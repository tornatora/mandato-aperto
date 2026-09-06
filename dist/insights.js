(() => {
  let panel;
  let toggle;
  let body;
  let summary;
  let activeView = "map";
  let selectedMetric = "participationPct";
  let mapScope = "all";
  let compareFromMap = false;
  let mapCompare = [];
  let highlightId = null;
  let attempts = 0;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const mean = (items, reader) => items.length ? items.reduce((sum, item) => sum + reader(item), 0) / items.length : 0;
  const sum = (items, reader) => items.reduce((total, item) => total + reader(item), 0);
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

  function hasDocumentedActivity(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (!text || text === "n/d" || text === "0") return false;
    const bounds = bandBounds(text);
    return bounds ? bounds[1] > 0 : /\d/.test(text) || text.includes("oltre");
  }

  function filteredPeople() {
    return Array.isArray(state.filtered) ? state.filtered : [];
  }

  function areaComparisonSource() {
    const query = normalize(el.search.value.trim());
    return state.politicians.filter((person) => {
      const haystack = normalize(`${person.name} ${person.id} ${person.politicalArea ?? ""}`);
      return matchesBand(person) && (!query || haystack.includes(query));
    });
  }

  function initiativeScore(person) {
    const bills = metricScore(person.metrics?.billsFirstSigned, "count");
    const oversight = metricScore(person.metrics?.oversightFirstSigned, "count");
    const interventions = metricScore(person.metrics?.interventions, "count");
    return clamp(bills * .35 + oversight * .30 + interventions * .35);
  }

  function deterministicJitter(id, axis) {
    const text = `${id}-${axis}`;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return ((Math.abs(hash) % 1000) / 1000 - .5) * 4.8;
  }

  function percentileCopy(person) {
    const current = inactivity(person);
    const population = state.politicians.filter((p) => Number.isFinite(inactivity(p)));
    const area = population.filter((p) => p.politicalArea === person.politicalArea);
    const overallBetterThan = population.length
      ? Math.round(population.filter((p) => inactivity(p) > current).length / population.length * 100)
      : 0;
    const areaBetterThan = area.length
      ? Math.round(area.filter((p) => inactivity(p) > current).length / area.length * 100)
      : 0;
    return { overallBetterThan, areaBetterThan, areaCount: area.length };
  }

  function mount() {
    const map = q(".activity-map");
    const mapHead = q(".map-head", map);
    if (!map || !mapHead || q("#analysis-panel")) return;

    const hint = [...mapHead.children].find((node) => node.tagName === "SPAN");
    const actions = document.createElement("div");
    actions.className = "map-actions";
    if (hint) {
      hint.classList.add("map-hint");
      actions.append(hint);
    }

    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "analysis-toggle";
    toggle.id = "analysis-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "Analizza <span>↗</span>";
    actions.append(toggle);
    mapHead.append(actions);

    panel = document.createElement("section");
    panel.className = "analysis-panel";
    panel.id = "analysis-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="analysis-shell">
        <div class="analysis-head">
          <div class="analysis-title">
            <span>Analisi interattiva</span>
            <strong>Cosa mostrano i dati?</strong>
            <small>Un solo livello alla volta. I grafici reagiscono ai filtri della pagina.</small>
          </div>
          <button class="analysis-close" type="button" aria-label="Chiudi analisi">×</button>
        </div>
        <div class="analysis-summary" id="analysis-summary"></div>
        <div class="analysis-tabs" role="tablist" aria-label="Tipo di analisi">
          <button class="analysis-tab active" type="button" data-analysis-view="map">Mappa</button>
          <button class="analysis-tab" type="button" data-analysis-view="activity">Attività</button>
          <button class="analysis-tab" type="button" data-analysis-view="areas">Aree</button>
          <button class="analysis-tab" type="button" data-analysis-view="cost">Costo</button>
        </div>
        <div class="analysis-view" id="analysis-view"></div>
        <p class="analysis-note">Le visualizzazioni usano esclusivamente fasce pubbliche anonime. Percentili e posizioni sono approssimativi perché calcolati sui punti medi delle fasce.</p>
      </div>`;
    map.insertAdjacentElement("afterend", panel);

    body = q("#analysis-view", panel);
    summary = q("#analysis-summary", panel);

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    q(".analysis-close", panel).addEventListener("click", () => setOpen(false));
    q(".analysis-tabs", panel).addEventListener("click", (event) => {
      const button = event.target.closest("[data-analysis-view]");
      if (!button) return;
      activeView = button.dataset.analysisView;
      qa(".analysis-tab", panel).forEach((tab) => tab.classList.toggle("active", tab === button));
      renderBody();
    });

    body.addEventListener("click", handleChartClick);
    bindProfileEnhancement();
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      renderAll();
      if (window.matchMedia("(max-width: 640px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderSummary() {
    const people = filteredPeople();
    const avgInactivity = mean(people, inactivity);
    const avgPresence = mean(people, (person) => metricScore(person.metrics?.participationPct, "participation"));
    const avgCost = people.length ? sum(people, inactivityCost) / people.length : 0;
    summary.innerHTML = `
      <span>Profili<strong>${nf.format(people.length)}</strong></span>
      <span>Inattività media<strong>≈ ${Math.round(avgInactivity)}%</strong></span>
      <span>Presenza media<strong>≈ ${Math.round(avgPresence)}%</strong></span>
      <span>Quota equivalente media<strong>≈ ${euro.format(avgCost)}/mese</strong></span>`;
  }

  function mapDot(person, activeIds) {
    const presence = metricScore(person.metrics?.participationPct, "participation");
    const initiative = initiativeScore(person);
    const x = clamp(presence + deterministicJitter(person.id, "x"), 2, 98);
    const y = clamp(initiative + deterministicJitter(person.id, "y"), 2, 98);
    const active = activeIds.has(String(person.id));
    const selected = mapCompare.includes(String(person.id));
    const highlighted = highlightId === String(person.id);
    return `<button
      class="parliament-dot ${active ? "is-active" : "is-muted"} ${selected ? "is-selected" : ""} ${highlighted ? "is-highlighted" : ""}"
      type="button"
      style="--x:${x.toFixed(2)}%;--y:${(100 - y).toFixed(2)}%"
      data-map-profile="${escapeHtml(person.id)}"
      aria-label="${escapeHtml(person.name)}: presenza circa ${Math.round(presence)}%, iniziativa circa ${Math.round(initiative)}%"
      title="${escapeHtml(person.name)} · presenza ≈ ${Math.round(presence)}% · iniziativa ≈ ${Math.round(initiative)}%">
      <span></span>
    </button>`;
  }

  function renderMap() {
    const filteredIds = new Set(filteredPeople().map((p) => String(p.id)));
    const source = mapScope === "filtered" ? state.politicians.filter((p) => filteredIds.has(String(p.id))) : state.politicians;
    const dots = source.map((person) => mapDot(person, filteredIds)).join("");
    const selectedCopy = compareFromMap
      ? mapCompare.length
        ? `${mapCompare.length}/2 selezionati`
        : "Seleziona il primo profilo"
      : "Clicca un punto per aprire il profilo";

    body.innerHTML = `
      <div class="analysis-view-head map-view-head">
        <div>
          <strong>Mappa dei ${nf.format(state.politicians.length)}</strong>
          <span>Presenza sull’asse orizzontale · iniziativa documentata sull’asse verticale.</span>
        </div>
        <div class="map-toolbar">
          <button class="map-tool ${mapScope === "filtered" ? "active" : ""}" type="button" data-map-scope>
            ${mapScope === "filtered" ? "Solo filtro" : "Tutti i 399"}
          </button>
          <button class="map-tool ${compareFromMap ? "active" : ""}" type="button" data-map-compare>Confronta</button>
        </div>
      </div>
      <div class="parliament-map-wrap">
        <div class="parliament-axis axis-y"><span>Più iniziativa</span><span>Meno iniziativa</span></div>
        <div class="parliament-map" id="parliament-map">
          <i class="axis-line axis-line-x"></i>
          <i class="axis-line axis-line-y"></i>
          <span class="axis-label label-left">Meno presenza</span>
          <span class="axis-label label-right">Più presenza</span>
          ${dots}
        </div>
      </div>
      <div class="map-readout">
        <span>${selectedCopy}</span>
        <small>${mapScope === "all" ? "I punti attenuati sono fuori dai filtri attuali." : "Sono visibili solo i profili del filtro corrente."} I punti sono leggermente distanziati per evitare sovrapposizioni.</small>
      </div>`;
  }

  function activityStats(people, def) {
    if (def.type === "participation") {
      const value = mean(people, (person) => metricScore(person.metrics?.[def.key], def.type));
      return { value, label: `≈ ${Math.round(value)}%`, detail: `Presenza media stimata sui ${nf.format(people.length)} profili attualmente selezionati.` };
    }
    const active = people.filter((person) => hasDocumentedActivity(person.metrics?.[def.key])).length;
    const value = people.length ? active / people.length * 100 : 0;
    return { value, label: `${Math.round(value)}%`, detail: `${nf.format(active)} su ${nf.format(people.length)} profili mostrano almeno un’attività documentata in questa voce.` };
  }

  function renderActivity() {
    const people = filteredPeople();
    const rows = metricDefs.map((def) => {
      const stats = activityStats(people, def);
      return `<button class="insight-row" type="button" data-metric-key="${def.key}">
        <span>${def.short}</span>
        <i class="insight-track"><i style="--w:${clamp(stats.value)}%"></i></i>
        <span class="insight-value"><strong>${stats.label}</strong></span>
      </button>`;
    }).join("");
    const chosen = metricDefs.find((def) => def.key === selectedMetric) ?? metricDefs[0];
    const detail = activityStats(people, chosen);
    body.innerHTML = `
      <div class="analysis-view-head"><div><strong>Attività documentata</strong><span>Tocca un indicatore per leggerlo in parole semplici.</span></div></div>
      <div class="insight-chart">${rows}</div>
      <div class="insight-detail"><strong>${chosen.label}.</strong> ${detail.detail}</div>`;
  }

  function renderAreas() {
    const source = areaComparisonSource();
    const areas = ["Centrodestra", "Centrosinistra", "Centro", "Altro / non classificato"];
    const rows = areas.map((area) => {
      const people = source.filter((person) => person.politicalArea === area);
      if (!people.length) return "";
      const avg = mean(people, inactivity);
      return `<button class="area-analysis-row" type="button" data-area-target="${area}">
        <span>${area === "Altro / non classificato" ? "Altro" : area}</span>
        <i class="insight-track"><i style="--w:${clamp(avg)}%"></i></i>
        <span class="insight-value"><strong>≈ ${Math.round(avg)}%</strong> · ${nf.format(people.length)}</span>
      </button>`;
    }).join("");
    body.innerHTML = `
      <div class="analysis-view-head"><div><strong>Inattività media per macro-area</strong><span>Il confronto rispetta gli altri filtri attivi. Tocca una barra per filtrare.</span></div><button class="analysis-reset" type="button" data-analysis-reset>Azzera filtri</button></div>
      <div class="insight-chart">${rows || "<div class=\"insight-detail\">Nessun dato disponibile con questi filtri.</div>"}</div>`;
  }

  function renderCost() {
    const people = filteredPeople();
    const total = sum(people, inactivityCost);
    const average = people.length ? total / people.length : 0;
    const groups = [
      { key: "low", label: "Inattività bassa" },
      { key: "medium", label: "Inattività media" },
      { key: "high", label: "Inattività alta" }
    ];
    const rows = groups.map((group) => {
      const groupPeople = people.filter((person) => categoryFor(person) === group.key);
      const value = sum(groupPeople, inactivityCost);
      const share = total ? value / total * 100 : 0;
      return `<button class="cost-band-row" type="button" data-band-target="${group.key}">
        <span>${group.label}</span>
        <i class="insight-track"><i style="--w:${clamp(share)}%"></i></i>
        <span class="insight-value"><strong>${euro.format(value)}</strong></span>
      </button>`;
    }).join("");
    body.innerHTML = `
      <div class="analysis-cost-total"><div><span>Quota equivalente complessiva / mese</span><strong>≈ ${euro.format(total)}</strong></div><small>Media per profilo: ≈ ${euro.format(average)}/mese. È una stima comparativa applicata alle fasce di inattività, non una voce di spesa aggiuntiva.</small></div>
      <div class="analysis-view-head"><div><strong>Dove si concentra la stima</strong><span>Tocca una fascia per filtrare i profili.</span></div></div>
      <div class="insight-chart">${rows}</div>`;
  }

  function renderBody() {
    if (!body) return;
    if (activeView === "activity") renderActivity();
    else if (activeView === "areas") renderAreas();
    else if (activeView === "cost") renderCost();
    else renderMap();
  }

  function renderAll() {
    if (!panel) return;
    renderSummary();
    renderBody();
    if (state.activeProfile) enhanceOpenProfile(state.activeProfile);
  }

  function handleMapProfile(id) {
    const person = politicianById(id);
    if (!person) return;
    if (!compareFromMap) {
      highlightId = String(id);
      openProfile(id);
      requestAnimationFrame(() => enhanceOpenProfile(person));
      return;
    }

    const key = String(id);
    if (mapCompare.includes(key)) mapCompare = mapCompare.filter((item) => item !== key);
    else if (mapCompare.length < 2) mapCompare.push(key);

    if (mapCompare.length === 2) {
      state.compare = [...mapCompare];
      updateCompareBar();
      openComparison();
      compareFromMap = false;
      mapCompare = [];
    }
    renderMap();
  }

  function handleChartClick(event) {
    const profile = event.target.closest("[data-map-profile]");
    if (profile) {
      handleMapProfile(profile.dataset.mapProfile);
      return;
    }

    if (event.target.closest("[data-map-scope]")) {
      mapScope = mapScope === "all" ? "filtered" : "all";
      renderMap();
      return;
    }

    if (event.target.closest("[data-map-compare]")) {
      compareFromMap = !compareFromMap;
      mapCompare = [];
      renderMap();
      return;
    }

    const metric = event.target.closest("[data-metric-key]");
    if (metric) {
      selectedMetric = metric.dataset.metricKey;
      renderActivity();
      return;
    }

    const areaRow = event.target.closest("[data-area-target]");
    if (areaRow) {
      const target = qa("[data-area]").find((button) => button.dataset.area === areaRow.dataset.areaTarget);
      target?.click();
      requestAnimationFrame(renderAll);
      return;
    }

    const bandRow = event.target.closest("[data-band-target]");
    if (bandRow) {
      q(`[data-band="${bandRow.dataset.bandTarget}"]`)?.click();
      requestAnimationFrame(renderAll);
      return;
    }

    if (event.target.closest("[data-analysis-reset]")) {
      q("#reset-filters")?.click();
      requestAnimationFrame(renderAll);
    }
  }

  function enhanceOpenProfile(person) {
    const drawer = q("#profile-dialog .drawer");
    if (!drawer || !person) return;
    let block = q("#profile-positioning", drawer);
    if (!block) {
      block = document.createElement("section");
      block.id = "profile-positioning";
      block.className = "profile-positioning";
      const metrics = q("#profile-metrics", drawer);
      metrics?.insertAdjacentElement("afterend", block);
    }

    const pct = percentileCopy(person);
    block.innerHTML = `
      <div class="positioning-head">
        <div><span>Posizionamento</span><strong>Più attivo di circa ${pct.overallBetterThan}% dei profili</strong></div>
        <button type="button" data-see-on-map="${escapeHtml(person.id)}">Vedi sulla mappa ↗</button>
      </div>
      <div class="percentile-track" aria-label="Percentile di attività approssimativo"><i style="--w:${pct.overallBetterThan}%"></i><b style="--x:${pct.overallBetterThan}%"></b></div>
      <div class="positioning-meta">
        <span>Camera <strong>≈ ${pct.overallBetterThan}° percentile</strong></span>
        <span>${escapeHtml(person.politicalArea || "Macro-area")} <strong>≈ ${pct.areaBetterThan}° percentile</strong></span>
      </div>
      <small>Stima basata sulle fasce pubbliche anonime, non su valori puntuali.</small>`;
  }

  function showOnMap(id) {
    highlightId = String(id);
    activeView = "map";
    qa(".analysis-tab", panel).forEach((tab) => tab.classList.toggle("active", tab.dataset.analysisView === "map"));
    setOpen(true);
    renderMap();
    q("#profile-dialog")?.close();
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => q(`[data-map-profile="${CSS.escape(String(id))}"]`, panel)?.focus({ preventScroll: true }), 350);
  }

  function bindProfileEnhancement() {
    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-open-profile]");
      if (opener) {
        const person = politicianById(opener.dataset.openProfile);
        if (person) requestAnimationFrame(() => enhanceOpenProfile(person));
      }

      const mapButton = event.target.closest("[data-see-on-map]");
      if (mapButton) {
        event.preventDefault();
        showOnMap(mapButton.dataset.seeOnMap);
      }
    });
  }

  function bindLiveUpdates() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-band], [data-area], #reset-filters, .hist-bar")) requestAnimationFrame(renderAll);
    });
    q("#search-input")?.addEventListener("input", () => requestAnimationFrame(renderAll));
    q("#sort-filter")?.addEventListener("change", () => requestAnimationFrame(renderAll));
  }

  function boot() {
    attempts += 1;
    if (typeof state === "undefined" || !Array.isArray(state.politicians) || !state.politicians.length) {
      if (attempts < 100) window.setTimeout(boot, 100);
      return;
    }
    mount();
    bindLiveUpdates();
    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();