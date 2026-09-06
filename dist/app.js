const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 24;
const BASE_MONTHLY_COST = 17628.11;
const AREAS = ["Centrodestra", "Centrosinistra", "Centro", "Altro / non classificato"];

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  activeBand: "all",
  activeArea: "all",
  view: "cards",
  meta: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const nf = new Intl.NumberFormat("it-IT");
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" });

const el = {
  search: $("#search-input"),
  sort: $("#sort-filter"),
  grid: $("#card-grid"),
  tableBody: $("#data-table-body"),
  count: $("#results-count"),
  empty: $("#empty-state"),
  reset: $("#reset-filters"),
  loadMore: $("#load-more"),
  histogram: $("#histogram"),
  areaChart: $("#area-chart"),
  metricOverview: $("#metric-overview"),
  compareBar: $("#compare-bar"),
  compareCount: $("#compare-count"),
  compareNames: $("#compare-names"),
  clearCompare: $("#clear-compare"),
  openCompare: $("#open-compare"),
  toast: $("#toast")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it-IT");
}

function bandBounds(value) {
  const text = String(value ?? "").trim();
  const single = text.match(/^(\d+)$/);
  if (single) return [Number(single[1]), Number(single[1])];
  const range = text.match(/^(\d+)[–-](\d+)$/);
  return range ? [Number(range[1]), Number(range[2])] : null;
}

function bandMid(value) {
  const bounds = bandBounds(value);
  return bounds ? (bounds[0] + bounds[1]) / 2 : null;
}

function average(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function inactivity(person) {
  return bandMid(person.inactivityBand) ?? 0;
}

function inactivityCost(person) {
  return BASE_MONTHLY_COST * inactivity(person) / 100;
}

function categoryFor(person) {
  const value = inactivity(person);
  if (value >= 60) return "high";
  if (value >= 35) return "medium";
  return "low";
}

function metricText(value, suffix = "") {
  if (value == null || value === "N/D") return "N/D";
  return `${value}${suffix}`;
}

function metricScore(value, type) {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text || text === "n/d") return 0;
  if (type === "participation") return Math.max(0, Math.min(100, ((bandMid(text) ?? Number(text)) || 0)));
  if (text === "0") return 4;
  if (text.includes("oltre")) return 96;
  const mid = bandMid(text);
  if (!Number.isFinite(mid)) return 0;
  if (mid <= 5) return 28;
  if (mid <= 20) return 52;
  if (mid <= 100) return 76;
  return 92;
}

const metricDefs = [
  { key: "participationPct", label: "Presenza alle votazioni", short: "Presenza", type: "participation", suffix: "%" },
  { key: "billsFirstSigned", label: "Proposte firmate per primo", short: "Leggi", type: "count", suffix: "" },
  { key: "oversightFirstSigned", label: "Atti di controllo", short: "Controllo", type: "count", suffix: "" },
  { key: "interventions", label: "Interventi registrati", short: "Interventi", type: "count", suffix: "" }
];

function politicianById(id) {
  return state.politicians.find((person) => String(person.id) === String(id));
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.toast.hidden = true; }, 2200);
}

function simpleLabel(person) {
  const value = inactivity(person);
  if (value >= 70) return "Attività documentata molto bassa";
  if (value >= 60) return "Attività documentata bassa";
  if (value >= 35) return "Attività nella fascia centrale";
  return "Attività documentata alta";
}

function areaBadge(person) {
  return person.politicalArea ? `<span class="area-badge">${escapeHtml(person.politicalArea)}</span>` : "";
}

function metricBar(def, person, compact = false) {
  const raw = person.metrics?.[def.key];
  const score = metricScore(raw, def.type);
  return `<div class="metric-bar ${compact ? "compact-metric" : ""}">
    <div><span>${escapeHtml(def.short)}</span><strong>${escapeHtml(metricText(raw, def.suffix))}</strong></div>
    <i><b style="--w:${score}%"></b></i>
  </div>`;
}

function cardTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  const score = Math.round(inactivity(person));
  return `<article class="profile-card" role="listitem" data-id="${escapeHtml(person.id)}">
    <div class="card-topline"><span>#${String(index + 1).padStart(2, "0")}</span>${areaBadge(person)}<button class="compare-add" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}" aria-label="${selected ? "Rimuovi dal" : "Aggiungi al"} confronto">${selected ? "✓" : "+"}</button></div>
    <button class="card-body" type="button" data-open-profile="${escapeHtml(person.id)}">
      <div class="card-title-row"><div><span class="micro">Profilo anonimo</span><h3>${escapeHtml(person.name)}</h3></div><div class="score-pill"><strong>${escapeHtml(person.inactivityBand ?? "N/D")}</strong><span>inattività</span></div></div>
      <div class="inactivity-line"><i><b style="--w:${score}%"></b></i><span>${escapeHtml(simpleLabel(person))}</span></div>
      <div class="card-metrics">${metricDefs.map((def) => metricBar(def, person, true)).join("")}</div>
      <div class="card-footer"><span>Quota equivalente</span><strong>≈ ${euro.format(inactivityCost(person))}<small>/mese</small></strong><em>Apri dettagli →</em></div>
    </button>
  </article>`;
}

function renderCards() {
  const shown = state.filtered.slice(0, state.visible);
  el.grid.innerHTML = shown.map((person, index) => cardTemplate(person, index)).join("");
  el.count.textContent = `${nf.format(state.filtered.length)} profili nel filtro corrente`;
  el.empty.hidden = state.filtered.length !== 0;
  el.loadMore.hidden = state.visible >= state.filtered.length;
  updateCompareBar();
}

function rowTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  return `<tr>
    <td><span class="table-rank">${String(index + 1).padStart(2, "0")}</span></td>
    <td><button class="table-profile" type="button" data-open-profile="${escapeHtml(person.id)}"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(simpleLabel(person))}</span></button></td>
    <td>${areaBadge(person)}</td>
    <td><div class="table-score"><strong>${escapeHtml(person.inactivityBand)}</strong><i><b style="--w:${Math.round(inactivity(person))}%"></b></i></div></td>
    <td>${escapeHtml(metricText(person.metrics?.participationPct, "%"))}</td>
    <td>${escapeHtml(metricText(person.metrics?.billsFirstSigned))}</td>
    <td>${escapeHtml(metricText(person.metrics?.oversightFirstSigned))}</td>
    <td>${escapeHtml(metricText(person.metrics?.interventions))}</td>
    <td><strong class="money-cell">≈ ${euro.format(inactivityCost(person))}</strong></td>
    <td><button class="table-action" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}">${selected ? "✓" : "+"}</button></td>
  </tr>`;
}

function renderTable() {
  el.tableBody.innerHTML = state.filtered.map((person, index) => rowTemplate(person, index)).join("");
  $("#table-caption").textContent = `${nf.format(state.filtered.length)} profili`;
  updateCompareBar();
}

function matchesBand(person) {
  return state.activeBand === "all" || categoryFor(person) === state.activeBand;
}

function matchesArea(person) {
  return state.activeArea === "all" || person.politicalArea === state.activeArea;
}

function baseFiltered({ ignoreArea = false, ignoreBand = false } = {}) {
  const query = normalize(el.search.value.trim());
  return state.politicians.filter((person) => {
    const haystack = normalize(`${person.name} ${person.id} ${person.politicalArea ?? ""}`);
    const bandOk = ignoreBand || matchesBand(person);
    const areaOk = ignoreArea || matchesArea(person);
    return bandOk && areaOk && (!query || haystack.includes(query));
  });
}

function applyFilters() {
  const sort = el.sort.value;
  state.filtered = baseFiltered();
  state.filtered.sort((a, b) => {
    if (sort === "inactivity-desc") return inactivity(b) - inactivity(a) || a.id.localeCompare(b.id, "it");
    if (sort === "inactivity-asc") return inactivity(a) - inactivity(b) || a.id.localeCompare(b.id, "it");
    return a.id.localeCompare(b.id, "it");
  });
  state.visible = PAGE_SIZE;
  renderCards();
  renderTable();
  renderAnalytics();
  updateLiveStrip();
}

function setBand(band) {
  state.activeBand = band;
  $$("[data-band]").forEach((button) => button.classList.toggle("active", button.dataset.band === band));
  applyFilters();
}

function setArea(area) {
  state.activeArea = area;
  $$("[data-area]").forEach((button) => button.classList.toggle("active", button.dataset.area === area));
  applyFilters();
}

function setView(view) {
  state.view = view;
  $$('[data-view]').forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$('[data-view-panel]').forEach((panel) => {
    const active = panel.dataset.viewPanel === view;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (view === "analytics") renderAnalytics();
}

function updateCounts() {
  const all = state.politicians.length;
  const high = state.politicians.filter((person) => categoryFor(person) === "high").length;
  const medium = state.politicians.filter((person) => categoryFor(person) === "medium").length;
  const low = all - high - medium;
  $("#count-all").textContent = nf.format(all);
  $("#count-high").textContent = nf.format(high);
  $("#count-medium").textContent = nf.format(medium);
  $("#count-low").textContent = nf.format(low);
  $("#hero-count").textContent = nf.format(all);
}

function updateAreaControls() {
  const withArea = state.politicians.filter((person) => AREAS.includes(person.politicalArea));
  const wrap = $("#area-filter-wrap");
  if (!withArea.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const count = (area) => withArea.filter((person) => person.politicalArea === area).length;
  $("#count-area-all").textContent = nf.format(withArea.length);
  $("#count-area-cdx").textContent = nf.format(count("Centrodestra"));
  $("#count-area-csx").textContent = nf.format(count("Centrosinistra"));
  $("#count-area-centro").textContent = nf.format(count("Centro"));
  $("#count-area-altro").textContent = nf.format(count("Altro / non classificato"));
}

function updateLiveStrip() {
  const count = state.filtered.length;
  const total = state.politicians.length || 1;
  const avgInactivity = average(state.filtered.map(inactivity));
  const avgParticipation = average(state.filtered.map((person) => bandMid(person.metrics?.participationPct)));
  const avgCost = Number.isFinite(avgInactivity) ? BASE_MONTHLY_COST * avgInactivity / 100 : null;
  $("#live-count").textContent = nf.format(count);
  $("#live-share").textContent = `${Math.round(count / total * 100)}% del totale`;
  $("#live-inactivity").textContent = Number.isFinite(avgInactivity) ? `${Math.round(avgInactivity)}%` : "N/D";
  $("#live-participation").textContent = Number.isFinite(avgParticipation) ? `${Math.round(avgParticipation)}%` : "N/D";
  $("#live-cost").textContent = Number.isFinite(avgCost) ? `≈ ${euro.format(avgCost)}` : "N/D";
}

function renderHeroExample() {
  const person = [...state.politicians].sort((a, b) => inactivity(b) - inactivity(a))[0];
  if (!person) return;
  $("#hero-profile-name").textContent = person.name;
  $("#hero-score").textContent = person.inactivityBand;
  $("#hero-orbit").style.setProperty("--score", Math.round(inactivity(person)));
  $("#hero-score-label").textContent = simpleLabel(person);
  $("#hero-cost-estimate").textContent = `≈ ${euro.format(inactivityCost(person))} / mese`;
  const area = $("#hero-profile-area");
  area.hidden = !person.politicalArea;
  if (person.politicalArea) area.textContent = person.politicalArea;
  $("#hero-mini-bars").innerHTML = metricDefs.map((def) => metricBar(def, person, true)).join("");
}

function histogramBucket(value) {
  if (!Number.isFinite(value)) return -1;
  if (value <= 10) return 0;
  return Math.min(9, Math.ceil(value / 10) - 1);
}

function renderHistogram() {
  const source = baseFiltered();
  const labels = ["0–10", "11–20", "21–30", "31–40", "41–50", "51–60", "61–70", "71–80", "81–90", "91–100"];
  const counts = Array(10).fill(0);
  source.forEach((person) => {
    const bucket = histogramBucket(inactivity(person));
    if (bucket >= 0) counts[bucket] += 1;
  });
  const max = Math.max(...counts, 1);
  el.histogram.innerHTML = counts.map((count, index) => {
    const mid = index === 0 ? 5 : index * 10 + 5;
    const cat = mid >= 60 ? "high" : mid >= 35 ? "medium" : "low";
    return `<button class="hist-column ${cat}" type="button" data-hist-band="${cat}" title="${labels[index]}: ${count} profili"><span class="hist-value">${count}</span><i><b style="--h:${Math.max(4, count / max * 100)}%"></b></i><small>${labels[index]}</small></button>`;
  }).join("");
}

function renderAreaChart() {
  const source = baseFiltered({ ignoreArea: true });
  const rows = AREAS.map((area) => {
    const people = source.filter((person) => person.politicalArea === area);
    return { area, count: people.length, value: average(people.map(inactivity)) };
  }).filter((row) => row.count > 0);
  const max = Math.max(...rows.map((row) => row.value ?? 0), 1);
  el.areaChart.innerHTML = rows.map((row) => {
    const active = state.activeArea === row.area;
    return `<button class="area-chart-row ${active ? "active" : ""}" type="button" data-chart-area="${escapeHtml(row.area)}">
      <span class="area-chart-label"><strong>${escapeHtml(row.area)}</strong><small>${nf.format(row.count)} profili</small></span>
      <i><b style="--w:${Math.round((row.value ?? 0) / max * 100)}%"></b></i>
      <strong class="area-chart-value">${Number.isFinite(row.value) ? `${Math.round(row.value)}%` : "N/D"}</strong>
    </button>`;
  }).join("");
}

function renderMix() {
  const total = state.filtered.length || 1;
  const high = state.filtered.filter((person) => categoryFor(person) === "high").length;
  const medium = state.filtered.filter((person) => categoryFor(person) === "medium").length;
  const low = state.filtered.length - high - medium;
  const highPct = high / total * 100;
  const mediumPct = medium / total * 100;
  const lowPct = low / total * 100;
  $("#mix-total").textContent = `${nf.format(state.filtered.length)} profili`;
  $("#mix-main").textContent = `${Math.round(highPct)}%`;
  $("#mix-donut").style.setProperty("--high", `${highPct}%`);
  $("#mix-donut").style.setProperty("--medium", `${highPct + mediumPct}%`);
  $("#mix-legend").innerHTML = [
    ["Alta", high, highPct, "high"],
    ["Media", medium, mediumPct, "medium"],
    ["Bassa", low, lowPct, "low"]
  ].map(([label, count, pct, cls]) => `<div><i class="${cls}"></i><span>${label}</span><strong>${count}</strong><small>${Math.round(pct)}%</small></div>`).join("");
}

function renderMetricOverview() {
  const rows = metricDefs.map((def) => {
    const values = state.filtered.map((person) => metricScore(person.metrics?.[def.key], def.type));
    return { def, value: average(values) ?? 0 };
  });
  el.metricOverview.innerHTML = rows.map(({ def, value }) => `<div class="overview-row"><span><strong>${escapeHtml(def.label)}</strong><small>${Math.round(value)}/100 normalizzato</small></span><i><b style="--w:${Math.round(value)}%"></b></i><strong>${Math.round(value)}</strong></div>`).join("");
}

function renderAnalytics() {
  renderHistogram();
  renderAreaChart();
  renderMix();
  renderMetricOverview();
}

function updateCompareBar() {
  const people = state.compare.map(politicianById).filter(Boolean);
  el.compareBar.hidden = people.length === 0;
  el.compareCount.textContent = `${people.length}/2`;
  el.compareNames.textContent = people.length ? people.map((person) => person.name).join(" · ") : "Seleziona due profili";
  el.openCompare.disabled = people.length !== 2;
  $$('[data-add-compare]').forEach((button) => {
    const selected = state.compare.includes(String(button.dataset.addCompare));
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "✓" : "+";
  });
  if (state.activeProfile && $("#profile-compare")) {
    $("#profile-compare").textContent = state.compare.includes(String(state.activeProfile.id)) ? "Rimuovi dal confronto" : "Aggiungi al confronto";
  }
  try { localStorage.setItem("mandato-aperto-compare", JSON.stringify(state.compare)); } catch {}
}

function toggleCompare(id) {
  const key = String(id);
  if (state.compare.includes(key)) state.compare = state.compare.filter((item) => item !== key);
  else if (state.compare.length >= 2) return showToast("Puoi confrontare due profili alla volta.");
  else state.compare.push(key);
  updateCompareBar();
}

function compareTopTwo() {
  const source = state.filtered.length ? state.filtered : state.politicians;
  const top = [...source].sort((a, b) => inactivity(b) - inactivity(a)).slice(0, 2);
  if (top.length < 2) return showToast("Servono almeno due profili nel filtro corrente.");
  state.compare = top.map((person) => String(person.id));
  updateCompareBar();
  openComparison();
}

function profileMetricTemplate(def, person) {
  const raw = person.metrics?.[def.key];
  const score = metricScore(raw, def.type);
  return `<div class="profile-metric"><div><span>${escapeHtml(def.label)}</span><strong>${escapeHtml(metricText(raw, def.suffix))}</strong></div><i><b style="--w:${score}%"></b></i><small>${Math.round(score)}/100 normalizzato dalla fascia pubblica</small></div>`;
}

function areaAverage(area) {
  return average(state.politicians.filter((person) => person.politicalArea === area).map(inactivity));
}

function overallRank(person) {
  const ranked = [...state.politicians].sort((a, b) => inactivity(b) - inactivity(a) || a.id.localeCompare(b.id));
  return ranked.findIndex((item) => item.id === person.id) + 1;
}

function openProfile(id) {
  const person = politicianById(id);
  if (!person) return;
  state.activeProfile = person;
  $("#profile-name").textContent = person.name;
  $("#profile-score").textContent = person.inactivityBand ?? "N/D";
  $("#profile-orbit").style.setProperty("--score", Math.round(inactivity(person)));
  $("#profile-label").textContent = simpleLabel(person);
  $("#profile-rank").textContent = `Posizione indicativa #${overallRank(person)} su ${state.politicians.length} per centro fascia.`;
  $("#profile-cost").textContent = `≈ ${euro.format(inactivityCost(person))} / mese`;
  const avg = areaAverage(person.politicalArea);
  $("#profile-area-average").textContent = Number.isFinite(avg) ? `${Math.round(avg)}% inattività indicativa` : "N/D";
  $("#profile-metrics").innerHTML = metricDefs.map((def) => profileMetricTemplate(def, person)).join("");
  const area = $("#profile-area");
  area.hidden = !person.politicalArea;
  if (person.politicalArea) area.textContent = person.politicalArea;
  $("#profile-source-stamp").textContent = state.meta?.generatedAt ? `Dati Camera · aggiornati ${dateFmt.format(new Date(state.meta.generatedAt))}` : "Dati Camera";
  setProfileTab("metrics");
  updateCompareBar();
  $("#profile-dialog").showModal();
}

function setProfileTab(tab) {
  $$('[data-profile-tab]').forEach((button) => button.classList.toggle("active", button.dataset.profileTab === tab));
  $$('[data-profile-panel]').forEach((panel) => {
    const active = panel.dataset.profilePanel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function compareMetric(def, left, right) {
  const leftScore = metricScore(left.metrics?.[def.key], def.type);
  const rightScore = metricScore(right.metrics?.[def.key], def.type);
  const delta = Math.abs(leftScore - rightScore);
  return `<div class="vs-metric">
    <div class="vs-metric-head"><strong>${escapeHtml(def.label)}</strong><span>Δ ${Math.round(delta)} pt</span></div>
    <div class="vs-values"><span>${escapeHtml(metricText(left.metrics?.[def.key], def.suffix))}</span><span>${escapeHtml(metricText(right.metrics?.[def.key], def.suffix))}</span></div>
    <div class="duel-bars"><i class="left"><b style="--w:${leftScore}%"></b></i><i class="right"><b style="--w:${rightScore}%"></b></i></div>
  </div>`;
}

function radarSvg(left, right) {
  const scoresLeft = metricDefs.map((def) => metricScore(left.metrics?.[def.key], def.type));
  const scoresRight = metricDefs.map((def) => metricScore(right.metrics?.[def.key], def.type));
  const center = 120;
  const radius = 82;
  const points = (scores) => scores.map((score, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const r = radius * score / 100;
    return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`;
  }).join(" ");
  const grid = [25, 50, 75, 100].map((pct) => {
    const r = radius * pct / 100;
    const pts = [0,1,2,3].map((index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 2;
      return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" class="radar-grid"/>`;
  }).join("");
  const axes = [0,1,2,3].map((index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="radar-axis"/>`;
  }).join("");
  return `<svg class="radar" viewBox="0 0 240 240" role="img" aria-label="Confronto normalizzato dei quattro indicatori">${grid}${axes}<polygon points="${points(scoresLeft)}" class="radar-a"/><polygon points="${points(scoresRight)}" class="radar-b"/><text x="120" y="18" text-anchor="middle">Presenza</text><text x="224" y="124" text-anchor="end">Leggi</text><text x="120" y="232" text-anchor="middle">Controllo</text><text x="16" y="124">Interventi</text></svg>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) return;
  const leftInactive = Math.round(inactivity(left));
  const rightInactive = Math.round(inactivity(right));
  const gap = Math.abs(leftInactive - rightInactive);
  const lower = leftInactive <= rightInactive ? left : right;
  $("#compare-table").innerHTML = `
    <div class="vs-summary">
      <div class="vs-person"><span class="micro">Profilo A</span><h3>${escapeHtml(left.name)}</h3>${areaBadge(left)}<strong class="vs-score">${escapeHtml(left.inactivityBand)}</strong><span>inattività</span><small>≈ ${euro.format(inactivityCost(left))}/mese</small></div>
      <div class="radar-wrap">${radarSvg(left, right)}<div class="radar-legend"><span><i class="a"></i>${escapeHtml(left.name)}</span><span><i class="b"></i>${escapeHtml(right.name)}</span></div></div>
      <div class="vs-person right"><span class="micro">Profilo B</span><h3>${escapeHtml(right.name)}</h3>${areaBadge(right)}<strong class="vs-score">${escapeHtml(right.inactivityBand)}</strong><span>inattività</span><small>≈ ${euro.format(inactivityCost(right))}/mese</small></div>
    </div>
    <div class="comparison-callout"><span>Differenza indicativa di inattività</span><strong>${gap} punti</strong><small>${escapeHtml(lower.name)} ha il valore indicativo più basso nel confronto.</small></div>
    <div class="vs-metrics">${metricDefs.map((def) => compareMetric(def, left, right)).join("")}</div>
    <p class="comparison-note">Il radar e i delta usano scale normalizzate ricavate esclusivamente dalle fasce pubbliche. Non ricostruiscono valori puntuali nascosti.</p>`;
  $("#compare-dialog").showModal();
}

function restoreCompare() {
  try {
    const stored = JSON.parse(localStorage.getItem("mandato-aperto-compare") ?? "[]");
    state.compare = Array.isArray(stored) ? stored.map(String).filter((id) => politicianById(id)).slice(0, 2) : [];
  } catch { state.compare = []; }
}

function resetFilters() {
  el.search.value = "";
  el.sort.value = "inactivity-desc";
  state.activeArea = "all";
  state.activeBand = "all";
  $$("[data-area]").forEach((button) => button.classList.toggle("active", button.dataset.area === "all"));
  $$("[data-band]").forEach((button) => button.classList.toggle("active", button.dataset.band === "all"));
  applyFilters();
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.politicians = payload.deputies ?? [];
    state.meta = payload.meta ?? {};
    updateCounts();
    updateAreaControls();
    renderHeroExample();
    restoreCompare();
    applyFilters();
    if (state.meta.generatedAt) {
      const formatted = dateFmt.format(new Date(state.meta.generatedAt));
      $("#header-freshness").textContent = `Agg. ${formatted}`;
      $("#dataset-status-text").textContent = `Camera · aggiornato ${formatted}`;
    }
  } catch (error) {
    console.error(error);
    el.count.textContent = "Dati non disponibili";
    el.empty.hidden = false;
    el.empty.querySelector("strong").textContent = "Impossibile caricare i dati.";
    $("#dataset-status-text").textContent = "Dati non disponibili";
  }
}

el.search.addEventListener("input", applyFilters);
el.sort.addEventListener("change", applyFilters);
el.reset.addEventListener("click", resetFilters);
el.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderCards(); });

$("#view-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) setView(button.dataset.view);
});

$("#band-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-band]");
  if (button) setBand(button.dataset.band);
});

$("#area-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-area]");
  if (button) setArea(button.dataset.area);
});

el.histogram.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hist-band]");
  if (button) setBand(button.dataset.histBand);
});

el.areaChart.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-area]");
  if (!button) return;
  const area = button.dataset.chartArea;
  setArea(state.activeArea === area ? "all" : area);
});

function handleDataAction(event) {
  const open = event.target.closest("[data-open-profile]");
  const compare = event.target.closest("[data-add-compare]");
  if (open) openProfile(open.dataset.openProfile);
  if (compare) toggleCompare(compare.dataset.addCompare);
}

el.grid.addEventListener("click", handleDataAction);
el.tableBody.addEventListener("click", handleDataAction);

$$('[data-table-sort]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.tableSort === "inactivity-desc") el.sort.value = "inactivity-desc";
  else el.sort.value = "code";
  applyFilters();
}));

el.clearCompare.addEventListener("click", () => { state.compare = []; updateCompareBar(); });
el.openCompare.addEventListener("click", openComparison);
$("#profile-compare").addEventListener("click", () => { if (state.activeProfile) toggleCompare(state.activeProfile.id); });
$("#compare-top").addEventListener("click", compareTopTwo);
$("#hero-compare-top").addEventListener("click", compareTopTwo);

$("#profile-show-analysis").addEventListener("click", () => {
  if (!state.activeProfile) return;
  $("#profile-dialog").close();
  setArea(state.activeProfile.politicalArea || "all");
  setView("analytics");
  $("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
});

$(".drawer-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-tab]");
  if (button) setProfileTab(button.dataset.profileTab);
});

$$('[data-dialog]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.dialog}`)?.showModal()));
$$('[data-view-jump]').forEach((button) => button.addEventListener("click", () => {
  setView(button.dataset.viewJump);
  $("#explore").scrollIntoView({ behavior: "smooth", block: "start" });
}));

$$('dialog').forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    el.search.focus();
    el.search.select();
  }
});

loadData();
