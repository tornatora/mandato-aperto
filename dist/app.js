const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 40;

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  alternativeText: "",
  meta: null
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  search: $("#search-input"),
  sort: $("#sort-filter"),
  grid: $("#card-grid"),
  count: $("#results-count"),
  freshness: $("#freshness"),
  total: $("#total-stat"),
  high: $("#high-stat"),
  common: $("#common-stat"),
  updated: $("#updated-stat"),
  headerUpdated: $("#header-updated"),
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
  year: "2-digit",
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
  const match = text.match(/^(\d+)–(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function inactivityValue(person) {
  const bounds = bandBounds(person.inactivityBand);
  return bounds ? (bounds[0] + bounds[1]) / 2 : -1;
}

function metric(value, suffix = "") {
  if (value === null || value === undefined || value === "N/D") return "N/D";
  if (typeof value === "string") return `${value}${suffix}`;
  return Number.isFinite(value) ? `${numberFormat.format(value)}${suffix}` : "N/D";
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
  const score = Math.max(0, Math.min(100, inactivityValue(person)));
  const high = score >= 60;

  return `
    <article class="record-row ${high ? "is-high" : ""}" role="row">
      <span class="row-rank" role="cell">${String(index + 1).padStart(2, "0")}</span>
      <div class="record-identity" role="cell">
        <button type="button" data-open-profile="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>
        <small>CODICE ${escapeHtml(person.id)}</small>
      </div>
      <div class="inactivity-wrap" role="cell">
        <span class="band-main ${high ? "is-high" : ""}">${escapeHtml(inactivity)}</span>
        <span class="mini-meter" aria-hidden="true"><span style="--meter:${score}%"></span></span>
      </div>
      <div class="row-metric" role="cell"><span>PARTECIP.</span><strong>${escapeHtml(metric(person.metrics.participationPct, "%"))}</strong></div>
      <div class="row-metric" role="cell"><span>PROPOSTE</span><strong>${escapeHtml(metric(person.metrics.billsFirstSigned))}</strong></div>
      <div class="row-metric" role="cell"><span>CONTROLLO</span><strong>${escapeHtml(metric(person.metrics.oversightFirstSigned))}</strong></div>
      <div class="row-metric" role="cell"><span>INTERVENTI</span><strong>${escapeHtml(metric(person.metrics.interventions))}</strong></div>
      <div class="row-action" role="cell">
        <button type="button" data-open-profile="${escapeHtml(person.id)}">Apri →</button>
        <button class="compare-toggle" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}">${selected ? "SELEZIONATO" : "+ CONFRONTA"}</button>
      </div>
    </article>`;
}

function renderRows() {
  const shown = state.filtered.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(rowTemplate).join("");
  elements.count.textContent = `${numberFormat.format(state.filtered.length)} record`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
}

function applyFilters() {
  const query = normalize(elements.search.value.trim());
  const sort = elements.sort.value;

  state.filtered = state.politicians.filter((person) => {
    return !query || normalize(`${person.id} ${person.name}`).includes(query);
  });

  state.filtered.sort((a, b) => {
    if (sort === "inactivity-desc") return inactivityValue(b) - inactivityValue(a) || a.id.localeCompare(b.id, "it");
    if (sort === "inactivity-asc") {
      const av = inactivityValue(a), bv = inactivityValue(b);
      if (av < 0) return 1;
      if (bv < 0) return -1;
      return av - bv || a.id.localeCompare(b.id, "it");
    }
    return a.id.localeCompare(b.id, "it");
  });

  state.visible = PAGE_SIZE;
  renderRows();
}

function updateCompareBar() {
  const people = state.compare.map(politicianById).filter(Boolean);
  elements.compareBar.hidden = people.length === 0;
  elements.compareCount.textContent = `${people.length}/2`;
  elements.compareNames.textContent = people.length ? people.map((p) => p.name).join(" · ") : "Seleziona due politici";
  elements.openCompare.disabled = people.length !== 2;

  document.querySelectorAll("[data-add-compare]").forEach((button) => {
    const selected = state.compare.includes(String(button.dataset.addCompare));
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "SELEZIONATO" : "+ CONFRONTA";
  });

  if (state.activeProfile) {
    $("#profile-compare").textContent = state.compare.includes(String(state.activeProfile.id)) ? "Rimuovi dal confronto" : "Aggiungi al confronto";
  }

  try { localStorage.setItem("mandato-aperto-compare", JSON.stringify(state.compare)); } catch {}
}

function toggleCompare(id) {
  const key = String(id);
  if (state.compare.includes(key)) state.compare = state.compare.filter((item) => item !== key);
  else if (state.compare.length >= 2) return showToast("Puoi confrontare due politici alla volta.");
  else state.compare.push(key);
  updateCompareBar();
}

function openProfile(id) {
  const person = politicianById(id);
  if (!person) return;
  state.activeProfile = person;

  $("#profile-code").textContent = person.id;
  $("#profile-name").textContent = person.name;
  $("#profile-meta").textContent = "Cognome **** · Partito **** · Area ****";
  $("#profile-inactivity").textContent = person.inactivityBand ?? "N/D";
  $("#profile-label").textContent = person.inactivityLabel ?? "Dati aggregati";
  $("#metric-attendance").textContent = metric(person.metrics.participationPct, "%");
  $("#metric-bills").textContent = metric(person.metrics.billsFirstSigned);
  $("#metric-oversight").textContent = metric(person.metrics.oversightFirstSigned);
  $("#metric-interventions").textContent = metric(person.metrics.interventions);

  const updated = state.meta?.generatedAt ? dateFormat.format(new Date(state.meta.generatedAt)) : "data non disponibile";
  $("#profile-source-stamp").textContent = `Dati istituzionali aggregati · aggiornamento ${updated} · metodo ${state.meta?.methodologyVersion ?? "0.1.2"}`;
  updateCompareBar();
  $("#profile-dialog").showModal();
}

function comparisonRow(label, left, right, note = "") {
  return `<div class="comparison-row"><div><span class="comparison-label">${escapeHtml(label)}</span><span class="comparison-note">${escapeHtml(note)}</span></div><div><span class="comparison-value">${escapeHtml(left)}</span></div><div><span class="comparison-value">${escapeHtml(right)}</span></div></div>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) return;
  $("#compare-table").innerHTML = `
    <div class="comparison-row header"><div>INDICATORE</div><div><strong>${escapeHtml(left.name)}</strong></div><div><strong>${escapeHtml(right.name)}</strong></div></div>
    ${comparisonRow("Inattività", left.inactivityBand ?? "N/D", right.inactivityBand ?? "N/D", "Fascia su 100")}
    ${comparisonRow("Partecipazione", metric(left.metrics.participationPct, "%"), metric(right.metrics.participationPct, "%"), "Votazioni elettroniche")}
    ${comparisonRow("Proposte", metric(left.metrics.billsFirstSigned), metric(right.metrics.billsFirstSigned), "Primo firmatario")}
    ${comparisonRow("Controllo", metric(left.metrics.oversightFirstSigned), metric(right.metrics.oversightFirstSigned), "Primo firmatario")}
    ${comparisonRow("Interventi", metric(left.metrics.interventions), metric(right.metrics.interventions), "Fascia aggregata")}`;
  $("#compare-dialog").showModal();
}

function isHttpUrl(value) {
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}

function openAlternative() {
  const profileDialog = $("#profile-dialog");
  if (profileDialog.open) profileDialog.close();
  $("#alternative-form").reset();
  $("#alternative-form").hidden = false;
  $("#alternative-result").hidden = true;
  state.alternativeText = "";
  const current = state.activeProfile;
  $("#alternative-current").textContent = current ? `${current.name} · inattività ${current.inactivityBand ?? "N/D"}/100` : "Nessun politico selezionato";
  $("#replacement-dialog").showModal();
}

function renderAlternative(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const name = $("#candidate-name").value.trim();
  const status = $("#candidate-status").value;
  const experience = $("#candidate-experience").value.trim();
  const evidence = $("#candidate-evidence").value.trim();
  const commitments = $("#candidate-commitments").value.split("\n").map((line) => line.replace(/^[-–—•\d.)\s]+/, "").trim()).filter(Boolean);
  const transparency = $("#candidate-transparency").checked;

  if (!isHttpUrl(evidence)) {
    $("#candidate-evidence").setCustomValidity("Inserisci un URL valido che inizi con http:// o https://");
    $("#candidate-evidence").reportValidity();
    return;
  }
  $("#candidate-evidence").setCustomValidity("");

  const checks = [
    ["Identità e stato", Boolean(name && status)],
    ["Esperienza con riferimento", Boolean(experience && evidence)],
    ["Tre impegni misurabili", commitments.length >= 3],
    ["Dichiarazione trasparenza", transparency]
  ];
  const readiness = checks.filter(([, ok]) => ok).length;

  $("#alternative-name").textContent = name;
  $("#alternative-status").textContent = status;
  $("#alternative-readiness").textContent = `${readiness}/4`;
  $("#readiness-list").innerHTML = checks.map(([label, ok]) => `<div class="readiness-item ${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${escapeHtml(label)}</div>`).join("");
  $("#alternative-copy").innerHTML = `
    <article><h4>Esperienza dichiarata</h4><p>${escapeHtml(experience)}</p></article>
    <article><h4>Impegni</h4><ol>${commitments.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></article>
    <article><h4>Riferimento privato</h4><p>Registrato nella bozza locale e non pubblicato dal progetto.</p></article>`;

  state.alternativeText = [
    "MANDATO APERTO — SCHEDA ALTERNATIVA PRIVATA",
    `Alternativa: ${name}`,
    `Stato: ${status}`,
    `Politico di riferimento: ${state.activeProfile?.name ?? "non selezionato"}`,
    "",
    "ESPERIENZA",
    experience,
    `Riferimento privato: ${evidence}`,
    "",
    "IMPEGNI",
    ...commitments.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Trasparenza dichiarata: ${transparency ? "sì" : "no"}`,
    `Completezza formale: ${readiness}/4`
  ].join("\n");

  form.hidden = true;
  $("#alternative-result").hidden = false;
}

async function copyAlternative() {
  if (!state.alternativeText) return;
  try { await navigator.clipboard.writeText(state.alternativeText); showToast("Scheda copiata."); }
  catch { showToast("Copia non disponibile."); }
}

function downloadAlternative() {
  if (!state.alternativeText) return;
  const blob = new Blob([state.alternativeText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "scheda-alternativa-mandato-aperto.txt";
  link.click();
  URL.revokeObjectURL(url);
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

    elements.total.textContent = numberFormat.format(state.politicians.length);
    elements.high.textContent = numberFormat.format(state.politicians.filter((p) => inactivityValue(p) >= 60).length);

    const bands = new Map();
    for (const person of state.politicians) {
      if (!person.inactivityBand || person.inactivityBand === "N/D") continue;
      bands.set(person.inactivityBand, (bands.get(person.inactivityBand) ?? 0) + 1);
    }
    elements.common.textContent = [...bands.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/D";

    const updated = state.meta.generatedAt ? new Date(state.meta.generatedAt) : null;
    elements.updated.textContent = updated ? shortDateFormat.format(updated) : "N/D";
    elements.headerUpdated.textContent = updated ? shortDateFormat.format(updated).toUpperCase() : "LIVE";
    elements.freshness.textContent = updated ? `Ultima variazione dati: ${dateFormat.format(updated)}` : "Data non disponibile";

    restoreCompare();
    applyFilters();
    updateCompareBar();
  } catch (error) {
    console.error(error);
    elements.count.textContent = "Dataset non disponibile";
    elements.freshness.textContent = "Errore di caricamento";
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "Impossibile caricare i dati.";
    elements.empty.querySelector("p").textContent = "Riprova tra poco.";
    elements.reset.hidden = true;
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
elements.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderRows(); });
elements.grid.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-profile]");
  const compare = event.target.closest("[data-add-compare]");
  if (open) openProfile(open.dataset.openProfile);
  if (compare) toggleCompare(compare.dataset.addCompare);
});
elements.clearCompare.addEventListener("click", () => { state.compare = []; updateCompareBar(); });
elements.openCompare.addEventListener("click", openComparison);
$("#profile-compare").addEventListener("click", () => { if (state.activeProfile) toggleCompare(state.activeProfile.id); });
$("#profile-alternative").addEventListener("click", openAlternative);
$("#alternative-form").addEventListener("submit", renderAlternative);
$("#copy-alternative").addEventListener("click", copyAlternative);
$("#download-alternative").addEventListener("click", downloadAlternative);
$("#edit-alternative").addEventListener("click", () => { $("#alternative-result").hidden = true; $("#alternative-form").hidden = false; });

document.querySelectorAll("[data-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = $(`#${button.dataset.dialog}`);
    if (button.dataset.dialog === "replacement-dialog") {
      state.activeProfile = null;
      $("#alternative-current").textContent = "Nessun politico selezionato";
      $("#alternative-form").reset();
      $("#alternative-form").hidden = false;
      $("#alternative-result").hidden = true;
    }
    dialog?.showModal();
  });
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
    elements.search.select();
  }
});

loadData();
