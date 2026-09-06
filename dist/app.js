const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 30;

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  meta: null,
  alternativeText: ""
};

const $ = (selector) => document.querySelector(selector);

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
  compareBar: $("#compare-bar"),
  compareCount: $("#compare-count"),
  compareNames: $("#compare-names"),
  clearCompare: $("#clear-compare"),
  openCompare: $("#open-compare"),
  toast: $("#toast")
};

const numberFormat = new Intl.NumberFormat("it-IT");
const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome"
});
const shortDateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Rome"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT");
}

function bandBounds(value) {
  const text = String(value ?? "").trim();
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    return [number, number];
  }
  const range = text.match(/^(\d+)–(\d+)$/);
  return range ? [Number(range[1]), Number(range[2])] : null;
}

function inactivityValue(person) {
  const bounds = bandBounds(person.inactivityBand);
  return bounds ? (bounds[0] + bounds[1]) / 2 : -1;
}

function signalClass(person) {
  return inactivityValue(person) >= 60 ? "is-high" : "";
}

function percent(value) {
  if (typeof value === "string") return value === "N/D" ? value : `${value}%`;
  return Number.isFinite(value)
    ? `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`
    : "N/D";
}

function metric(value) {
  if (typeof value === "string") return value;
  return Number.isFinite(value) ? numberFormat.format(value) : "N/D";
}

function politicianById(id) {
  return state.politicians.find((person) => String(person.id) === String(id));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 2200);
}

function rowTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  const inactivity = person.inactivityBand ?? "N/D";
  return `
    <article class="person-row ${signalClass(person)}" role="listitem">
      <span class="row-rank">${String(index + 1).padStart(2, "0")}</span>
      <div class="identity">
        <button class="person-link" type="button" data-open-profile="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>
      </div>
      <div class="inactivity-cell">
        <div class="inactivity-value"><strong>${escapeHtml(inactivity)}</strong><span>/100</span></div>
        <small>${escapeHtml(person.inactivityLabel ?? "")}</small>
      </div>
      <span class="metric">${escapeHtml(percent(person.metrics.participationPct))}</span>
      <span class="metric">${escapeHtml(metric(person.metrics.billsFirstSigned))}</span>
      <span class="metric">${escapeHtml(metric(person.metrics.oversightFirstSigned))}</span>
      <span class="metric">${escapeHtml(metric(person.metrics.interventions))}</span>
      <div class="row-actions">
        <button class="compare-button" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}" aria-label="${selected ? "Rimuovi dal" : "Aggiungi al"} confronto">${selected ? "✓" : "+"}</button>
      </div>
    </article>`;
}

function renderRows() {
  const shown = state.filtered.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(rowTemplate).join("");
  elements.count.textContent = `${numberFormat.format(state.filtered.length)} politici`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
}

function applyFilters() {
  const query = normalize(elements.search.value.trim());
  const sort = elements.sort.value;

  state.filtered = state.politicians.filter((person) => {
    const haystack = normalize(`${person.name} ${person.id}`);
    return !query || haystack.includes(query);
  });

  state.filtered.sort((left, right) => {
    if (sort === "inactivity-desc") {
      return inactivityValue(right) - inactivityValue(left) || left.id.localeCompare(right.id, "it");
    }
    if (sort === "inactivity-asc") {
      const lv = inactivityValue(left);
      const rv = inactivityValue(right);
      if (lv < 0) return 1;
      if (rv < 0) return -1;
      return lv - rv || left.id.localeCompare(right.id, "it");
    }
    return left.id.localeCompare(right.id, "it");
  });

  state.visible = PAGE_SIZE;
  renderRows();
  updateCompareBar();
}

function updateCompareBar() {
  const people = state.compare.map(politicianById).filter(Boolean);
  elements.compareBar.hidden = people.length === 0;
  elements.compareCount.textContent = `${people.length}/2`;
  elements.compareNames.textContent = people.length
    ? people.map((person) => person.name).join(" · ")
    : "Seleziona due politici";
  elements.openCompare.disabled = people.length !== 2;

  document.querySelectorAll("[data-add-compare]").forEach((button) => {
    const selected = state.compare.includes(String(button.dataset.addCompare));
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "✓" : "+";
  });

  if (state.activeProfile) {
    const button = $("#profile-compare");
    button.textContent = state.compare.includes(String(state.activeProfile.id))
      ? "Rimuovi dal confronto"
      : "Aggiungi al confronto";
  }

  try {
    localStorage.setItem("mandato-aperto-compare", JSON.stringify(state.compare));
  } catch {}
}

function toggleCompare(id) {
  const key = String(id);
  if (state.compare.includes(key)) {
    state.compare = state.compare.filter((item) => item !== key);
  } else if (state.compare.length >= 2) {
    showToast("Puoi confrontare due politici alla volta.");
    return;
  } else {
    state.compare.push(key);
  }
  updateCompareBar();
}

function openProfile(id) {
  const person = politicianById(id);
  if (!person) return;
  state.activeProfile = person;

  $("#profile-code").textContent = person.id;
  $("#profile-name").textContent = person.name;
  $("#profile-meta").textContent = "Profilo anonimo: l’identità non viene pubblicata e il codice cambia a ogni aggiornamento.";
  $("#profile-score").textContent = person.inactivityBand ?? "N/D";
  $("#profile-label").textContent = person.inactivityLabel ?? "Dato non disponibile";
  $("#metric-attendance").textContent = percent(person.metrics.participationPct);
  $("#metric-bills").textContent = metric(person.metrics.billsFirstSigned);
  $("#metric-oversight").textContent = metric(person.metrics.oversightFirstSigned);
  $("#metric-interventions").textContent = metric(person.metrics.interventions);

  const updated = state.meta?.generatedAt
    ? dateFormat.format(new Date(state.meta.generatedAt))
    : "data non disponibile";
  $("#profile-source-stamp").textContent = `Dati aggiornati ${updated} · metodo ${state.meta?.methodologyVersion ?? "0.1.2"}`;

  updateCompareBar();
  $("#profile-dialog").showModal();
}

function comparisonRow(label, left, right, note = "") {
  return `<div class="comparison-row">
    <div><span class="comparison-label">${escapeHtml(label)}</span>${note ? `<span class="comparison-note">${escapeHtml(note)}</span>` : ""}</div>
    <div><span class="comparison-value">${left}</span></div>
    <div><span class="comparison-value">${right}</span></div>
  </div>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) return;

  $("#compare-table").innerHTML = `
    <div class="comparison-row header"><div>Indicatore</div><div><strong>${escapeHtml(left.name)}</strong></div><div><strong>${escapeHtml(right.name)}</strong></div></div>
    ${comparisonRow("Inattività documentata", escapeHtml(left.inactivityBand), escapeHtml(right.inactivityBand), "Fascia su 100")}
    ${comparisonRow("Presenza alle votazioni", escapeHtml(percent(left.metrics.participationPct)), escapeHtml(percent(right.metrics.participationPct)))}
    ${comparisonRow("Proposte di legge", escapeHtml(metric(left.metrics.billsFirstSigned)), escapeHtml(metric(right.metrics.billsFirstSigned)))}
    ${comparisonRow("Atti di controllo", escapeHtml(metric(left.metrics.oversightFirstSigned)), escapeHtml(metric(right.metrics.oversightFirstSigned)))}
    ${comparisonRow("Interventi registrati", escapeHtml(metric(left.metrics.interventions)), escapeHtml(metric(right.metrics.interventions)))}`;
  $("#compare-dialog").showModal();
}

function restoreCompare() {
  try {
    const stored = JSON.parse(localStorage.getItem("mandato-aperto-compare") ?? "[]");
    state.compare = Array.isArray(stored)
      ? stored.map(String).filter((id) => politicianById(id)).slice(0, 2)
      : [];
  } catch {
    state.compare = [];
  }
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
  const commitments = $("#candidate-commitments").value
    .split("\n")
    .map((line) => line.replace(/^[-–—•\d.)\s]+/, "").trim())
    .filter(Boolean);
  const transparency = $("#candidate-transparency").checked;

  if (!name || !experience || commitments.length < 3 || !transparency) {
    showToast("Inserisci esperienza, tre impegni e la dichiarazione.");
    return;
  }

  $("#alternative-name").textContent = name;
  $("#alternative-copy").innerHTML = `<p><strong>Esperienza</strong><br>${escapeHtml(experience)}</p><p><strong>Impegni</strong></p><ol>${commitments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
  state.alternativeText = [
    "MANDATO APERTO — SCHEDA PRIVATA",
    `Alternativa: ${name}`,
    "",
    "ESPERIENZA",
    experience,
    "",
    "IMPEGNI",
    ...commitments.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Trasparenza dichiarata: sì"
  ].join("\n");

  event.currentTarget.hidden = true;
  $("#alternative-result").hidden = false;
}

async function copyAlternative() {
  if (!state.alternativeText) return;
  try {
    await navigator.clipboard.writeText(state.alternativeText);
    showToast("Scheda copiata.");
  } catch {
    showToast("Copia non disponibile.");
  }
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.politicians = payload.deputies ?? [];
    state.meta = payload.meta ?? {};

    elements.total.textContent = numberFormat.format(state.politicians.length);
    elements.high.textContent = numberFormat.format(
      state.politicians.filter((person) => inactivityValue(person) >= 60).length
    );

    const counts = new Map();
    for (const person of state.politicians) {
      if (!person.inactivityBand || person.inactivityBand === "N/D") continue;
      counts.set(person.inactivityBand, (counts.get(person.inactivityBand) ?? 0) + 1);
    }
    elements.common.textContent = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/D";

    const updated = state.meta.generatedAt ? new Date(state.meta.generatedAt) : null;
    const shortUpdated = updated ? shortDateFormat.format(updated) : "N/D";
    const fullUpdated = updated ? dateFormat.format(updated) : "non disponibile";
    elements.updated.textContent = shortUpdated;
    elements.freshness.textContent = `Dati aggiornati ${fullUpdated}`;
    elements.sidebarFreshness.textContent = updated ? `Aggiornato ${shortUpdated}` : "Aggiornamento non disponibile";

    restoreCompare();
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.count.textContent = "Dati non disponibili";
    elements.freshness.textContent = "Riprova tra poco";
    elements.sidebarFreshness.textContent = "Dati non disponibili";
    elements.empty.hidden = false;
    elements.empty.querySelector("strong").textContent = "Impossibile caricare i dati";
    elements.empty.querySelector("span").textContent = "Riprova tra poco.";
  }
}

elements.search.addEventListener("input", applyFilters);
elements.sort.addEventListener("change", applyFilters);
elements.reset.addEventListener("click", () => {
  elements.search.value = "";
  elements.sort.value = "inactivity-desc";
  applyFilters();
  elements.search.focus();
});
elements.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderRows();
});
elements.grid.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-profile]");
  const compare = event.target.closest("[data-add-compare]");
  if (open) openProfile(open.dataset.openProfile);
  if (compare) toggleCompare(compare.dataset.addCompare);
});
elements.clearCompare.addEventListener("click", () => {
  state.compare = [];
  updateCompareBar();
});
elements.openCompare.addEventListener("click", openComparison);

$("#profile-compare").addEventListener("click", () => {
  if (state.activeProfile) toggleCompare(state.activeProfile.id);
});
$("#profile-alternative").addEventListener("click", openAlternative);
$("#alternative-form").addEventListener("submit", renderAlternative);
$("#copy-alternative").addEventListener("click", copyAlternative);
$("#edit-alternative").addEventListener("click", () => {
  $("#alternative-result").hidden = true;
  $("#alternative-form").hidden = false;
});

document.querySelectorAll("[data-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    $(`#${button.dataset.dialog}`)?.showModal();
  });
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
    elements.search.select();
  }
});

loadData();