(() => {
  let dialog;
  let table;
  let mode = "direct";
  let metricKey = "activity";
  let internalRender = false;
  let observer;
  let probe = null;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

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

  function percentileInPopulation(person, def, population) {
    const current = def.value(person);
    const values = population.map(def.value).filter(Number.isFinite);
    if (!values.length || !Number.isFinite(current)) return 0;
    const betterOrEqual = def.higherBetter
      ? values.filter((value) => value <= current).length
      : values.filter((value) => value >= current).length;
    return clamp(Math.round((betterOrEqual / values.length) * 100));
  }

  function percentile(person, def, scope = "camera") {
    return percentileInPopulation(person, def, comparablePopulation(person, scope));
  }

  function averageRaw(def, population) {
    const values = population.map(def.value).filter(Number.isFinite);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
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
        probe = null;
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
    return `<button class="compare-person-mini ${side}" type="button" data-probe-person="${side}">
      <div><small>Profilo ${side === "left" ? "A" : "B"}</small><strong>${escapeHtml(person.name)}</strong>${area}</div>
      <b>${score}%<small>percentile</small></b>
    </button>`;
  }

  function distributionBins(population, def) {
    const bins = Array.from({ length: 10 }, () => 0);
    population.forEach((person) => {
      const pct = percentileInPopulation(person, def, population);
      const index = Math.min(9, Math.max(0, Math.ceil(Math.max(1, pct) / 10) - 1));
      bins[index] += 1;
    });
    return bins;
  }

  function bandLabel(index) {
    const start = index * 10 + 1;
    const end = (index + 1) * 10;
    return index === 0 ? "0–10" : `${start}–${end}`;
  }

  function distributionBars(population, def, dataset, activeBin = null) {
    const bins = distributionBins(population, def);
    const max = Math.max(...bins, 1);
    return bins.map((count, index) => {
      const height = Math.max(8, Math.round((count / max) * 100));
      return `<button class="distribution-bin ${activeBin === index ? "active" : ""}" type="button"
        data-${dataset}-bin="${index}" style="--h:${height}%"
        aria-label="Percentile ${bandLabel(index)}: ${count} profili"
        title="${bandLabel(index)} percentile · ${count} profili">
        <i></i><span>${count}</span>
      </button>`;
    }).join("");
  }

  function directProbeCopy(left, right, def, leftPct, rightPct) {
    if (probe?.type === "person") {
      const person = probe.side === "left" ? left : right;
      const pct = probe.side === "left" ? leftPct : rightPct;
      const distance = Math.abs(pct - 50);
      const direction = pct >= 50 ? "sopra" : "sotto";
      return `<strong>${escapeHtml(person.name)}</strong> · ${escapeHtml(def.display(person))} · ${pct}° percentile, circa ${distance} punti ${direction} la mediana Camera.`;
    }
    if (probe?.type === "direct-bin") {
      const population = state.politicians;
      const bins = distributionBins(population, def);
      const count = bins[probe.index] ?? 0;
      const share = population.length ? Math.round((count / population.length) * 100) : 0;
      return `<strong>Fascia ${bandLabel(probe.index)}° percentile</strong> · ${nf.format(count)} profili, circa ${share}% della Camera.`;
    }
    const delta = Math.abs(leftPct - rightPct);
    return `<strong>Distanza tra A e B:</strong> ${delta} punti percentile. Tocca un marker o una colonna per leggere il dettaglio.`;
  }

  function sharedDistribution(left, right, def) {
    const population = state.politicians;
    const leftPct = percentileInPopulation(left, def, population);
    const rightPct = percentileInPopulation(right, def, population);
    const activeBin = probe?.type === "direct-bin" ? probe.index : null;
    return `<div class="shared-distribution">
      <div class="distribution-axis"><span>0</span><span>Percentile Camera</span><span>100</span></div>
      <div class="distribution-stage">
        <div class="distribution-bars">${distributionBars(population, def, "direct", activeBin)}</div>
        <button class="distribution-marker marker-a ${probe?.type === "person" && probe.side === "left" ? "active" : ""}" type="button"
          data-probe-person="left" style="--x:${leftPct}%"><span>A</span><small>${leftPct}</small></button>
        <button class="distribution-marker marker-b ${probe?.type === "person" && probe.side === "right" ? "active" : ""}" type="button"
          data-probe-person="right" style="--x:${rightPct}%"><span>B</span><small>${rightPct}</small></button>
        <i class="distribution-median"></i>
      </div>
      <div class="distribution-readout">${directProbeCopy(left, right, def, leftPct, rightPct)}</div>
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
      <div class="compare-values-row">
        <span><small>A</small><strong>${escapeHtml(def.display(left))}</strong></span>
        <span><small>B</small><strong>${escapeHtml(def.display(right))}</strong></span>
      </div>
      ${sharedDistribution(left, right, def)}
      <div class="compare-context-strip">
        <span>Attività complessiva <strong>${leftActivity}%</strong> vs <strong>${rightActivity}%</strong></span>
        <span>Costo equivalente <strong>${euro.format(inactivityCost(left))}</strong> vs <strong>${euro.format(inactivityCost(right))}</strong></span>
      </div>`;
  }

  function benchmarkProbeCopy(person, side, def, scope, population, pct) {
    if (probe?.side !== side) {
      return `Tocca una colonna o il marker ${side === "left" ? "A" : "B"} per esplorare la distribuzione.`;
    }
    if (probe.type === "marker") {
      const average = averageRaw(def, population);
      const raw = def.value(person);
      let relation = "in linea con";
      if (Number.isFinite(raw) && Number.isFinite(average)) {
        if (def.higherBetter) relation = raw > average ? "sopra" : raw < average ? "sotto" : "in linea con";
        else relation = raw < average ? "meglio della" : raw > average ? "peggio della" : "in linea con";
      }
      return `<strong>${escapeHtml(person.name)}</strong> · ${pct}° percentile · ${relation} media del benchmark.`;
    }
    if (probe.type === "benchmark-bin") {
      const bins = distributionBins(population, def);
      const count = bins[probe.index] ?? 0;
      const share = population.length ? Math.round((count / population.length) * 100) : 0;
      return `<strong>${bandLabel(probe.index)}° percentile</strong> · ${nf.format(count)} profili (${share}%).`;
    }
    return "";
  }

  function benchmarkDistribution(person, side, def, scope) {
    const population = comparablePopulation(person, scope);
    const pct = percentileInPopulation(person, def, population);
    const activeBin = probe?.type === "benchmark-bin" && probe.side === side ? probe.index : null;
    return `<div class="benchmark-distribution">
      <div class="benchmark-distribution-head"><span>${scope === "area" ? escapeHtml(person.politicalArea || "Area") : "Camera"}</span><strong>${nf.format(population.length)} profili</strong></div>
      <div class="distribution-stage compact">
        <div class="distribution-bars">${distributionBars(population, def, `benchmark-${side}`, activeBin)}</div>
        <button class="distribution-marker ${side === "left" ? "marker-a" : "marker-b"} ${probe?.type === "marker" && probe.side === side ? "active" : ""}" type="button"
          data-benchmark-marker="${side}" style="--x:${pct}%"><span>${side === "left" ? "A" : "B"}</span><small>${pct}</small></button>
        <i class="distribution-median"></i>
      </div>
      <div class="benchmark-probe">${benchmarkProbeCopy(person, side, def, scope, population, pct)}</div>
    </div>`;
  }

  function benchmarkCard(person, side, def, scope) {
    const population = comparablePopulation(person, scope);
    const pct = percentileInPopulation(person, def, population);
    const chamberPct = percentile(person, def, "camera");
    const label = scope === "area" && person.politicalArea ? person.politicalArea : "Camera";
    const average = averageRaw(def, population);
    const raw = def.value(person);
    let relation = "in linea con";
    if (Number.isFinite(raw) && Number.isFinite(average)) {
      if (def.higherBetter) relation = raw > average ? "sopra" : raw < average ? "sotto" : "in linea con";
      else relation = raw < average ? "meglio della" : raw > average ? "peggio della" : "in linea con";
    }
    return `<article class="benchmark-card ${side}">
      <div class="benchmark-card-head"><span>${escapeHtml(person.name)}</span><strong>${escapeHtml(def.display(person))}</strong></div>
      <div class="benchmark-copy"><strong>${pct}° percentile</strong><span>${relation} media ${escapeHtml(label)}</span></div>
      ${benchmarkDistribution(person, side, def, scope)}
      <div class="benchmark-foot"><span>Camera</span><strong>${chamberPct}° percentile</strong></div>
    </article>`;
  }

  function benchmarkView(left, right, def, scope) {
    const title = scope === "area" ? "Contro la propria macro-area" : "Contro tutta la Camera";
    const subtitle = scope === "area"
      ? "Ogni profilo ha la propria distribuzione di riferimento. Tocca direttamente colonne e marker."
      : "I due profili sono posizionati dentro la distribuzione dei 399. La grafica è interattiva.";
    return `${metricTabs()}
      <div class="benchmark-title"><strong>${title}</strong><span>${subtitle}</span></div>
      <div class="benchmark-grid">
        ${benchmarkCard(left, "left", def, scope)}
        ${benchmarkCard(right, "right", def, scope)}
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
  }

  function handleTableClick(event) {
    const metric = event.target.closest("[data-compare-metric]");
    if (metric) {
      metricKey = metric.dataset.compareMetric;
      probe = null;
      render();
      return;
    }

    const person = event.target.closest("[data-probe-person]");
    if (person) {
      probe = { type: "person", side: person.dataset.probePerson };
      render();
      return;
    }

    const directBin = event.target.closest("[data-direct-bin]");
    if (directBin) {
      probe = { type: "direct-bin", index: Number(directBin.dataset.directBin) };
      render();
      return;
    }

    const benchmarkMarker = event.target.closest("[data-benchmark-marker]");
    if (benchmarkMarker) {
      probe = { type: "marker", side: benchmarkMarker.dataset.benchmarkMarker };
      render();
      return;
    }

    const leftBin = event.target.closest("[data-benchmark-left-bin]");
    if (leftBin) {
      probe = { type: "benchmark-bin", side: "left", index: Number(leftBin.dataset.benchmarkLeftBin) };
      render();
      return;
    }

    const rightBin = event.target.closest("[data-benchmark-right-bin]");
    if (rightBin) {
      probe = { type: "benchmark-bin", side: "right", index: Number(rightBin.dataset.benchmarkRightBin) };
      render();
    }
  }

  function captureAndRender() {
    if (internalRender || !table) return;
    const html = table.innerHTML.trim();
    if (!html || html.includes("compare-enhanced-view")) return;
    ensureChrome();
    probe = null;
    render();
  }

  function boot() {
    dialog = q("#compare-dialog");
    table = q("#compare-table");
    if (!dialog || !table || typeof state === "undefined") return;
    ensureChrome();
    table.addEventListener("click", handleTableClick);
    observer = new MutationObserver(captureAndRender);
    observer.observe(table, { childList: true, subtree: true });
    dialog.addEventListener("close", () => {
      mode = "direct";
      metricKey = "activity";
      probe = null;
      qa("[data-compare-mode]", dialog).forEach((button) => button.classList.toggle("active", button.dataset.compareMode === "direct"));
    });
    if (table.innerHTML.trim()) captureAndRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
