const SOURCES = [
  {
    id: 'reggiofest',
    name: 'Comune di Reggio Calabria · ReggioFest 2026',
    type: 'Comune',
    url: 'https://comune.reggio-calabria.it/Notizie/Details/8263',
    critical: true
  },
  {
    id: 'mariane',
    name: 'Comune di Reggio Calabria · Festività Mariane',
    type: 'Comune',
    url: 'https://comune.reggio-calabria.it/Notizie/Details/8435',
    critical: true
  },
  {
    id: 'marrc',
    name: 'Comune di Reggio Calabria · Estate al MArRC',
    type: 'Cultura',
    url: 'https://www.comune.reggio-calabria.it/Eventi/Details/11',
    critical: false
  },
  {
    id: 'oppido',
    name: 'Comune di Oppido Mamertina',
    type: 'Comune',
    url: 'https://comune.oppidomamertina.rc.it/',
    critical: true
  },
  {
    id: 'diocesi',
    name: 'Diocesi Oppido Mamertina · Palmi',
    type: 'Diocesi',
    url: 'https://www.diocesioppidopalmi.it/wd-appuntamenti/conferenza-episcopale-calabra/',
    critical: true
  },
  {
    id: 'palmi',
    name: 'Comune di Palmi',
    type: 'Comune',
    url: 'https://www.comune.palmi.rc.it/',
    critical: true
  },
  {
    id: 'aci',
    name: 'ACI Sport · Calendario',
    type: 'Sport',
    url: 'https://www.acisport.it/it/acisport/calendari/9/2026/0/0',
    critical: false
  },
  {
    id: 'cai',
    name: 'CAI Reggio Calabria · Eventi',
    type: 'Associazione',
    url: 'https://organizzazione.cai.it/sez-reggio-calabria/eventi/mese/',
    critical: false
  }
];

async function checkSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  const started = Date.now();
  try {
    const res = await fetch(source.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'user-agent': 'GAL-BaTiR-Agenda/1.0 (+public-event-source-check)',
        'accept': 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });
    const text = await res.text();
    return {
      ...source,
      online: res.ok,
      status: res.status,
      responseMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      marker: detectMarker(source.id, text)
    };
  } catch (error) {
    return {
      ...source,
      online: false,
      status: 0,
      responseMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      marker: null,
      error: error?.name === 'AbortError' ? 'timeout' : 'unreachable'
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectMarker(id, html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  if (id === 'palmi') return /Nessun evento in programma/i.test(text) ? 'nessun-evento' : 'pagina-attiva';
  if (id === 'oppido') return /Slalom città di Oppido Mamertina/i.test(text) ? 'slalom-2026' : 'pagina-attiva';
  if (id === 'reggiofest') return /ReggioFest2026/i.test(text) ? 'reggiofest-2026' : 'pagina-attiva';
  if (id === 'mariane') return /Notti Reggine|Festività Mariane/i.test(text) ? 'mariane-2026' : 'pagina-attiva';
  if (id === 'diocesi') return /Gioia Tauro|Taurianova|Rizziconi/i.test(text) ? 'agenda-settembre' : 'pagina-attiva';
  if (id === 'marrc') return /Estate al MArRC/i.test(text) ? 'marrc-2026' : 'pagina-attiva';
  if (id === 'aci') return /OPPIDO MAMERTINA/i.test(text) ? 'oppido-aci' : 'pagina-attiva';
  if (id === 'cai') return /Settembre 2026|Carmelia|Sant.Elia/i.test(text) ? 'agenda-settembre' : 'pagina-attiva';
  return 'pagina-attiva';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  const checks = await Promise.all(SOURCES.map(checkSource));
  const online = checks.filter(s => s.online).length;
  const critical = checks.filter(s => s.critical);
  const criticalOnline = critical.filter(s => s.online).length;
  const coverage = Math.round((online / checks.length) * 100);
  const criticalCoverage = Math.round((criticalOnline / critical.length) * 100);
  res.status(200).json({
    refreshedAt: new Date().toISOString(),
    coverage,
    criticalCoverage,
    sources: checks
  });
}
