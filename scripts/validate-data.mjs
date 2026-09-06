import { readFile } from "node:fs/promises";

const path = new URL("../dist/data/deputies.json", import.meta.url);
const payload = JSON.parse(await readFile(path, "utf8"));
const deputies = payload.deputies;
const allowedAreas = new Set(["Centrodestra", "Centrosinistra", "M5S", "Centro", "Autonomie/altro"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isValidInactivityBand(band) {
  if (band === "N/D") return true;
  const match = String(band).match(/^(\d+)(?:–(\d+))?$/);
  if (!match) return false;
  const lower = Number(match[1]);
  const upper = Number(match[2] ?? match[1]);
  return lower >= 0 && upper <= 100 && lower <= upper && upper - lower <= 9;
}

assert(Array.isArray(deputies), "deputies deve essere un array");
assert(deputies.length >= 350 && deputies.length <= 450, `numero deputati anomalo: ${deputies.length}`);
assert(new Set(deputies.map((item) => item.id)).size === deputies.length, "id duplicati");
assert(payload.meta?.methodologyVersion === "0.1.3", "versione metodologia inattesa");
assert(!/https?:/i.test(JSON.stringify(payload.meta?.sources ?? [])), "collegamento diretto presente nelle fonti pubblicate");

for (const deputy of deputies) {
  assert(deputy.name, `scheda incompleta: ${deputy.id}`);
  assert(/^R\d{3}$/.test(deputy.id), `identificativo non pseudonimo: ${deputy.id}`);
  assert(deputy.name === `Politico ${deputy.id}`, `nome non anonimo: ${deputy.id}`);
  for (const key of ["uri", "firstName", "lastName", "group", "constituency", "profileUrl", "photoUrl", "score", "scoreBand", "scoreLabel"]) {
    assert(!(key in deputy), `campo identificativo presente (${key}): ${deputy.id}`);
  }
  assert(allowedAreas.has(deputy.politicalArea), `macro-area politica non valida: ${deputy.id}`);
  assert(isValidInactivityBand(deputy.inactivityBand), `fascia inattività non valida: ${deputy.id}`);
  assert(typeof deputy.inactivityLabel === "string" && deputy.inactivityLabel.length > 0, `etichetta inattività non valida: ${deputy.id}`);
  assert(Object.keys(deputy.metrics).length === 4, `metriche eccedenti: ${deputy.id}`);
  for (const [key, band] of Object.entries(deputy.metrics)) {
    assert(typeof band === "string" && band.length > 0, `fascia ${key} non valida: ${deputy.id}`);
  }
  assert(!/https?:|camera\.it/.test(JSON.stringify(deputy)), `collegamento riconducibile presente: ${deputy.id}`);
}

console.log(`Dataset valido: ${deputies.length} politici, metodologia ${payload.meta.methodologyVersion}.`);