/* ===== Вкладка «Склад»: рендер карточек, CRUD химии, копирование, тосты, история склада ===== */
function invHintKey(){return 'inv_hint_dismissed_'+locId}
let invHintDismissed=false;
function dismissInvHint(){
 invHintDismissed=true;
 localStorage.setItem(invHintKey(),'1');
 document.getElementById('emptyInvHint').style.display='none';
}

function logInvHistory(action, desc){
 data.history.unshift({
   id: crypto.randomUUID(),
   time: new Date().toISOString(),
   action,
   desc
 });
 data.history = data.history.slice(0, 100);
}

function render(){
  const q=document.getElementById('search').value.trim().toLowerCase();
  document.getElementById('clearSearch').classList.toggle('show',q.length>0);
  document.getElementById('emptyInvHint').style.display=(data.items.length===0&&!invHintDismissed)?'block':'none';
  const list=data.items.filter(x=>x.name.toLowerCase().includes(q));
  document.getElementById('itemsCount').textContent=data.items.length;
  document.getElementById('lowCount').textContent=data.items.filter(x=>x.measures.some(m=>(m.trackMin!==false)&&Number(m.qty)<=Number(m.min))).length;
  document.getElementById('reportDate').textContent=todayStr();
  document.getElementById('cards').innerHTML=list.length?list.map(card).join(''):
    `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><div>Ничего не найдено.<br>Добавьте новую позицию.</div></div>`;
  if(typeof reportPreviewReady!=='undefined'&&reportPreviewReady){
    renderReportHintsAndVisibility();
    renderReportPreview();
  }
}
function onSearch(){render()}
function clearSearch(){document.getElementById('search').value='';render();document.getElementById('search').focus()}

function toggleInReport(id){
 const x=data.items.find(i=>i.id===id);
 if(!x)return;
 x.inReport=!x.inReport;
 logInvHistory(x.inReport ? 'Включение в отчёт' : 'Исключение из отчёта', x.name);
 persist();
 render();
 toast(x.inReport ? `«${x.name}» добавлена в отчёт дня` : `«${x.name}» убрана из отчёта дня`);
}

function card(x){
 const isLow=x.measures.some(m=>(m.trackMin!==false)&&Number(m.qty)<=Number(m.min));
 const isInRep=Boolean(x.inReport);
 return `<article class="card ${isLow?'card-low':''} ${isInRep?'card-in-report':''}">
   <div class="card-top">
     <div class="name-wrap">
       <div class="name">${esc(x.name)}</div>
       <div class="unit-line">${x.measures.length} ${x.measures.length===1?'единица':'единицы'} измерения</div>
       <div class="badges-row">
         ${isLow?`<div class="low-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>Заканчивается</div>`:''}
         ${isInRep?`<div class="report-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>В отчёте дня</div>`:''}
       </div>
     </div>
     <div class="card-actions">
       <button class="icon-btn report-toggle-btn ${isInRep?'active':''}" onclick="toggleInReport('${x.id}')" aria-label="В отчёт дня" title="${isInRep?'Убрать из отчёта дня':'Добавить в отчёт дня'}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
       </button>
       <button class="icon-btn" onclick="copyItem('${x.id}')" aria-label="Копировать позицию" title="Копировать">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
       </button>
       <button class="icon-btn menu-btn" onclick="openEdit('${x.id}')" aria-label="Изменить" title="Редактировать">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
     </div>
   </div>
   <div class="quantities">${x.measures.map((m,i)=>measureHtml(x,i)).join('')}</div>
 </article>`;
}
function measureHtml(x,i){
 const m=x.measures[i];
 const track=m.trackMin!==false;
 const low=track&&Number(m.qty)<=Number(m.min);
 return `<div class="measure ${low?'is-low':''}" title="${track?('Минимальный остаток: '+fmt(m.min)+' '+esc(m.unit)):'Минимальный остаток не отслеживается'}">
   <div class="measure-row">
     <div class="measure-main"><span class="unit-label">${esc(m.unit)}:</span><strong>${fmt(m.qty)}</strong></div>
     <div class="measure-actions">
       <button class="mminus" onclick="change('${x.id}',${i},-1)" aria-label="Уменьшить на 1">−</button>
       <button class="mplus" onclick="change('${x.id}',${i},1)" aria-label="Увеличить на 1">+</button>
     </div>
   </div>
   <div class="quick">
     <button onclick="change('${x.id}',${i},-5)">−5</button>
     <button onclick="change('${x.id}',${i},-0.5)">−0,5</button>
     <button onclick="change('${x.id}',${i},0.5)">+0,5</button>
     <button onclick="change('${x.id}',${i},5)">+5</button>
   </div>
 </div>`;
}
function change(id,mi,delta){
 const x=data.items.find(i=>i.id===id); if(!x)return;
 const m=x.measures[mi]; if(!m)return;
 const old=Number(m.qty), next=Math.max(0,Math.round((old+delta)*100)/100);
 const actual=next-old; if(actual===0)return;
 m.qty=next;
 logInvHistory('Изменение остатка', `${x.name}: ${actual>0?'+':''}${fmt(actual)} ${m.unit}`);
 persist();render();
 toast(`${x.name}: ${actual>0?'+':''}${fmt(actual)} ${m.unit}`);
}

function openAdd(){
 editId=null;modalTitle.textContent='Добавить химию';fName.value='';
 const delBtn=document.getElementById('btnDeleteItem');
 if(delBtn) delBtn.style.display='none';
 measureConfig.innerHTML='';addMeasureRow(null, true);
 modal.classList.add('show');setTimeout(()=>fName.focus(),50);
}
function openEdit(id){
 const x=data.items.find(i=>i.id===id);if(!x)return;
 editId=id;modalTitle.textContent='Изменить химию';fName.value=x.name;
 const delBtn=document.getElementById('btnDeleteItem');
 if(delBtn) delBtn.style.display='block';
 measureConfig.innerHTML='';
 x.measures.forEach((m, idx)=>addMeasureRow(m, idx===0));
 modal.classList.add('show');
}
function deleteCurrentItem(){
 if(!editId) return;
 const x=data.items.find(i=>i.id===editId);
 if(!x) return;
 if(!confirm(`Вы уверены, что хотите удалить «${x.name}» со всеми остатками?`)) return;
 data.items = data.items.filter(i=>i.id!==editId);
 logInvHistory('Удалена позиция', x.name);
 persist();
 closeModal();
 render();
 toast(`Позиция «${x.name}» удалена`);
}
function addMeasureRow(m=null, isFirst=null){
 const isFirstRow = isFirst !== null ? isFirst : (measureConfig.children.length === 0);
 const unit = m ? (m.unit || '') : '';
 const qty = m ? (m.qty != null ? m.qty : 0) : 0;
 const min = m ? (m.min != null ? m.min : 1) : 1;
 const trackMin = m ? (m.trackMin !== false) : isFirstRow;

 const wrap=document.createElement('div');
 wrap.className='measure-config';
 wrap.innerHTML=`<div class="measure-config-head"><span>Единица измерения</span><button type="button" class="remove-measure" onclick="this.closest('.measure-config').remove()">Удалить</button></div>
 <div class="measure-config-grid">
   <div><label>Единица</label><input class="m-unit" required placeholder="кан, кг, л, шт..." value="${esc(unit)}"></div>
   <div><label>Количество</label><input class="m-qty" type="number" step="0.01" min="0" required value="${qty}"></div>
   <div style="grid-column:1/-1">
     <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
       <label style="margin:0">Минимальный остаток</label>
       <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--accent-dark);user-select:none">
         <input type="checkbox" class="m-track-min" ${trackMin?'checked':''} onchange="toggleTrackMin(this)" style="width:auto;margin:0;cursor:pointer">
         Отслеживать
       </label>
     </div>
     <input class="m-min" type="number" step="0.01" min="0" ${trackMin?'required':'disabled'} value="${min}" style="${trackMin?'':'opacity:0.4;background:var(--bg)'}">
   </div>
 </div>`;
 measureConfig.appendChild(wrap);
}
function toggleTrackMin(cb){
 const wrap=cb.closest('.measure-config');
 if(!wrap) return;
 const inp=wrap.querySelector('.m-min');
 if(!inp) return;
 inp.disabled = !cb.checked;
 inp.required = cb.checked;
 inp.style.opacity = cb.checked ? '1' : '0.4';
 inp.style.background = cb.checked ? '' : 'var(--bg)';
}
function saveItem(e){
 e.preventDefault();
 const name=fName.value.trim();
 const rows=[...document.querySelectorAll('.measure-config')];
 if(!rows.length){toast('Добавьте хотя бы одну единицу');return}
 const measures=rows.map(r=>{
   const cb=r.querySelector('.m-track-min');
   const trackMin=cb ? cb.checked : true;
   return {
     unit:r.querySelector('.m-unit').value.trim(),
     qty:Number(r.querySelector('.m-qty').value),
     min:Number(r.querySelector('.m-min').value),
     trackMin:trackMin
   };
 });
 if(measures.some(m=>!m.unit)){toast('Укажите единицу измерения');return}

 if(editId){
   const x=data.items.find(i=>i.id===editId);
   const changes=[];
   if(x.name!==name) changes.push(`Название: ${x.name} → ${name}`);
   const oldM=x.measures||[];
   const maxLen=Math.max(oldM.length,measures.length);
   for(let i=0;i<maxLen;i++){
     const om=oldM[i], nm=measures[i];
     if(!om&&nm){changes.push(`+ ${nm.qty} ${nm.unit} (мин. ${nm.trackMin ? nm.min : 'не отсл.'})`);continue}
     if(om&&!nm){changes.push(`− ${om.qty} ${om.unit}`);continue}
     const parts=[];
     if(om.unit!==nm.unit) parts.push(`ед: ${om.unit} → ${nm.unit}`);
     if(Number(om.qty)!==Number(nm.qty)) parts.push(`кол-во: ${fmt(om.qty)} → ${fmt(nm.qty)}`);
     if(Boolean(om.trackMin)!==Boolean(nm.trackMin)) parts.push(`отслеживание: ${nm.trackMin?'вкл':'выкл'}`);
     if(Number(om.min)!==Number(nm.min) && nm.trackMin) parts.push(`мин: ${fmt(om.min)} → ${fmt(nm.min)}`);
     if(parts.length) changes.push(`${nm.unit||om.unit}: ${parts.join(', ')}`);
   }
   x.name=name;x.measures=measures;
   logInvHistory('Редактирование', `${name}${changes.length ? '\n'+changes.join('\n') : ''}`);
 }else{
   data.items.push({id:crypto.randomUUID(),name,measures,inReport:false});
   logInvHistory('Добавлена позиция', `${name} (${measures.map(m=>m.qty+' '+m.unit+(m.trackMin?'':' [без отсл.]')).join(', ')})`);
 }
 persist();closeModal();render();toast(editId?'Позиция изменена':'Позиция добавлена');
}
function closeModal(){modal.classList.remove('show')}
function backdropClick(e){if(e.target===modal)closeModal()}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function execCommandCopy(text){
 return new Promise((resolve,reject)=>{
   try{
     const ta=document.createElement('textarea');
     ta.value=text;
     ta.style.position='fixed';ta.style.top='0';ta.style.left='0';
     ta.style.width='1px';ta.style.height='1px';ta.style.opacity='0';
     document.body.appendChild(ta);
     ta.focus({preventScroll:true});ta.select();ta.setSelectionRange(0,text.length);
     const ok=document.execCommand('copy');
     document.body.removeChild(ta);
     ok?resolve():reject(new Error('execCommand failed'));
   }catch(e){reject(e)}
 });
}
function copyToClipboard(text){
 const tryModern=()=>{
   if(window.isSecureContext&&navigator.clipboard&&navigator.clipboard.writeText){
     return navigator.clipboard.writeText(text);
   }
   return Promise.reject(new Error('clipboard API unavailable'));
 };
 return tryModern().catch(()=>execCommandCopy(text));
}
function buildReportText(items){
 const lines=items.map(x=>`${x.name} — ${x.measures.map(m=>`${fmt(m.qty)}${m.unit}`).join(', ')}`);
 return `Остаток химии на ${todayStr()}\n\n${lines.join('\n')}`;
}
let lastCopyText='';
function copyReport(){
 const text=buildReportText(data.items);
 lastCopyText=text;
 copyToClipboard(text).then(()=>{
   toast('Остаток скопирован в буфер обмена');
   const btn=document.getElementById('copyBtn');
   btn.classList.add('copied');setTimeout(()=>btn.classList.remove('copied'),1200);
 }).catch(()=>showCopyFallback(text));
}
function copyItem(id){
 const x=data.items.find(i=>i.id===id);if(!x)return;
 const text=buildReportText([x]);
 lastCopyText=text;
 copyToClipboard(text).then(()=>toast(`«${x.name}» скопировано`)).catch(()=>showCopyFallback(text));
}
function showCopyFallback(text){
 const ta=document.getElementById('copyTextarea');
 ta.value=text;
 document.getElementById('copyModal').classList.add('show');
 setTimeout(()=>{ta.focus();ta.select();ta.setSelectionRange(0,text.length);},80);
}
function closeCopyModal(){document.getElementById('copyModal').classList.remove('show')}
function retryCopyFromModal(){
 copyToClipboard(lastCopyText).then(()=>{toast('Скопировано');closeCopyModal();}).catch(()=>{
   const ta=document.getElementById('copyTextarea');ta.focus();ta.select();
   toast('Выделите текст вручную и скопируйте');
 });
}

let toastTimer;
function toast(s){clearTimeout(toastTimer);toastEl.textContent=s;toastEl.classList.add('show');toastTimer=setTimeout(()=>toastEl.classList.remove('show'),1800)}
const modal=document.getElementById('modal'),modalTitle=document.getElementById('modalTitle'),fName=document.getElementById('fName'),measureConfig=document.getElementById('measureConfig'),toastEl=document.getElementById('toast');
window.addEventListener('online',()=>setSyncStatus('online','Синхронизировано'));
window.addEventListener('offline',()=>setSyncStatus('offline','Офлайн — работает локально'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))closeModal()});


/* ===== Модальные окна истории ===== */
function openInvHistory(){
  const el=document.getElementById('invHistoryList');
  if(!data.history||!data.history.length){
    el.innerHTML='<div class="empty">История склада пока пуста</div>';
  }else{
    el.innerHTML=data.history.map(h=>`
      <div class="h-card">
        <div class="h-card-head">
          <span class="h-card-title">${esc(h.action)}</span>
          <span class="h-card-time">${new Date(h.time).toLocaleString('ru-RU')}</span>
        </div>
        <div class="h-card-body">${h.desc.split('\n').map(l=>esc(l)).join('<br>')}</div>
      </div>`).join('');
  }
  document.getElementById('invHistoryModal').classList.add('show');
}
function closeInvHistory(){document.getElementById('invHistoryModal').classList.remove('show')}

