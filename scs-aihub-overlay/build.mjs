import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ORIGIN='https://scs-aihub.vercel.app';
const OUT=path.resolve('dist');
const RAW='https://raw.githubusercontent.com/tornatora/mandato-aperto/main/scs-aihub-overlay';
const ua='Mozilla/5.0 (compatible; SCS-AIHub-Snapshot/4.0; +https://scs-aihub.vercel.app)';
const seen=new Set(),queue=[];const rewrites=new Map();let assetCount=0,pageCount=0,queryAssetCount=0;
const sha=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,14);
await fs.rm(OUT,{recursive:true,force:true});await fs.mkdir(OUT,{recursive:true});
const get=async u=>{const r=await fetch(u,{headers:{'user-agent':ua,'accept':'*/*'},redirect:'follow'});if(!r.ok)throw new Error(`FETCH ${r.status} ${u}`);return r};
const rootResp=await get(ORIGIN+'/');const rootHtmlRaw=await rootResp.text();
if(rootHtmlRaw.length<1200||!/<\/body>/i.test(rootHtmlRaw))throw new Error('Original AI Hub HTML validation failed');
const[surveyCss,surveyJs,nativeCss,nativeJs]=await Promise.all([(await get(RAW+'/survey.css')).text(),(await get(RAW+'/survey.js')).text(),(await get(RAW+'/native.css')).text(),(await get(RAW+'/native.js')).text()]);
if(surveyCss.length<5000||surveyJs.length<15000||nativeCss.length<300||nativeJs.length<800)throw new Error('Assessment assets validation failed');
function cleanUrl(raw,base=ORIGIN+'/'){try{if(!raw)return null;raw=String(raw).replace(/&amp;/g,'&');if(/^(data:|mailto:|tel:|javascript:|#)/i.test(raw))return null;const u=new URL(raw,base);if(u.origin!==ORIGIN)return null;u.hash='';return u}catch{return null}}
function extFor(ct,u){const p=path.posix.extname(u.pathname);if(p)return p;ct=(ct||'').toLowerCase();if(ct.includes('image/avif'))return'.avif';if(ct.includes('image/webp'))return'.webp';if(ct.includes('image/png'))return'.png';if(ct.includes('image/jpeg'))return'.jpg';if(ct.includes('image/svg'))return'.svg';if(ct.includes('font/woff2'))return'.woff2';if(ct.includes('font/woff'))return'.woff';if(ct.includes('text/css'))return'.css';if(ct.includes('javascript'))return'.js';if(ct.includes('application/json'))return'.json';return'.bin'}
function webPathFor(u,ct=''){if(u.search){const wp=`/__mirror/${sha(u.href)}${extFor(ct,u)}`;rewrites.set(u.href,wp);return wp}let p=decodeURIComponent(u.pathname);if(p==='/'||!p)p='/index.html';const ext=path.posix.extname(p);if(!ext&&/text\/html/i.test(ct))p=p.replace(/\/$/,'')+'/index.html';else if(!ext&&p.endsWith('/'))p+='index.html';return p}
function diskFor(wp){return path.join(OUT,wp.replace(/^\/+/,''))}
async function writeBuf(file,buf){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,buf)}
function extractHtmlRaw(html){const out=[];let m;const re=/(?:src|href|poster|content)\s*=\s*["']([^"']+)["']/gi;while((m=re.exec(html)))out.push(m[1]);const srcset=/srcset\s*=\s*["']([^"']+)["']/gi;while((m=srcset.exec(html)))for(const p of m[1].split(','))out.push(p.trim().split(/\s+/)[0]);return out}
function extractHtml(html,base){return extractHtmlRaw(html).map(x=>cleanUrl(x,base)).filter(Boolean)}
function extractCss(css,base){const out=[];let m;const re=/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi;while((m=re.exec(css)))out.push(m[1]);const imp=/@import\s+(?:url\()?\s*["']([^"']+)["']/gi;while((m=imp.exec(css)))out.push(m[1]);return out.map(x=>cleanUrl(x,base)).filter(Boolean)}
function extractJs(js,base){const out=[];let m;const re=/["'`]((?:\/_next\/|\/assets\/|\/images\/|\/fonts\/|\/media\/)[^"'`]+)["'`]/g;while((m=re.exec(js)))out.push(m[1]);return out.map(x=>cleanUrl(x,base)).filter(Boolean)}
function isPage(u){return!path.posix.extname(u.pathname)&&!u.pathname.startsWith('/_next')&&!u.pathname.startsWith('/api')&&!u.pathname.startsWith('/__mirror')}
function enqueue(u){if(!u)return;const k=u.href;if(!seen.has(k)){seen.add(k);queue.push(u)}}
function applyRewrites(text,base=ORIGIN+'/'){return text.replace(/(["'(=\s])((?:https?:\/\/scs-aihub\.vercel\.app)?\/[^"')\s,>]+\?[^"')\s,>]*)/g,(all,prefix,raw)=>{const u=cleanUrl(raw,base);if(!u)return all;const w=rewrites.get(u.href);return w?prefix+w:all})}
for(const u of extractHtml(rootHtmlRaw,ORIGIN+'/'))enqueue(u);
while(queue.length&&seen.size<800){const u=queue.shift();try{const r=await get(u.href),ct=r.headers.get('content-type')||'',buf=Buffer.from(await r.arrayBuffer());const wp=webPathFor(u,ct);await writeBuf(diskFor(wp),buf);assetCount++;if(u.search)queryAssetCount++;if(/text\/html/i.test(ct)){pageCount++;for(const v of extractHtml(buf.toString('utf8'),u.href))enqueue(v)}else if(/text\/css/i.test(ct)){for(const v of extractCss(buf.toString('utf8'),u.href))enqueue(v)}else if(/(?:javascript|ecmascript)/i.test(ct)||/\.m?js$/i.test(u.pathname)){for(const v of extractJs(buf.toString('utf8'),u.href))enqueue(v)}}catch(e){console.warn('mirror-skip',u.pathname,String(e.message||e))}}
for(const u of extractHtml(rootHtmlRaw,ORIGIN+'/').filter(isPage).slice(0,40)){try{const r=await get(u.href),ct=r.headers.get('content-type')||'';if(!/text\/html/i.test(ct))continue;let html=await r.text();for(const v of extractHtml(html,u.href))enqueue(v);html=applyRewrites(html,u.href);await writeBuf(diskFor(webPathFor(u,'text/html')),Buffer.from(html));pageCount++}catch(e){console.warn('page-skip',u.pathname)}}
while(queue.length&&seen.size<950){const u=queue.shift();try{const r=await get(u.href),ct=r.headers.get('content-type')||'',buf=Buffer.from(await r.arrayBuffer());const wp=webPathFor(u,ct);await writeBuf(diskFor(wp),buf);assetCount++;if(u.search)queryAssetCount++;if(/text\/css/i.test(ct))for(const v of extractCss(buf.toString('utf8'),u.href))enqueue(v)}catch{}}

// Preserve every existing page as captured from the live AI Hub.
let rootHtml=applyRewrites(rootHtmlRaw,ORIGIN+'/');await writeBuf(path.join(OUT,'index.html'),Buffer.from(rootHtml));pageCount++;

// Assessment assets are external same-origin files. This avoids the original app CSP blocking inline JS.
const scsDir=path.join(OUT,'__scs-cost');await fs.mkdir(scsDir,{recursive:true});
await fs.writeFile(path.join(scsDir,'style.css'),surveyCss+'\n'+nativeCss,'utf8');
await fs.writeFile(path.join(scsDir,'survey.js'),surveyJs,'utf8');
await fs.writeFile(path.join(scsDir,'native.js'),nativeJs,'utf8');

function stripMetaCsp(html){return html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,'')}
function inject(html){let x=stripMetaCsp(html);if(!/<base\b/i.test(x))x=x.replace(/<head([^>]*)>/i,'<head$1><base href="/">');x=x.replace(/<\/head>/i,'<link rel="stylesheet" href="/__scs-cost/style.css?v=4"></head>');x=x.replace(/<\/body>/i,'<div id="scs-cost-root"></div><script src="/__scs-cost/survey.js?v=4"></script><script src="/__scs-cost/native.js?v=4"></script></body>');return x}
await fs.mkdir(path.join(OUT,'analisi-costi-ai'),{recursive:true});const assessment=inject(rootHtml);await fs.writeFile(path.join(OUT,'analisi-costi-ai','index.html'),assessment,'utf8');await fs.writeFile(path.join(OUT,'analisi-costi-ai.html'),assessment,'utf8');
await fs.writeFile(path.join(OUT,'404.html'),rootHtml,'utf8');
const diag={source:ORIGIN,capturedAt:new Date().toISOString(),sourceBytes:Buffer.byteLength(rootHtmlRaw),sourceSha256:crypto.createHash('sha256').update(rootHtmlRaw).digest('hex'),assetsMirrored:assetCount,queryAssetsMirrored:queryAssetCount,pagesMirrored:pageCount,surveyCssBytes:Buffer.byteLength(surveyCss),surveyJsBytes:Buffer.byteLength(surveyJs),nativeCssBytes:Buffer.byteLength(nativeCss),nativeJsBytes:Buffer.byteLength(nativeJs),assessmentBytes:Buffer.byteLength(assessment),route:'/analisi-costi-ai',scriptMode:'external-same-origin'};await fs.writeFile(path.join(OUT,'_snapshot-diagnostic.json'),JSON.stringify(diag,null,2));console.log('SCS AI Hub snapshot ready',diag);
