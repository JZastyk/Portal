/* ===== Общие утилиты: ввод чисел, хэширование, форматирование дат, состояние склада, управление темой и SVG иконки ===== */

/* ===== Управление темой оформления (Светлая / Тёмная) ===== */
function getSavedTheme(){
  try {
    const saved = localStorage.getItem('portal_theme');
    if(saved === 'dark' || saved === 'light') return saved;
    if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){
      return 'dark';
    }
  } catch(e){}
  return 'light';
}

function applyTheme(theme){
  const t = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('portal_theme', t);
  } catch(e){}
  
  // Обновление meta theme-color для строки состояния мобильных браузеров
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme){
    metaTheme.setAttribute('content', t === 'dark' ? '#141414' : '#ff5014');
  }
  
  updateThemeUI(t);
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || getSavedTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if(typeof toast === 'function'){
    toast(next === 'dark' ? 'Включена тёмная тема' : 'Включена светлая тема');
  }
}

function updateThemeUI(theme){
  const sunIcons = document.querySelectorAll('.theme-icon-sun');
  const moonIcons = document.querySelectorAll('.theme-icon-moon');
  const labelTexts = document.querySelectorAll('.theme-label-text');
  
  const isDark = theme === 'dark';
  sunIcons.forEach(el => el.style.display = isDark ? 'inline-block' : 'none');
  moonIcons.forEach(el => el.style.display = isDark ? 'none' : 'inline-block');
  labelTexts.forEach(el => el.textContent = isDark ? 'Светлая тема' : 'Тёмная тема');
}

// Применяем тему мгновенно
(function initThemeEarly(){
  const t = getSavedTheme();
  document.documentElement.setAttribute('data-theme', t);
})();

/* ===== Генератор чистых векторных SVG-иконок (замена эмодзи) ===== */
const SVG_ICONS = {
  zap: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  check: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  checkCircle: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  alert: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  calendar: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  card: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  shower: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  box: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  play: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
  fileText: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  cross: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  trash: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  droplet: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  car: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="7" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 11l2-5h10l2 5"/></svg>`,
  flask: `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 9l-6 11a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-11V3h-4v6z"/></svg>`
};

function getSvg(name){
  return SVG_ICONS[name] || '';
}

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

const PIN_SALT = 'portal_wash_v1_';

/**
 * Криптографически стойкий хеш PIN-кода с уникальной солью локации,
 * защищающий от предварительно рассчитанных радужных таблиц (rainbow tables).
 */
async function hashPin(pin, locId){
  return await sha256(PIN_SALT + (locId || '') + ':' + String(pin).trim());
}

let reportPreviewReady = false;
let locId = null;
function invKey(){ return 'chemical_inventory_v2_' + locId; }
function reportKey(){ return 'daily_report_draft_v1_' + locId; }
function reportHistKey(){ return 'daily_report_history_v1_' + locId; }
function lastAuthorKey(){ return 'report_last_author_' + locId; }

/**
 * Единый доверенный источник проверки прав суперадминистратора.
 * Исключает уязвимость создания поддельных моек с подстрокой в имени.
 * Права определяются ТОЛЬКО:
 * 1) По явной роли в базе данных (loc.role === 'admin' или loc.isSuperAdmin === true)
 * 2) Строгое точное совпадение для исторической флагманской точки (без подстрок includes!)
 */
function checkIsSuperAdmin(loc, locationId){
  if(!loc) return false;
  // 1. Прямая роль в Firebase
  if(loc.role === 'admin' || loc.isSuperAdmin === true) return true;
  if(loc.role === 'location' || loc.isSuperAdmin === false) return false;

  // 2. Строгое точное совпадение названия флагманской мойки (НЕ includes!)
  const normName = (loc.name || '').trim().toLowerCase();
  const isFlagship = (normName === 'таганрогская 134б' || normName === 'таганрогская, 134б');

  // Если это подтверждённая флагманская точка без прописанной роли, автоматически обновляем роль в базе
  if(isFlagship && locationId && typeof locationsRef !== 'undefined' && locationsRef){
    try {
      locationsRef.child(locationId).update({ role: 'admin' }).catch(()=>{});
    } catch(e){}
  }
  return isFlagship;
}

/**
 * Проверка прав суперадминистратора текущей активной сессии.
 */
function isCurrentSuperAdmin(){
  const authedId = localStorage.getItem(LOC_AUTHED_KEY) || localStorage.getItem(LOC_ID_KEY);
  if(!authedId) return false;
  if(localStorage.getItem('is_super_admin') !== '1') return false;

  // Если кэш локаций уже загружен, валидируем права по базе данных
  if(typeof locationsCache !== 'undefined' && locationsCache && locationsCache[authedId]){
    return checkIsSuperAdmin(locationsCache[authedId], authedId);
  }
  return true;
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
 if(!el) return;
 el.className='sync-status '+state;
 const txt = document.getElementById('syncText');
 if(txt) txt.textContent=text;
}

function persistLocal(){ localStorage.setItem(invKey(), JSON.stringify(data)); }

const syncInventoryDebounced = createDebounce(()=>{
  if(typeof dbRef !== 'undefined' && dbRef){
    dbRef.set(data).then(()=>{
      firebaseReady=true; setSyncStatus('online','Синхронизировано');
    }).catch(()=>{
      setSyncStatus('offline','Офлайн — сохранено локально');
    });
  }
}, 350);

function persist(){
  persistLocal();
  syncInventoryDebounced();
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

/**
 * Единая фабрика дебаунса для синхронизации с базой и локальным хранилищем.
 */
function createDebounce(fn, delay = 350){
  let timer = null;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Получение точной даты смены для отображения в календаре и аналитике
 */
function getEntryDisplayDate(entry){
  return getEntryShiftDate(entry);
}

/** Дата МОЙКИ (за какой день помыты машины) */
function getEntryShiftDate(entry){
  if(!entry) return '';
  return entry.shiftDate || entry.date || entry.id || '';
}

/** Дата ОТЧЁТА (в какой день составлен отчёт: остатки, TDS, рукава, расход) */
function getEntryReportDate(entry){
  if(!entry) return '';
  if(entry.reportDate) return entry.reportDate;
  const shift = getEntryShiftDate(entry);
  return shift ? addDaysISO(shift, 1) : '';
}

/**
 * Форматирование даты в полный русский вид (например: «26 сентября 2026 г.»).
 */
function formatRuFullDate(isoDateStr){
  if(!isoDateStr) return '';
  try {
    return new Date(isoDateStr + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});
  } catch(e){
    return isoToRuDate(isoDateStr);
  }
}

