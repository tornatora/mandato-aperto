const SOURCE_META = {
  reggiofest: { name: 'Comune RC · ReggioFest', type: 'Comune' },
  mariane: { name: 'Comune RC · Festività Mariane', type: 'Comune' },
  marrc: { name: 'Estate al MArRC', type: 'Cultura' },
  oppido: { name: 'Comune di Oppido Mamertina', type: 'Comune' },
  diocesi: { name: 'Diocesi Oppido · Palmi', type: 'Diocesi' },
  palmi: { name: 'Comune di Palmi', type: 'Comune' },
  aci: { name: 'ACI Sport', type: 'Sport' },
  cai: { name: 'CAI Reggio Calabria', type: 'Associazione' }
};

const EVENTS = [
  ev('2026-09-01','Quant’è bella la Calabria','Reggio Calabria · Pellaro','Piazza Mercato Lume','outdoor','reggiofest','Laboratorio / spettacolo diffuso'),
  ev('2026-09-02','Quant’è bella la Calabria','Reggio Calabria · Pellaro','Piazza Mercato Lume','outdoor','reggiofest','Laboratorio / spettacolo diffuso'),
  ev('2026-09-03','Qua si campa d’aria','Reggio Calabria · Pellaro','Via Lume 62','indoor','reggiofest','Laboratorio teatrale'),
  ev('2026-09-03','J’oòutamà trio','Reggio Calabria','Terrazza MArRC','outdoor','marrc','Concerto'),
  ev('2026-09-04','Qua si campa d’aria','Reggio Calabria · Pellaro','Via Lume 62','indoor','reggiofest','Laboratorio teatrale'),
  ev('2026-09-04','Festival Settembre di Demetra','Reggio Calabria','Terrazza MArRC','outdoor','marrc','Conferenza / cultura'),
  ev('2026-09-05','X Slalom Città di Oppido Mamertina','Oppido Mamertina','Centro urbano / percorso gara','sport','oppido','Festa e gara automobilistica'),
  ev('2026-09-05','X Slalom Città di Oppido Mamertina','Oppido Mamertina','Centro urbano / percorso gara','sport','aci','Evento sportivo'),
  ev('2026-09-06','ReggioFest · spettacoli TCA','Reggio Calabria · Santa Caterina','Piazza Sant’Ambrogio','outdoor','reggiofest','Spettacolo dal vivo'),
  ev('2026-09-06','Danzare il grecanico','Reggio Calabria','Palestra Liceo Preti-Campanella-Frangipane','indoor','reggiofest','Laboratorio'),
  ev('2026-09-06','X Slalom Città di Oppido Mamertina','Oppido Mamertina','Centro urbano / percorso gara','sport','oppido','Gara automobilistica'),
  ev('2026-09-07','ReggioFest · spettacoli TCA','Reggio Calabria · Santa Caterina','Piazza Sant’Ambrogio','outdoor','reggiofest','Spettacolo dal vivo'),
  ev('2026-09-07','Laboratori di Arte Contemporanea','Reggio Calabria','Museo Archeologico Nazionale','indoor','marrc','Laboratorio'),
  ev('2026-09-07','S. Messa','Gioia Tauro','Gioia Tauro','religious','diocesi','Appuntamento del Vescovo'),
  ev('2026-09-08','ReggioFest · spettacoli TCA','Reggio Calabria · Santa Caterina','Piazza Sant’Ambrogio','outdoor','reggiofest','Spettacolo dal vivo'),
  ev('2026-09-08','S. Messa','Taurianova','Taurianova','religious','diocesi','Appuntamento del Vescovo'),
  ev('2026-09-09','ReggioFest · spettacoli TCA','Reggio Calabria · Santa Caterina','Piazza Sant’Ambrogio','outdoor','reggiofest','Spettacolo dal vivo'),
  ...range('2026-09-10','2026-09-21').map(d=>ev(d,'Festa Patronale · area fieristica','Reggio Calabria · Pentimele','Zona Pentimele lato mare','fair','mariane','Fiera e attività commerciali')),
  ev('2026-09-10','Conferenza Episcopale Calabra','Diocesi Oppido Mamertina · Palmi','Sede indicata dalla Diocesi','indoor','diocesi','Conferenza'),
  ev('2026-09-11','Conferenza Episcopale Calabra','Diocesi Oppido Mamertina · Palmi','Sede indicata dalla Diocesi','indoor','diocesi','Conferenza'),
  ev('2026-09-11','Presentazione libro di don Giuseppe Sofrà','Gioia Tauro','Gioia Tauro','indoor','diocesi','Presentazione libro'),
  ev('2026-09-11','Veglia Mariana','Reggio Calabria','Basilica dell’Eremo','religious','mariane','Celebrazione religiosa'),
  ev('2026-09-12','Processione Madonna della Consolazione','Reggio Calabria','Eremo → Basilica Cattedrale','religious','mariane','Grande evento religioso e civile'),
  ev('2026-09-13','Ritiro con i seminaristi','Monte Cucudo','Monte Cucudo','religious','diocesi','Ritiro'),
  ev('2026-09-14','Celebrazioni mariane al MArRC','Reggio Calabria','Museo Archeologico Nazionale','indoor','marrc','Apertura straordinaria'),
  ev('2026-09-15','Festività Mariane · processione e fuochi','Reggio Calabria','Centro città','religious','mariane','Evento principale della città'),
  ev('2026-09-17','Piccoli Sogni','Reggio Calabria','Antigone · Osservatorio sulla ’ndrangheta','indoor','reggiofest','Teatro di strada / laboratorio'),
  ev('2026-09-17','Assemblea diocesana','Rizziconi','Auditorium Famiglia di Nazareth','indoor','diocesi','Assemblea'),
  ev('2026-09-18','Piccoli Sogni','Reggio Calabria','Antigone · Osservatorio sulla ’ndrangheta','indoor','reggiofest','Teatro di strada / laboratorio'),
  ev('2026-09-18','Assemblea diocesana · 2° giorno','Rizziconi','Auditorium Famiglia di Nazareth','indoor','diocesi','Assemblea'),
  ev('2026-09-19','S. Messa e Indizione Visita Pastorale','Oppido Mamertina','Cattedrale','religious','diocesi','Celebrazione'),
  ev('2026-09-19','Carmelia · Puntone La Croce · Polsi','Aspromonte','Carmelia → Santuario di Polsi','outdoor','cai','Trekking'),
  ev('2026-09-20','Carmelia · Puntone La Croce · Polsi','Aspromonte','Santuario di Polsi','outdoor','cai','Trekking'),
  ev('2026-09-20','Anello dei Piani di Sant’Elia','Palmi','Piani di Sant’Elia','outdoor','cai','Escursione'),
  ev('2026-09-21','Piccoli Sogni','Reggio Calabria','Antigone · Osservatorio sulla ’ndrangheta','indoor','reggiofest','Teatro di strada / laboratorio'),
  ev('2026-09-22','Teatro Escape · Miti in fuga','Reggio Calabria','I.C. Catanoso · De Gasperi · Cardeto · S. Sperato','indoor','reggiofest','Teatro / scuola'),
  ev('2026-09-23','ReggioFest · spettacolo Adexo APS','Reggio Calabria · Pellaro','Arena Lega Navale','outdoor','reggiofest','Spettacolo dal vivo')
];

function ev(date,title,city,venue,category,sourceId,type){return {id:`${date}-${title}-${sourceId}`,date,title,city,venue,category,sourceId,type}}
function range(start,end){const out=[];let d=new Date(`${start}T12:00:00`),e=new Date(`${end}T12:00:00`);while(d<=e){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1)}return out}

const SOURCE_URLS={
  reggiofest:'https://comune.reggio-calabria.it/Notizie/Details/8263',
  mariane:'https://comune.reggio-calabria.it/Notizie/Details/8435',
  marrc:'https://www.comune.reggio-calabria.it/Eventi/Details/11',
  oppido:'https://comune.oppidomamertina.rc.it/',
  diocesi:'https://www.diocesioppidopalmi.it/wd-appuntamenti/conferenza-episcopale-calabra/',
  palmi:'https://www.comune.palmi.rc.it/',
  aci:'https://www.acisport.it/it/acisport/calendari/9/2026/0/0',
  cai:'https://organizzazione.cai.it/sez-reggio-calabria/eventi/mese/'
};

const monthNames=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const weekdayShort=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const state={year:2026,month:8,filter:'all',query:'',coverage:0,criticalCoverage:0,sources:[],galDates:new Set(),today:'2026-09-08'};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function dateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function eventsOn(key){return EVENTS.filter(e=>e.date===key && (state.filter==='all'||e.category===state.filter) && (!state.query || `${e.title} ${e.city} ${e.venue}`.toLowerCase().includes(state.query.toLowerCase())))}
function allEventsOn(key){return EVENTS.filter(e=>e.date===key)}
function dayStatus(key){const events=allEventsOn(key);if(state.galDates.has(key)) return 'gal';if(state.criticalCoverage<80) return 'incomplete';if(events.length===0) return 'free';if(events.length===1 && !isMajor(events[0])) return 'low';return 'busy'}
function isMajor(e){return /processione|festa patronale|slalom|fiera|fuochi/i.test(`${e.title} ${e.type}`)}
function labelFor(status,count){if(status==='gal')return 'GAL';if(status==='incomplete')return 'DA VERIFICARE';if(status==='free')return 'LIBERA';if(status==='low')return `${count} EVENTO`;return `${count} EVENTI`}
function metaFor(status){if(status==='free')return '';if(status==='low')return 'pressione bassa';if(status==='busy')return 'conflitto alto';if(status==='gal')return 'evento GAL';return 'copertura incompleta'}

function render(){
  $('#monthTitle').textContent=`${monthNames[state.month]} ${state.year}`;
  $('#periodLabel').textContent=`Provincia di Reggio Calabria · ${monthNames[state.month].toLowerCase()} ${state.year}`;
  const first=new Date(state.year,state.month,1,12);const days=new Date(state.year,state.month+1,0).getDate();let mondayIndex=(first.getDay()+6)%7;
  const prevDays=new Date(state.year,state.month,0).getDate();const cells=[];
  for(let i=0;i<mondayIndex;i++)cells.push({d:prevDays-mondayIndex+i+1,outside:true,offset:-1});
  for(let d=1;d<=days;d++)cells.push({d,outside:false,offset:0});
  while(cells.length%7)cells.push({d:cells.length%7+1,outside:true,offset:1});
  $('#calendarGrid').innerHTML=cells.map(c=>{
    if(c.outside)return `<div class="day outside"><span class="day-number">${c.d}</span></div>`;
    const key=dateKey(state.year,state.month,c.d), all=allEventsOn(key), visible=eventsOn(key), status=dayStatus(key), hiddenByFilter=all.length && !visible.length;
    const today=key===state.today?'<span class="today-badge">OGGI</span>':'';
    const count=state.filter==='all'&&!state.query?all.length:visible.length;
    const effectiveStatus=hiddenByFilter && (state.filter!=='all'||state.query)?'free':status;
    return `<button class="day ${effectiveStatus} ${key===state.today?'today':''}" data-date="${key}">${today}<span class="day-number">${c.d}</span><div><span class="day-label">${labelFor(effectiveStatus,count)}</span><div class="day-meta">${metaFor(effectiveStatus)}</div></div></button>`
  }).join('');
  $$('.day[data-date]').forEach(b=>b.addEventListener('click',()=>openDrawer(b.dataset.date)));
  renderMetrics();renderBestDates();
}

function getMonthDates(){const days=new Date(state.year,state.month+1,0).getDate();return Array.from({length:days},(_,i)=>dateKey(state.year,state.month,i+1))}
function renderMetrics(){
  const keys=getMonthDates();const free=keys.filter(k=>dayStatus(k)==='free').length;const busy=keys.filter(k=>dayStatus(k)==='busy').length;
  $('#freeDates').textContent=state.criticalCoverage<80?'—':free;$('#highConflict').textContent=busy;$('#coverage').textContent=state.coverage?`${state.coverage}%`:'—';
  const best=getBestDates()[0];
  if(best){const d=new Date(`${best}T12:00:00`);$('#nextBest').textContent=`${weekdayShort[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()].toLowerCase()}`;$('#nextBestMeta').textContent=`0 eventi rilevati · ${state.coverage}% fonti`}
  else{$('#nextBest').textContent='Nessuna data certa';$('#nextBestMeta').textContent=state.criticalCoverage<80?'copertura critica incompleta':'nel mese selezionato'}
}
function getBestDates(){if(state.criticalCoverage<80)return[];const today=new Date(`${state.today}T12:00:00`);return getMonthDates().filter(k=>dayStatus(k)==='free'&&new Date(`${k}T12:00:00`)>=today).sort((a,b)=>scoreDate(a)-scoreDate(b)||a.localeCompare(b)).slice(0,5)}
function scoreDate(key){const d=new Date(`${key}T12:00:00`),dow=d.getDay();return (dow===0?12:0)+(dow===6?4:0)}
function renderBestDates(){const best=getBestDates();$('#bestDates').innerHTML=best.length?best.map((k,i)=>{const d=new Date(`${k}T12:00:00`);const conf=Math.max(75,state.coverage-i*2);return `<button class="best-date" data-date="${k}"><div class="num">${d.getDate()}</div><div><strong>${weekdayShort[d.getDay()]} · ${monthNames[d.getMonth()].toLowerCase()}</strong><span>0 eventi</span></div><div class="score">${conf}% fonti</div></button>`}).join(''):`<div class="rule-box"><strong>Nessuna data dichiarata libera</strong><span>Serve una copertura sufficiente delle fonti critiche.</span></div>`;$$('.best-date').forEach(b=>b.addEventListener('click',()=>openDrawer(b.dataset.date)))}

function openDrawer(key){
  const d=new Date(`${key}T12:00:00`),events=allEventsOn(key),status=dayStatus(key);$('#drawerDate').textContent=`${weekdayShort[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  const pill=$('#drawerStatus');pill.textContent=status==='free'?'Data libera':status==='low'?'Bassa pressione':status==='busy'?'Conflitto alto':status==='gal'?'Evento GAL':'Copertura incompleta';pill.style.background=status==='busy'?'var(--red-soft)':status==='low'?'var(--amber-soft)':status==='gal'?'var(--blue-soft)':'var(--green-soft)';pill.style.color=status==='busy'?'var(--red)':status==='low'?'var(--amber)':status==='gal'?'var(--blue)':'var(--green)';
  $('#drawerEvents').innerHTML=events.length?events.map(eventCard).join(''):`<div class="rule-box"><strong>Nessun evento rilevato</strong><span>La data può essere considerata libera solo con copertura critica sufficiente.</span></div>`;
  $('#drawerCoverage').textContent=`Copertura fonti: ${state.coverage||0}% · critiche ${state.criticalCoverage||0}%`;$('#markGal').dataset.date=key;$('#markGal').textContent=state.galDates.has(key)?'Rimuovi evento GAL':'Segna come evento GAL';
  $('#drawer').classList.add('open');$('#drawerBackdrop').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');
}
function eventCard(e){const src=SOURCE_META[e.sourceId]||{name:e.sourceId};return `<article class="event-card"><h4>${e.title}</h4><p><strong>${e.city}</strong><br>${e.venue}<br>${e.type}</p><div class="event-tags"><span class="tag ${e.category}">${categoryLabel(e.category)}</span><span class="tag">${src.type||'Fonte pubblica'}</span></div><div class="event-source"><span>${src.name}</span><a href="${SOURCE_URLS[e.sourceId]}" target="_blank" rel="noreferrer">Apri fonte ↗</a></div></article>`}
function categoryLabel(c){return({outdoor:"All'aperto",indoor:'Luogo chiuso',fair:'Sagra / fiera',religious:'Religioso',sport:'Sport'})[c]||c}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true')}

async function refreshSources(){
  const btn=$('#refreshButton');btn.classList.add('loading');btn.disabled=true;
  try{
    const res=await fetch(`/api/events?t=${Date.now()}`);if(!res.ok)throw new Error('sync failed');const data=await res.json();state.coverage=data.coverage;state.criticalCoverage=data.criticalCoverage;state.sources=data.sources||[];
    const on=state.sources.filter(s=>s.online).length,off=state.sources.length-on;$('#sourceCount').textContent=`${state.sources.length} fonti`;$('#sourcesOnline').textContent=`${on} aggiornate`;$('#sourcesOffline').textContent=off?`${off} da verificare`:'';$('#lastRefresh').textContent=`Ultimo refresh: ${new Date(data.refreshedAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`;
    const grouped={};state.sources.forEach(s=>{grouped[s.type]??={on:0,total:0};grouped[s.type].total++;if(s.online)grouped[s.type].on++});$('#sourceSummary').innerHTML=Object.entries(grouped).map(([k,v])=>`<div class="source-row"><span>${k}</span><strong class="${v.on===v.total?'online':'offline'}">${v.on} / ${v.total}</strong></div>`).join('');
  }catch(e){
    state.coverage=0;state.criticalCoverage=0;$('#sourcesOnline').textContent='sync non disponibile';$('#sourcesOffline').textContent='riprovare';$('#sourceSummary').innerHTML='<div class="source-row"><span>Connessione</span><strong class="offline">non verificata</strong></div>';
  }finally{btn.classList.remove('loading');btn.disabled=false;render()}
}

$('#refreshButton').addEventListener('click',refreshSources);$('#drawerClose').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);
$('#markGal').addEventListener('click',e=>{const k=e.currentTarget.dataset.date;if(state.galDates.has(k))state.galDates.delete(k);else state.galDates.add(k);localStorage.setItem('galDates',JSON.stringify([...state.galDates]));openDrawer(k);render()});
$('#prevMonth').addEventListener('click',()=>{state.month--;if(state.month<0){state.month=11;state.year--}render()});$('#nextMonth').addEventListener('click',()=>{state.month++;if(state.month>11){state.month=0;state.year++}render()});$('#todayButton').addEventListener('click',()=>{state.year=2026;state.month=8;render()});
$$('.chip').forEach(c=>c.addEventListener('click',()=>{$$('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');state.filter=c.dataset.filter;render()}));$('#searchInput').addEventListener('input',e=>{state.query=e.target.value.trim();render()});
try{state.galDates=new Set(JSON.parse(localStorage.getItem('galDates')||'[]'))}catch{}
render();refreshSources();
