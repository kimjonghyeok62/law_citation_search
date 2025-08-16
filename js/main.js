
// ============ js/main.js ============
import {
  searchLawRow, fetchArticleJSON, buildLawFullHTMLURL, buildLawArticleURL,
  fetchTextDirectOrProxy, isFailPage, fetchPublicLawSnippet, publicLawURL
} from './drf.js';
import { extractCitationsAdvanced } from './extract.js';
import { renderFound, appendResult, openPreviewModal, closePreviewModal, sanitizeForEmbed } from './ui.js';

const $ = id => document.getElementById(id);
const getProxyBase = () => ($('proxy')?.value?.trim() || 'https://law-proxy.hyok96.workers.dev/?url=');

function humanizeRaw(raw, disp){
  if(!raw || !disp) return raw || '';
  return raw
    .replace(/^\s*(같은\s*법|이\s*법|동\s*법)\s*/, '')
    .replace(/^\s*(동\s*법\s*시행령|같은\s*법\s*시행령|이\s*영|동\s*시행령)\s*/, '')
    .replace(/^\s*(동\s*법\s*시행규칙|같은\s*법\s*시행규칙|이\s*규칙|동\s*규칙)\s*/, '')
    .replace(/^\s*(까지|및|또는|등)\s*/, '')
    .replace(/^/, disp + ' ');
}

// Tooltip
const tip = (()=>{ const el=document.createElement('div'); el.className='tooltip'; el.innerHTML='<div class="hdr"></div><div class="cnt"><span class="loading">불러오는 중…</span></div>'; document.body.appendChild(el); return el; })();
function tipShow(title, html, x, y){ tip.querySelector('.hdr').textContent=title||''; tip.querySelector('.cnt').innerHTML = sanitizeForEmbed(html) || '<span class="loading">내용이 없습니다.</span>'; tip.style.display='block'; tipPos(x,y); }
function tipPos(x,y){ const pad=12; const vw=innerWidth, vh=innerHeight; const r=tip.getBoundingClientRect(); let left=x+pad, top=y+pad; if(left+r.width>vw-8) left=vw-r.width-8; if(top+r.height>vh-8) top=y-r.height-pad; if(top<8) top=8; tip.style.left=left+'px'; tip.style.top=top+'px'; }
function tipHide(){ tip.style.display='none'; }

document.addEventListener('mousemove', (e)=>{ if(tip.style.display==='block') tipPos(e.clientX,e.clientY); });

async function hoverPreview(host, ev){
  const lawId = host.dataset.lawid; const lawName = host.dataset.lawname;
  const jo = host.dataset.jo||null; const joi = host.dataset.joi||null; const hang = host.dataset.hang||null; const ho = host.dataset.ho||null; const mok = host.dataset.mok||null;
  tipShow(`${lawName} · 제${jo}${joi?`의${joi}`:''}조`, '<span class="loading">불러오는 중…</span>', ev.clientX, ev.clientY);
  let html='';
  const json = await fetchArticleJSON(lawId, { jo, joi, hang, ho, mok }, getProxyBase());
  if(json){
    try{
      const art = json && (json.law || json.Law) || json; const body=[];
      const articleTitle = (art.조문제목||'').trim(); const articleText=(art.조문내용||'').trim();
      if(articleTitle) body.push(`<div><b>${articleTitle}</b></div>`);
      if(articleText) body.push(`<div style=\"white-space:pre-wrap\">${articleText}</div>`);
      html = `<div class=\"render\"><div class=\"hdr\"><div>${lawName}</div></div><div class=\"body\">${body.join('')}</div></div>`;
    }catch{}
  }
  if(!html){ const full = await fetchTextDirectOrProxy(buildLawFullHTMLURL(lawId), getProxyBase()); if(full && full.length>200 && !isFailPage(full)){ const key = `제${parseInt(jo||'0',10)}조` + (joi?`의${parseInt(joi,10)}`:''); const idx = full.indexOf(key); if(idx>=0){ html = full.substring(Math.max(0, idx-400), Math.min(full.length, idx+1600)); } } }
  if(!html){ const sn = await fetchPublicLawSnippet(lawName, parseInt(jo||'0',10), joi?parseInt(joi,10):null, getProxyBase()); if(sn) html = sn; }
  tipShow(`${lawName} · 제${jo}${joi?`의${joi}`:''}조`, html || '<div class="small">조문을 불러오지 못했습니다.</div>', ev.clientX, ev.clientY);
}

// 3단 폴백 조문 열기
async function openArticleWithFallback(li){
  const lawId = li.dataset.lawid;
  const lawName = li.dataset.lawname;
  const jo = li.dataset.jo||null; const joi = li.dataset.joi||null; const hang = li.dataset.hang||null; const ho = li.dataset.ho||null; const mok = li.dataset.mok||null;

  const htmlURL = buildLawArticleURL(lawId, { jo, joi, hang, ho, mok });
  // 1) HTML 유효성 체크 (프록시로 GET)
  const text = await fetchTextDirectOrProxy(htmlURL, getProxyBase());
  if(text && text.length>30 && !isFailPage(text)){
    window.open(htmlURL, '_blank', 'noopener');
    return;
  }
  // 2) JSON 모달 렌더
  const json = await fetchArticleJSON(lawId, { jo, joi, hang, ho, mok }, getProxyBase());
  if(json){
    try{
      const art = json && (json.law || json.Law) || json;
      const body = [];
      const articleTitle = (art.조문제목||'').trim();
      const articleText  = (art.조문내용||'').trim();
      if(articleTitle) body.push(`<div><b>${articleTitle}</b></div>`);
      if(articleText)  body.push(`<div style=\"white-space:pre-wrap\">${articleText}</div>`);
      const hangArr = Array.isArray(art.항) ? art.항 : (art.항 ? [art.항] : []);
      for(const h of hangArr){
        const hNo = h.항번호||''; const hTx = (h.항내용||'').trim();
        body.push(`<div style=\"margin-top:8px\"><b>제${hNo}항</b> ${hTx}</div>`);
        const hos = Array.isArray(h.호) ? h.호 : (h.호? [h.호]: []);
        for(const _ho of hos){
          const hoNo = _ho.호번호||''; const hoTx=(_ho.호내용||'').trim();
          body.push(`<div style=\"margin:4px 0 0 12px\"><b>제${hoNo}호</b> ${hoTx}</div>`);
          const moks = Array.isArray(_ho.목) ? _ho.목 : (_ho.목? [_ho.목]: []);
          for(const mk of moks){
            const mkNo = mk.목번호||''; const mkTx=(mk.목내용||'').trim();
            body.push(`<div style=\"margin:2px 0 0 24px\"><b>${mkNo}목</b> ${mkTx}</div>`);
          }
        }
      }
      openPreviewModal(`${lawName} · 제${jo}${joi?`의${joi}`:''}조 (JSON)`, `<div class=\"render\"><div class=\"hdr\"><div>${lawName}</div></div><div class=\"body\">${body.join('')}</div></div>`);
      return;
    }catch{}
  }
  // 3) 퍼블릭 페이지로 이동
  window.open(publicLawURL(lawName), '_blank', 'noopener');
}

async function handleRun(){
  const text = $('input').value||'';
  const foundUl = $('foundList');
  const resUl = $('resList');
  foundUl.innerHTML=''; resUl.innerHTML='';
  if(!text.trim()){ alert('본문을 입력해 주세요.'); return; }

  const items = extractCitationsAdvanced(text);
  renderFound(foundUl, items);
  if(!items.length) return;

  // 병렬로 법령ID 조회 → 순서대로 렌더
  const rows = await Promise.allSettled(items.map(it=>searchLawRow(it.disp || it.lawName, getProxyBase())));

  items.forEach((it, idx)=>{
    const st = rows[idx];
    const row = (st.status==='fulfilled') ? st.value : null;
    if(!row){
      const li = document.createElement('li'); li.className='item';
      li.innerHTML = `<div><b class=\"preview-hook\">${humanizeRaw(it.raw, it.disp||it.lawName)}</b> <span class=\"small\">(${it.disp||it.lawName})</span></div>
        <div class=\"small\">법령ID 검색 실패. 퍼블릭 링크를 제공합니다.</div>
        <div>• 법령 페이지: <a target=\"_blank\" rel=\"noopener\" href=\"https://www.law.go.kr/법령/${encodeURIComponent(it.disp||it.lawName)}\">${it.disp||it.lawName}</a></div>`;
      resUl.appendChild(li);
      return;
    }

    const lawId = row.법령ID || row.id || '';
    const lsiSeq = row.법령일련번호 || '';
    const displayRaw = humanizeRaw(it.raw, (it.disp||it.lawName));
    const li = appendResult(resUl, {raw:displayRaw, disp:(it.disp||it.lawName), lawId, lsiSeq, jo:it.jo, joi:it.joi, hang:it.hang, ho:it.ho, mok:it.mok});

    const openArticle = li.querySelector('.open-article');
    const openFull = li.querySelector('.open-full');
    if(openArticle){
      openArticle.href = '#';
      openArticle.addEventListener('click', (e)=>{ e.preventDefault(); openArticleWithFallback(li); });
    }
    if(openFull) openFull.href = buildLawFullHTMLURL(lawId);

    const hook = li.querySelector('.preview-hook');
    if(hook){
      hook.addEventListener('mouseover', (e)=>hoverPreview(li, e));
      hook.addEventListener('mousemove', (e)=>tipPos(e.clientX,e.clientY));
      hook.addEventListener('mouseout', ()=>tipHide());
    }

    (async()=>{
      let html = '';
      const json = await fetchArticleJSON(lawId, { jo:it.jo, joi:it.joi, hang:it.hang, ho:it.ho, mok:it.mok }, getProxyBase());
      if(json){
        try{
          const art = json && (json.law || json.Law) || json;
          const body = [];
          const articleTitle = (art.조문제목||'').trim();
          const articleText  = (art.조문내용||'').trim();
          if(articleTitle) body.push(`<div><b>${articleTitle}</b></div>`);
          if(articleText)  body.push(`<div style=\"white-space:pre-wrap\">${articleText}</div>`);
          const hang = art.항 || art.hang || [];
          const arr = Array.isArray(hang) ? hang : (hang? [hang]: []);
          for(const h of arr){
            const hNo = h.항번호||''; const hTx = (h.항내용||'').trim();
            body.push(`<div style=\"margin-top:8px\"><b>제${hNo}항</b> ${hTx}</div>`);
            const hos = Array.isArray(h.호) ? h.호 : (h.호? [h.호]: []);
            for(const _ho of hos){
              const hoNo = _ho.호번호||''; const hoTx=(_ho.호내용||'').trim();
              body.push(`<div style=\"margin:4px 0 0 12px\"><b>제${hoNo}호</b> ${hoTx}</div>`);
              const moks = Array.isArray(_ho.목) ? _ho.목 : (_ho.목? [_ho.목]: []);
              for(const mk of moks){
                const mkNo = mk.목번호||''; const mkTx=(mk.목내용||'').trim();
                body.push(`<div style=\"margin:2px 0 0 24px\"><b>${mkNo}목</b> ${mkTx}</div>`);
              }
            }
          }
          html = `<div class=\"render\"><div class=\"hdr\"><div>${(it.disp||it.lawName)} · ${displayRaw} (JSON)</div></div><div class=\"body\">${body.join('')}</div></div>`;
        }catch{}
      }
      if(!html){
        const full = await fetchTextDirectOrProxy(buildLawFullHTMLURL(lawId), getProxyBase());
        if(full && full.length>200 && !isFailPage(full)){
          const key = `제${parseInt(it.jo||'0',10)}조` + (it.joi?`의${parseInt(it.joi,10)}`:'');
          const idx = full.indexOf(key);
          if(idx>=0){ html = `<div class=\"render\"><div class=\"hdr\"><div>${(it.disp||it.lawName)} · ${displayRaw} (HTML 폴백)</div></div><div class=\"body\">${full.substring(Math.max(0, idx-400), Math.min(full.length, idx+1600))}</div></div>`; }
        }
      }
      if(!html){
        const sn = await fetchPublicLawSnippet((it.disp||it.lawName), parseInt(it.jo||'0',10), it.joi?parseInt(it.joi,10):null, getProxyBase());
        if(sn) html = sn;
      }
      if(html){ const box = document.createElement('div'); box.innerHTML = sanitizeForEmbed(html); li.appendChild(box); }
      else { const warn=document.createElement('div'); warn.className='small'; warn.textContent='조문을 불러오지 못했습니다.'; li.appendChild(warn); }
    })();
  });
}

function bind(){
  $('run')?.addEventListener('click', handleRun);
  $('clear')?.addEventListener('click', ()=>{ $('foundList').innerHTML=''; $('resList').innerHTML=''; });
  $('viewerClose')?.addEventListener('click', closePreviewModal);

  $('runTests')?.addEventListener('click', ()=>{
    const sample = [
      '건축법 제22조, 같은법 제23조, 동법시행령 제9조의2 제3항을 적용한다.',
      '또한 「유아교육법」 제2조제2호, 「초·중등교육법」 제2조 및 「고등교육법」 제2조를 따른다.',
      '같은 법 시행령 제9조의2 제1항을 적용한다.',
      '그리고 별표 1과 부칙 1을 참고한다.',
      '… 2025. 6. 30.까지 유아교육법 제30조를 준용한다.',
      '오타 테스트: 영유아교육법 제1조 (→ 유아교육법/영유아보육법 자동 보정)'
    ].join(' ');
    $('input').value = sample; handleRun(); $('testOutput').innerHTML = '샘플 본문으로 실행했습니다. (JSON 우선, 프록시 폴백 활성)';
  });

  $('runTests2')?.addEventListener('click', ()=>{
    const sample2 = [
      '도로교통법 시행규칙 제6조의2 제1항 제3호 가목을 따른다.',
      '같은 법 제8조 및 같은 법 시행령 제8조의2를 병기한다.',
      '영유아교육법 제2조 (유사명 자동보정 테스트 포함)'
    ].join(' ');
    $('input').value = sample2; handleRun(); $('testOutput').innerHTML = '추가 테스트 본문으로 실행했습니다. (시행규칙/의조/목 처리 포함)';
  });
}

document.addEventListener('DOMContentLoaded', bind);
