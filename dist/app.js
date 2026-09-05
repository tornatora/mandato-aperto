const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 30;

const state = {
  politicians: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  alternativeText: "",
  meta: null
};

const elements = {
  search: document.querySelector("#search-input"),
  sort: document.querySelector("#sort-filter"),
  grid: document.querySelector("#card-grid"),
  count: document.querySelector("#results-count"),
  freshness: document.querySelector("#freshness"),
  total: document.querySelector("#total-stat"),
  empty: document.querySelector("#empty-state"),
  reset: document.querySelector("#reset-filters"),
  loadMore: document.querySelector("#load-more"),
  compareBar: document.querySelector("#compare-bar"),
  compareCount: document.querySelector("#compare-count"),
  compareNames: document.querySelector("#compare-names"),
  clearCompare: document.querySelector("#clear-compare"),
  openCompare: document.querySelector("#open-compare"),
  toast: document.querySelector("#toast")
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
  const value = inactivityValue(person);
  if (value >= 40) return "is-high";
  if (value >= 20) return "is-medium";
  return "is-low";
}

function percent(value) {
  if (typeof value === "string") return value === "N/D" ? value : `${value}%`;
  return Number.isFinite(value)
    ? `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`
    : "N/D";
}

function integer(value) {
  if (typeof value === "string") return value;
  return Number.isFinite(value) ? numberFormat.format(value) : "N/D";
}

function politicianById(id) {
  return state.politicians.find((person) => String(person.id) === String(id));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
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
      const leftValue = inactivityValue(left);
      const rightValue = inactivityValue(right);
      if (leftValue < 0) return 1;
      if (rightValue < 0) return -1;
      return leftValue - rightValue || left.id.localeCompare(right.id, "it");
    }
    return left.id.localeCompare(right.id, "it");
  });

  state.visible = PAGE_SIZE;
  renderRows();
}

function rowTemplate(person, index) {
  const selected = state.compare.includes(String(person.id));
  const inactivity = person.inactivityBand ?? "N/D";
  return `
    <article class="person-row ${signalClass(person)}" role="listitem">
      <span class="row-rank">${String(index + 1).padStart(2, "0")}</span>
      <div class="identity">
        <button class="person-link" type="button" data-open-profile="${escapeHtml(person.id)}">${escapeHtml(person.name)}</button>
        <span>Cognome **** · Partito ****</span>
      </div>
      <div class="inactivity-cell" aria-label="Fascia di inattività documentata ${escapeHtml(inactivity)} su 100">
        <span>Inattività</span>
        <p><strong>${escapeHtml(inactivity)}</strong><small>/100</small></p>
        <em>${escapeHtml(person.inactivityLabel)}</em>
      </div>
      <div class="row-metrics">
        <dl><dt>Partecipazione</dt><dd>${escapeHtml(percent(person.metrics.participationPct))}</dd></dl>
        <dl><dt>Proposte</dt><dd>${escapeHtml(integer(person.metrics.billsFirstSigned))}</dd></dl>
        <dl><dt>Controllo</dt><dd>${escapeHtml(integer(person.metrics.oversightFirstSigned))}</dd></dl>
        <dl><dt>Interventi</dt><dd>${escapeHtml(integer(person.metrics.interventions))}</dd></dl>
      </div>
      <div class="row-actions">
        <button class="open-profile" type="button" data-open-profile="${escapeHtml(person.id)}">Dettagli</button>
        <button class="add-compare" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}" aria-label="${selected ? "Rimuovi" : "Aggiungi"} ${escapeHtml(person.name)} ${selected ? "dal" : "al"} confronto">${selected ? "✓" : "+"}</button>
      </div>
    </article>`;
}

function renderRows() {
  const shown = state.filtered.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(rowTemplate).join("");
  const noun = state.filtered.length === 1 ? "politico" : "politici";
  elements.count.textContent = `${numberFormat.format(state.filtered.length)} ${noun}`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
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
    const id = String(button.dataset.addCompare);
    const selected = state.compare.includes(id);
    const person = politicianById(id);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      `${selected ? "Rimuovi" : "Aggiungi"} ${person?.name ?? "politico"} ${selected ? "dal" : "al"} confronto`
    );
    button.textContent = selected ? "✓" : "+";
  });

  if (state.activeProfile) {
    const button = document.querySelector("#profile-compare");
    const selected = state.compare.includes(String(state.activeProfile.id));
    button.textContent = selected ? "Rimuovi dal confronto" : "Aggiungi al confronto";
  }

  try {
    localStorage.setItem("mandato-aperto-compare", JSON.stringify(state.compare));
  } catch {
    // Il confronto resta disponibile durante la sessione.
  }
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
  const metrics = person.metrics;
  document.querySelector("#profile-code").textContent = person.id;
  document.querySelector("#profile-name").textContent = person.name;
  document.querySelector("#profile-meta").textContent = "Cognome **** · Partito **** · Area ****";
  document.querySelector("#profile-inactivity strong").textContent = person.inactivityBand ?? "N/D";
  document.querySelector("#profile-label").textContent = person.inactivityLabel;
  document.querySelector("#metric-attendance").textContent = percent(metrics.participationPct);
  document.querySelector("#metric-bills").textContent = integer(metrics.billsFirstSigned);
  document.querySelector("#metric-oversight").textContent = integer(metrics.oversightFirstSigned);
  document.querySelector("#metric-interventions").textContent = integer(metrics.interventions);

  const updated = state.meta?.generatedAt
    ? dateFormat.format(new Date(state.meta.generatedAt))
    : "data non disponibile";
  document.querySelector("#profile-source-stamp").textContent =
    `Dati istituzionali aggregati · Nessun riferimento personale · Aggiornamento ${updated} · Metodo ${state.meta?.methodologyVersion ?? "0.1.2"}`;

  updateCompareBar();
  document.querySelector("#profile-dialog").showModal();
}

function comparisonRow(label, left, right, note = "") {
  return `
    <div class="comparison-row">
      <div><span class="comparison-label">${escapeHtml(label)}</span>${note ? `<div class="comparison-note">${escapeHtml(note)}</div>` : ""}</div>
      <div><span class="comparison-value">${left}</span></div>
      <div><span class="comparison-value">${right}</span></div>
    </div>`;
}

function openComparison() {
  const [left, right] = state.compare.map(politicianById);
  if (!left || !right) return;

  document.querySelector("#compare-table").innerHTML = `
    <div class="comparison-row header">
      <div><span>Indicatore</span></div>
      <div><strong>${escapeHtml(left.name)}</strong><span>Anonimo</span></div>
      <div><strong>${escapeHtml(right.name)}</strong><span>Anonimo</span></div>
    </div>
    ${comparisonRow("Inattività documentata", escapeHtml(left.inactivityBand), escapeHtml(right.inactivityBand), "Fascia su 100")}
    ${comparisonRow("Partecipazione", escapeHtml(percent(left.metrics.participationPct)), escapeHtml(percent(right.metrics.participationPct)), "Votazioni elettroniche")}
    ${comparisonRow("Proposte di legge", escapeHtml(integer(left.metrics.billsFirstSigned)), escapeHtml(integer(right.metrics.billsFirstSigned)), "Primo firmatario")}
    ${comparisonRow("Indirizzo e controllo", escapeHtml(integer(left.metrics.oversightFirstSigned)), escapeHtml(integer(right.metrics.oversightFirstSigned)), "Primo firmatario")}
    ${comparisonRow("Interventi", escapeHtml(integer(left.metrics.interventions)), escapeHtml(integer(right.metrics.interventions)), "Fascia aggregata")}`;
  document.querySelector("#compare-dialog").showModal();
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function openAlternativeFromProfile() {
  const profileDialog = document.querySelector("#profile-dialog");
  if (profileDialog.open) profileDialog.close();
  const current = state.activeProfile;

  document.querySelector("#alternative-form").reset();
  document.querySelector("#alternative-form").hidden = false;
  document.querySelector("#alternative-result").hidden = true;
  state.alternativeText = "";
  document.querySelector("#alternative-current").textContent = current
    ? `${current.name} · inattività ${current.inactivityBand ?? "N/D"}/100`
    : "Nessun politico selezionato";
  document.querySelector("#replacement-dialog").showModal();
}

function renderAlternative(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const name = document.querySelector("#candidate-name").value.trim();
  const status = document.querySelector("#candidate-status").value;
  const experience = document.querySelector("#candidate-experience").value.trim();
  const evidence = document.querySelector("#candidate-evidence").value.trim();
  const evidenceField = document.querySelector("#candidate-evidence");
  if (!isHttpUrl(evidence)) {
    evidenceField.setCustomValidity("Inserisci un riferimento che inizi con http:// o https://");
    evidenceField.reportValidity();
    return;
  }
  evidenceField.setCustomValidity("");

  const commitments = document.querySelector("#candidate-commitments").value
    .split("\n")
    .map((line) => line.replace(/^[-–—•\d.)\s]+/, "").trim())
    .filter(Boolean);
  const transparency = document.querySelector("#candidate-transparency").checked;
  const current = state.activeProfile;
  const checks = [
    { label: "Identità e stato del profilo", ok: Boolean(name && status) },
    { label: "Esperienza con riferimento privato", ok: Boolean(experience && isHttpUrl(evidence)) },
    { label: "Almeno tre impegni misurabili", ok: commitments.length >= 3 },
    { label: "Dichiarazione di trasparenza", ok: transparency }
  ];
  const readiness = checks.filter((check) => check.ok).length;

  document.querySelector("#alternative-name").textContent = name;
  document.querySelector("#alternative-status").textContent = status;
  document.querySelector("#alternative-readiness").textContent = `${readiness}/4`;
  document.querySelector("#readiness-list").innerHTML = checks
    .map((check) => `<div class="readiness-item ${check.ok ? "ok" : ""}">${escapeHtml(check.label)}</div>`)
    .join("");

  const referenceText = current
    ? `${current.name}: inattività ${current.inactivityBand ?? "N/D"}/100, partecipazione ${percent(current.metrics.participationPct)}, proposte nella fascia ${integer(current.metrics.billsFirstSigned)}.`
    : "Nessun politico selezionato. Apri una scheda per collegare il confronto a un mandato.";
  const commitmentsHtml = commitments.length
    ? `<ol>${commitments.map((commitment) => `<li>${escapeHtml(commitment)}</li>`).join("")}</ol>`
    : "<p>Nessun impegno strutturato.</p>";

  document.querySelector("#alternative-copy").innerHTML = `
    <article><h4>Esperienza dichiarata</h4><p>${escapeHtml(experience)}</p></article>
    <article><h4>Politico di riferimento</h4><p>${escapeHtml(referenceText)}</p></article>
    <article><h4>Impegni proposti</h4>${commitmentsHtml}</article>
    <article><h4>Riferimento privato</h4><p>Registrato nella bozza locale; non mostrato come collegamento.</p></article>`;

  state.alternativeText = [
    "MANDATO APERTO — SCHEDA ALTERNATIVA (BOZZA PRIVATA, NON CERTIFICATA)",
    `Alternativa: ${name}`,
    `Stato: ${status}`,
    `Politico di riferimento: ${current?.name ?? "non selezionato"}`,
    "",
    "ESPERIENZA DICHIARATA",
    experience,
    `Riferimento privato: ${evidence}`,
    "",
    "IMPEGNI MISURABILI",
    ...commitments.map((commitment, index) => `${index + 1}. ${commitment}`),
    "",
    `Trasparenza dichiarata: ${transparency ? "sì" : "no"}`,
    `Completezza formale: ${readiness}/4`,
    "",
    "Nota: questa scheda non certifica la candidatura e non assegna un giudizio politico."
  ].join("\n");

  form.hidden = true;
  document.querySelector("#alternative-result").hidden = false;
}

async function copyAlternative() {
  if (!state.alternativeText) return;
  try {
    await navigator.clipboard.writeText(state.alternativeText);
    showToast("Scheda copiata.");
  } catch {
    const field = document.createElement("textarea");
    field.value = state.alternativeText;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
    showToast("Scheda copiata.");
  }
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
    state.compare = Array.isArray(stored)
      ? stored.map(String).filter((id) => politicianById(id)).slice(0, 2)
      : [];
  } catch {
    state.compare = [];
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
    const updated = state.meta.generatedAt
      ? dateFormat.format(new Date(state.meta.generatedAt))
      : "data non disponibile";
    elements.freshness.textContent = `Dati aggregati · aggiornati ${updated}`;

    restoreCompare();
    applyFilters();
    updateCompareBar();
  } catch (error) {
    console.error(error);
    elements.freshness.textContent = "Dati temporaneamente non disponibili";
    elements.count.textContent = "Errore di caricamento";
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "Impossibile caricare l’elenco";
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
elements.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderRows();
});
elements.grid.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-profile]");
  const compareButton = event.target.closest("[data-add-compare]");
  if (openButton) openProfile(openButton.dataset.openProfile);
  if (compareButton) toggleCompare(compareButton.dataset.addCompare);
});
elements.clearCompare.addEventListener("click", () => {
  state.compare = [];
  updateCompareBar();
});
elements.openCompare.addEventListener("click", openComparison);
document.querySelector("#profile-compare").addEventListener("click", () => {
  if (state.activeProfile) toggleCompare(state.activeProfile.id);
});
document.querySelector("#profile-alternative").addEventListener("click", openAlternativeFromProfile);
document.querySelector("#alternative-form").addEventListener("submit", renderAlternative);
document.querySelector("#copy-alternative").addEventListener("click", copyAlternative);
document.querySelector("#download-alternative").addEventListener("click", downloadAlternative);
document.querySelector("#edit-alternative").addEventListener("click", () => {
  document.querySelector("#alternative-result").hidden = true;
  document.querySelector("#alternative-form").hidden = false;
});

document.querySelectorAll("[data-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.dialog === "replacement-dialog") {
      state.activeProfile = null;
      document.querySelector("#alternative-form").reset();
      document.querySelector("#alternative-form").hidden = false;
      document.querySelector("#alternative-result").hidden = true;
      state.alternativeText = "";
      document.querySelector("#alternative-current").textContent = "Nessun politico selezionato";
    }
    document.querySelector(`#${button.dataset.dialog}`)?.showModal();
  });
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector(".close-dialog")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
    elements.search.select();
  }
});

loadData();
