(()=>{
const root=document.getElementById('scs-cost-root');if(!root)return;
const px=n=>Math.max(0,Math.round(n))+'px';
const rgb=s=>{const m=String(s||'').match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);return m?[+m[1],+m[2],+m[3],m[4]==null?1:+m[4]]:null};
const lum=c=>c?(c[0]*.2126+c[1]*.7152+c[2]*.0722)/255:1;
function cleanIds(node){if(node.nodeType!==1)return;node.removeAttribute('id');for(const c of node.children)cleanIds(c)}
function outside(){return [...document.body.querySelectorAll('*')].filter(e=>e!==root&&!root.contains(e)&&!e.hasAttribute('data-qa-native-header-clone'))}
function bestHeader(){return outside().filter(e=>e.matches('header,nav')).map(e=>({e,r:e.getBoundingClientRect(),s:getComputedStyle(e)})).filter(x=>x.r.width>innerWidth*.55&&x.r.height>=38&&x.r.height<=150&&x.r.top<45&&x.s.display!=='none'&&x.s.visibility!=='hidden').sort((a,b)=>Math.abs(a.r.top)-Math.abs(b.r.top)||b.r.width-a.r.width)[0]}
function pageSurface(){
 const candidates=outside().slice(0,1400).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),c=rgb(s.backgroundColor);return{e,r,s,c,area:Math.max(0,r.width)*Math.max(0,r.height)}}).filter(x=>x.r.width>innerWidth*.65&&x.r.height>innerHeight*.35&&x.c&&x.c[3]>.12&&x.s.display!=='none'&&x.s.visibility!=='hidden');
 const dark=candidates.filter(x=>lum(x.c)<.38).sort((a,b)=>b.area-a.area)[0];
 return dark||candidates.sort((a,b)=>b.area-a.area)[0]||null;
}
function strongestAccent(){
 const candidates=outside().filter(e=>{const r=e.getBoundingClientRect();return r.width>45&&r.height>22&&r.width<500&&r.height<120});
 let best=null,score=-1;
 for(const e of candidates){const s=getComputedStyle(e);for(const v of [s.backgroundColor,s.borderTopColor,s.color]){const c=rgb(v);if(!c||c[3]<.5)continue;const spread=Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]);const warm=c[0]>175&&c[1]>75&&c[1]<205&&c[2]<120;const sc=spread+(warm?180:0);if(sc>score){score=sc;best=v}}}
 return best;
}
function apply(){
 const surface=pageSurface();
 let bg=surface?.s.backgroundColor||'#071017';
 let bgc=rgb(bg);if(!bgc||lum(bgc)>.48){bg='#071017';bgc=rgb(bg)}
 root.style.setProperty('--qa-bg',bg);
 root.style.setProperty('--qa-backdrop-opacity','1');
 root.classList.toggle('qa-dark',lum(bgc)<.42);
 const head=outside().find(e=>e.matches('h1,h2,[class*="hero"] h1,[class*="hero"] h2')&&e.getBoundingClientRect().height>10);
 if(head){const s=getComputedStyle(head),hc=rgb(s.color);if(hc&&Math.abs(lum(hc)-lum(bgc))>.34)root.style.setProperty('--qa-ink',s.color);else root.style.setProperty('--qa-ink','#f7f9fb');if(s.fontFamily)root.style.setProperty('--qa-font',s.fontFamily);root.style.setProperty('--qa-display-weight',s.fontWeight||'480')}else root.style.setProperty('--qa-ink','#f7f9fb');
 const accent=strongestAccent();if(accent)root.style.setProperty('--qa-accent',accent);else root.style.setProperty('--qa-accent','#f39a17');
 const h=bestHeader();if(h){const clone=h.e.cloneNode(true);cleanIds(clone);clone.setAttribute('data-qa-native-header-clone','');clone.style.setProperty('position','fixed','important');clone.style.setProperty('z-index','2147483001','important');document.body.appendChild(clone);const r=clone.getBoundingClientRect();root.classList.add('qa-native-header');root.style.setProperty('--qa-native-header-h',px(r.height||h.r.height));}
 const btn=outside().find(e=>{if(!e.matches('button,a'))return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>70&&r.height>28&&s.display!=='none'});if(btn){const s=getComputedStyle(btn);root.style.setProperty('--qa-btn-radius',s.borderRadius||'999px');if(s.transitionTimingFunction&&s.transitionTimingFunction!=='ease')root.style.setProperty('--qa-ease',s.transitionTimingFunction.split(',')[0])}
 const moving=outside().find(e=>{const s=getComputedStyle(e);return s.animationName&&s.animationName!=='none'});if(moving){const s=getComputedStyle(moving);if(s.animationTimingFunction&&s.animationTimingFunction!=='ease')root.style.setProperty('--qa-ease',s.animationTimingFunction.split(',')[0]);const d=parseFloat(s.animationDuration);if(Number.isFinite(d)&&d>0&&d<2)root.style.setProperty('--qa-dur',Math.round(d*1000)+'ms')}
 document.documentElement.style.background=bg;document.body.style.background=bg;
}
requestAnimationFrame(()=>requestAnimationFrame(apply));
})();
