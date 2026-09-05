import { readFile } from "node:fs/promises";

const path = new URL("../dist/data/deputies.json", import.meta.url);
const payload = JSON.parse(await readFile(path, "utf8"));
const deputies = payload.deputies;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(Array.isArray(deputies), "deputies deve essere un array");
assert(deputies.length >= 350 && deputies.length <= 450, `numero deputati anomalo: ${deputies.length}`);
assert(new Set(deputies.map((item) => item.id)).size === deputies.length, "id duplicati");
assert(payload.meta?.methodologyVersion === "0.1.1", "versione metodologia inattesa");

for (const deputy of deputies) {
  assert(deputy.name, `scheda incompleta: ${deputy.id}`);
  assert(/^R\d{3}$/.test(deputy.id), `identificativo non pseudonimo: ${deputy.id}`);
  assert(deputy.name === `Rappresentante ${deputy.id}`, `nome non anonimo: ${deputy.id}`);
  for (const key of ["uri", "firstName", "lastName", "group", "constituency", "profileUrl", "photoUrl", "score"]) {
    assert(!(key in deputy), `campo identificativo presente (${key}): ${deputy.id}`);
  }
  assert(/^((\d+–\d+)|100|N\/D)$/.test(deputy.scoreBand), `fascia indice non valida: ${deputy.id}`);
  assert(Object.keys(deputy.metrics).length === 4, `metriche eccedenti: ${deputy.id}`);
  for (const [key, band] of Object.entries(deputy.metrics)) {
    assert(typeof band === "string" && band.length > 0, `fascia ${key} non valida: ${deputy.id}`);
  }
  assert(!/https?:|camera\.it/.test(JSON.stringify(deputy)), `collegamento riconducibile presente: ${deputy.id}`);
}

console.log(`Dataset valido: ${deputies.length} deputati, metodologia ${payload.meta.methodologyVersion}.`);
