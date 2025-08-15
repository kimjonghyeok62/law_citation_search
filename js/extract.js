// ============ js/extract.js ============
// 인용 추출/정규식/컨텍스트
const LAW_BASE = `[가-힣A-Za-z0-9·ㆍ\\s]+?(?:법|법률)`;
const LAW_EO   = `(?:시행령|시행규칙)`;
const LAW_FULL = `(${LAW_BASE}(?:\\s*${LAW_EO})?)`;
const D   = `\\d+`;
const MOK = `([가-하])목`;
const JO  = `제\\s*(${D})(?:\\s*조(?:의\\s*(${D}))?)?`;
const HANG= `(?:\\s*제?\\s*(${D})\\s*항)?`;
const HO  = `(?:\\s*제?\\s*(${D})\\s*호)?`;
const MOKRE = `(?:\\s*(${MOK}))?`;

export const EXPL_RE = new RegExp(`${LAW_FULL}\\s*${JO}${HANG}${HO}${MOKRE}`, 'g');
export const QUOTED_RE = /「\s*([가-힣A-Za-z0-9·ㆍ\s]+?(?:법|법률)(?:\s*(?:시행령|시행규칙))?)\s*」\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?(?:\s*제?\s*(\d+)\s*항)?(?:\s*제?\s*(\d+)\s*호)?(?:\s*([가-하])\s*목)?/g;
const CTX_WORD = '(?:같은\\s*법|이\\s*법|동\\s*법|같은\\s*법률|이\\s*법률|동\\s*법률|같은\\s*법\\s*시행령|동\\s*법\\s*시행령|이\\s*영|동\\s*시행령|같은\\s*법\\s*시행규칙|동\\s*법\\s*시행규칙|이\\s*규칙|동\\s*규칙)';
export const CTX_RE   = new RegExp(`(${CTX_WORD})\\s*${JO}${HANG}${HO}${MOKRE}`, 'g');

function tokenizeForContext(text){ return text.replace(/[\u00A0\t\r\n]+/g,' ').split(/(?<=[.!?。]|[)\]}])\s+|\s{2,}/); }

const _normCtx = s => (s||'').replace(/\s+/g,'');
const isContextualName = (nameRaw)=>{
  const n = _normCtx(nameRaw);
  return n==='같은법'||n==='이법'||n==='동법'||n==='같은법시행령'||n==='동법시행령'||n==='같은법시행규칙'||n==='동법시행규칙'||n==='이영'||n==='동시행령'||n==='이규칙'||n==='동규칙'||n==='같은법률'||n==='이법률'||n==='동법률';
};

export function extractCitationsAdvanced(text){
  let last = { 법:null, 영:null, 규:null };
  const cites = []; const seen = new Set();

  const refineLawName = s => {
    let t = (s||'').trim();
    if(!t) return t;
    t = t.replace(/^(?:까지|및|또는|등|관련|관한|따른|에\s*따른|에\s*의한|의)\s+/, '');
    const toks = t.split(/\s+/); let i=-1;
    for(let k=toks.length-1;k>=0;k--){ if(/[법]$/.test(toks[k])){ i=k; break; } }
    if(i>=0){ if(toks[i+1] && /^(시행령|시행규칙)$/.test(toks[i+1])) return (toks[i]+' '+toks[i+1]).trim(); return toks[i]; }
    return t;
  };
  const displayName = s => (s||'').replace(/[\"“”'‘’\[\]\(\)「」]/g,'').trim();
  const canonName = s => (s||'').replace(/[\s"“”'‘’\[\]\(\)「」]/g,'').replace(/[·ㆍ]/g,'');

  function updateBaseFromName(disp){
    if(/시행령$/.test(disp)){ last.영 = disp; last.법 = disp.replace(/시행령$/, ''); last.규 = last.법 + '시행규칙'; }
    else if(/시행규칙$/.test(disp)){ last.규 = disp; last.법 = disp.replace(/시행규칙$/, ''); last.영 = last.법 + '시행령'; }
    else { last.법 = disp; last.영 = disp + '시행령'; last.규 = disp + '시행규칙'; }
  }
  function resolveCtx(token){
    const BASE=/(같은\s*법|이\s*법|동\s*법|같은\s*법률|이\s*법률|동\s*법률)/;
    const SL=/(동\s*법\s*시행령|같은\s*법\s*시행령|이\s*영|동\s*시행령)/;
    const SK=/(동\s*법\s*시행규칙|같은\s*법\s*시행규칙|이\s*규칙|동\s*규칙)/;
    if(BASE.test(token)) return last?.법 || null;
    if(SL.test(token))   return last?.영 || (last?.법 ? last.법 + '시행령' : null);
    if(SK.test(token))   return last?.규 || (last?.법 ? last.법 + '시행규칙' : null);
    return null;
  }
  function pushUnique(obj){
    const key = [obj.lawName, obj.jo||'', obj.joi||'', obj.hang||'', obj.ho||'', obj.mok||'', obj.kind||''].join('|');
    if(seen.has(key)) return; seen.add(key); cites.push(obj);
  }

  const tokens = tokenizeForContext(text);
  for(const t of tokens){
    let m0; const LAW_NAME_ONLY_RE = new RegExp(LAW_FULL, 'g');
    while((m0 = LAW_NAME_ONLY_RE.exec(t))){
      const rawNameText = displayName(m0[1]);
      if(isContextualName(rawNameText)) continue;
      const ref = refineLawName(rawNameText); if(!ref) continue; if(isContextualName(ref)) continue; updateBaseFromName(ref);
    }

    let q; while((q = QUOTED_RE.exec(t))){
      const [raw, rawName, joNum, joUi, hang, ho, mokChar] = q;
      const disp = refineLawName(displayName(rawName));
      pushUnique({ raw, lawName: canonName(disp), disp, jo: joNum, joi: joUi||null, hang: hang||null, ho: ho||null, mok: mokChar||null, kind:'article' });
      updateBaseFromName(disp);
    }

    let m; while((m = EXPL_RE.exec(t))){
      const [raw, rawName, joNum, joUi, hang, ho, mokAll] = m;
      const rawNameText = displayName(rawName);
      if(isContextualName(rawNameText)) continue;
      const disp = refineLawName(rawNameText); if(!disp) continue; if(isContextualName(disp)) continue;
      pushUnique({ raw, lawName: canonName(disp), disp, jo: joNum||null, joi: joUi||null, hang: hang||null, ho: ho||null, mok: mokAll?mokAll.match(/[가-하]/)?.[0]||null:null, kind:'article' });
      updateBaseFromName(disp);
    }

    while((m = CTX_RE.exec(t))){
      const [raw, ctxWord, joNum, joUi, hang, ho, mokAll] = m;
      const resolved = resolveCtx(ctxWord); if(!resolved) continue;
      const disp = refineLawName(displayName(resolved));
      pushUnique({ raw, lawName: canonName(disp), disp, jo: joNum||null, joi: joUi||null, hang: hang||null, ho: ho||null, mok: mokAll?mokAll.match(/[가-하]/)?.[0]||null:null, kind:'article' });
    }
  }
  return cites;
}
