const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 24;

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  meta: null,
  alternativeText: "",
  bandFilter: "all",
  rangeFilter: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  search: $("#search-input"),
  sort: $("#sort-filter"),
  grid: $("#card-grid"),
  count: $("#results-count"),
  freshness: $("#freshness"),
  sidebarFreshness: $("#sidebar-freshness"),
  total: $("#total-stat"),
  high: $("#high-stat"),
  common: $("#common-stat"),
  updated: $("#updated-stat"),
  empty: $("#empty-state"),
  reset: $("#reset-filters"),
  loadMore: $("#load-more"),
  distribution: $("#distribution-bars"),
  compareBar: $("#compare-bar"),
  compareCount: $("#compare-count"),
  compareNames: $("#compare-names"),
  clearCompare: $("#clear-compare"),
  openCompare: $("#open-compare"),
  toast: $("#toast")
};

const numberFormat = new Intl.NumberFormat("it-IT");
const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"
});
const shortDateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", timeZone: "Europe/Rome" });

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
  if (/^\d+$/.test(text)) return [Number(text), Number(text)];
  const range = text.match(/^(\d+)–(\d+)$/);
  if (range) return [Number(range[1]), Number(range[2])];
  if (/^oltre\s+(\d+)$/i.test(text)) {
    const n = Number(text.match(/\d+/)?.[0] ?? 100);
    return [n, n];
  }
  return null;
}

function midpoint(value, fallback = 0) {
  const bounds = bandBounds(value);
  return bounds ? (bounds[0] + bounds[1]) / 2 : fallback;
}

function inactivityValue(person) {
  return midpoint(person.inactivityBand, -1);
}

function levelClass(person) {
  const value = inactivityValue(person);
  if (value >= 60) return "level-high";
  if (value >= 30) return "level-mid";
  return "level-low";
}

function percent(value) {
  if (typeof value === "string") return value === "N/D" ? value : `${value}%`;
  return Number.isFinite(value) ? `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` : "N/D";
}

function metric(value) {
  if (typeof value === "string") return value;
  return Number.isFinite(value) ? numberFormat.format(value) : "N/D";
}

function metricProgress(value, type) {
  if (value === "N/D" || value == null) return 0;
  const raw = midpoint(value, Number(value) || 0);
  const cap = type === "participationPct" ? 100 : type === "billsFirstSigned" ? 20 : 100;
  return Math.max(3, Math.min(100, (raw / cap) * 100));
}

function politicianById(id) {
  return state.politicians.find((person) => String(person.id) === String(id));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 2100);
}

function metricMini(label, value, progress) {
  return `<div class="micro-metric"><span>${label}</span><strong>${escapeHtml(value)}</strong><i><b style="--p:${progress}%"></b></i></div>`;
}

function cardTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  const score = Math.max(0, inactivityValue(person));
  const attendance = percent(person.metrics.participationPct);
  const bills = metric(person.metrics.billsFirstSigned);
  const oversight = metric(person.metrics.oversightFirstSigned);
  const interventions = metric(person.metrics.interventions);

  return `
    <article class="profile-card ${levelClass(person)} ${selected ? "is-selected" : ""}" role="listitem" style="--score:${score}">
      <header class="card-top">
        <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="profile-code">${escapeHtml(person.id)}</span>
        <button class="quick-compare" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}" aria-label="${selected ? "Rimuovi dal" : "Aggiungi al"} confronto">
          <svg viewBox="0 0 24 24" aria-hidden="true">${selected ? '<path d="m6 12 4 4 8-9"/>' : '<path d="M12 5v14M5 12h14"/>'}</svg>
        </button>
      </header>

      <button class="card-open" type="button" data-open-profile="${escapeHtml(person.id)}">
        <div class="score-orb"><div><strong>${escapeHtml(person.inactivityBand ?? "—")}</strong><span>inattività</span></div></div>
        <div class="card-label"><span>${escapeHtml(person.inactivityLabel ?? "")}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></div>
      </button>

      <div class="micro-grid">
        ${metricMini("Presenza", attendance, metricProgress(person.metrics.participationPct, "participationPct"))}
        ${metricMini("Proposte", bills, metricProgress(person.metrics.billsFirstSigned, "billsFirstSigned"))}
        ${metricMini("Controllo", oversight, metricProgress(person.metrics.oversightFirstSigned, "oversightFirstSigned"))}
        ${metricMini("Interventi", interventions, metricProgress(person.metrics.interventions, "interventions"))}
      </div>
    </article>`;
}

function renderCards() {
  const shown = state.filtered.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(cardTemplate).join("");
  elements.count.textContent = `${numberFormat.format(state.filtered.length)}`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
}

function matchesBand(person) {
  const score = inactivityValue(person);
  if (state.rangeFilter) return score >= state.rangeFilter[0] && score <= state.rangeFilter[1];
  if (state.bandFilter === "high") return score >= 60;
  if (state.bandFilter === "mid") return score >= 30 && score < 60;
  if (state.bandFilter === "low") return score >= 0 && score < 30;
  return true;
}

function updateFilterUI() {
  $$("[data-band-filter]").forEach((button) => {
    button.classList.toggle("active", !state.rangeFilter && button.dataset.bandFilter === state.bandFilter);
  });
  $$("[data-dist-filter]").forEach((button) => {
    const [min, max] = button.dataset.distFilter.split(":").map(Number);
    button.classList.toggle("active", !!state.rangeFilter && min === state.rangeFilter[0] && max === state.rangeFilter[1]);
  });
}

function applyFilters() {
  const query = normalize(elements.search.value.trim());
  const sort = elements.sort.value;

  state.filtered = state.politicians.filter((person) => {
    const haystack = normalize(`${person.name} ${person.id}`);
    return (!query || haystack.includes(query)) && matchesBand(person);
  });

  state.filtered.sort((left, right) => {
    if (sort === "inactivity-desc") return inactivityValue(right) - inactivityValue(left) || left.id.localeCompare(right.id, "it");
    if (sort === "inactivity-asc") return inactivityValue(left) - inactivityValue(right) || left.id.localeCompare(right.id, "it");
    return left.id.localeCompare(right.id, "it");
  });

  state.visible = PAGE_SIZE;
  updateFilterUI();
  renderCards();
  updateCompareDock();
}

function renderDistribution() {
  const bins = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, max: i === 9 ? 100 : i * 10 + 9, count: 0 }));
  for (const person of state.politicians) {
    const value = inactivityValue(person);
    if (value < 0) continue;
    const index = Math.min(9, Math.floor(value / 10));
    bins[index].count += 1;
  }
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  elements.distribution.innerHTML = bins.map((bin, index) => {
    const height = Math.max(10, (bin.count / maxCount) * 100);
    const hue = index >= 6 ? "hot" : index >= 3 ? "warm" : "cool";
    return `<button class="dist-column ${hue}" type="button" data-dist-filter="${bin.min}:${bin.max}" style="--h:${height}%" aria-label="Fascia ${bin.min}-${bin.max}: ${bin.count} profili"><span>${bin.count}</span><i></i></button>`;
  }).join("");
}

function updateCompareDock() {
  const people = state.compare.map(politicianById).filter(Boolean);
  elements.compareBar.hidden = people.length === 0;
  elements.compareCount.textContent = `${people.length}/2`;
  elements.compareNames.textContent = people.length ? people.map((person) => person.id).join("  ↔  ") : "Seleziona due profili";
  elements.openCompare.disabled = people.length !== 2;

  $$("[data-add-compare]").forEach((button) => {
    const selected = state.compare.includes(String(button.dataset.addCompare));
    button.setAttribute("aria-pressed", String(selected));
    const svg = button.querySelector("svg");
    if (svg) svg.innerHTML = selected ? '<path d="m6 12 4 4 8-9"/>' : '<path d="M12 5v14M5 12h14"/>';
    button.closest(".profile-card")?.classList.toggle("is-selected", selected);
  });

  if (state.activeProfile) {
    const button = $("#profile-compare");
    if (button) button.textContent = state.compare.includes(String(state.activeProfile.id)) ? "Rimuovi dal confronto" : "Aggiungi al confronto";
  }

  try { localStorage.setItem("mandato-aperto-compare", JSON.stringify(state.compare)); } catch {}
}

function toggleCompare(id) {
  const key = String(id);
  if (state.compare.includes(key)) state.compare = state.compare.filter((item) => item !== key);
  else if (state.compare.length >= 2) {
    showToast("Confronto pieno: rimuovi prima un profilo.");
    return;
  } else state.compare.push(key);
  updateCompareDock();
}

function setVisualBar(id, value, type) {
  const element = $(`#${id}`);
  if (element) element.style.setProperty("--p", `${metricProgress(value, type)}%`);
}

function openProfile(id) {
  const person = politicianById(id);
  if (!person) return;
  state.activeProfile = person;

  const score = Math.max(0, inactivityValue(person));
  $("#profile-code").textContent = person.id;
  $("#profile-name").textContent = person.name;
  $("#profile-meta").textContent = "Codice rigenerato a ogni aggiornamento";
  $("#profile-score").textContent = person.inactivityBand ?? "—";
  $("#profile-label").textContent = person.inactivityLabel ?? "Dato non disponibile";
  $("#profile-score-ring").style.setProperty("--score", score);
  $("#metric-attendance").textContent = percent(person.metrics.participationPct);
  $("#metric-bills").textContent = metric(person.metrics.billsFirstSigned);
  $("#metric-oversight").textContent = metric(person.metrics.oversightFirstSigned);
  $("#metric-interventions").textContent = metric(person.metrics.interventions);
  setVisualBar("bar-attendance", person.metrics.participationPct, "participationPct");
  setVisualBar("bar-bills", person.metrics.billsFirstSigned, "billsFirstSigned");
  setVisualBar("bar-oversight", person.metrics.oversightFirstSigned, "oversightFirstSigned");
  setVisualBar("bar-interventions", person.metrics.interventions, "interventions");

  const updated = state.meta?.generatedAt ? dateFormat.format(new Date(state.meta.generatedAt)) : "—";
  $("#profile-source-stamp").textContent = `${updated} · metodo ${state.meta?.methodologyVersion ?? "0.1.2"}`;

  updateCompareDock();
  $("#profile-dialog").showModal();
}

function compareMetric(label, leftDisplay, rightDisplay, leftProgress, rightProgress) {
  return `<div class="versus-metric">
    <div class="versus-label">${escapeHtml(label)}</div>
    <div class="versus-line left"><strong>${escapeHtml(leftDisplay)}</strong><i><b style="--p:${leftProgress}%"></b></i></div>
    <div class="versus-line right"><i><b style="--p:${rightProgress}%"></b></i><strong>${escapeHtml(rightDisplay)}</strong></div>
  </div>`;
}

function compareIdentity(person) {
  const score = Math.max(0, inactivityValue(person));
  return `<div class="versus-person" style="--score:${score}"><div class="versus-orb"><strong>${escapeHtml(person.inactivityBand ?? "—")}</strong></div><span>${escapeHtml(person.id)}</span></div>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) {
    showToast("Seleziona due profili.");
    return;
  }

  $("#compare-table").innerHTML = `
    <div class="versus-top">${compareIdentity(left)}<div class="versus-mark">VS</div>${compareIdentity(right)}</div>
    <div class="versus-metrics">
      ${compareMetric("Inattività", left.inactivityBand ?? "—", right.inactivityBand ?? "—", Math.max(0, inactivityValue(left)), Math.max(0, inactivityValue(right)))}
      ${compareMetric("Presenza", percent(left.metrics.participationPct), percent(right.metrics.participationPct), metricProgress(left.metrics.participationPct, "participationPct"), metricProgress(right.metrics.participationPct, "participationPct"))}
      ${compareMetric("Proposte", metric(left.metrics.billsFirstSigned), metric(right.metrics.billsFirstSigned), metricProgress(left.metrics.billsFirstSigned, "billsFirstSigned"), metricProgress(right.metrics.billsFirstSigned, "billsFirstSigned"))}
      ${compareMetric("Controllo", metric(left.metrics.oversightFirstSigned), metric(right.metrics.oversightFirstSigned), metricProgress(left.metrics.oversightFirstSigned, "oversightFirstSigned"), metricProgress(right.metrics.oversightFirstSigned, "oversightFirstSigned"))}
      ${compareMetric("Interventi", metric(left.metrics.interventions), metric(right.metrics.interventions), metricProgress(left.metrics.interventions, "interventions"), metricProgress(right.metrics.interventions, "interventions"))}
    </div>`;
  $("#compare-dialog").showModal();
}

function restoreCompare() {
  try {
    const stored = JSON.parse(localStorage.getItem("mandato-aperto-compare") ?? "[]");
    state.compare = Array.isArray(stored) ? stored.map(String).filter((id) => politicianById(id)).slice(0, 2) : [];
  } catch { state.compare = []; }
}

function openAlternative() {
  if ($("#profile-dialog").open) $("#profile-dialog").close();
  $("#alternative-form").reset();
  $("#alternative-form").hidden = false;
  $("#alternative-result").hidden = true;
  state.alternativeText = "";
  $("#replacement-dialog").showModal();
}

function renderAlternative(event) {
  event.preventDefault();
  const name = $("#candidate-name").value.trim();
  const experience = $("#candidate-experience").value.trim();
  const commitments = $("#candidate-commitments").value.split("\n").map((line) => line.replace(/^[-–—•\d.)\s]+/, "").trim()).filter(Boolean);
  const transparency = $("#candidate-transparency").checked;

  if (!name || !experience || commitments.length < 3 || !transparency) {
    showToast("Servono esperienza, tre impegni e trasparenza.");
    return;
  }

  $("#alternative-name").textContent = name;
  $("#alternative-copy").innerHTML = `<p><strong>Esperienza</strong><br>${escapeHtml(experience)}</p><ol>${commitments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
  state.alternativeText = ["MANDATO APERTO — SCHEDA PRIVATA", `Alternativa: ${name}`, "", experience, "", ...commitments.map((item, index) => `${index + 1}. ${item}`), "", "Trasparenza dichiarata: sì"].join("\n");
  event.currentTarget.hidden = true;
  $("#alternative-result").hidden = false;
}

async function copyAlternative() {
  if (!state.alternativeText) return;
  try { await navigator.clipboard.writeText(state.alternativeText); showToast("Scheda copiata."); }
  catch { showToast("Copia non disponibile."); }
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.politicians = payload.deputies ?? [];
    state.meta = payload.meta ?? {};

    elements.total.textContent = numberFormat.format(state.politicians.length);
    elements.high.textContent = numberFormat.format(state.politicians.filter((person) => inactivityValue(person) >= 60).length);

    const counts = new Map();
    for (const person of state.politicians) {
      if (!person.inactivityBand || person.inactivityBand === "N/D") continue;
      counts.set(person.inactivityBand, (counts.get(person.inactivityBand) ?? 0) + 1);
    }
    elements.common.textContent = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    const updated = state.meta.generatedAt ? new Date(state.meta.generatedAt) : null;
    const shortUpdated = updated ? shortDateFormat.format(updated) : "—";
    const fullUpdated = updated ? dateFormat.format(updated) : "—";
    elements.updated.textContent = shortUpdated;
    elements.freshness.textContent = `Sync ${fullUpdated}`;
    elements.sidebarFreshness.textContent = shortUpdated;

    restoreCompare();
    renderDistribution();
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.count.textContent = "—";
    elements.freshness.textContent = "Dati non disponibili";
    elements.empty.hidden = false;
    elements.empty.querySelector("strong").textContent = "Dati non disponibili";
  }
}

elements.search.addEventListener("input", applyFilters);
elements.sort.addEventListener("change", applyFilters);

elements.reset.addEventListener("click", () => {
  elements.search.value = "";
  elements.sort.value = "inactivity-desc";
  state.bandFilter = "all";
  state.rangeFilter = null;
  applyFilters();
});

elements.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderCards();
  updateCompareDock();
});

elements.grid.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-profile]");
  const compare = event.target.closest("[data-add-compare]");
  if (open) openProfile(open.dataset.openProfile);
  if (compare) toggleCompare(compare.dataset.addCompare);
});

elements.distribution.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dist-filter]");
  if (!button) return;
  const range = button.dataset.distFilter.split(":").map(Number);
  const isSame = state.rangeFilter && state.rangeFilter[0] === range[0] && state.rangeFilter[1] === range[1];
  state.rangeFilter = isSame ? null : range;
  if (isSame) state.bandFilter = "all";
  applyFilters();
  $("#ranking").scrollIntoView({ behavior: "smooth", block: "start" });
});

$$("[data-band-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.bandFilter = button.dataset.bandFilter;
    state.rangeFilter = null;
    applyFilters();
  });
});

elements.clearCompare.addEventListener("click", () => { state.compare = []; updateCompareDock(); });
elements.openCompare.addEventListener("click", openComparison);
$("#rail-compare")?.addEventListener("click", openComparison);
$("#mobile-compare")?.addEventListener("click", openComparison);

$("#profile-compare").addEventListener("click", () => { if (state.activeProfile) toggleCompare(state.activeProfile.id); });
$("#profile-alternative").addEventListener("click", openAlternative);
$("#alternative-form").addEventListener("submit", renderAlternative);
$("#copy-alternative").addEventListener("click", copyAlternative);
$("#edit-alternative").addEventListener("click", () => { $("#alternative-result").hidden = true; $("#alternative-form").hidden = false; });

$$("[data-dialog]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.dialog}`)?.showModal()));

$$("dialog").forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
    elements.search.select();
  }
});

loadData();