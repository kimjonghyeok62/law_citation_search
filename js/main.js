import {
  searchLawRow, fetchArticleJSON, buildLawFullHTMLURL, buildLawArticleURL,
  fetchTextDirectOrProxy, isFailPage, fetchPublicLawSnippet
} from './drf.js';
// EXPL_RE는 사용하지 않으므로 제거
import { extractCitationsAdvanced } from './extract.js';
import { renderFound, appendResult, openPreviewModal, closePreviewModal, sanitizeForEmbed } from './ui.js';

const $ = id => document.getElementById(id);
const getProxyBase = () => ($('proxy')?.value?.trim() || 'https://law-proxy.hyok96.workers.dev/?url=');

// 화면 표시용: 같은법/이법/동법(시행령/시행규칙) → 실제 법명으로 치환
// * 원문이 이미 완전한 법명인 경우에는 그대로 둡니다(중복 방지).
function humanizeRaw(raw, disp){
  if(!raw || !disp) return raw || '';
  const s = raw.trim();

  // 시작 토큰이 있을 때만 치환 (없으면 그대로 반환)
  const m = s.match(
    /^(?:(같은\s*법|이\s*법|동\s*법)\s*(시행령|시행규칙)?|이\s*(영|규칙)|동\s*(시행령|규칙))\s*/
  );
  if(!m) return raw;

  // 시행령/시행규칙 꼬리 보존
  let suffix = m[2] || m[3] || m[4] || '';
  if(suffix === '영') suffix = '시행령';
  if(suffix === '규칙') suffix = '시행규칙';

  const lawPart = disp + (suffix ? ' ' + suffix : '');
  return lawPart + ' ' + s.slice(m[0].length);
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

  for(const it of items){
    const row = await searchLawRow(it.disp || it.lawName, getProxyBase());
    if(!row){
      const li = document.createElement('li'); li.className='item';
      li.innerHTML = `<div><b class="preview-hook">${it.raw||it.disp||it.lawName}</b> <span class="small">(${it.disp||it.lawName})</span></div>
        <div class="small">법령ID 검색 실패. 퍼블릭 링크를 제공합니다.</div>
        <div>• 법령 페이지: <a target="_blank" rel="noopener" href="https://www.law.go.kr/법령/${encodeURIComponent(it.disp||it.lawName)}">${it.disp||it.lawName}</a></div>`;
      resUl.appendChild(li);
      continue;
    }

    const lawId = row.법령ID || row.id || '';
    const lsiSeq = row.법령일련번호 || '';

    // ✅ 화면표시용 raw: 데이터 단계에서 확정된 rawResolved가 있으면 우선 사용
    const displayRaw = it.rawResolved ?? humanizeRaw(it.raw, (it.disp || it.lawName));

    const li = appendResult(resUl, {
      raw: displayRaw,
      disp: (it.disp||it.lawName),
      lawId, lsiSeq,
      jo: it.jo, joi: it.joi, hang: it.hang, ho: it.ho, mok: it.mok
    });

    const openArticle = li.querySelector('.open-article');
    const openFull = li.querySelector('.open-full');
    if(openArticle) openArticle.href = buildLawArticleURL(lawId, {jo:it.jo, joi:it.joi, hang:it.hang, ho:it.ho, mok:it.mok});
    if(openFull) openFull.href = buildLawFullHTMLURL(lawId);

    // 미리보기 즉시 삽입 (비동기)
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
          if(articleText)  body.push(`<div style="white-space:pre-wrap">${articleText}</div>`);
          const hang = art.항 || art.hang || [];
          const arr = Array.isArray(hang) ? hang : (hang? [hang]: []);
          for(const h of arr){
            const hNo = h.항번호||''; const hTx = (h.항내용||'').trim();
            body.push(`<div style="margin-top:8px"><b>제${hNo}항</b> ${hTx}</div>`);
            const hos = Array.isArray(h.호) ? h.호 : (h.호? [h.호]: []);
            for(const _ho of hos){
              const hoNo = _ho.호번호||''; const hoTx=(_ho.호내용||'').trim();
              body.push(`<div style="margin:4px 0 0 12px"><b>제${hoNo}호</b> ${hoTx}</div>`);
              const moks = Array.isArray(_ho.목) ? _ho.목 : (_ho.목? [_ho.목]: []);
              for(const mk of moks){
                const mkNo = mk.목번호||''; const mkTx=(mk.목내용||'').trim();
                body.push(`<div style="margin:2px 0 0 24px"><b>${mkNo}목</b> ${mkTx}</div>`);
              }
            }
          }
          html = `<div class="render"><div class="hdr"><div>${(it.disp||it.lawName)} · ${displayRaw} (JSON)</div></div><div class="body">${body.join('')}</div></div>`;
        }catch{}
      }
      if(!html){
        const full = await fetchTextDirectOrProxy(buildLawFullHTMLURL(lawId), getProxyBase());
        if(full && full.length>200 && !isFailPage(full)){
          const key = `제${parseInt(it.jo||'0',10)}조` + (it.joi?`의${parseInt(it.joi,10)}`:'');
          const idx = full.indexOf(key);
          if(idx>=0){
            html = `<div class="render"><div class="hdr"><div>${(it.disp||it.lawName)} · ${displayRaw} (HTML 폴백)</div></div><div class="body">${full.substring(Math.max(0, idx-400), Math.min(full.length, idx+1600))}</div></div>`;
          }
        }
      }
      if(!html){
        const sn = await fetchPublicLawSnippet((it.disp||it.lawName), parseInt(it.jo||'0',10), it.joi?parseInt(it.joi,10):null, getProxyBase());
        if(sn) html = sn;
      }
      if(html){
        const box = document.createElement('div');
        box.innerHTML = sanitizeForEmbed(html);
        li.appendChild(box);
      } else {
        const warn=document.createElement('div');
        warn.className='small';
        warn.textContent='조문을 불러오지 못했습니다.';
        li.appendChild(warn);
      }
    })();
  }
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
