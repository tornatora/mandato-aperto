import { mkdir, writeFile } from "node:fs/promises";

const LEGISLATURE = 19;
const CAMERA_LIST_URL = `https://www.camera.it/deputati/ws/elenco_deputati?_format=json&leg=${LEGISLATURE}`;
const CAMERA_SPARQL_URL = "https://dati.camera.it/sparql";
const OUTPUT = new URL("../dist/data/deputies.json", import.meta.url);
const LEG_URI = `http://dati.camera.it/ocd/legislatura.rdf/repubblica_${LEGISLATURE}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, { attempts = 4, timeout = 150_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json, application/sparql-results+json",
          "user-agent": "MandatoAperto/0.1 (+https://github.com/)"
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1_250);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function sparql(query, options) {
  const url = new URL(CAMERA_SPARQL_URL);
  url.searchParams.set("format", "application/sparql-results+json");
  url.searchParams.set("query", query);
  const payload = await fetchJson(url, options);
  return payload.results?.bindings ?? [];
}

function value(binding, key, fallback = "") {
  return binding?.[key]?.value ?? fallback;
}

function normalizeName(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleUpperCase("it-IT");
}

function displayName(text) {
  return text
    .toLocaleLowerCase("it-IT")
    .replace(/(^|[\s'’-])\p{L}/gu, (match) => match.toLocaleUpperCase("it-IT"));
}

function addNested(map, id, key, amount) {
  if (!map.has(id)) map.set(id, new Map());
  const inner = map.get(id);
  inner.set(key, (inner.get(key) ?? 0) + amount);
}

function sumMatching(inner, predicate) {
  if (!inner) return 0;
  return [...inner.entries()].reduce(
    (total, [key, amount]) => total + (predicate(key) ? amount : 0),
    0
  );
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction));
  return sorted[index];
}

function logScale(value, cap) {
  if (!Number.isFinite(value) || value <= 0 || cap <= 0) return 0;
  return Math.min(1, Math.log1p(value) / Math.log1p(cap));
}

async function fetchAttendanceBatch(uris) {
  const values = uris.map((uri) => `<${uri}>`).join("\n");
  const query = `
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?deputato ?tipo ?descrizione (COUNT(DISTINCT ?voto) AS ?numero)
WHERE {
  VALUES ?deputato {
    ${values}
  }
  ?voto ocd:rif_deputato ?deputato;
        ocd:rif_votazione ?votazione;
        dc:type ?tipo.
  OPTIONAL { ?voto dc:description ?descrizione. }
}
GROUP BY ?deputato ?tipo ?descrizione`;

  try {
    return await sparql(query, { attempts: 2, timeout: 120_000 });
  } catch (error) {
    if (uris.length === 1) throw error;
    const middle = Math.ceil(uris.length / 2);
    const [left, right] = await Promise.all([
      fetchAttendanceBatch(uris.slice(0, middle)),
      fetchAttendanceBatch(uris.slice(middle))
    ]);
    return [...left, ...right];
  }
}

async function mapPool(items, concurrency, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
}

const basicQuery = `
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dct: <http://purl.org/dc/terms/>
SELECT DISTINCT ?deputato ?nome ?cognome ?foto ?profilo ?circoscrizione
WHERE {
  ?deputato a ocd:deputato;
            ocd:rif_leg <${LEG_URI}>;
            ocd:rif_mandatoCamera ?mandato;
            foaf:firstName ?nome;
            foaf:surname ?cognome.
  FILTER NOT EXISTS { ?mandato ocd:endDate ?fineMandato. }
  OPTIONAL { ?deputato foaf:depiction ?foto. }
  OPTIONAL { ?deputato dct:isReferencedBy ?profilo. }
  OPTIONAL {
    ?mandato ocd:rif_elezione ?elezione.
    ?elezione dc:coverage ?circoscrizione.
  }
}
ORDER BY ?cognome ?nome`;

const firstSignerQuery = `
PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?deputato ?tipo (COUNT(DISTINCT ?atto) AS ?numero)
WHERE {
  ?deputato a ocd:deputato;
            ocd:rif_leg <${LEG_URI}>;
            ocd:rif_mandatoCamera ?mandato.
  FILTER NOT EXISTS { ?mandato ocd:endDate ?fineMandato. }
  ?atto ocd:primo_firmatario ?deputato.
  OPTIONAL { ?atto dc:type ?tipo. }
}
GROUP BY ?deputato ?tipo`;

const coSignerQuery = `
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT ?deputato (COUNT(DISTINCT ?atto) AS ?numero)
WHERE {
  ?deputato a ocd:deputato;
            ocd:rif_leg <${LEG_URI}>;
            ocd:rif_mandatoCamera ?mandato.
  FILTER NOT EXISTS { ?mandato ocd:endDate ?fineMandato. }
  ?atto ocd:altro_firmatario ?deputato.
}
GROUP BY ?deputato`;

const interventionsQuery = `
PREFIX ocd: <http://dati.camera.it/ocd/>
SELECT ?deputato (COUNT(DISTINCT ?intervento) AS ?numero)
WHERE {
  ?deputato a ocd:deputato;
            ocd:rif_leg <${LEG_URI}>;
            ocd:rif_mandatoCamera ?mandato.
  FILTER NOT EXISTS { ?mandato ocd:endDate ?fineMandato. }
  ?intervento a ocd:intervento;
              ocd:rif_deputato ?deputato.
}
GROUP BY ?deputato`;

console.log("Scarico elenco, attività e interventi dalla Camera…");
const [officialList, basicRows, firstRows, coRows, interventionRows] = await Promise.all([
  fetchJson(CAMERA_LIST_URL),
  sparql(basicQuery),
  sparql(firstSignerQuery),
  sparql(coSignerQuery),
  sparql(interventionsQuery)
]);

const currentGroups = new Map(
  officialList
    .filter((person) => !person.data_cessazione)
    .map((person) => [normalizeName(`${person.nome} ${person.cognome}`), person.gruppo])
);

const firstByDeputy = new Map();
for (const row of firstRows) {
  addNested(firstByDeputy, value(row, "deputato"), value(row, "tipo", "Altro"), Number(value(row, "numero", 0)));
}

const coByDeputy = new Map(
  coRows.map((row) => [value(row, "deputato"), Number(value(row, "numero", 0))])
);
const interventionsByDeputy = new Map(
  interventionRows.map((row) => [value(row, "deputato"), Number(value(row, "numero", 0))])
);

console.log(`Calcolo partecipazione per ${basicRows.length} deputati…`);
const uris = basicRows.map((row) => value(row, "deputato"));
const batches = [];
for (let index = 0; index < uris.length; index += 12) batches.push(uris.slice(index, index + 12));
const attendanceRows = (await mapPool(batches, 5, fetchAttendanceBatch)).flat();
const attendanceByDeputy = new Map();
for (const row of attendanceRows) {
  const deputy = value(row, "deputato");
  const key = `${value(row, "tipo")}|${value(row, "descrizione")}`;
  addNested(attendanceByDeputy, deputy, key, Number(value(row, "numero", 0)));
}

const oversightPattern = /(INTERROGAZIONE|INTERPELLANZA|MOZIONE|RISOLUZIONE|ORDINE DEL GIORNO|\bODG\b)/i;

const deputies = basicRows.map((row) => {
  const uri = value(row, "deputato");
  const first = firstByDeputy.get(uri) ?? new Map();
  const attendance = attendanceByDeputy.get(uri) ?? new Map();
  const firstName = value(row, "nome");
  const lastName = value(row, "cognome");
  const votesCast = sumMatching(attendance, (key) => /^(Favorevole|Contrario|Astensione|Ha votato)\|/.test(key));
  const absentVotes = attendance.get("Non ha votato|Non ha partecipato") ?? 0;
  const missions = attendance.get("Non ha votato|In missione") ?? 0;
  const presiding = attendance.get("Non ha votato|Presidente di turno") ?? 0;
  const eligibleVotes = votesCast + absentVotes;
  const participationPct = eligibleVotes ? Math.round((votesCast / eligibleVotes) * 1_000) / 10 : null;
  const billsFirstSigned = sumMatching(first, (type) => /Progetto di Legge/i.test(type));
  const oversightFirstSigned = sumMatching(first, (type) => oversightPattern.test(type));
  const actsFirstSigned = sumMatching(first, () => true);
  const id = uri.match(/d(\d+)_/)?.[1] ?? uri;
  const profile = value(row, "profilo").replace(/^http:/, "https:");

  return {
    id,
    uri,
    name: `${displayName(firstName)} ${displayName(lastName)}`,
    firstName: displayName(firstName),
    lastName: displayName(lastName),
    group: currentGroups.get(normalizeName(`${firstName} ${lastName}`)) ?? "Gruppo non disponibile",
    constituency: value(row, "circoscrizione", "Circoscrizione non disponibile"),
    profileUrl: profile,
    photoUrl: value(row, "foto").replace(/^http:/, "https:"),
    metrics: {
      participationPct,
      votesCast,
      absentVotes,
      missions,
      presiding,
      eligibleVotes,
      billsFirstSigned,
      oversightFirstSigned,
      actsFirstSigned,
      actsCoSigned: coByDeputy.get(uri) ?? 0,
      interventions: interventionsByDeputy.get(uri) ?? 0
    }
  };
});

const caps = {
  billsFirstSigned: percentile(deputies.map((item) => item.metrics.billsFirstSigned), 0.95),
  oversightFirstSigned: percentile(deputies.map((item) => item.metrics.oversightFirstSigned), 0.95),
  interventions: percentile(deputies.map((item) => item.metrics.interventions), 0.95)
};

for (const deputy of deputies) {
  const { metrics } = deputy;
  const complete = Number.isFinite(metrics.participationPct) && metrics.eligibleVotes > 0;
  const score = complete
    ? Math.round(
        50 * (metrics.participationPct / 100) +
          20 * logScale(metrics.billsFirstSigned, caps.billsFirstSigned) +
          15 * logScale(metrics.oversightFirstSigned, caps.oversightFirstSigned) +
          15 * logScale(metrics.interventions, caps.interventions)
      )
    : null;
  deputy.score = score;
  deputy.dataComplete = complete;
}

const scoreBands = {
  p20: percentile(deputies.map((item) => item.score), 0.2),
  p40: percentile(deputies.map((item) => item.score), 0.4),
  p60: percentile(deputies.map((item) => item.score), 0.6),
  p80: percentile(deputies.map((item) => item.score), 0.8)
};

for (const deputy of deputies) {
  const score = deputy.score;
  deputy.scoreLabel = !Number.isFinite(score)
    ? deputy.metrics.presiding > 0 && deputy.metrics.eligibleVotes === 0
      ? "Ruolo non comparabile"
      : "Dati insufficienti"
    : score >= scoreBands.p80
      ? "Fascia superiore"
      : score >= scoreBands.p60
        ? "Sopra la mediana"
        : score >= scoreBands.p40
          ? "Fascia centrale"
          : score >= scoreBands.p20
            ? "Sotto la mediana"
            : "Fascia inferiore";
}

deputies.sort((a, b) => a.lastName.localeCompare(b.lastName, "it") || a.firstName.localeCompare(b.firstName, "it"));

const payload = {
  meta: {
    title: "Mandato Aperto — Camera dei deputati",
    legislature: "XIX",
    scope: "Deputati in carica",
    generatedAt: new Date().toISOString(),
    methodologyVersion: "0.1.0",
    scoreCaps: caps,
    scoreBands,
    count: deputies.length,
    disclaimer: "L'indice misura attività documentata, non qualità, competenza, integrità o efficacia politica.",
    sources: [
      {
        name: "Camera dei deputati — elenco ufficiale",
        url: "https://www.camera.it/deputati/elenco"
      },
      {
        name: "Camera dei deputati — Linked Open Data",
        url: CAMERA_SPARQL_URL
      }
    ]
  },
  deputies
};

await mkdir(new URL("../dist/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Salvati ${deputies.length} deputati in ${OUTPUT.pathname}`);
