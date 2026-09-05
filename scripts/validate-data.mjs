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
assert(payload.meta?.methodologyVersion === "0.1.0", "versione metodologia inattesa");

for (const deputy of deputies) {
  assert(deputy.name && deputy.group && deputy.profileUrl, `scheda incompleta: ${deputy.id}`);
  assert(deputy.profileUrl.startsWith("https://"), `fonte non HTTPS: ${deputy.id}`);
  for (const [key, number] of Object.entries(deputy.metrics)) {
    assert(number === null || (Number.isFinite(number) && number >= 0), `metrica ${key} non valida: ${deputy.id}`);
  }
  assert(deputy.score === null || (Number.isInteger(deputy.score) && deputy.score >= 0 && deputy.score <= 100), `indice non valido: ${deputy.id}`);
}

console.log(`Dataset valido: ${deputies.length} deputati, metodologia ${payload.meta.methodologyVersion}.`);
