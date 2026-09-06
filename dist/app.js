const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 24;
const BASE_MONTHLY_COST = 17628.11;

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  activeBand: "all",
  meta: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const nf = new Intl.NumberFormat("it-IT");
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" });

const el = {
  search: $("#search-input"), sort: $("#sort-filter"), grid: $("#card-grid"), count: $("#results-count"),
  empty: $("#empty-state"), reset: $("#reset-filters"), loadMore: $("#load-more"), histogram: $("#histogram"),
  compareBar: $("#compare-bar"), compareCount: $("#compare-count"), compareNames: $("#compare-names"),
  clearCompare: $("#clear-compare"), openCompare: $("#open-compare"), toast: $("#toast")
};

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  return bounds ? (bounds[0] + bounds[1]) / 2 : 0;
}

function inactivity(person) { return bandMid(person.inactivityBand); }
function inactivityCost(person) { return BASE_MONTHLY_COST * inactivity(person) / 100; }
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
  if (text === "n/d") return 0;
  const b = bandBounds(text);
  if (type === "participation") return Math.max(0, Math.min(100, b ? (b[0] + b[1]) / 2 : Number(text) || 0));
  if (text === "0") return 2;
  if (text.includes("oltre")) return 95;
  if (b) {
    const mid = (b[0] + b[1]) / 2;
    if (mid <= 5) return 24;
    if (mid <= 20) return 48;
    if (mid <= 100) return 74;
    return 92;
  }
  const n = Number(text);
  return Number.isFinite(n) ? Math.min(100, 12 + Math.log10(n + 1) * 38) : 0;
}

const metricDefs = [
  { key: "participationPct", label: "C’è alle votazioni", short: "Presenza", help: "Quanto partecipa alle votazioni", type: "participation", suffix: "%" },
  { key: "billsFirstSigned", label: "Propone leggi", short: "Leggi", help: "Proposte firmate per primo", type: "count" },
  { key: "oversightFirstSigned", label: "Controlla il Governo", short: "Controllo", help: "Atti per chiedere conto al Governo", type: "count" },
  { key: "interventions", label: "Interviene", short: "Interventi", help: "Interventi registrati nei lavori", type: "count" }
];

function politicianById(id) { return state.politicians.find((p) => String(p.id) === String(id)); }

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.toast.hidden = true; }, 2200);
}

function simpleLabel(person) {
  const v = inactivity(person);
  if (v >= 70) return "Nei dati emerge pochissima attività.";
  if (v >= 60) return "L’attività documentata è bassa.";
  if (v >= 35) return "L’attività documentata è nella fascia centrale.";
  return "Nei dati emerge molta attività.";
}

function metricMini(def, person) {
  const raw = person.metrics?.[def.key];
  const score = metricScore(raw, def.type);
  return `<div class="mini-metric"><div><span>${def.short}</span><strong>${escapeHtml(metricText(raw, def.suffix))}</strong></div><i><b style="--w:${score}%"></b></i></div>`;
}

function cardTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  const score = Math.round(inactivity(person));
  const category = categoryFor(person);
  return `<article class="profile-card ${category}" role="listitem" data-id="${escapeHtml(person.id)}">
    <div class="card-top"><span class="rank-number">#${String(index + 1).padStart(2, "0")}</span><button class="compare-add" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}">${selected ? "✓" : "+"}</button></div>
    <button class="card-main" type="button" data-open-profile="${escapeHtml(person.id)}">
      <div class="card-identity"><span class="mini-label">Profilo anonimo</span><h3>${escapeHtml(person.name)}</h3></div>
      <div class="score-orbit card-orbit" style="--score:${score}"><div><strong>${escapeHtml(person.inactivityBand ?? "N/D")}</strong><span>inattività</span></div></div>
      <p class="card-meaning">${escapeHtml(simpleLabel(person))}</p>
      <div class="mini-metrics">${metricDefs.map((d) => metricMini(d, person)).join("")}</div>
      <div class="card-cost"><span>Quanto pesa l’inattività</span><strong>≈ ${euro.format(inactivityCost(person))}<small>/mese</small></strong><em>stima equivalente</em></div>
    </button>
  </article>`;
}

function renderCards() {
  const shown = state.filtered.slice(0, state.visible);
  el.grid.innerHTML = shown.map((p, i) => cardTemplate(p, i)).join("");
  el.count.textContent = `${nf.format(state.filtered.length)} profili`;
  el.empty.hidden = state.filtered.length !== 0;
  el.loadMore.hidden = state.visible >= state.filtered.length;
  updateCompareBar();
}

function matchesBand(person) {
  return state.activeBand === "all" || categoryFor(person) === state.activeBand;
}

function applyFilters() {
  const query = normalize(el.search.value.trim());
  const sort = el.sort.value;
  state.filtered = state.politicians.filter((person) => {
    const haystack = normalize(`${person.name} ${person.id}`);
    return matchesBand(person) && (!query || haystack.includes(query));
  });

  state.filtered.sort((a, b) => {
    if (sort === "inactivity-desc") return inactivity(b) - inactivity(a) || a.id.localeCompare(b.id, "it");
    if (sort === "inactivity-asc") return inactivity(a) - inactivity(b) || a.id.localeCompare(b.id, "it");
    return a.id.localeCompare(b.id, "it");
  });

  state.visible = PAGE_SIZE;
  renderCards();
}

function setBand(band) {
  state.activeBand = band;
  $$("[data-band]").forEach((button) => button.classList.toggle("active", button.dataset.band === band));
  applyFilters();
}

function renderHistogram() {
  const ranges = ["0–10", "11–20", "21–30", "31–40", "41–50", "51–60", "61–70", "71–80", "81–90", "91–100"];
  const counts = ranges.map((range) => state.politicians.filter((p) => p.inactivityBand === range).length);
  const max = Math.max(...counts, 1);
  el.histogram.innerHTML = ranges.map((range, i) => {
    const mid = bandMid(range);
    const cat = mid >= 60 ? "high" : mid >= 35 ? "medium" : "low";
    return `<button class="hist-bar ${cat}" type="button" data-hist-band="${cat}" title="${range}: ${counts[i]} profili"><i style="--h:${Math.max(5, counts[i] / max * 100)}%"></i><span>${range.replace("–", "–")}</span><b>${counts[i]}</b></button>`;
  }).join("");
}

function updateCounts() {
  const all = state.politicians.length;
  const high = state.politicians.filter((p) => categoryFor(p) === "high").length;
  const medium = state.politicians.filter((p) => categoryFor(p) === "medium").length;
  const low = all - high - medium;
  $("#count-all").textContent = nf.format(all);
  $("#count-high").textContent = nf.format(high);
  $("#count-medium").textContent = nf.format(medium);
  $("#count-low").textContent = nf.format(low);
  $("#hero-count").textContent = nf.format(all);
}

function renderHeroExample() {
  const ranked = [...state.politicians].sort((a, b) => inactivity(b) - inactivity(a));
  const person = ranked[0];
  if (!person) return;
  const score = Math.round(inactivity(person));
  $("#hero-profile-name").textContent = person.name;
  $("#hero-rank").textContent = "#01";
  $("#hero-score").textContent = person.inactivityBand;
  $("#hero-orbit").style.setProperty("--score", score);
  $("#hero-score-label").textContent = simpleLabel(person);
  $("#hero-cost-estimate").textContent = `≈ ${euro.format(inactivityCost(person))} / mese`;
}

function updateCompareBar() {
  const people = state.compare.map(politicianById).filter(Boolean);
  el.compareBar.hidden = people.length === 0;
  el.compareCount.textContent = `${people.length}/2`;
  el.compareNames.textContent = people.length ? people.map((p) => p.name).join(" · ") : "Seleziona due profili";
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
  if (state.compare.includes(key)) state.compare = state.compare.filter((x) => x !== key);
  else if (state.compare.length >= 2) return showToast("Puoi confrontare due profili alla volta.");
  else state.compare.push(key);
  updateCompareBar();
}

function profileMetricTemplate(def, person) {
  const raw = person.metrics?.[def.key];
  const score = metricScore(raw, def.type);
  return `<div class="profile-metric"><div><span>${def.label}</span><small>${def.help}</small></div><strong>${escapeHtml(metricText(raw, def.suffix))}</strong><i><b style="--w:${score}%"></b></i></div>`;
}

function openProfile(id) {
  const person = politicianById(id);
  if (!person) return;
  state.activeProfile = person;
  const score = Math.round(inactivity(person));
  $("#profile-name").textContent = person.name;
  $("#profile-score").textContent = person.inactivityBand ?? "N/D";
  $("#profile-orbit").style.setProperty("--score", score);
  $("#profile-label").textContent = simpleLabel(person);
  $("#profile-cost").textContent = `≈ ${euro.format(inactivityCost(person))} / mese`;
  $("#profile-metrics").innerHTML = metricDefs.map((d) => profileMetricTemplate(d, person)).join("");
  $("#profile-source-stamp").textContent = state.meta?.generatedAt ? `Dati Camera · aggiornati ${dateFmt.format(new Date(state.meta.generatedAt))}` : "Dati Camera";
  updateCompareBar();
  $("#profile-dialog").showModal();
}

function compareMetric(def, left, right) {
  const lv = metricScore(left.metrics?.[def.key], def.type);
  const rv = metricScore(right.metrics?.[def.key], def.type);
  return `<div class="vs-metric"><span class="vs-label">${def.label}</span><div class="vs-values"><strong>${escapeHtml(metricText(left.metrics?.[def.key], def.suffix))}</strong><strong>${escapeHtml(metricText(right.metrics?.[def.key], def.suffix))}</strong></div><div class="duel-bar"><i><b style="--w:${lv}%"></b></i><i class="right"><b style="--w:${rv}%"></b></i></div></div>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) return;
  $("#compare-table").innerHTML = `<div class="vs-head">
      <div class="vs-person"><span>Profilo A</span><h3>${escapeHtml(left.name)}</h3><div class="score-orbit vs-orbit" style="--score:${Math.round(inactivity(left))}"><div><strong>${escapeHtml(left.inactivityBand)}</strong><span>inattività</span></div></div><em>≈ ${euro.format(inactivityCost(left))}/mese</em></div>
      <div class="vs-center">VS</div>
      <div class="vs-person"><span>Profilo B</span><h3>${escapeHtml(right.name)}</h3><div class="score-orbit vs-orbit" style="--score:${Math.round(inactivity(right))}"><div><strong>${escapeHtml(right.inactivityBand)}</strong><span>inattività</span></div></div><em>≈ ${euro.format(inactivityCost(right))}/mese</em></div>
    </div><div class="vs-metrics">${metricDefs.map((d) => compareMetric(d, left, right)).join("")}</div>`;
  $("#compare-dialog").showModal();
}

function restoreCompare() {
  try {
    const stored = JSON.parse(localStorage.getItem("mandato-aperto-compare") ?? "[]");
    state.compare = Array.isArray(stored) ? stored.map(String).filter((id) => politicianById(id)).slice(0, 2) : [];
  } catch { state.compare = []; }
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.politicians = payload.deputies ?? [];
    state.meta = payload.meta ?? {};
    updateCounts();
    renderHistogram();
    renderHeroExample();
    restoreCompare();
    applyFilters();
    if (state.meta.generatedAt) $("#header-freshness").textContent = `Agg. ${dateFmt.format(new Date(state.meta.generatedAt))}`;
  } catch (error) {
    console.error(error);
    el.count.textContent = "Dati non disponibili";
    el.empty.hidden = false;
    el.empty.querySelector("strong").textContent = "Impossibile caricare i dati.";
  }
}

el.search.addEventListener("input", applyFilters);
el.sort.addEventListener("change", applyFilters);
el.reset.addEventListener("click", () => { el.search.value = ""; el.sort.value = "inactivity-desc"; setBand("all"); });
el.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderCards(); });
$("#band-filters").addEventListener("click", (event) => { const button = event.target.closest("[data-band]"); if (button) setBand(button.dataset.band); });
el.histogram.addEventListener("click", (event) => { const button = event.target.closest("[data-hist-band]"); if (button) setBand(button.dataset.histBand); });
el.grid.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-profile]");
  const compare = event.target.closest("[data-add-compare]");
  if (open) openProfile(open.dataset.openProfile);
  if (compare) toggleCompare(compare.dataset.addCompare);
});
el.clearCompare.addEventListener("click", () => { state.compare = []; updateCompareBar(); });
el.openCompare.addEventListener("click", openComparison);
$("#profile-compare").addEventListener("click", () => { if (state.activeProfile) toggleCompare(state.activeProfile.id); });

$$('[data-dialog]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.dialog}`)?.showModal()));
$$('dialog').forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault(); el.search.focus(); el.search.select();
  }
});

loadData();