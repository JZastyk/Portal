/* ===== Переключение вкладок и запуск приложения после авторизации ===== */
/* ===== Вкладки приложения ===== */
function switchTab(tab){
 if(tab==='analytics' && !isCurrentSuperAdmin()){
   tab='inventory';
 }
 document.getElementById('viewInventory').classList.toggle('active',tab==='inventory');
 document.getElementById('viewReport').classList.toggle('active',tab==='report');
 document.getElementById('viewAnalytics').classList.toggle('active',tab==='analytics');

 document.getElementById('tabBtnInventory').classList.toggle('active',tab==='inventory');
 document.getElementById('tabBtnReport').classList.toggle('active',tab==='report');
 document.getElementById('tabBtnAnalytics').classList.toggle('active',tab==='analytics');

 if(tab==='report'){
   if(typeof refreshShiftDateIfDayChanged === 'function') refreshShiftDateIfDayChanged();
   renderReportHintsAndVisibility();
   renderReportPreview();
 }else if(tab==='analytics'){
   renderAnalytics();
 }
}



function initSuperAdminView(){
  const isSuper = isCurrentSuperAdmin();
  const anTab = document.getElementById('tabBtnAnalytics');
  if(anTab) anTab.style.display = isSuper ? 'flex' : 'none';

  if(!isSuper){
    const activeTab = document.querySelector('.tab-btn.active');
    if(activeTab && activeTab.id === 'tabBtnAnalytics'){
      switchTab('inventory');
    }
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
  let localHist = JSON.parse(localStorage.getItem(reportHistKey()) || '[]');
  if(!Array.isArray(localHist)) localHist = [];
  reportsHistoryCache = localHist;

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

 reportsHistoryRef.limitToLast(400).on('value',snap=>{
  const remote = snap.val();
  reportsHistoryCache = remote ? Object.values(remote).sort((a,b) => new Date(b.time) - new Date(a.time)) : [];
  localStorage.setItem(reportHistKey(), JSON.stringify(reportsHistoryCache));
  renderAnalytics();
 });

 initInteljetSync();
 if(typeof initWeatherSync === 'function') initWeatherSync();
}

let inteljetOrdersCache = {};
let inteljetRef = null;

function initInteljetSync(){
 if(!isCurrentSuperAdmin()) return;
 try{ inteljetOrdersCache = JSON.parse(localStorage.getItem('inteljet_orders_' + locId) || '{}'); }catch(e){ inteljetOrdersCache = {}; }
 inteljetRef = firebase.database().ref('locations/' + locId + '/inteljet_orders');
 inteljetRef.on('value', snap => {
   const val = snap.val() || {};
   inteljetOrdersCache = val;
   try{ localStorage.setItem('inteljet_orders_' + locId, JSON.stringify(val)); }catch(e){ /* локальный кэш переполнен — данные всё равно берутся из базы */ }
   if(typeof weatherSync === 'function') weatherSync();
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

 if(typeof initClientsSync === 'function') initClientsSync();
}

// Sync theme toggle UI on startup
document.addEventListener('DOMContentLoaded', () => {
  if (typeof updateThemeUI === 'function' && typeof getSavedTheme === 'function') {
    updateThemeUI(getSavedTheme());
  }
});
