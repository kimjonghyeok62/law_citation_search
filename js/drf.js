// ============ js/drf.js ============
export const DRF = 'https://www.law.go.kr/DRF';
export const OC  = 'bro3362';

const enc = s => encodeURIComponent(s);
const pad = (n,w) => String(parseInt(n,10)).padStart(w,'0');

export function buildURL(path, params){
  const u = new URL(DRF + path);
  Object.entries(params).forEach(([k,v])=>{ if(v!=null && v!=='') u.searchParams.set(k,v); });
  return u.toString();
}

export function withProxy(url, base){
  let b = (base || 'https://law-proxy.hyok96.workers.dev/?url=').trim();
  if(!b.includes('?')) b += (b.endsWith('/') ? '' : '/') + '?';
  if(!/\burl=/.test(b)) b += 'url=';
  return b + encodeURIComponent(url);
}

export async function fetchTextDirectOrProxy(url, proxyBase){
  try{
    const r = await fetch(url);
    const t = await r.text();
    if(t && t.length > 30) return t;
  }catch(_){}
  try{
    const r2 = await fetch(withProxy(url, proxyBase));
    return await r2.text();
  }catch(_){ return ''; }
}

export function isFailPage(html){
  const t = (html||'').replace(/\u00A0/g,' ');
  return /페이지\s*접속에\s*실패하였습니다|사용자인증에\s*실패하였습니다|페이지를\s*찾을\s*수\s*없습니다/.test(t);
}

export function publicLawURL(name){ return 'https://www.law.go.kr/법령/' + enc(name); }

export function joTo6(jo, joi){
  const head = pad(jo,4);
  return joi ? head + pad(joi,2) : head + '00';
}

export function buildLawFullHTMLURL(id){
  return buildURL('/lawService.do', { OC, target:'law', type:'HTML', ID:id });
}

export function buildLawArticleURL(id,{jo,joi,hang,ho,mok}){
  const params = { OC, target:'lawjosub', type:'HTML', ID:id, JO: joTo6(jo, joi) };
  if(hang) params.HANG = pad(hang,6); else if(ho) params.HANG = '000000';
  if(ho) params.HO = pad(ho,6);
  if(mok) params.MOK = mok;
  return buildURL('/lawService.do', params);
}

export async function fetchArticleJSON(id,{jo,joi,hang,ho,mok}, proxyBase){
  const url = buildURL('/lawService.do', {
    OC, target:'lawjosub', type:'JSON', ID:id,
    JO: joTo6(jo, joi),
    HANG: hang ? pad(hang,6) : (ho ? '000000' : ''),
    HO: ho ? pad(ho,6) : '',
    MOK: mok || ''
  });
  const txt = await fetchTextDirectOrProxy(url, proxyBase);
  try{ return JSON.parse(txt); }catch{ return null; }
}

export function canonName(s){ return (s||'').replace(/[\s"“”'‘’\[\]\(\)「」]/g,'').replace(/[·ㆍ]/g,''); }
export function displayName(s){ return (s||'').replace(/[\"“”'‘’\[\]\(\)「」]/g,'').trim(); }
export function refineLawName(name){
  let s = (name||'').trim();
  if(!s) return s;
  s = s.replace(/^(?:까지|및|또는|등|관련|관한|따른|에\s*따른|에\s*의한|의)\s+/, '');
  const toks = s.split(/\s+/); let i=-1;
  for(let k=toks.length-1;k>=0;k--){ if(/[법]$/.test(toks[k])){ i=k; break; } }
  if(i>=0){ if(toks[i+1] && /^(시행령|시행규칙)$/.test(toks[i+1])) return (toks[i]+' '+toks[i+1]).trim(); return toks[i]; }
  return s;
}

function generateAlternatives(q){
  const s = displayName(q||'').replace(/\s+/g,'').trim();
  const alts = new Set();
  if(/^영유아교육법$/.test(s)) { alts.add('유아교육법'); alts.add('영유아보육법'); }
  if(s) alts.add(s.replace(/[^가-힣A-Za-z0-9]/g,''));
  if(s.includes('교육')) alts.add(s.replace(/교육/g,'보육'));
  if(s.includes('보육')) alts.add(s.replace(/보육/g,'교육'));
  const refined = refineLawName(q); if(refined) alts.add(refined);
  if(q) alts.add(q);
  return [...alts].filter(Boolean);
}

export async function searchLawRow(lawQuery, proxyBase){
  const variants = generateAlternatives(lawQuery);
  const clean = s => canonName(refineLawName(s||''));
  const pickBest = (rows, wantCanon)=>{
    if(!rows||!rows.length) return null;
    const exact = rows.find(x => clean(x.법령명한글) === wantCanon);
    if(exact) return exact;
    const partial = rows.find(x => clean(x.법령명한글).includes(wantCanon) || wantCanon.includes(clean(x.법령명한글)));
    return partial || rows[0];
  };

  const tryJson = async (qCanon,qRaw)=>{
    const url = buildURL('/lawSearch.do', { OC, target:'law', type:'JSON', query:qRaw, display:10 });
    const text = await fetchTextDirectOrProxy(url, proxyBase);
    try{
      const data = JSON.parse(text);
      const root = (data && data.LawSearch) ? data.LawSearch : data;
      let rows = [];
      if(root && root.law){ rows = Array.isArray(root.law) ? root.law : [root.law]; }
      return pickBest(rows, qCanon);
    }catch{ return null; }
  };
  const tryXml = async (qCanon,qRaw)=>{
    const url = buildURL('/lawSearch.do', { OC, target:'law', type:'XML', query:qRaw, display:10 });
    const text = await fetchTextDirectOrProxy(url, proxyBase);
    try{
      const dom = new DOMParser().parseFromString(text, 'text/xml');
      const nodes = Array.from(dom.getElementsByTagName('law'));
      const rows = nodes.map(n=>({
        법령명한글: (n.getElementsByTagName('법령명한글')[0]?.textContent||'').trim(),
        법령ID: (n.getElementsByTagName('법령ID')[0]?.textContent||'').trim(),
        법령일련번호: (n.getElementsByTagName('법령일련번호')[0]?.textContent||'').trim(),
        법령상세링크: (n.getElementsByTagName('법령상세링크')[0]?.textContent||'').trim()
      }));
      return pickBest(rows, qCanon);
    }catch{ return null; }
  };
  const tryHtml = async (qCanon,qRaw)=>{
    const url = buildURL('/lawSearch.do', { OC, target:'law', type:'HTML', query:qRaw, display:10 });
    const text = await fetchTextDirectOrProxy(url, proxyBase);
    try{
      const dom = new DOMParser().parseFromString(text, 'text/html');
      const links = Array.from(dom.querySelectorAll('a[href*="ID="]'));
      const rows = links.map(a=>{
        const href=a.getAttribute('href')||'';
        const idMatch=href.match(/ID=([^&]+)/);
        const name=(a.textContent||'').trim();
        return { 법령명한글:name, 법령ID:idMatch?decodeURIComponent(idMatch[1]):'' };
      }).filter(x=>x.법령ID);
      return pickBest(rows, qCanon);
    }catch{ return null; }
  };

  for(const q of variants){
    const canon = clean(q);
    let row = await tryJson(canon,q);
    if(!row) row = await tryXml(canon,q);
    if(!row) row = await tryHtml(canon,q);
    if(row) return row;
  }
  return null;
}

export async function fetchPublicLawSnippet(lawName, jo, joi, proxyBase){
  try{
    const url = publicLawURL(lawName);
    const text = await fetchTextDirectOrProxy(url, proxyBase);
    if(!text || text.length<200) return null;
    const clean = (text||'').replace(/\r?\n/g,' ').replace(/\s{2,}/g,' ');
    const key = `제${parseInt(jo,10)}조` + (joi?`의${parseInt(joi,10)}`:'');
    let idx = clean.indexOf(key);
    if(idx<0){
      const noTag = clean.replace(/<[^>]+>/g,' ');
      idx = noTag.indexOf(key);
      if(idx<0) return null;
    }
    const from = Math.max(0, idx - 400);
    const to   = Math.min(clean.length, idx + 1600);
    const snippet = clean.substring(from, to);
    return `<div class="render"><div class="hdr"><div>${lawName} · ${key} (퍼블릭 폴백)</div></div><div class="body">${snippet}</div></div>`;
  }catch{ return null; }
}
