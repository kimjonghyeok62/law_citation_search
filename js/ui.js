export function sanitizeForEmbed(html){
  try{
    if(!html) return '';
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    doc.querySelectorAll('script,style,link,meta,iframe,header,footer,nav').forEach(n=>n.remove());
    const bodyHTML = doc.body.innerHTML;
    const MAX = 12000;
    return bodyHTML.length > MAX ? bodyHTML.slice(0, MAX) + '<div class="small">…(생략)</div>' : bodyHTML;
  }catch{ return ''; }
}

export function renderFound(listEl, items){
  listEl.innerHTML = '';
  if(!items.length){ listEl.innerHTML = '<li>특정 가능한 법조문 인용을 찾지 못했습니다.</li>'; return; }
  for(const it of items){
    const li = document.createElement('li');
    li.innerHTML = `<span class="tag">${it.disp||it.lawName}</span> <span class="monos">${(it.raw||'').trim()}</span>`;
    listEl.appendChild(li);
  }
}

export function appendResult(listEl, {raw, disp, lawId, lsiSeq, jo, joi, hang, ho, mok}){
  const li = document.createElement('li'); li.className='item';
  li.innerHTML = `<div><b class="preview-hook">${raw}</b> <span class="small">(${disp})</span></div>
    <div class="small">법령ID: ${lawId}${lsiSeq ? ` · 일련번호(lsiSeq): ${lsiSeq}`:''}</div>
    <div class="small actions">• <a class="open-article" target="_blank" rel="noopener">조문 바로가기</a> · <a class="open-full" target="_blank" rel="noopener">전체 본문</a> · <button class="preview-btn" style="background:#445b9c;border:0;border-radius:8px;padding:2px 8px;color:#fff;cursor:pointer">미리보기</button></div>`;
  li.dataset.lawid = lawId;
  li.dataset.lawname = disp;
  li.dataset.jo = jo||''; li.dataset.joi = joi||''; li.dataset.hang = hang||''; li.dataset.ho = ho||''; li.dataset.mok = mok||'';
  listEl.appendChild(li);
  return li;
}

export function openPreviewModal(title, html){
  const t = document.getElementById('viewerTitle');
  const b = document.getElementById('viewerBody');
  const v = document.getElementById('viewer');
  t.textContent = title || '';
  b.innerHTML = sanitizeForEmbed(html) || '<div class="small">내용이 없습니다.</div>';
  v.classList.add('on'); v.setAttribute('aria-hidden','false');
}

export function closePreviewModal(){
  const v = document.getElementById('viewer');
  v.classList.remove('on');
  v.setAttribute('aria-hidden','true');
}
