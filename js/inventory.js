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
 if(m.auto&&m.auto.on) return measureAutoHtml(x,i);
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
/* Единица с авторасчётом: основное число — в штуках (считается), вводится же количество в исходной единице (л, кг…) */
function measureAutoHtml(x,i){
 const m=x.measures[i], a=m.auto;
 const track=m.trackMin!==false;
 const low=track&&Number(m.qty)<=Number(m.min);
 const su=esc(a.srcUnit);
 return `<div class="measure is-auto ${low?'is-low':''}" title="${track?('Минимальный остаток: '+fmt(m.min)+' '+esc(m.unit)):'Минимальный остаток не отслеживается'}">
   <div class="measure-row">
     <div class="measure-main"><span class="unit-label">${esc(m.unit)}:</span><strong>${fmt(m.qty)}</strong><span class="auto-chip">авто</span></div>
     <div class="measure-actions">
       <button class="mminus" onclick="changeAuto('${x.id}',${i},-1)" aria-label="Уменьшить на 1 ${su}" title="−1 ${su}">−</button>
       <button class="mplus" onclick="changeAuto('${x.id}',${i},1)" aria-label="Увеличить на 1 ${su}" title="+1 ${su}">+</button>
     </div>
   </div>
   <div class="auto-src">
     <span class="auto-src-lbl">Есть</span>
     <input class="auto-src-input" type="number" inputmode="decimal" step="any" min="0" value="${a.srcQty}" aria-label="Количество в ${su}" onchange="setAutoSrc('${x.id}',${i},this.value)" onkeydown="if(event.key==='Enter')this.blur()">
     <span class="auto-src-unit">${su}</span>
     <span class="auto-note">1 ${esc(m.unit)} = ${esc(autoFactorText(a))}</span>
   </div>
   <div class="quick">
     <button onclick="changeAuto('${x.id}',${i},-5)">−5 ${su}</button>
     <button onclick="changeAuto('${x.id}',${i},-0.5)">−0,5 ${su}</button>
     <button onclick="changeAuto('${x.id}',${i},0.5)">+0,5 ${su}</button>
     <button onclick="changeAuto('${x.id}',${i},5)">+5 ${su}</button>
   </div>
 </div>`;
}
function applyAutoSrc(x,m,nextSrc){
 const a=m.auto, oldSrc=Number(a.srcQty), oldQty=Number(m.qty);
 const next=Math.max(0,Math.round(nextSrc*1000)/1000);
 if(next===oldSrc){render();return}
 a.srcQty=next;
 m.qty=autoCalcQty(a);
 const msg=`${x.name}: ${fmt(oldSrc)} → ${fmt(next)} ${a.srcUnit} (${fmt(oldQty)} → ${fmt(m.qty)} ${m.unit})`;
 logInvHistory('Изменение остатка', msg);
 persist();render();
 toast(`${x.name}: ${fmt(next)} ${a.srcUnit} = ${fmt(m.qty)} ${m.unit}`);
}
function changeAuto(id,mi,delta){
 const x=data.items.find(i=>i.id===id); if(!x)return;
 const m=x.measures[mi]; if(!m||!m.auto)return;
 applyAutoSrc(x,m,Number(m.auto.srcQty)+delta);
}
function setAutoSrc(id,mi,val){
 const x=data.items.find(i=>i.id===id); if(!x)return;
 const m=x.measures[mi]; if(!m||!m.auto)return;
 const n=Number(String(val).replace(',','.'));
 if(val===''||!isFinite(n)){render();return}
 applyAutoSrc(x,m,n);
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

 // Авторасчёт
 const au = (m && m.auto && m.auto.on) ? m.auto : null;
 const autoOn = Boolean(au);
 const aSrcUnit = au ? au.srcUnit : 'л';
 const aSrcQty = au ? au.srcQty : '';
 const aRound = au ? au.round : 'down';
 const subs = autoSubOptions(aSrcUnit);
 const useSub = au && subs.length && au.factor < 1;
 const aFactorShown = au ? (useSub ? Math.round(au.factor / subs[0].mult * 1e6) / 1e6 : au.factor) : '';
 const aFactorOpts = autoFactorOptionsHtml(aSrcUnit, useSub ? subs[0].mult : (subs.length && !au ? subs[0].mult : 1));

 const wrap=document.createElement('div');
 wrap.className='measure-config';
 wrap.innerHTML=`<div class="measure-config-head"><span>Единица измерения</span><button type="button" class="remove-measure" onclick="this.closest('.measure-config').remove()">Удалить</button></div>
 <div class="measure-config-grid">
   <div><label>Единица</label><input class="m-unit" required placeholder="кан, кг, л, шт..." value="${esc(unit)}" oninput="autoRecalc(this)"></div>
   <div><label>Количество</label><input class="m-qty" type="number" step="0.01" min="0" required value="${qty}"></div>
   <div class="auto-box" style="grid-column:1/-1">
     <label class="auto-toggle">
       <input type="checkbox" class="m-auto" ${autoOn?'checked':''} onchange="toggleAuto(this)">
       Авторасчёт из другой единицы
     </label>
     <div class="auto-fields" style="display:${autoOn?'grid':'none'}">
       <div><label>Вводить в</label><input class="a-src-unit" placeholder="л, кг..." value="${esc(aSrcUnit)}" oninput="autoUnitChanged(this)"></div>
       <div><label>Сколько есть</label><input class="a-src-qty" type="number" step="any" min="0" value="${aSrcQty}" oninput="autoRecalc(this)"></div>
       <div style="grid-column:1/-1">
         <label class="a-factor-lbl">В одной ${esc(unit||'шт')} содержится</label>
         <div class="auto-factor-row">
           <input class="a-factor" type="number" step="any" min="0" placeholder="напр. 700" value="${aFactorShown}" oninput="autoRecalc(this)">
           <select class="a-factor-unit" onchange="autoRecalc(this)">${aFactorOpts}</select>
         </div>
       </div>
       <div style="grid-column:1/-1">
         <label>Округление результата</label>
         <select class="a-round" onchange="autoRecalc(this)">${Object.keys(AUTO_ROUNDS).map(k=>`<option value="${k}" ${k===aRound?'selected':''}>${AUTO_ROUNDS[k]}</option>`).join('')}</select>
       </div>
       <div class="auto-preview" style="grid-column:1/-1"></div>
     </div>
   </div>
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
 if(autoOn){
   const q=wrap.querySelector('.m-qty');
   q.readOnly=true; q.classList.add('auto-ro');
   autoRecalc(q);
 }
}
/* ===== Авторасчёт в форме ===== */
function autoFactorOptionsHtml(srcUnit, selectedMult){
 const opts=[...autoSubOptions(srcUnit), { label: String(srcUnit||'').trim()||'ед.', mult: 1 }];
 return opts.map(o=>`<option value="${o.mult}" ${o.mult===selectedMult?'selected':''}>${esc(o.label)}</option>`).join('');
}
function readAutoRow(wrap){
 const num=sel=>{ const v=wrap.querySelector(sel).value; return v===''?NaN:Number(v); };
 const mult=Number(wrap.querySelector('.a-factor-unit').value)||1;
 return {
   on:true,
   unit:wrap.querySelector('.m-unit').value.trim(),
   srcUnit:wrap.querySelector('.a-src-unit').value.trim(),
   srcQty:num('.a-src-qty'),
   factor:Math.round(num('.a-factor')*mult*1e6)/1e6,
   round:wrap.querySelector('.a-round').value
 };
}
function autoRecalc(el){
 const wrap=el.closest('.measure-config'); if(!wrap)return;
 const cb=wrap.querySelector('.m-auto');
 const qtyInp=wrap.querySelector('.m-qty'), prev=wrap.querySelector('.auto-preview');
 const lbl=wrap.querySelector('.a-factor-lbl');
 if(lbl) lbl.textContent='В одной '+(wrap.querySelector('.m-unit').value.trim()||'шт')+' содержится';
 if(!cb.checked) return;
 const a=readAutoRow(wrap);
 if(!(a.factor>0)||!(a.srcQty>=0)){
   prev.textContent='Укажите, сколько в одной '+(a.unit||'шт')+' и сколько всего есть — остаток посчитается сам.';
   prev.classList.remove('ok');
   return;
 }
 const raw=a.srcQty/a.factor, q=autoCalcQty(a);
 qtyInp.value=q;
 prev.classList.add('ok');
 prev.textContent=`${fmt(a.srcQty)} ${a.srcUnit} ÷ ${fmt(a.factor)} ${a.srcUnit} = ${fmt(raw)} → ${fmt(q)} ${a.unit||'шт'}`;
}
function autoUnitChanged(inp){
 const wrap=inp.closest('.measure-config'); if(!wrap)return;
 const subs=autoSubOptions(inp.value);
 wrap.querySelector('.a-factor-unit').innerHTML=autoFactorOptionsHtml(inp.value, subs.length?subs[0].mult:1);
 autoRecalc(inp);
}
function toggleAuto(cb){
 const wrap=cb.closest('.measure-config'); if(!wrap)return;
 wrap.querySelector('.auto-fields').style.display=cb.checked?'grid':'none';
 const qtyInp=wrap.querySelector('.m-qty');
 qtyInp.readOnly=cb.checked;
 qtyInp.classList.toggle('auto-ro',cb.checked);
 autoRecalc(cb);
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
   const mm={
     unit:r.querySelector('.m-unit').value.trim(),
     qty:Number(r.querySelector('.m-qty').value),
     min:Number(r.querySelector('.m-min').value),
     trackMin:trackMin
   };
   const autoCb=r.querySelector('.m-auto');
   if(autoCb&&autoCb.checked){
     const a=readAutoRow(r);
     mm.auto={on:true,srcUnit:a.srcUnit,srcQty:a.srcQty,factor:a.factor,round:a.round};
     mm._autoOk=a.factor>0&&a.srcQty>=0&&Boolean(a.srcUnit);
   }
   return mm;
 });
 if(measures.some(m=>!m.unit)){toast('Укажите единицу измерения');return}
 if(measures.some(m=>m.auto&&!m._autoOk)){toast('Авторасчёт: заполните единицу ввода, объём одной штуки и количество');return}
 measures.forEach(m=>{
   if(m.auto){ delete m._autoOk; m.qty=autoCalcQty(m.auto); }
 });

 if(editId){
   const x=data.items.find(i=>i.id===editId);
   const changes=[];
   if(x.name!==name) changes.push(`Название: ${x.name} → ${name}`);
   const oldM=x.measures||[];
   const maxLen=Math.max(oldM.length,measures.length);
   for(let i=0;i<maxLen;i++){
     const om=oldM[i], nm=measures[i];
     if(!om&&nm){changes.push(`+ ${nm.qty} ${nm.unit} (мин. ${nm.trackMin ? nm.min : 'не отсл.'})${nm.auto?`, авторасчёт: ${fmt(nm.auto.srcQty)} ${nm.auto.srcUnit}`:''}`);continue}
     if(om&&!nm){changes.push(`− ${om.qty} ${om.unit}`);continue}
     const parts=[];
     if(om.unit!==nm.unit) parts.push(`ед: ${om.unit} → ${nm.unit}`);
     if(Number(om.qty)!==Number(nm.qty)) parts.push(`кол-во: ${fmt(om.qty)} → ${fmt(nm.qty)}`);
     const oa=om.auto&&om.auto.on?om.auto:null, na=nm.auto||null;
     if(!oa&&na) parts.push(`авторасчёт вкл (1 ${nm.unit} = ${autoFactorText(na)})`);
     else if(oa&&!na) parts.push('авторасчёт выкл');
     else if(oa&&na){
       if(Number(oa.factor)!==Number(na.factor)||oa.srcUnit!==na.srcUnit) parts.push(`1 ${nm.unit}: ${autoFactorText(oa)} → ${autoFactorText(na)}`);
       if(Number(oa.srcQty)!==Number(na.srcQty)) parts.push(`${fmt(oa.srcQty)} → ${fmt(na.srcQty)} ${na.srcUnit}`);
       if(oa.round!==na.round) parts.push(`округление: ${AUTO_ROUNDS[na.round]}`);
     }
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

