function calculate(){
 const a=state.answers; const users=Math.max(1,Number(a.aiUsers||1)); const employees=Math.max(users,Number(a.employees||users));
 const intensity={light:.65,normal:1,high:1.55,embedded:2.25}[a.intensity]||1;
 const ambition={assistant:1,knowledge:1.45,integrated:2.15,agents:3.1}[a.ambition]||1;
 const risk=riskMultiplier(); const useCases=Number(a.useCases||2); const ints=integrationCount(); const types=a.integrationTypes||[];
 const legacyFactor=types.includes('legacy')?1.35:1; const erpFactor=types.includes('erp')?1.18:1; const dataFactor={docs:1,manydocs:1.25,systems:1.55,realtime:2.05}[a.dataScope]||.8; const dataQuality={high:.82,medium:1,low:1.38,unknown:1.18}[a.dataQuality]||1;
 const teamFactor={none:1.15,small:1,medium:.88,strong:.76}[a.team]||1; const speedFactor={pilot:.94,'3m':1.18,'6m':1,'12m':.92}[a.timeline]||1;
 const multimodal=(a.workloads||[]).includes('media')?1.18:1; const workflow=(a.workloads||[]).includes('workflow')?1.12:1;
 const deploy=a.deployment||'hybrid';
 // recurring licenses / model usage
 let seatMonthly=deploy==='saas'?31:deploy==='hybrid'?23:6; seatMonthly*=intensity>.9?1:0.9;
 let licenseAnnual=users*seatMonthly*12;
 let apiMonthlyPerUser=(deploy==='custom'?14:deploy==='hybrid'?9:2.5)*intensity*multimodal*(a.ambition==='agents'?2.15:a.ambition==='integrated'?1.35:1);
 let apiAnnual=users*apiMonthlyPerUser*12;
 if(a.ambition==='agents'){const vol=Number(a.agentVolume||100);apiAnnual+=vol*250*0.075*intensity*multimodal;}
 // one-off delivery
 let core={assistant:14000,knowledge:28000,integrated:52000,agents:76000}[a.ambition]||20000;
 core*=Math.pow(Math.max(1,useCases/2),.72)*teamFactor*speedFactor*risk;
 let integration=ints?ints*11500*legacyFactor*erpFactor*teamFactor*speedFactor:0;
 let data= a.ambition==='assistant'?3000:(13000*dataFactor*dataQuality + Math.max(0,ints-1)*3200)*teamFactor;
 let governance=(9000 + users*42)*risk*(a.ambition==='agents'?1.35:a.ambition==='integrated'?1.15:1);
 let autonomy={suggest:1,prepare:1.08,approve:1.22,autonomous:1.48}[a.autonomy]||1; if(a.ambition==='agents'){core*=autonomy;governance*=autonomy}
 let adoption=(7000 + users*125*Math.min(1.55,.85+employees/Math.max(users,1)*.04)); if(users>1000)adoption=7000+users*82; if(a.team==='strong')adoption*=.88;
 let security=(5000+Math.min(users,3000)*18)*(risk-.25); if(a.sensitivity==='public')security*=.65;
 let implementation=core+integration+data+governance+adoption+security;
 // recurring platform / support / monitoring
 let platform=(6000+users*(deploy==='custom'?45:deploy==='hybrid'?26:12))*ambition*workflow; if(a.dataScope==='realtime')platform*=1.25;
 let supportRate={light:.09,managed:.14,full:.21,internal:.065}[a.support]||.12;
 let supportAnnual=implementation*supportRate*(a.team==='strong'?.82:1);
 let recurring=licenseAnnual+apiAnnual+platform+supportAnnual;
 let central=implementation+recurring;
 // Guardrails to prevent implausibly low enterprise estimates
 const floor=users*12*(deploy==='custom'?18:26)+({assistant:18000,knowledge:42000,integrated:80000,agents:125000}[a.ambition]||25000);
 central=Math.max(central,floor);
 const uncertainty=.18 + (a.currentSpend==='unknown'?.035:0) + (a.dataQuality==='unknown'?.045:0) + (a.deployment==='hybrid'?.025:0) + (a.ambition==='agents'?.035:0);
 const low=central*(1-uncertainty); const high=central*(1+uncertainty*1.35);
 const runRate=Math.max(recurring,central*.26); const perUser=runRate/users/12;
 const completeness=Object.keys(a).length/Math.max(1,state.visible.length); let conf=68+completeness*18-(a.currentSpend==='unknown'?4:0)-(a.dataQuality==='unknown'?5:0)-(a.deployment==='hybrid'?3:0); conf=Math.max(58,Math.min(89,Math.round(conf)));
 let readiness=42; readiness+=({none:0,small:8,medium:16,strong:23}[a.team]||0); readiness+=({high:14,medium:8,low:1,unknown:4}[a.dataQuality]||5); readiness+=a.timeline==='pilot'?9:5; readiness+=a.sensitivity==='regulated'?3:7; readiness+=a.currentSpend!=='0'&&a.currentSpend!=='unknown'?6:0; readiness=Math.max(31,Math.min(92,Math.round(readiness)));
 const breakdownRaw={
  'Licenze & model usage':licenseAnnual+apiAnnual,
  'Sviluppo & use case':core,
  'Integrazioni & dati':integration+data,
  'Governance & security':governance+security,
  'Adoption & change':adoption,
  'Run & monitoring':platform+supportAnnual
 }; const sum=Object.values(breakdownRaw).reduce((x,y)=>x+y,0)||1;
 const breakdown=Object.entries(breakdownRaw).map(([k,v])=>[k,v/sum*100,v]).sort((x,y)=>y[1]-x[1]);
 const driverCandidates=[];
 driverCandidates.push([users>=500?`${users.toLocaleString('it-IT')} utenti potenziali`:`${users.toLocaleString('it-IT')} utenti AI`,`La scala utenti incide su licenze, capacità, supporto e change management.`]);
 if(ints>0)driverCandidates.push([ints>=14?'Oltre 10 integrazioni':`${ints===1?'1–2':ints===4?'3–5':ints===8?'6–10':'Oltre 10'} sistemi da integrare`,`Le integrazioni rendono l’AI operativa sui processi reali e aumentano il costo iniziale.`]);
 if(a.ambition==='agents')driverCandidates.push(['Agenti AI '+({suggest:'assistivi',prepare:'supervisionati',approve:'con approvazione',autonomous:'autonomi'}[a.autonomy]||'operativi'),`Autonomia, tool use e volumi richiedono testing, permessi, audit e monitoring più robusti.`]);
 if(['personal','regulated'].includes(a.sensitivity))driverCandidates.push(['Dati '+(a.sensitivity==='regulated'?'altamente regolamentati':'personali'),`Security, governance e controlli diventano parte strutturale del TCO.`]);
 if(a.dataQuality==='low'||a.dataQuality==='unknown')driverCandidates.push(['Dati '+(a.dataQuality==='low'?'frammentati':'da validare'),`Discovery, bonifica e accessibilità dei dati aumentano la fase di preparazione.`]);
 if(a.timeline==='3m')driverCandidates.push(['Rollout entro 3 mesi','La compressione dei tempi richiede più capacità parallela e presidio di delivery.']);
 driverCandidates.push([`${useCases<=2?'1–2':useCases<=4?'3–5':useCases<=8?'6–10':'oltre 10'} use case in produzione`,`Il numero di casi d’uso influenza sviluppo, testing, supporto e governance del portafoglio.`]);
 const drivers=driverCandidates.slice(0,3);
 const labels=readiness>=78?['Alta','Le condizioni di partenza sono favorevoli a una scalabilità rapida, purché governance e priorità rimangano esplicite.']:readiness>=62?['Buona','La base è solida. Conviene consolidare operating model, dati e priorità prima di accelerare la scala.']:readiness>=48?['Intermedia','Il potenziale è concreto, ma alcune capability vanno costruite in parallelo al pilot per evitare costi di rework.']:['Da costruire','È preferibile partire con un perimetro stretto, validare dati e governance, poi estendere l’adozione.'];
 const company=a.company?` per ${escapeHtml(a.company)}`:'';
 const narrative=makeNarrative(a,users,central,runRate,breakdown,readiness);
 const id='SCS-'+Math.random().toString(36).slice(2,8).toUpperCase();
 $('#assessmentId').textContent=id; $('#resultSub').innerHTML=`Stima preliminare del costo totale di adozione a 12 mesi${company}.`;
 animateNumber($('#costCentral'),central,compact); $('#costRange').textContent=`${compact(low)} — ${compact(high)}`; $('#runRate').textContent=compact(runRate); $('#perUser').textContent=fmt(perUser); $('#confidence').textContent=conf>=82?'Alta':conf>=72?'Medio-alta':'Media';
 $('#readinessScore').textContent=readiness; $('#readinessRing').style.setProperty('--p',readiness); $('#readinessLabel').textContent=labels[0]; $('#readinessText').textContent=labels[1];
 $('#scenarioLean').textContent=compact(central*.78); $('#scenarioRec').textContent=compact(central); $('#scenarioScale').textContent=compact(central*1.34);
 $('#breakdown').innerHTML=breakdown.map(([k,p,v])=>`<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" data-w="${Math.max(3,p)}"></div></div><div class="bar-val">${Math.round(p)}%</div></div>`).join('');
 $('#drivers').innerHTML=drivers.map((d,i)=>`<div class="driver"><i>0${i+1}</i><div><b>${d[0]}</b><span>${d[1]}</span></div></div>`).join(''); $('#consultingRead').innerHTML=narrative;
 state.result={id,central,low,high,runRate,perUser,conf,readiness,breakdown,drivers,narrative}; localStorage.setItem('scs-ai-cost-result',JSON.stringify(state.result)); $('#progress').style.width='100%'; show('result'); setTimeout(()=>$$('.bar-fill').forEach(x=>x.style.width=x.dataset.w+'%'),250);window.scrollTo({top:0,behavior:'smooth'});
}
function makeNarrative(a,users,central,runRate,breakdown,readiness){
 const amb={assistant:'un modello prevalentemente basato su assistenti individuali',knowledge:'una piattaforma AI collegata alla conoscenza aziendale',integrated:'un’AI integrata ai sistemi e ai dati aziendali',agents:'un modello agentico capace di intervenire sui workflow'}[a.ambition]||'un programma AI enterprise';
 const biggest=breakdown[0]?.[0]||'delivery'; const scale=users>1500?'ampia':users>400?'significativa':'selettiva';
 let s=`Il profilo emerso descrive <strong>${amb}</strong>, con una platea ${scale} di circa <strong>${users.toLocaleString('it-IT')} utenti</strong>. Il primo driver economico è <strong>${biggest.toLowerCase()}</strong>. `;
 if(a.ambition==='agents')s+=`La componente agentica sposta il costo dal semplice accesso ai modelli verso <strong>integrazione, controllo operativo e monitoraggio</strong>. `;
 else if(a.ambition==='integrated')s+=`La parte più delicata non è il modello linguistico in sé, ma la qualità delle <strong>connessioni con i sistemi aziendali</strong> e la gestione dei permessi. `;
 else if(a.ambition==='knowledge')s+=`Il ritorno dipenderà soprattutto dalla qualità della knowledge base e dalla capacità di mantenere <strong>fonti, accessi e contenuti aggiornati</strong>. `;
 else s+=`In questo scenario il costo è dominato dalla diffusione delle licenze e dall’adozione: conviene misurare l’uso reale prima di estendere il perimetro. `;
 if(readiness<55)s+=`La priorità dovrebbe essere un <strong>pilot con governance minima già definita</strong>, evitando di scalare prima di aver validato dati, ownership e metriche.`;else if(readiness<75)s+=`La strada più efficiente è partire con pochi use case ad alto valore e costruire in parallelo <strong>governance, capability interne e misurazione del consumo</strong>.`;else s+=`L’organizzazione può puntare a una scala più rapida, mantenendo però un controllo mensile di <strong>costo per utente, costo per use case e valore generato</strong>.`;
 return s;
}
function animateNumber(el,target,formatter){const start=performance.now(),dur=850;function tick(t){const p=Math.min(1,(t-start)/dur),e=1-Math.pow(1-p,3);el.textContent=formatter(target*e);if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2200)}
function summaryText(){const r=state.result,a=state.answers;if(!r)return'';return `SCS AI COST ASSESSMENT\nAssessment: ${r.id}\nAzienda: ${a.company||'—'}\nUtenti AI: ${Number(a.aiUsers||0).toLocaleString('it-IT')}\nScenario: ${a.ambition||'—'}\nTCO anno 1: ${fmt(r.central)}\nRange: ${fmt(r.low)} — ${fmt(r.high)}\nRun-rate annuo: ${fmt(r.runRate)}\nCosto medio per utente/mese: ${fmt(r.perUser)}\nAI readiness: ${r.readiness}/100\nTop driver: ${r.drivers.map(d=>d[0]).join('; ')}`}
