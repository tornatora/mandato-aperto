import { readFile } from "node:fs/promises";

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error("Uso: node scripts/compare-public-data.mjs <prima.json> <dopo.json>");
  process.exit(2);
}

const [before, after] = await Promise.all([
  readFile(beforePath, "utf8").then(JSON.parse),
  readFile(afterPath, "utf8").then(JSON.parse)
]);

function canonical(payload) {
  const deputies = (payload.deputies ?? [])
    .map((item) => ({
      metrics: item.metrics,
      inactivityBand: item.inactivityBand,
      inactivityLabel: item.inactivityLabel,
      dataComplete: item.dataComplete
    }))
    .map((item) => JSON.stringify(item))
    .sort();

  return JSON.stringify({
    legislature: payload.meta?.legislature,
    methodologyVersion: payload.meta?.methodologyVersion,
    count: payload.meta?.count,
    scoreCaps: payload.meta?.scoreCaps,
    scoreBands: payload.meta?.scoreBands,
    deputies
  });
}

if (canonical(before) === canonical(after)) {
  console.log("NO_REAL_CHANGE");
  process.exit(0);
}

console.log("REAL_CHANGE");
process.exit(1);
