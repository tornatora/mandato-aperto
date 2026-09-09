(()=>{
const root=document.getElementById('scs-cost-root');if(!root)return;
const px=n=>Math.max(0,Math.round(n))+'px';
function cleanIds(node){if(node.nodeType!==1)return;node.removeAttribute('id');for(const c of node.children)cleanIds(c)}
function bestHeader(){return [...document.querySelectorAll('header,nav')].filter(e=>!root.contains(e)&&!e.hasAttribute('data-qa-native-header-clone')).map(e=>({e,r:e.getBoundingClientRect(),s:getComputedStyle(e)})).filter(x=>x.r.width>innerWidth*.55&&x.r.height>=38&&x.r.height<=150&&x.r.top<35&&x.s.display!=='none'&&x.s.visibility!=='hidden').sort((a,b)=>Math.abs(a.r.top)-Math.abs(b.r.top)||b.r.width-a.r.width)[0]}
function apply(){
 const h=bestHeader();if(h){const clone=h.e.cloneNode(true);cleanIds(clone);clone.setAttribute('data-qa-native-header-clone','');const pos=h.s.position;clone.style.setProperty('position','fixed','important');clone.style.setProperty('z-index','2147483001','important');document.body.appendChild(clone);const r=clone.getBoundingClientRect();root.classList.add('qa-native-header');root.style.setProperty('--qa-native-header-h',px(r.height||h.r.height));}
 const candidates=[...document.querySelectorAll('button,a')].filter(e=>!root.contains(e)&&e.offsetWidth>70&&e.offsetHeight>28);const btn=candidates.find(e=>{const s=getComputedStyle(e);return s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.display!=='none'})||candidates[0];if(btn){const s=getComputedStyle(btn);root.style.setProperty('--qa-btn-radius',s.borderRadius||'999px');if(s.transitionTimingFunction&&s.transitionTimingFunction!=='ease')root.style.setProperty('--qa-ease',s.transitionTimingFunction.split(',')[0])}
 const head=[...document.querySelectorAll('h1,h2')].find(e=>!root.contains(e)&&e.offsetHeight);if(head){const s=getComputedStyle(head);root.style.setProperty('--qa-display-weight',s.fontWeight||'480');if(s.fontFamily)root.style.setProperty('--qa-font',s.fontFamily)}
 const moving=[...document.querySelectorAll('*')].find(e=>{if(root.contains(e))return false;const s=getComputedStyle(e);return s.animationName&&s.animationName!=='none'});if(moving){const s=getComputedStyle(moving);if(s.animationTimingFunction&&s.animationTimingFunction!=='ease')root.style.setProperty('--qa-ease',s.animationTimingFunction.split(',')[0]);const d=parseFloat(s.animationDuration);if(Number.isFinite(d)&&d>0&&d<2)root.style.setProperty('--qa-dur',Math.round(d*1000)+'ms')}
}
requestAnimationFrame(()=>requestAnimationFrame(apply));
})();
