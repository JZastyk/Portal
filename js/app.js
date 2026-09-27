/* ===== Переключение вкладок и запуск приложения после авторизации ===== */
/* ===== Вкладки приложения ===== */
function switchTab(tab){
 if((tab==='analytics' || tab==='network') && !isCurrentSuperAdmin()){
   tab='inventory';
 }
 document.getElementById('viewInventory').classList.toggle('active',tab==='inventory');
 document.getElementById('viewReport').classList.toggle('active',tab==='report');
 document.getElementById('viewAnalytics').classList.toggle('active',tab==='analytics');
 document.getElementById('viewNetwork').classList.toggle('active',tab==='network');

 document.getElementById('tabBtnInventory').classList.toggle('active',tab==='inventory');
 document.getElementById('tabBtnReport').classList.toggle('active',tab==='report');
 document.getElementById('tabBtnAnalytics').classList.toggle('active',tab==='analytics');
 document.getElementById('tabBtnNetwork').classList.toggle('active',tab==='network');

 if(tab==='report'){
   if(typeof refreshShiftDateIfDayChanged === 'function') refreshShiftDateIfDayChanged();
   renderReportHintsAndVisibility();
   renderReportPreview();
 }else if(tab==='analytics'){
   renderAnalytics();
 }
}


/* ===== Запуск приложения после авторизации ===== */
function startApp(id,name){
 locId=id;
 dbRef=firebase.database().ref('locations/'+locId+'/inventory');
 reportDbRef=firebase.database().ref('locations/'+locId+'/dailyReport');
 reportsHistoryRef=firebase.database().ref('locations/'+locId+'/reportsHistory');
 settingsRef=firebase.database().ref('locations/'+locId+'/settings');

 document.getElementById('currentLocLabel').textContent=name;

 invHintDismissed=localStorage.getItem(invHintKey())==='1';
 reportHintDismissed=localStorage.getItem(reportHintKey())==='1';
 settings=sanitizeSettings(JSON.parse(localStorage.getItem(settingsKey())||'null'));
 data=sanitizeData(JSON.parse(localStorage.getItem(invKey())||'null')||{items:[],history:[]});
 report=sanitizeReport(JSON.parse(localStorage.getItem(reportKey())||'null'));
 reportsHistoryCache=JSON.parse(localStorage.getItem(reportHistKey())||'[]');

 render();
 rebuildReportDynamicUI();
 fillReportForm();
 reportPreviewReady=true;
 initSuperAdminView();
 renderAnalytics();

 settingsRef.on('value',snap=>{
  const remote=snap.val();
  if(remote){
    settings=sanitizeSettings(remote);
    localStorage.setItem(settingsKey(),JSON.stringify(settings));
    report=sanitizeReport(report);
    rebuildReportDynamicUI();
    fillReportForm();
    persistReportLocal();
  }else{
    settingsRef.set(settings).catch(()=>{});
  }
 });

 dbRef.on('value',snap=>{
  firebaseReady=true;
  setSyncStatus('online','Синхронизировано');
  const remote=snap.val();
  try{
    if(remote&&remote.items){
      data=sanitizeData(remote);
      persistLocal();
    }else{
      data=sanitizeData(data);
      dbRef.set(data);
    }
    render();
  }catch(e){
    console.error('Ошибка синхронизации данных:',e);
  }
 },err=>{
  console.error(err);
  setSyncStatus('offline','Офлайн — работает локально');
 });

 reportDbRef.on('value',snap=>{
  const remote=snap.val();
  if(remote){
    report=sanitizeReport(remote);
    persistReportLocal();
    fillReportForm();
  }
 });

 reportsHistoryRef.limitToLast(100).on('value',snap=>{
  const remote=snap.val();
  if(remote){
    reportsHistoryCache=Object.values(remote).sort((a,b)=>new Date(b.time)-new Date(a.time));
    localStorage.setItem(reportHistKey(),JSON.stringify(reportsHistoryCache));
    renderAnalytics();
  }
 });

 initInteljetSync();
}

let inteljetOrdersCache = {};
let inteljetRef = null;

function initInteljetSync(){
 if(!isCurrentSuperAdmin()) return;
 inteljetOrdersCache = JSON.parse(localStorage.getItem('inteljet_orders_' + locId) || '{}');
 inteljetRef = firebase.database().ref('locations/' + locId + '/inteljet_orders');
 inteljetRef.on('value', snap => {
   const val = snap.val() || {};
   inteljetOrdersCache = val;
   localStorage.setItem('inteljet_orders_' + locId, JSON.stringify(val));
   if(typeof renderInteljetAnalytics === 'function'){
     renderInteljetAnalytics();
   }
   if(typeof renderDateDetailCard === 'function'){
     renderDateDetailCard();
   }
   if(typeof applyInteljetAutofill === 'function'){
     applyInteljetAutofill();
     if(typeof renderReportPreview === 'function') renderReportPreview();
   }
 });
}

