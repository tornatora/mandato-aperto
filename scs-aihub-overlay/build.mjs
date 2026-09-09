import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ORIGIN='https://scs-aihub.vercel.app';
const OUT=path.resolve('dist');
const RAW='https://raw.githubusercontent.com/tornatora/mandato-aperto/main/scs-aihub-overlay';
const ua='Mozilla/5.0 (compatible; SCS-AIHub-Snapshot/1.0; +https://scs-aihub.vercel.app)';
const seen=new Set(), queue=[]; let assetCount=0,pageCount=0;

await fs.rm(OUT,{recursive:true,force:true}); await fs.mkdir(OUT,{recursive:true});
const get=async u=>{const r=await fetch(u,{headers:{'user-agent':ua,'accept':'*/*'},redirect:'follow'});if(!r.ok)throw new Error(`FETCH ${r.status} ${u}`);return r};
const rootResp=await get(ORIGIN+'/'); const rootHtml=await rootResp.text();
if(rootHtml.length<1200||!/<\/body>/i.test(rootHtml))throw new Error('Original AI Hub HTML validation failed');
const [surveyCss,surveyJs]=await Promise.all([(await get(RAW+'/survey.css')).text(),(await get(RAW+'/survey.js')).text()]);
if(surveyCss.length<5000||surveyJs.length<15000)throw new Error('Assessment assets validation failed');

function cleanUrl(raw,base=ORIGIN+'/'){
 try{if(!raw||raw.startsWith('data:')||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('javascript:')||raw.startsWith('#'))return null;const u=new URL(raw,base);if(u.origin!==ORIGIN)return null;u.hash='';return u}catch{return null}
}
function outputPath(u,contentType=''){
 let p=decodeURIComponent(u.pathname); if(p==='/'||!p)p='/index.html';
 const ext=path.posix.extname(p); if(!ext && /text\/html/i.test(contentType)) p=p.replace(/\/$/,'')+'/index.html';
 else if(!ext && p.endsWith('/'))p+='index.html';
 return path.join(OUT,p.replace(/^\/+/,''));
}
async function writeBuf(file,buf){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,buf)}
function extractHtml(html,base){
 const out=[]; const re=/(?:src|href|poster|content)\s*=\s*["']([^"']+)["']/gi;let m;while((m=re.exec(html)))out.push(m[1]);
 const srcset=/srcset\s*=\s*["']([^"']+)["']/gi;while((m=srcset.exec(html)))for(const part of m[1].split(','))out.push(part.trim().split(/\s+/)[0]);
 return out.map(x=>cleanUrl(x,base)).filter(Boolean)
}
function extractCss(css,base){const out=[];let m;const re=/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi;while((m=re.exec(css)))out.push(m[1]);const imp=/@import\s+(?:url\()?\s*["']([^"']+)["']/gi;while((m=imp.exec(css)))out.push(m[1]);return out.map(x=>cleanUrl(x,base)).filter(Boolean)}
function extractJs(js,base){const out=[];let m;const re=/["'`]((?:\/_next\/|\/assets\/|\/images\/|\/fonts\/)[^"'`?]+(?:\?[^"'`]*)?)["'`]/g;while((m=re.exec(js)))out.push(m[1]);return out.map(x=>cleanUrl(x,base)).filter(Boolean)}
function isPage(u){const p=u.pathname;return !path.posix.extname(p)&&!p.startsWith('/_next')&&!p.startsWith('/api')}
function enqueue(u){const key=u.href;if(!seen.has(key)){seen.add(key);queue.push(u)}}
for(const u of extractHtml(rootHtml,ORIGIN+'/'))enqueue(u);

await writeBuf(path.join(OUT,'index.html'),Buffer.from(rootHtml)); pageCount++;

while(queue.length&&seen.size<650){const u=queue.shift();try{const r=await get(u.href);const ct=r.headers.get('content-type')||'';const buf=Buffer.from(await r.arrayBuffer());let file=outputPath(u,ct);await writeBuf(file,buf);assetCount++;
 if(/text\/html/i.test(ct)){pageCount++;const txt=buf.toString('utf8');for(const v of extractHtml(txt,u.href))enqueue(v)}
 else if(/text\/css/i.test(ct)){const txt=buf.toString('utf8');for(const v of extractCss(txt,u.href))enqueue(v)}
 else if(/(?:javascript|ecmascript)/i.test(ct)||/\.m?js$/i.test(u.pathname)){const txt=buf.toString('utf8');for(const v of extractJs(txt,u.href))enqueue(v)}
 }catch(e){console.warn('mirror-skip',u.pathname,String(e.message||e))}}

for(const u of extractHtml(rootHtml,ORIGIN+'/').filter(isPage).slice(0,30)){try{const r=await get(u.href);const ct=r.headers.get('content-type')||'';if(!/text\/html/i.test(ct))continue;const html=await r.text();await writeBuf(outputPath(u,'text/html'),Buffer.from(html));pageCount++;for(const v of extractHtml(html,u.href)){if(!seen.has(v.href)&&seen.size<650)enqueue(v)}}catch(e){console.warn('page-skip',u.pathname)}}

while(queue.length&&seen.size<800){const u=queue.shift();try{const r=await get(u.href),ct=r.headers.get('content-type')||'',buf=Buffer.from(await r.arrayBuffer());await writeBuf(outputPath(u,ct),buf);assetCount++;if(/text\/css/i.test(ct)){for(const v of extractCss(buf.toString('utf8'),u.href))enqueue(v)}}catch{}}

function inject(html){
 let x=html;
 if(!/<base\b/i.test(x))x=x.replace(/<head([^>]*)>/i,'<head$1><base href="/">');
 x=x.replace(/<\/head>/i,`<style id="scs-cost-style">${surveyCss.replace(/<\/style>/gi,'<\\/style>')}</style></head>`);
 x=x.replace(/<\/body>/i,`<div id="scs-cost-root"></div><script id="scs-cost-script">${surveyJs.replace(/<\/script>/gi,'<\\/script>')}</script></body>`);
 return x;
}
await fs.mkdir(path.join(OUT,'analisi-costi-ai'),{recursive:true});
await fs.writeFile(path.join(OUT,'analisi-costi-ai','index.html'),inject(rootHtml),'utf8');
await fs.writeFile(path.join(OUT,'analisi-costi-ai.html'),inject(rootHtml),'utf8');

const diag={source:ORIGIN,capturedAt:new Date().toISOString(),sourceBytes:Buffer.byteLength(rootHtml),sourceSha256:crypto.createHash('sha256').update(rootHtml).digest('hex'),assetsMirrored:assetCount,pagesMirrored:pageCount,surveyCssBytes:Buffer.byteLength(surveyCss),surveyJsBytes:Buffer.byteLength(surveyJs)};
await fs.writeFile(path.join(OUT,'_snapshot-diagnostic.json'),JSON.stringify(diag,null,2));
console.log('SCS AI Hub snapshot ready',diag);
