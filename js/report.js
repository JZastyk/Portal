/* ===== Вкладка «Отчёт дня»: настройки, форма смены, сборка текста отчёта, история отчётов ===== */
/* Дата смены для формы отчёта */
let currentShiftDate = yesterdayISO();
let isCustomShiftDatePicked = false;
let lastKnownTodayISO = todayISO();

function onReportShiftDateChange(){
 const el = document.getElementById('rDateShift');
 if(el && el.value){
   currentShiftDate = el.value;
   isCustomShiftDatePicked = (currentShiftDate !== yesterdayISO());
   updateWashedDateLabel();
   applyInteljetAutofill();
   renderReportPreview();
 }
}

function updateWashedDateLabel(){
 const lbl = document.getElementById('washedDateLabel');
 if(lbl && currentShiftDate){
   lbl.textContent = isoToRuDate(currentShiftDate);
 }
}

/* Автоматическое заполнение количества машин по боксам из INTELJET */
function applyInteljetAutofill(){
  const badge = document.getElementById('washedAutoBadge');
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()){
    if(badge) badge.style.display = 'none';
    return;
  }

  const shiftD = currentShiftDate || yesterdayISO();
  const allOrders = Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {});
  const shiftOrders = allOrders.filter(o => o && o.date === shiftD);

  if(!shiftOrders.length){
    if(badge) badge.style.display = 'none';
    return;
  }

  const boxCountNum = Number(settings.boxCount) || 0;
  const counts = {};
  for(let b=1; b<=boxCountNum; b++) counts[b] = 0;

  shiftOrders.forEach(o => {
    const b = Number(o.box) || 1;
    if(counts[b] !== undefined) counts[b] += 1;
  });

  const total = shiftOrders.length;
  let didAutofill = false;

  for(let b=1; b<=boxCountNum; b++){
    const inp = document.querySelector(`.washed-in[data-box="${b}"]`);
    if(inp && document.activeElement !== inp){
      // Заполняем, если поле пустое или было автозаполнено ранее
      if(report.washed[b] === '' || report.washed[b] == null || inp.dataset.autoFilled === '1'){
        report.washed[b] = String(counts[b] || 0);
        inp.value = report.washed[b];
        inp.dataset.autoFilled = '1';
        didAutofill = true;
      }
    }
  }

  if(badge){
    const hasManual = Array.from(document.querySelectorAll('.washed-in')).some(el => el.dataset.autoFilled === '0');
    badge.style.display = 'inline-block';
    badge.textContent = hasManual 
      ? `⚡ Заполнено из INTELJET (${total} авто, отредактировано)`
      : `⚡ Заполнено из INTELJET (${total} авто)`;
    badge.title = 'Данные подтянуты автоматически из INTELJET. Вы можете скорректировать цифры в любой момент.';
  }
}

function refreshShiftDateIfDayChanged(forceReset = false){
 const currentToday = todayISO();
 const dateInput = document.getElementById('rDateShift');
 if(forceReset || (!isCustomShiftDatePicked && currentToday !== lastKnownTodayISO)){
   lastKnownTodayISO = currentToday;
   currentShiftDate = yesterdayISO();
   isCustomShiftDatePicked = false;
   if(dateInput) dateInput.value = currentShiftDate;
   updateWashedDateLabel();
   renderReportPreview();
 } else if(dateInput && !dateInput.value){
   dateInput.value = currentShiftDate || yesterdayISO();
   updateWashedDateLabel();
 }
}

document.addEventListener('visibilitychange', () => {
 if(!document.hidden) refreshShiftDateIfDayChanged();
});
window.addEventListener('focus', () => refreshShiftDateIfDayChanged());


/* ===== Ежедневный отчёт ===== */
function range(n){const a=[];for(let i=1;i<=n;i++)a.push(i);return a}
function settingsKey(){return 'report_settings_v1_'+locId}
function reportHintKey(){return 'report_hint_dismissed_'+locId}
let reportHintDismissed=false;

function dismissReportHint(){
 reportHintDismissed=true;
 localStorage.setItem(reportHintKey(),'1');
 document.getElementById('emptyReportHint').style.display='none';
}

function defaultSettings(){
 return {
   authors:[],
   boxCount:0,
   compressorCount:0,
   pumpCount:0,
   consumptionItems:[]
 };
}

function isReportConfigured(){
 return (settings.boxCount>0 || settings.compressorCount>0 || settings.pumpCount>0 || settings.authors.length>0 || data.items.some(x=>x.inReport));
}

function sanitizeSettings(s){
 const d=defaultSettings();
 if(!s||typeof s!=='object')return d;
 const boxCount=parseInt(s.boxCount);
 const compressorCount=parseInt(s.compressorCount);
 const pumpCount=parseInt(s.pumpCount);
 return {
   authors:Array.isArray(s.authors)?s.authors.filter(a=>a&&String(a).trim()):toArray(s.authors).filter(a=>a&&String(a).trim()),
   boxCount:Number.isFinite(boxCount)?Math.max(0,Math.min(12,boxCount)):d.boxCount,
   compressorCount:Number.isFinite(compressorCount)?Math.max(0,Math.min(12,compressorCount)):d.compressorCount,
   pumpCount:Number.isFinite(pumpCount)?Math.max(0,Math.min(12,pumpCount)):d.pumpCount,
   consumptionItems:Array.isArray(s.consumptionItems)?s.consumptionItems.filter(a=>a&&String(a).trim()):toArray(s.consumptionItems).filter(a=>a&&String(a).trim())
 };
}
let settings=defaultSettings();
let settingsSyncTimer;
function persistSettingsLocal(){localStorage.setItem(settingsKey(),JSON.stringify(settings))}
function persistSettings(){
 persistSettingsLocal();
 clearTimeout(settingsSyncTimer);
 settingsSyncTimer=setTimeout(()=>{settingsRef.set(settings).catch(()=>{});},350);
}

function defaultReport(){
 const boxState={},washed={},hoses={},consumption={};
 range(settings.boxCount).forEach(b=>{boxState[b]='ok';washed[b]='';hoses[b]={left:'',back:'',right:''};consumption[b]={};});
 const compressorState={};
 range(settings.compressorCount).forEach(i=>{compressorState[i]='ok';});
 const pumpState={},pumpPressure={};
 range(settings.pumpCount).forEach(i=>{pumpState[i]='ok';pumpPressure[i]='';});
 return {
   author:localStorage.getItem(lastAuthorKey())||'',
   boxState,washed,tds:'',
   compressorState,pumpState,pumpPressure,
   hoses,consumption
 };
}
function sanitizeReport(r){
 const d=defaultReport();
 if(!r||typeof r!=='object')return d;
 const out={
   author:r.author!==undefined?r.author:d.author,
   boxState:{},washed:{},tds:r.tds!==undefined?r.tds:(r.ph!==undefined?r.ph:''),
   compressorState:{},pumpState:{},pumpPressure:{},
   hoses:{},consumption:{}
 };
 range(settings.boxCount).forEach(b=>{
   out.boxState[b]=(r.boxState&&r.boxState[b])||'ok';
   out.washed[b]=(r.washed&&r.washed[b])||'';
   const h=r.hoses&&r.hoses[b];
   out.hoses[b]={left:(h&&h.left)||'',back:(h&&h.back)||'',right:(h&&h.right)||''};
   out.consumption[b]=Object.assign({},r.consumption&&r.consumption[b]);
 });
 range(settings.compressorCount).forEach(i=>{out.compressorState[i]=(r.compressorState&&r.compressorState[i])||'ok';});
 range(settings.pumpCount).forEach(i=>{
   out.pumpState[i]=(r.pumpState&&r.pumpState[i])||'ok';
   out.pumpPressure[i]=(r.pumpPressure&&r.pumpPressure[i])||'';
 });
 return out;
}
let report={};
let reportsHistoryCache=[];

function renderToggleGroup(elId,ids,stateObj,prefix,offLabel){
 const el=document.getElementById(elId);
 if(!el)return;
 el.innerHTML=ids.map(i=>`
   <div class="toggle-item">
     <span>${prefix} ${i}</span>
     <div class="pill-toggle">
       <button type="button" class="${stateObj[i]!=='bad'?'on':''}" onclick="setToggle('${elId}',${i},'ok')">Норма</button>
       <button type="button" class="${stateObj[i]==='bad'?'off':''}" onclick="setToggle('${elId}',${i},'bad')">${offLabel}</button>
     </div>
   </div>`).join('');
}
function renderAllToggles(){
 if(settings.boxCount>0)renderToggleGroup('boxStatusRow',range(settings.boxCount),report.boxState,'Бокс','Не работает');
 if(settings.compressorCount>0)renderToggleGroup('compressorRow',range(settings.compressorCount),report.compressorState,'Компрессор','Не в норме');
 if(settings.pumpCount>0)renderToggleGroup('pumpRow',range(settings.pumpCount),report.pumpState,'Помпа','Не в норме');
}
function setToggle(group,i,val){
 if(group==='boxStatusRow')report.boxState[i]=val;
 else if(group==='compressorRow')report.compressorState[i]=val;
 else if(group==='pumpRow')report.pumpState[i]=val;
 renderAllToggles();
 renderReportPreview();
 persistReport();
}
function buildAuthorSelect(){
 const sel=document.getElementById('rAuthor');
 const cur=sel.value;
 let html='<option value="">Выберите...</option>';
 settings.authors.forEach(a=>{html+=`<option value="${esc(a)}">${esc(a)}</option>`});
 html+='<option value="__custom__">Другое имя...</option>';
 sel.innerHTML=html;
 if([...sel.options].some(o=>o.value===cur))sel.value=cur;
}
function onAuthorChange(){
 const sel=document.getElementById('rAuthor').value;
 const custom=document.getElementById('rAuthorCustom');
 custom.style.display=sel==='__custom__'?'block':'none';
 updateReport();
}
function commitCustomAuthor(){
 const inp=document.getElementById('rAuthorCustom');
 const name=inp.value.trim();
 if(!name)return;
 if(!settings.authors.includes(name)){
   settings.authors.push(name);
   persistSettings();
 }
 buildAuthorSelect();
 document.getElementById('rAuthor').value=name;
 inp.style.display='none';
 updateReport();
}

/* Секция боксов с безопасным decimal вводом для рукава и расхода */
function buildBoxSectionHtml(b){
 return `<details class="box-section">
   <summary>Бокс ${b}</summary>
   <div class="box-section-body">
     <div class="sub-label-row">
       <span class="sub-label">Проход рукава</span>
       <div class="sub-label-actions">
         <button type="button" class="mini-copy" onclick="copyBoxHose(${b},event)">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           Копировать
         </button>
         <button type="button" class="mini-copy clear" onclick="clearBoxHose(${b},event)">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
           Очистить
         </button>
       </div>
     </div>
     <div class="hose-grid">
       <div><label>Слева</label><input class="hose-in" data-box="${b}" data-side="left" type="text" inputmode="decimal" placeholder="0.0" oninput="onDecimalInput(this, updateReport)"></div>
       <div><label>Сзади</label><input class="hose-in" data-box="${b}" data-side="back" type="text" inputmode="decimal" placeholder="0.0" oninput="onDecimalInput(this, updateReport)"></div>
       <div><label>Справа</label><input class="hose-in" data-box="${b}" data-side="right" type="text" inputmode="decimal" placeholder="0.0" oninput="onDecimalInput(this, updateReport)"></div>
     </div>
     ${settings.consumptionItems.length?`
     <div class="sub-label-row">
       <span class="sub-label">Расход химии, г</span>
       <div class="sub-label-actions">
         <button type="button" class="mini-copy" onclick="copyBoxConsumption(${b},event)">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           Копировать
         </button>
         <button type="button" class="mini-copy clear" onclick="clearBoxConsumption(${b},event)">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
           Очистить
         </button>
       </div>
     </div>
     <div class="consumption-grid">
       ${settings.consumptionItems.map(name=>`<div><label>${esc(name)}</label><input class="cons-in" data-box="${b}" data-name="${esc(name)}" type="text" inputmode="decimal" placeholder="0.0" oninput="onDecimalInput(this, updateReport)"></div>`).join('')}
     </div>`:''}
   </div>
 </details>`;
}
function buildHoseText(b){
 const h=report.hoses[b]||{};
 const lines=[`Проход рукава ${b} бокс:`];
 if(h.left)lines.push(`Слева - ${h.left}`);
 if(h.back)lines.push(`Сзади - ${h.back}`);
 if(h.right)lines.push(`Справа - ${h.right}`);
 return lines.join('\n');
}
function buildConsumptionText(b){
 const c=report.consumption[b]||{};
 const rows=settings.consumptionItems.filter(name=>c[name]);
 const lines=[`Расход химии ${b} бокс:`];
 rows.forEach(name=>lines.push(`${name} - ${c[name]} г.`));
 return lines.join('\n');
}
function flashMiniCopy(btn){
 btn.classList.add('copied');
 setTimeout(()=>btn.classList.remove('copied'),1200);
}
function copyBoxHose(b,ev){
 const h=report.hoses[b]||{};
 if(!h.left&&!h.back&&!h.right){toast(`Бокс ${b}: нет данных по рукаву`);return}
 const text=buildHoseText(b);
 lastCopyText=text;
 copyToClipboard(text).then(()=>{
   toast(`Проход рукава, бокс ${b} — скопировано`);
   if(ev&&ev.currentTarget)flashMiniCopy(ev.currentTarget);
 }).catch(()=>showCopyFallback(text));
}
function copyBoxConsumption(b,ev){
 const c=report.consumption[b]||{};
 if(!settings.consumptionItems.some(name=>c[name])){toast(`Бокс ${b}: нет данных по расходу`);return}
 const text=buildConsumptionText(b);
 lastCopyText=text;
 copyToClipboard(text).then(()=>{
   toast(`Расход химии, бокс ${b} — скопировано`);
   if(ev&&ev.currentTarget)flashMiniCopy(ev.currentTarget);
 }).catch(()=>showCopyFallback(text));
}
function clearBoxHose(b,ev){
 const h=report.hoses[b]||{};
 if(!h.left&&!h.back&&!h.right){toast(`Бокс ${b}: проход рукава уже пуст`);return}
 if(!confirm(`Очистить проход рукава для бокса ${b}?`))return;
 report.hoses[b]={left:'',back:'',right:''};
 document.querySelectorAll(`.hose-in[data-box="${b}"]`).forEach(inp=>inp.value='');
 renderReportPreview();
 persistReport();
 toast(`Проход рукава, бокс ${b} — очищено`);
}
function clearBoxConsumption(b,ev){
 const c=report.consumption[b]||{};
 if(!settings.consumptionItems.some(name=>c[name])){toast(`Бокс ${b}: расход химии уже пуст`);return}
 if(!confirm(`Очистить расход химии для бокса ${b}?`))return;
 report.consumption[b]={};
 document.querySelectorAll(`.cons-in[data-box="${b}"]`).forEach(inp=>inp.value='');
 renderReportPreview();
 persistReport();
 toast(`Расход химии, бокс ${b} — очищено`);
}
function buildBoxSectionsOnce(){
 let html='';
 range(settings.boxCount).forEach(b=>{html+=buildBoxSectionHtml(b);});
 document.getElementById('boxSections').innerHTML=html;
}
function buildWashedGridOnce(){
 document.getElementById('washedGrid').innerHTML=range(settings.boxCount).map(b=>
   `<div><span>Бокс ${b}</span><input class="washed-in" data-box="${b}" type="number" min="0" inputmode="numeric" oninput="updateReport()"></div>`
 ).join('');
}
function buildPumpPressureOnce(){
 document.getElementById('pumpPressureGrid').innerHTML=range(settings.pumpCount).map(i=>
   `<div><span>Помпа ${i}</span><input class="pump-pressure-in" data-pump="${i}" type="text" inputmode="decimal" placeholder="0.0" oninput="onDecimalInput(this, updateReport)"></div>`
 ).join('');
}

function renderReportHintsAndVisibility(){
 const configured=isReportConfigured();
 document.getElementById('emptyReportHint').style.display=(!configured&&!reportHintDismissed)?'block':'none';

 document.getElementById('rowAuthor').style.display=settings.authors.length>0?'block':'none';
 document.getElementById('rowBoxStatus').style.display=settings.boxCount>0?'block':'none';
 document.getElementById('rowWashed').style.display=settings.boxCount>0?'block':'none';
 document.getElementById('rowTds').style.display=configured?'block':'none';
 document.getElementById('rowCompressor').style.display=settings.compressorCount>0?'block':'none';
 document.getElementById('rowPump').style.display=settings.pumpCount>0?'block':'none';
 document.getElementById('rowPumpPressure').style.display=settings.pumpCount>0?'block':'none';
 document.getElementById('boxSections').style.display=settings.boxCount>0?'block':'none';

 document.getElementById('rowReportActions').style.display=configured?'flex':'none';
 document.getElementById('rowReportPreview').style.display=configured?'block':'none';
}

function rebuildReportDynamicUI(){
 renderReportHintsAndVisibility();
 buildWashedGridOnce();
 buildPumpPressureOnce();
 buildBoxSectionsOnce();
 buildAuthorSelect();
 renderAllToggles();
}

/* Заполнение формы без перезаписи активного поля ввода и без устаревших вызовов */
function fillReportForm(){
 const dateInput = document.getElementById('rDateShift');
 if(dateInput && !dateInput.value){
   dateInput.value = currentShiftDate || yesterdayISO();
 }
 updateWashedDateLabel();
 buildAuthorSelect();

 const authorSel=document.getElementById('rAuthor'),authorCustom=document.getElementById('rAuthorCustom');
 if(settings.authors.includes(report.author)){
   authorSel.value=report.author;authorCustom.style.display='none';authorCustom.value='';
 }else if(report.author){
   authorSel.value='__custom__';authorCustom.style.display='block';authorCustom.value=report.author;
 }else{
   authorSel.value='';authorCustom.style.display='none';authorCustom.value='';
 }

 document.querySelectorAll('.washed-in').forEach(inp=>{
   if(document.activeElement === inp) return;
   inp.value=report.washed[inp.dataset.box]||'';
 });
 applyInteljetAutofill();

 if(document.activeElement !== document.getElementById('rTds')){
   document.getElementById('rTds').value=report.tds||'';
 }

 document.querySelectorAll('.pump-pressure-in').forEach(inp=>{
   if(document.activeElement === inp) return;
   inp.value=report.pumpPressure[inp.dataset.pump]||'';
 });

 document.querySelectorAll('.hose-in').forEach(inp=>{
   if(document.activeElement === inp) return;
   const b=inp.dataset.box,side=inp.dataset.side;
   inp.value=(report.hoses[b]&&report.hoses[b][side])||'';
 });

 document.querySelectorAll('.cons-in').forEach(inp=>{
   if(document.activeElement === inp) return;
   const b=inp.dataset.box,name=inp.dataset.name;
   inp.value=(report.consumption[b]&&report.consumption[b][name])||'';
 });

 renderAllToggles();
 renderReportHintsAndVisibility();
 renderReportPreview();
}

/* Универсальная функция сборки отчёта (с учётом выбранной даты смены) */
function buildDailyReportTextCustom(r, setObj, chemItems, customShiftDate){
 const bCount = Number(setObj.boxCount) || 0;
 const cCount = Number(setObj.compressorCount) || 0;
 const pCount = Number(setObj.pumpCount) || 0;

 if(!bCount && !cCount && !pCount && (!chemItems || !chemItems.length)) return '';

 const shiftD = customShiftDate || currentShiftDate || yesterdayISO();
 const shiftDateStr = isoToRuDate(shiftD);
 const repDateStr = isoToRuDate(addDaysISO(shiftD, 1));

 const lines = [];
 lines.push(`${repDateStr}${r.author ? (' ' + r.author) : ''}`.trim());

 if(bCount > 0){
   const boxIds = range(bCount);
   const normalBoxes = boxIds.filter(b => r.boxState && r.boxState[b] !== 'bad');
   const badBoxes = boxIds.filter(b => r.boxState && r.boxState[b] === 'bad');
   if(normalBoxes.length) lines.push(`Боксы ${normalBoxes.join(', ')} - работают в штатном режиме.`);
   badBoxes.forEach(b => lines.push(`Бокс ${b} - не работает.`));
   lines.push('');

   lines.push(`Помыто машин за ${shiftDateStr}:`);
   boxIds.forEach(b => lines.push(`${b} бокс - ${(r.washed && r.washed[b] !== '' && r.washed[b] != null) ? r.washed[b] : 0}`));
   lines.push('');
 }

 const reportStockItems = (chemItems || []).filter(it => it.inReport);
 if(reportStockItems.length > 0){
   lines.push('Остаток химии:');
   reportStockItems.forEach(x => {
     let shown = (x.measures || []).filter(m => Number(m.qty) !== 0);
     if(!shown.length) shown = x.measures || [];
     lines.push(`${x.name} - ${shown.map(m => `${fmt(m.qty)}${m.unit}.`).join(' и ')}`);
   });
   lines.push('');
 }

 if(r.tds) lines.push(`TDS - ${r.tds}`);
 lines.push('');

 if(cCount > 0){
   range(cCount).forEach(i => {
     lines.push(`Масло компрессор ${i} - ${(r.compressorState && r.compressorState[i] === 'bad') ? 'не в норме' : 'норма'}.`);
   });
 }

 if(pCount > 0){
   const pumpIds = range(pCount);
   const pumpOk = pumpIds.filter(i => r.pumpState && r.pumpState[i] !== 'bad');
   const pumpBad = pumpIds.filter(i => r.pumpState && r.pumpState[i] === 'bad');
   if(pumpOk.length) lines.push(`Помпы ${pumpOk.join(', ')} масло в норме.`);
   if(pumpBad.length) lines.push(`Помпы ${pumpBad.join(', ')} масло не в норме.`);
   pumpIds.forEach(i => {
     if(r.pumpPressure && r.pumpPressure[i] !== '' && r.pumpPressure[i] != null) {
       lines.push(`Давление помпы ${i} - ${r.pumpPressure[i]}`);
     }
   });
   lines.push('');
 }

 if(bCount > 0){
   range(bCount).forEach(b => {
     const h = (r.hoses && r.hoses[b]) || {};
     if(h.left || h.back || h.right){
       lines.push(`Проход рукава ${b} бокс:`);
       if(h.left) lines.push(`Слева - ${h.left}`);
       if(h.back) lines.push(`Сзади - ${h.back}`);
       if(h.right) lines.push(`Справа - ${h.right}`);
       lines.push('');
     }
   });
   range(bCount).forEach(b => {
     const c = (r.consumption && r.consumption[b]) || {};
     const consList = setObj.consumptionItems || [];
     const rows = consList.filter(name => c[name]);
     if(rows.length){
       lines.push(`Расход химии ${b} бокс:`);
       rows.forEach(name => lines.push(`${name} - ${c[name]} г.`));
       lines.push('');
     }
   });
 }
 return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildDailyReportText(r){
 return buildDailyReportTextCustom(r, settings, data.items, currentShiftDate);
}

function renderReportPreview(){
 document.getElementById('reportPreview').value=buildDailyReportText(report);
}
let reportSyncTimer;
function persistReportLocal(){localStorage.setItem(reportKey(),JSON.stringify(report))}
function persistReport(){
 persistReportLocal();
 clearTimeout(reportSyncTimer);
 reportSyncTimer=setTimeout(()=>{reportDbRef.set(report).catch(()=>{});},350);
}
function updateReport(){
 const selVal=document.getElementById('rAuthor').value;
 if(selVal!=='__custom__')report.author=selVal;
 else report.author=document.getElementById('rAuthorCustom').value;
 localStorage.setItem(lastAuthorKey(),report.author);
 document.querySelectorAll('.washed-in').forEach(inp=>{
   report.washed[inp.dataset.box]=inp.value;
   if(document.activeElement === inp){
     inp.dataset.autoFilled = '0';
   }
 });
 applyInteljetAutofill();
 report.tds=document.getElementById('rTds').value;
 document.querySelectorAll('.pump-pressure-in').forEach(inp=>{report.pumpPressure[inp.dataset.pump]=inp.value});
 document.querySelectorAll('.hose-in').forEach(inp=>{
   const b=inp.dataset.box,side=inp.dataset.side;
   report.hoses[b][side]=inp.value;
 });
 document.querySelectorAll('.cons-in').forEach(inp=>{
   const b=inp.dataset.box,name=inp.dataset.name;
   if(inp.value)report.consumption[b][name]=inp.value;
   else delete report.consumption[b][name];
 });
 renderReportPreview();
 persistReport();
}
function clearReportForm(){
 if(!confirm('Очистить форму отчёта на новый день? Ответственный останется прежним.'))return;
 const keepAuthor=report.author;
 report=defaultReport();
 report.author=keepAuthor;
 refreshShiftDateIfDayChanged(true);
 fillReportForm();
 persistReport();
 toast('Форма очищена');
}

/* Сохранение отчёта строго под датой составления (сегодня) с сохранением смены */
function saveReportToHistoryManual(){
 const shiftDate = currentShiftDate || yesterdayISO();
 const text = buildDailyReportText(report);
 if(!text){toast('Отчёт пуст — заполните параметры');return}

 const reportDate = addDaysISO(shiftDate, 1);
 const entry={
   id: reportDate,
   date: shiftDate,
   shiftDate: shiftDate,
   reportDate: reportDate,
   author: report.author,
   text,
   report: JSON.parse(JSON.stringify(report)),
   time: new Date().toISOString()
 };

 // Локально перезаписываем день
 reportsHistoryCache = [entry, ...reportsHistoryCache.filter(e => e.id !== reportDate && e.reportDate !== reportDate && e.date !== shiftDate)];
 localStorage.setItem(reportHistKey(), JSON.stringify(reportsHistoryCache));

 // В Firebase сохраняем с ключом по дате отчёта
 reportsHistoryRef.child(reportDate).set(entry).then(()=>{
   toast(`Отчёт за ${isoToRuDate(reportDate)} сохранён`);
 }).catch(()=>{
   toast('Сохранено локально');
 });

 // Обновляем дату в календаре аналитики на сохранённую дату отчёта
 const anPicker = document.getElementById('anDateSelect');
 if(anPicker) anPicker.value = reportDate;

 renderAnalytics();
}

function copyDailyReport(){
 const text=buildDailyReportText(report);
 if(!text){toast('Отчёт пуст — сначала настройте автомойку');return;}
 lastCopyText=text;
 copyToClipboard(text).then(()=>{
   toast('Отчёт скопирован в буфер обмена');
   saveReportToHistoryManual();
 }).catch(()=>showCopyFallback(text));
}

/* Удаление записи из истории отчётов */
function deleteReportHistoryEntry(entryId, ev){
 if(ev) ev.stopPropagation();
 if(!confirm('Удалить этот отчёт из истории?')) return;

 reportsHistoryCache = reportsHistoryCache.filter(e => e.id !== entryId && e.date !== entryId && e.reportDate !== entryId);
 localStorage.setItem(reportHistKey(), JSON.stringify(reportsHistoryCache));
 reportsHistoryRef.child(entryId).remove().catch(()=>{});

 openReportHistory();
 renderAnalytics();
 toast('Отчёт удалён');
}


function openReportHistory(){
  const el=document.getElementById('reportHistoryList');
  const uniqueReports = getUniqueDailyReports();
  if(!uniqueReports.length){
    el.innerHTML='<div class="empty">История отчётов пока пуста</div>';
  }else{
    el.innerHTML=uniqueReports.map(h=>{
      const titleDate = h.reportDate ? isoToRuDate(h.reportDate) : (h.date ? isoToRuDate(addDaysISO(h.date, 1)) : '');
      return `
      <div class="h-card" style="cursor:pointer" onclick="toggleReportHistDetail('${h.id}')">
        <div class="h-card-head">
          <span class="h-card-title">${titleDate} ${esc(h.author?('• '+h.author):'')}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="h-card-time">${new Date(h.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span>
            <button type="button" class="h-del-btn" onclick="deleteReportHistoryEntry('${h.id}', event)">Удалить</button>
          </div>
        </div>
        <div id="rhDetail_${h.id}" style="display:none;margin-top:8px;padding-top:8px;border-top:1px dashed #d0d7de;white-space:pre-wrap;font-family:monospace;font-size:11.5px">${esc(h.text)}</div>
      </div>`;
    }).join('');
  }
  document.getElementById('reportHistoryModal').classList.add('show');
}
function closeReportHistory(){document.getElementById('reportHistoryModal').classList.remove('show')}
function toggleReportHistDetail(id){
  const el=document.getElementById('rhDetail_'+id);
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}


/* ===== Настройки отчёта ===== */
const settingsModal=document.getElementById('settingsModal');
function openSettings(){
 renderSettingsAuthors();
 renderSettingsConsumption();
 document.getElementById('setBoxCount').textContent=settings.boxCount;
 document.getElementById('setCompressorCount').textContent=settings.compressorCount;
 document.getElementById('setPumpCount').textContent=settings.pumpCount;
 settingsModal.classList.add('show');
}
function closeSettings(){settingsModal.classList.remove('show')}
function settingsBackdropClick(e){if(e.target===settingsModal)closeSettings()}

function renderSettingsAuthors(){
 const el=document.getElementById('setAuthorsList');
 el.innerHTML=settings.authors.length?settings.authors.map((a,i)=>
   `<div class="setting-chip"><span>${esc(a)}</span><button type="button" onclick="removeSettingAuthor(${i})" aria-label="Удалить">✕</button></div>`
 ).join(''):'<div class="empty" style="padding:8px 0">Список пуст</div>';
}
function addSettingAuthor(){
 const inp=document.getElementById('newAuthorName');
 const name=inp.value.trim();
 if(!name)return;
 if(!settings.authors.includes(name))settings.authors.push(name);
 inp.value='';
 persistSettings();
 renderSettingsAuthors();
 rebuildReportDynamicUI();
 fillReportForm();
}
function removeSettingAuthor(i){
 settings.authors.splice(i,1);
 persistSettings();
 renderSettingsAuthors();
 rebuildReportDynamicUI();
 fillReportForm();
}

function renderSettingsConsumption(){
 const el=document.getElementById('setConsumptionList');
 el.innerHTML=settings.consumptionItems.length?settings.consumptionItems.map((a,i)=>
   `<div class="setting-chip"><span>${esc(a)}</span><button type="button" onclick="removeSettingConsumption(${i})" aria-label="Удалить">✕</button></div>`
 ).join(''):'<div class="empty" style="padding:8px 0">Список пуст</div>';
}
function addSettingConsumption(){
 const inp=document.getElementById('newConsumptionName');
 const name=inp.value.trim();
 if(!name)return;
 if(!settings.consumptionItems.includes(name))settings.consumptionItems.push(name);
 inp.value='';
 persistSettings();
 renderSettingsConsumption();
 buildBoxSectionsOnce();
 fillReportForm();
}
function removeSettingConsumption(i){
 settings.consumptionItems.splice(i,1);
 persistSettings();
 renderSettingsConsumption();
 buildBoxSectionsOnce();
 fillReportForm();
 persistReport();
}

function changeBoxCount(delta){
 const next=settings.boxCount+delta;
 if(next<0||next>12)return;
 settings.boxCount=next;
 persistSettings();
 report=sanitizeReport(report);
 document.getElementById('setBoxCount').textContent=settings.boxCount;
 rebuildReportDynamicUI();
 fillReportForm();
 persistReport();
}
function changeCompressorCount(delta){
 const next=settings.compressorCount+delta;
 if(next<0||next>12)return;
 settings.compressorCount=next;
 persistSettings();
 report=sanitizeReport(report);
 document.getElementById('setCompressorCount').textContent=settings.compressorCount;
 rebuildReportDynamicUI();
 fillReportForm();
 persistReport();
}
function changePumpCount(delta){
 const next=settings.pumpCount+delta;
 if(next<0||next>12)return;
 settings.pumpCount=next;
 persistSettings();
 report=sanitizeReport(report);
 document.getElementById('setPumpCount').textContent=settings.pumpCount;
 rebuildReportDynamicUI();
 fillReportForm();
 persistReport();
}

