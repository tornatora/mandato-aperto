(() => {
  let dialog;
  let table;
  let mode = "direct";
  let metricKey = "activity";
  let directSource = "";
  let internalRender = false;
  let observer;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const metrics = [
    { key: "activity", label: "Attività", higherBetter: true, value: (p) => 100 - inactivity(p), display: (p) => `≈ ${Math.round(100 - inactivity(p))}%` },
    { key: "participationPct", label: "Presenza", higherBetter: true, value: (p) => bandMid(p.metrics?.participationPct), display: (p) => metricText(p.metrics?.participationPct, "%") },
    { key: "billsFirstSigned", label: "Proposte", higherBetter: true, value: (p) => countRank(p.metrics?.billsFirstSigned), display: (p) => metricText(p.metrics?.billsFirstSigned) },
    { key: "oversightFirstSigned", label: "Controllo", higherBetter: true, value: (p) => countRank(p.metrics?.oversightFirstSigned), display: (p) => metricText(p.metrics?.oversightFirstSigned) },
    { key: "interventions", label: "Interventi", higherBetter: true, value: (p) => countRank(p.metrics?.interventions), display: (p) => metricText(p.metrics?.interventions) },
    { key: "cost", label: "Costo", higherBetter: false, value: (p) => inactivityCost(p), display: (p) => `≈ ${euro.format(inactivityCost(p))}/mese` }
  ];

  function countRank(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (!text || text === "n/d" || text === "0") return 0;
    if (text.includes("oltre")) return 4;
    if (/^1[–-]5$/.test(text)) return 1;
    if (/^6[–-]20$/.test(text)) return 2;
    if (/^21[–-]100$/.test(text)) return 3;
    const bounds = bandBounds(text);
    if (bounds) return bounds[1] <= 5 ? 1 : bounds[1] <= 20 ? 2 : 3;
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric <= 5 ? 1 : numeric <= 20 ? 2 : numeric <= 100 ? 3 : 4;
  }

  function selectedPeople() {
    return state.compare.map(politicianById).filter(Boolean).slice(0, 2);
  }

  function metricDef() {
    return metrics.find((item) => item.key === metricKey) ?? metrics[0];
  }

  function comparablePopulation(person, scope) {
    if (scope === "area" && person?.politicalArea) {
      const area = state.politicians.filter((p) => p.politicalArea === person.politicalArea);
      if (area.length >= 5) return area;
    }
    return state.politicians;
  }

  function percentile(person, def, scope = "camera") {
    const population = comparablePopulation(person, scope);
    const current = def.value(person);
    const values = population.map(def.value).filter(Number.isFinite);
    if (!values.length || !Number.isFinite(current)) return 0;
    const betterOrEqual = def.higherBetter
      ? values.filter((value) => value <= current).length
      : values.filter((value) => value >= current).length;
    return Math.max(0, Math.min(100, Math.round((betterOrEqual / values.length) * 100)));
  }

  function averageRaw(def, population) {
    const values = population.map(def.value).filter(Number.isFinite);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function benchmarkPercentile(person, def, scope) {
    return percentile(person, def, scope);
  }

  function winnerForMetric(left, right, def) {
    const lv = def.value(left);
    const rv = def.value(right);
    if (!Number.isFinite(lv) || !Number.isFinite(rv) || lv === rv) return "tie";
    if (def.higherBetter) return lv > rv ? "left" : "right";
    return lv < rv ? "left" : "right";
  }

  function scorecard(left, right) {
    const core = metrics.filter((item) => item.key !== "cost");
    let leftWins = 0;
    let rightWins = 0;
    core.forEach((def) => {
      const winner = winnerForMetric(left, right, def);
      if (winner === "left") leftWins += 1;
      if (winner === "right") rightWins += 1;
    });
    if (leftWins === rightWins) return { leftWins, rightWins, label: "Confronto equilibrato" };
    const winner = leftWins > rightWins ? left : right;
    return { leftWins, rightWins, label: `${winner.name} prevale su più indicatori` };
  }

  function ensureChrome() {
    const modal = q(".compare-modal", dialog);
    const header = q(".dialog-header", modal);
    if (!modal || !header) return;

    if (!q("#compare-mode-tabs", modal)) {
      const tabs = document.createElement("div");
      tabs.className = "compare-mode-tabs";
      tabs.id = "compare-mode-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Modalità confronto");
      tabs.innerHTML = `
        <button class="active" type="button" data-compare-mode="direct">Diretto</button>
        <button type="button" data-compare-mode="camera">Camera</button>
        <button type="button" data-compare-mode="area">Area</button>`;
      header.insertAdjacentElement("afterend", tabs);
      tabs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-compare-mode]");
        if (!button) return;
        mode = button.dataset.compareMode;
        qa("[data-compare-mode]", tabs).forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    }
  }

  function metricTabs() {
    return `<div class="compare-metric-tabs" role="tablist" aria-label="Indicatore da confrontare">
      ${metrics.map((item) => `<button type="button" data-compare-metric="${item.key}" class="${item.key === metricKey ? "active" : ""}">${item.label}</button>`).join("")}
    </div>`;
  }

  function personBadge(person, side, score) {
    const area = person.politicalArea ? `<span>${escapeHtml(person.politicalArea)}</span>` : "";
    return `<div class="compare-person-mini ${side}">
      <div><small>Profilo ${side === "left" ? "A" : "B"}</small><strong>${escapeHtml(person.name)}</strong>${area}</div>
      <b>${score}%<small>percentile</small></b>
    </div>`;
  }

  function directView(left, right, def) {
    const leftPct = percentile(left, def, "camera");
    const rightPct = percentile(right, def, "camera");
    const winner = winnerForMetric(left, right, def);
    const card = scorecard(left, right);
    const leftActivity = Math.round(100 - inactivity(left));
    const rightActivity = Math.round(100 - inactivity(right));
    const winnerLabel = winner === "tie" ? "Stesso livello nella fascia pubblica" : winner === "left" ? `${left.name} è avanti` : `${right.name} è avanti`;

    return `${metricTabs()}
      <div class="compare-summary-line">
        <span><strong>${card.leftWins}</strong> indicatori A</span>
        <b>${escapeHtml(card.label)}</b>
        <span><strong>${card.rightWins}</strong> indicatori B</span>
      </div>
      <div class="compare-focus-head">
        ${personBadge(left, "left", leftPct)}
        <div class="compare-focus-title"><span>${def.label}</span><strong>${escapeHtml(winnerLabel)}</strong></div>
        ${personBadge(right, "right", rightPct)}
      </div>
      <div class="compare-duel-live">
        <div class="duel-live-value left"><strong>${escapeHtml(def.display(left))}</strong><span>${leftPct}° percentile Camera</span></div>
        <div class="duel-live-track" aria-label="Confronto percentile ${def.label}">
          <i class="left"><b style="--w:${leftPct}%"></b></i>
          <span></span>
          <i class="right"><b style="--w:${rightPct}%"></b></i>
        </div>
        <div class="duel-live-value right"><strong>${escapeHtml(def.display(right))}</strong><span>${rightPct}° percentile Camera</span></div>
      </div>
      <div class="compare-context-strip">
        <span>Attività complessiva <strong>${leftActivity}%</strong> vs <strong>${rightActivity}%</strong></span>
        <span>Costo equivalente <strong>${euro.format(inactivityCost(left))}</strong> vs <strong>${euro.format(inactivityCost(right))}</strong></span>
      </div>`;
  }

  function benchmarkCard(person, def, scope) {
    const population = comparablePopulation(person, scope);
    const pct = benchmarkPercentile(person, def, scope);
    const chamberPct = percentile(person, def, "camera");
    const label = scope === "area" && person.politicalArea ? person.politicalArea : "Camera";
    const average = averageRaw(def, population);
    const raw = def.value(person);
    let relation = "in linea con";
    if (Number.isFinite(raw) && Number.isFinite(average)) {
      if (def.higherBetter) relation = raw > average ? "sopra" : raw < average ? "sotto" : "in linea con";
      else relation = raw < average ? "meglio della" : raw > average ? "peggio della" : "in linea con";
    }
    return `<article class="benchmark-card">
      <div class="benchmark-card-head"><span>${escapeHtml(person.name)}</span><strong>${escapeHtml(def.display(person))}</strong></div>
      <div class="benchmark-meter"><i style="--w:${pct}%"></i><span style="--x:${pct}%"></span></div>
      <div class="benchmark-copy"><strong>${pct}° percentile</strong><span>${relation} media ${escapeHtml(label)}</span></div>
      <div class="benchmark-foot"><span>Camera</span><strong>${chamberPct}° percentile</strong></div>
    </article>`;
  }

  function benchmarkView(left, right, def, scope) {
    const title = scope === "area" ? "Contro la propria macro-area" : "Contro tutta la Camera";
    const subtitle = scope === "area"
      ? "Ogni profilo viene confrontato con i politici della stessa macro-area."
      : "Percentile calcolato sulle fasce pubbliche anonime di tutti i profili.";
    return `${metricTabs()}
      <div class="benchmark-title"><strong>${title}</strong><span>${subtitle}</span></div>
      <div class="benchmark-grid">
        ${benchmarkCard(left, def, scope)}
        ${benchmarkCard(right, def, scope)}
      </div>
      <p class="compare-disclosure">I percentili sono confronti ordinali costruiti sulle fasce pubbliche, non valori puntuali nascosti.</p>`;
  }

  function render() {
    const [left, right] = selectedPeople();
    if (!table || !left || !right) return;
    const def = metricDef();
    internalRender = true;
    table.innerHTML = `<div class="compare-enhanced-view" data-mode="${mode}">
      ${mode === "direct" ? directView(left, right, def) : benchmarkView(left, right, def, mode)}
    </div>`;
    internalRender = false;
    bindMetricTabs();
  }

  function bindMetricTabs() {
    qa("[data-compare-metric]", table).forEach((button) => {
      button.addEventListener("click", () => {
        metricKey = button.dataset.compareMetric;
        render();
      });
    });
  }

  function captureAndRender() {
    if (internalRender || !table) return;
    const html = table.innerHTML.trim();
    if (!html || html.includes("compare-enhanced-view")) return;
    directSource = html;
    ensureChrome();
    render();
  }

  function boot() {
    dialog = q("#compare-dialog");
    table = q("#compare-table");
    if (!dialog || !table || typeof state === "undefined") return;
    ensureChrome();
    observer = new MutationObserver(captureAndRender);
    observer.observe(table, { childList: true, subtree: true });
    dialog.addEventListener("close", () => { mode = "direct"; metricKey = "activity"; qa("[data-compare-mode]", dialog).forEach((button) => button.classList.toggle("active", button.dataset.compareMode === "direct")); });
    if (table.innerHTML.trim()) captureAndRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
