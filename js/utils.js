/* ===== Общие утилиты: ввод чисел, хэширование, форматирование дат, состояние склада ===== */
/* Безопасная функция ввода дробных чисел: точка и запятая без сброса курсора и пустоты */
function onDecimalInput(inp, callback){
  const start = inp.selectionStart;
  const oldVal = inp.value;
  let val = oldVal.replace(/,/g, '.');
  val = val.replace(/[^0-9.]/g, '');
  const parts = val.split('.');
  if(parts.length > 2){
    val = parts[0] + '.' + parts.slice(1).join('');
  }
  if(val !== oldVal){
    inp.value = val;
    if(start !== null){
      inp.setSelectionRange(start, start);
    }
  }
  if(callback) callback();
}

async function sha256(str){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

var reportPreviewReady=false;
let locId=null;
function invKey(){return 'chemical_inventory_v2_'+locId}
function reportKey(){return 'daily_report_draft_v1_'+locId}
function reportHistKey(){return 'daily_report_history_v1_'+locId}
function lastAuthorKey(){return 'report_last_author_'+locId}

function isCurrentSuperAdmin(){
  const name = (localStorage.getItem(LOC_NAME_KEY) || '').trim().toLowerCase();
  return (name.includes('таганрогская 134б') || name.includes('гоноровская 134б')) && (localStorage.getItem('is_super_admin') === '1');
}

function toArray(v){
 if(Array.isArray(v))return v;
 if(v&&typeof v==='object')return Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]);
 return [];
}
function sanitizeData(d){
 const items=toArray(d&&d.items).filter(Boolean).map(it=>({
   id:(it&&it.id)||crypto.randomUUID(),
   name:(it&&it.name)||'',
   inReport:Boolean(it&&it.inReport),
   measures:toArray(it&&it.measures).filter(Boolean).map((m, idx)=>({
     unit:(m&&m.unit)||'',
     qty:Number(m&&m.qty)||0,
     min:Number(m&&m.min)||0,
     trackMin:typeof m.trackMin!=='undefined'?Boolean(m.trackMin):(idx===0)
   }))
 }));
 const history=toArray(d&&d.history).filter(Boolean);
 return {items, history};
}

let data={items:[], history:[]};
let editId=null;
let syncTimer;
let firebaseReady=false;

function setSyncStatus(state,text){
 const el=document.getElementById('syncStatus');
 el.className='sync-status '+state;
 document.getElementById('syncText').textContent=text;
}

function persistLocal(){localStorage.setItem(invKey(),JSON.stringify(data))}
function persist(){
 persistLocal();
 clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>{
   dbRef.set(data).then(()=>{
     firebaseReady=true;setSyncStatus('online','Синхронизировано');
   }).catch(()=>{
     setSyncStatus('offline','Офлайн — сохранено локально');
   });
 },350);
}

function fmt(n){return Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2})}
function todayStr(){return new Date().toLocaleDateString('ru-RU')}
function todayISO(){
 const d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function yesterdayISO(){
 const d=new Date();
 d.setDate(d.getDate()-1);
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function yesterdayDMY(){
 const d=new Date();
 d.setDate(d.getDate()-1);
 return d.toLocaleDateString('ru-RU');
}
function addDaysISO(isoDateStr, days){
 const d=new Date(isoDateStr + 'T00:00:00');
 d.setDate(d.getDate() + (days || 0));
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function isoToRuDate(isoDateStr){
 if(!isoDateStr) return '';
 return new Date(isoDateStr + 'T00:00:00').toLocaleDateString('ru-RU');
}
