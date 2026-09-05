const DATA_URL = "data/deputies.json";
const PAGE_SIZE = 24;

const state = {
  deputies: [],
  filtered: [],
  visible: PAGE_SIZE,
  compare: [],
  activeProfile: null,
  alternativeText: "",
  meta: null
};

const elements = {
  search: document.querySelector("#search-input"),
  group: document.querySelector("#group-filter"),
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

function initials(person) {
  return person.id?.slice(-2) ?? "**";
}

function scoreValue(person) {
  const value = Number.parseInt(String(person.scoreBand ?? ""), 10);
  return Number.isFinite(value) ? value : -1;
}

function percent(value) {
  if (typeof value === "string") return value === "N/D" ? value : `${value}%`;
  return Number.isFinite(value) ? `${value.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` : "N/D";
}

function integer(value) {
  if (typeof value === "string") return value;
  return Number.isFinite(value) ? numberFormat.format(value) : "N/D";
}

function personById(id) {
  return state.deputies.find((person) => String(person.id) === String(id));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function populateGroups() {
  if (!elements.group) return;
  const groups = [...new Set(state.deputies.map((person) => person.group).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "it"));
  const fragment = document.createDocumentFragment();
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    fragment.append(option);
  }
  elements.group.append(fragment);
}

function applyFilters() {
  const query = normalize(elements.search.value.trim());
  const group = elements.group?.value ?? "";
  const sort = elements.sort.value;

  state.filtered = state.deputies.filter((person) => {
    const haystack = normalize(`${person.name} ${person.id}`);
    return (!query || haystack.includes(query)) && !group;
  });

  state.filtered.sort((a, b) => {
    if (sort === "score-desc") return scoreValue(b) - scoreValue(a) || a.id.localeCompare(b.id, "it");
    return a.id.localeCompare(b.id, "it");
  });

  state.visible = PAGE_SIZE;
  renderCards();
}

function cardTemplate(person) {
  const selected = state.compare.includes(String(person.id));
  const score = person.scoreBand ?? "N/D";
  const scoreNumber = scoreValue(person);
  const angle = scoreNumber >= 0 ? Math.max(0, Math.min(360, (scoreNumber + 5) * 3.6)) : 0;
  return `
    <article class="person-card">
      <div class="card-top">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials(person))}</div>
        <div class="identity">
          <h3 title="${escapeHtml(person.name)}">${escapeHtml(person.name)}</h3>
          <p>Identità non pubblicata</p>
        </div>
        <div class="score-dial" style="--score-angle: ${angle}deg" aria-label="Indice di attività ${escapeHtml(score)} su 100">
          <strong>${escapeHtml(score)}</strong>
        </div>
      </div>
      <p class="card-district">Partito e area non pubblicati</p>
      <div class="card-metrics">
        <div><strong>${escapeHtml(percent(person.metrics.participationPct))}</strong><span>Votazioni</span></div>
        <div><strong>${escapeHtml(integer(person.metrics.billsFirstSigned))}</strong><span>Proposte</span></div>
        <div><strong>${escapeHtml(integer(person.metrics.oversightFirstSigned))}</strong><span>Controllo</span></div>
      </div>
      <p class="card-label">${escapeHtml(person.scoreLabel)}</p>
      <div class="card-actions">
        <button class="open-profile" type="button" data-open-profile="${escapeHtml(person.id)}">Apri scheda</button>
        <button class="add-compare" type="button" data-add-compare="${escapeHtml(person.id)}" aria-pressed="${selected}" aria-label="${selected ? "Rimuovi" : "Aggiungi"} ${escapeHtml(person.name)} dal confronto">${selected ? "✓" : "+"}</button>
      </div>
    </article>`;
}

function renderCards() {
  const shown = state.filtered.slice(0, state.visible);
  elements.grid.innerHTML = shown.map(cardTemplate).join("");
  elements.count.textContent = `${numberFormat.format(state.filtered.length)} ${state.filtered.length === 1 ? "risultato" : "risultati"}`;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.loadMore.hidden = state.visible >= state.filtered.length;
}

function updateCompareBar() {
  const people = state.compare.map(personById).filter(Boolean);
  elements.compareBar.hidden = people.length === 0;
  elements.compareCount.textContent = `${people.length}/2`;
  elements.compareNames.textContent = people.length ? people.map((person) => person.name).join(" · ") : "Seleziona due deputati";
  elements.openCompare.disabled = people.length !== 2;

  document.querySelectorAll("[data-add-compare]").forEach((button) => {
    const selected = state.compare.includes(String(button.dataset.addCompare));
    const person = personById(button.dataset.addCompare);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${selected ? "Rimuovi" : "Aggiungi"} ${person?.name ?? "deputato"} ${selected ? "dal" : "al"} confronto`);
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
    // La selezione resta valida per la sessione anche se lo storage è disabilitato.
  }
}

function toggleCompare(id) {
  const key = String(id);
  if (state.compare.includes(key)) {
    state.compare = state.compare.filter((item) => item !== key);
  } else if (state.compare.length >= 2) {
    showToast("Puoi confrontare due deputati alla volta.");
    return;
  } else {
    state.compare.push(key);
  }
  updateCompareBar();
}

function openProfile(id) {
  const person = personById(id);
  if (!person) return;
  state.activeProfile = person;
  const metrics = person.metrics;
  document.querySelector("#profile-avatar").textContent = initials(person);
  document.querySelector("#profile-name").textContent = person.name;
  document.querySelector("#profile-meta").textContent = "Identità, partito e area non pubblicati";
  document.querySelector("#profile-score strong").textContent = person.scoreBand ?? "N/D";
  document.querySelector("#profile-label").textContent = person.scoreLabel;
  document.querySelector("#metric-attendance").textContent = percent(metrics.participationPct);
  document.querySelector("#metric-attendance-note").textContent = "Valore pubblicato per fascia";
  document.querySelector("#metric-bills").textContent = integer(metrics.billsFirstSigned);
  document.querySelector("#metric-oversight").textContent = integer(metrics.oversightFirstSigned);
  document.querySelector("#metric-interventions").textContent = integer(metrics.interventions);
  const updated = state.meta?.generatedAt ? dateFormat.format(new Date(state.meta.generatedAt)) : "data non disponibile";
  document.querySelector("#profile-source-stamp").textContent = `Dati istituzionali aggregati · Nessun riferimento personale pubblicato · Aggiornamento ${updated} · Metodo ${state.meta?.methodologyVersion ?? "0.1.1"}`;
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
  const [left, right] = state.compare.map(personById);
  if (!left || !right) return;
  document.querySelector("#compare-table").innerHTML = `
    <div class="comparison-row header">
      <div><span class="comparison-label">Indicatore</span></div>
      <div><strong>${escapeHtml(left.name)}</strong><span>Anonimo</span></div>
      <div><strong>${escapeHtml(right.name)}</strong><span>Anonimo</span></div>
    </div>
    ${comparisonRow("Fascia attività", escapeHtml(left.scoreBand), escapeHtml(right.scoreBand), "Intervallo su 100")}
    ${comparisonRow("Partecipazione voti", escapeHtml(percent(left.metrics.participationPct)), escapeHtml(percent(right.metrics.participationPct)), "Missioni escluse")}
    ${comparisonRow("Proposte di legge", escapeHtml(integer(left.metrics.billsFirstSigned)), escapeHtml(integer(right.metrics.billsFirstSigned)), "Primo firmatario")}
    ${comparisonRow("Indirizzo e controllo", escapeHtml(integer(left.metrics.oversightFirstSigned)), escapeHtml(integer(right.metrics.oversightFirstSigned)), "Primo firmatario")}
    ${comparisonRow("Interventi", escapeHtml(integer(left.metrics.interventions)), escapeHtml(integer(right.metrics.interventions)), "Fascia aggregata")}`;
  document.querySelector("#compare-dialog").showModal();
}

function populateSources() {
  // I riferimenti diretti sono intenzionalmente esclusi dalla pubblicazione.
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
    ? `${current.name} · fascia attività ${current.scoreBand ?? "N/D"}/100`
    : "Nessun eletto selezionato";
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
    evidenceField.setCustomValidity("Inserisci un collegamento che inizi con http:// o https://");
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
    { label: "Esperienza collegata a una fonte", ok: Boolean(experience && isHttpUrl(evidence)) },
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

  const incumbentText = current
    ? `${current.name}: fascia attività ${current.scoreBand ?? "N/D"}/100, partecipazione ${percent(current.metrics.participationPct)}, proposte di legge nella fascia ${integer(current.metrics.billsFirstSigned)}.`
    : "Nessun eletto selezionato. Apri una scheda per collegare il confronto a un mandato in corso.";
  const commitmentsHtml = commitments.length
    ? `<ol>${commitments.map((commitment) => `<li>${escapeHtml(commitment)}</li>`).join("")}</ol>`
    : "<p>Nessun impegno strutturato.</p>";
  document.querySelector("#alternative-copy").innerHTML = `
    <article><h4>Esperienza dichiarata</h4><p>${escapeHtml(experience)}</p></article>
    <article><h4>Mandato di riferimento</h4><p>${escapeHtml(incumbentText)}</p></article>
    <article><h4>Impegni proposti</h4>${commitmentsHtml}<p><a href="${escapeHtml(evidence)}" target="_blank" rel="noreferrer">Apri la fonte dichiarata ↗</a></p></article>`;

  state.alternativeText = [
    "MANDATO APERTO — SCHEDA ALTERNATIVA (BOZZA PRIVATA, NON CERTIFICATA)",
    `Alternativa: ${name}`,
    `Stato: ${status}`,
    `Eletto di riferimento: ${current?.name ?? "non selezionato"}`,
    "",
    "ESPERIENZA DICHIARATA",
    experience,
    `Fonte: ${evidence}`,
    "",
    "IMPEGNI MISURABILI",
    ...commitments.map((commitment, index) => `${index + 1}. ${commitment}`),
    "",
    `Trasparenza dichiarata: ${transparency ? "sì" : "no"}`,
    `Completezza formale: ${readiness}/4`,
    "",
    "Nota: questa scheda non certifica la candidatura, non assegna un punteggio politico e non sostituisce le fonti elettorali ufficiali."
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
      ? stored.map(String).filter((id) => personById(id)).slice(0, 2)
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
    state.deputies = payload.deputies ?? [];
    state.meta = payload.meta ?? {};
    elements.total.textContent = numberFormat.format(state.deputies.length);
    const updated = state.meta.generatedAt ? dateFormat.format(new Date(state.meta.generatedAt)) : "data non disponibile";
    elements.freshness.textContent = `Dati istituzionali aggregati · aggiornati ${updated}`;
    populateGroups();
    populateSources();
    restoreCompare();
    applyFilters();
    updateCompareBar();
  } catch (error) {
    console.error(error);
    elements.freshness.textContent = "Dati temporaneamente non disponibili";
    elements.count.textContent = "Errore di caricamento";
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "Impossibile caricare le schede";
    elements.empty.querySelector("p").textContent = "Riprova tra poco.";
    elements.reset.hidden = true;
  }
}

elements.search.addEventListener("input", applyFilters);
elements.group?.addEventListener("change", applyFilters);
elements.sort.addEventListener("change", applyFilters);
elements.reset.addEventListener("click", () => {
  elements.search.value = "";
  if (elements.group) elements.group.value = "";
  elements.sort.value = "name";
  applyFilters();
  elements.search.focus();
});
elements.loadMore.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderCards();
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
      document.querySelector("#alternative-current").textContent = "Nessun eletto selezionato";
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
