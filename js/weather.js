/* ===== Погода и праздничные дни (Open-Meteo, без ключа) ===== */
// Ростов-на-Дону, Таганрогская 134Б (район). Сетка погодных моделей ~10 км — точный дом не нужен.
const WEATHER_LAT = 47.27, WEATHER_LON = 39.65;
const WX_H1 = 6, WX_H2 = 22; // «дневные» часы, по которым считаются осадки
const WX_VARS = 'temperature_2m,precipitation,snowfall,cloud_cover,weather_code,relative_humidity_2m,wind_speed_10m';

let weatherStore = {};    // дата -> запись истории (хранится в базе: locations/<id>/weather)
let weatherForecast = {}; // дата -> прогноз (только в памяти и локальном кэше)
let weatherRef = null, weatherSyncing = false, wxRetryAt = 0, wxStatus = '';
const wxSkip = new Set();

/* g — группа для модели прогноза */
const WX_CATS = {
  sunny:   { t: 'Солнечно',               i: 'sun',     g: 'dry' },
  partly:  { t: 'Переменная облачность',  i: 'partly',  g: 'dry' },
  cloudy:  { t: 'Пасмурно',               i: 'cloud',   g: 'dry' },
  fog:     { t: 'Туман',                  i: 'fog',     g: 'dry' },
  drizzle: { t: 'Небольшой дождь',        i: 'drizzle', g: 'light' },
  rain:    { t: 'Дождь',                  i: 'rain',    g: 'rain' },
  heavy:   { t: 'Сильный дождь',          i: 'rain',    g: 'heavy' },
  storm:   { t: 'Гроза',                  i: 'storm',   g: 'heavy' },
  snow:    { t: 'Снег',                   i: 'snow',    g: 'snow' }
};

const WX_ICONS = {
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  partly: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.2M2.6 3.4l.9.9M1.5 8h1.2M13.4 3.4l-.9.9"/><path d="M17.5 20H10a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 17.5 20z"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  fog: '<path d="M3 8h18M5 12h14M3 16h18M7 20h10"/>',
  drizzle: '<path d="M8 19v2M8 13v2M16 19v2M16 13v2M12 21v2M12 15v2"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>',
  rain: '<path d="M16 13v8M8 13v8M12 15v8"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>',
  snow: '<path d="M20 17.6A5 5 0 0 0 18 8h-1.3A8 8 0 1 0 4 16.3"/><path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01"/>',
  storm: '<path d="M19 16.9A5 5 0 0 0 18 7h-1.3a8 8 0 1 0-11.6 9"/><polyline points="13 11 9 17 15 17 11 23"/>'
};
function wxIcon(name){
  return `<svg class="svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${WX_ICONS[name] || ''}</svg>`;
}

/* Нерабочие праздничные дни РФ (по производственному календарю). Таблицу нужно дополнять на следующие годы. */
const HOLIDAY_RANGES = [
  ['2026-01-01', '2026-01-11', 'Новогодние каникулы'],
  ['2026-02-21', '2026-02-23', 'День защитника Отечества'],
  ['2026-03-07', '2026-03-09', 'Международный женский день'],
  ['2026-05-01', '2026-05-03', 'Праздник Весны и Труда'],
  ['2026-05-09', '2026-05-11', 'День Победы'],
  ['2026-06-12', '2026-06-14', 'День России'],
  ['2026-11-04', '2026-11-04', 'День народного единства'],
  ['2026-12-31', '2026-12-31', 'Выходной (перенос)']
];
function holidayName(d){
  for(const r of HOLIDAY_RANGES){ if(d >= r[0] && d <= r[1]) return r[2]; }
  return '';
}

function wxHp(r){ return r ? (Array.isArray(r.hp) ? r.hp : Object.values(r.hp || {})).map(Number) : []; }
function wxRec(d){ return weatherStore[d] || weatherForecast[d] || null; }

/* Тип погоды в конкретный час: s ясно, p переменная, c пасмурно, f туман, d морось, r дождь, h ливень, t гроза, n снег */
function wxHourKind(h, i){
  const n = v => Number(v) || 0, p = n(h.p[i]), c = n(h.c[i]), code = n(h.w[i]);
  if(code >= 95) return 't';
  if(n(h.s[i]) >= 0.2) return 'n';
  if(p >= 4) return 'h';
  if(p >= 0.8) return 'r';
  if(p >= 0.1) return 'd';
  if(code === 45 || code === 48 || (n(h.rh[i]) >= 98 && n(h.ws[i]) <= 6)) return 'f';
  return c < 25 ? 's' : (c < 70 ? 'p' : 'c');
}

/* Часовые массивы одного дня -> суточная запись с категорией погоды */
function wxBuildRecord(date, h, final){
  const okT = h.t.filter(v => v != null && !isNaN(v));
  if(okT.length < 20) return null; // неполный день
  const n = v => Number(v) || 0;
  const rng = (a, f, t) => { const o = []; for(let i = f; i <= t; i++) o.push(n(a[i])); return o; };
  const p = rng(h.p, WX_H1, WX_H2);
  const precip = p.reduce((a, b) => a + b, 0);
  const snow = rng(h.s, WX_H1, WX_H2).reduce((a, b) => a + b, 0);
  const rainHours = p.filter(v => v >= 0.2).length;
  const maxHour = Math.max(...p);
  const cl = rng(h.c, 8, 20); const cloud = cl.reduce((a, b) => a + b, 0) / cl.length;
  const codes = rng(h.w, WX_H1, WX_H2);
  const storm = codes.some(c => c >= 95);
  let fogH = 0;
  for(let i = 7; i <= 20; i++){
    if(n(h.w[i]) === 45 || n(h.w[i]) === 48 || (n(h.rh[i]) >= 98 && n(h.ws[i]) <= 6 && n(h.p[i]) < 0.1)) fogH++;
  }
  let cat;
  if(storm) cat = 'storm';
  else if(snow >= 0.5) cat = 'snow';
  else if(precip >= 8 || maxHour >= 4) cat = 'heavy';
  else if(precip >= 2.5) cat = 'rain';
  else if(precip >= 0.4) cat = 'drizzle';
  else if(fogH >= 3) cat = 'fog';
  else cat = cloud < 25 ? 'sunny' : (cloud < 70 ? 'partly' : 'cloudy');
  const r1 = x => Math.round(x * 10) / 10;
  return {
    date, cat, tmax: Math.round(Math.max(...okT)), tmin: Math.round(Math.min(...okT)),
    precip: r1(precip), rainHours, snow: r1(snow), cloud: Math.round(cloud),
    hp: Array.from({ length: 24 }, (_, i) => r1(n(h.p[i]))),
    ht: Array.from({ length: 24 }, (_, i) => Math.round(n(h.t[i]))),
    hk: Array.from({ length: 24 }, (_, i) => wxHourKind(h, i)).join(''),
    final: !!final, upd: Date.now()
  };
}

/* Маршруты запроса: напрямую, затем через публичные CORS-прокси (на случай, если сервис погоды недоступен из вашей сети).
   Через прокси уходят только координаты района и даты. Рабочий маршрут запоминается на сессию. */
const WX_ROUTES = [
  { name: 'напрямую', f: u => u },
  { name: 'прокси corsproxy.io', f: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u) },
  { name: 'прокси allorigins', f: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) }
];
let wxTimeoutMs = 8000; // долго не ждём недоступный путь
/* Рабочий путь помним сутки: так приложение не тратит время на заблокированный прямой адрес при каждом запуске */
function wxLoadRoute(){
  try{ const o = JSON.parse(localStorage.getItem('wx_route') || 'null'); if(o && Date.now() - o.t < 24 * 3600 * 1000) return Number(o.i) || 0; }catch(e){}
  return 0;
}
let wxRoute = wxLoadRoute();
function wxFetchTimeout(u, ms){
  const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = c ? setTimeout(() => c.abort(), ms || wxTimeoutMs) : null;
  return fetch(u, c ? { signal: c.signal } : undefined).finally(() => { if(t) clearTimeout(t); });
}

async function wxGet(url, ms){
  const tried = [];
  for(let k = 0; k < WX_ROUTES.length; k++){
    const i = (wxRoute + k) % WX_ROUTES.length;
    try{
      const r = await wxFetchTimeout(WX_ROUTES[i].f(url), ms);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if(i !== wxRoute){ wxRoute = i; try{ localStorage.setItem('wx_route', JSON.stringify({ i, t: Date.now() })); }catch(e){} console.warn('Погода: рабочий маршрут —', WX_ROUTES[i].name); }
      return j;
    }catch(e){ tried.push(WX_ROUTES[i].name + ': ' + (e && e.name === 'AbortError' ? 'нет ответа за ' + (ms || wxTimeoutMs) / 1000 + ' с' : (e && e.message ? e.message : e))); }
  }
  throw new Error('нет связи с сервисом погоды (api.open-meteo.com) ни одним из путей. ' + tried.join('; ') + '. Проверьте доступ к сайту, VPN или блокировщик рекламы.');
}

async function wxFetch(url, ms){
  const j = await wxGet(url, ms);
  if(!j.hourly || !j.hourly.time) throw new Error('пустой ответ сервиса погоды');
  const g = {};
  j.hourly.time.forEach((ts, i) => {
    const d = ts.slice(0, 10), hh = Number(ts.slice(11, 13));
    const o = g[d] || (g[d] = { t: [], p: [], s: [], c: [], w: [], rh: [], ws: [] });
    o.t[hh] = j.hourly.temperature_2m[i]; o.p[hh] = j.hourly.precipitation[i]; o.s[hh] = j.hourly.snowfall[i];
    o.c[hh] = j.hourly.cloud_cover[i]; o.w[hh] = j.hourly.weather_code[i];
    o.rh[hh] = j.hourly.relative_humidity_2m[i]; o.ws[hh] = j.hourly.wind_speed_10m[i];
  });
  return g;
}

function wxPersistLocal(){
  try{ localStorage.setItem('wx_store_' + locId, JSON.stringify(weatherStore)); }catch(e){}
}
function wxRerender(){
  if(typeof renderCalendar === 'function') renderCalendar();
  if(typeof renderDayDetailCard === 'function') renderDayDetailCard();
  if(typeof renderForecast === 'function') renderForecast();
}

/* Догружает недостающие дни истории (архив) и прогноз на 10 дней; всё, что до сегодня, пишется в базу */
async function weatherSync(force){
  if(weatherSyncing || typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()) return;
  if(!force && Date.now() < wxRetryAt) return;
  weatherSyncing = true;
  wxStatus = '';
  const upd = {};
  const keep = (d, rec) => {
    const old = weatherStore[d];
    if(old && old.final && !rec.final) return;
    if(old && JSON.stringify(Object.assign({}, old, { upd: 0 })) === JSON.stringify(Object.assign({}, rec, { upd: 0 }))) return;
    weatherStore[d] = rec; upd[d] = rec;
  };
  try{
    const today = todayISO();
    const geo = `latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&hourly=${WX_VARS}&timezone=Europe%2FMoscow`;
    const last = Number(localStorage.getItem('wx_last_' + locId)) || 0;
    const stale = Object.values(weatherStore).some(r => r && !r.hk && r.date >= addDaysISO(today, -10));
    if(force || stale || Date.now() - last > 3 * 3600 * 1000 || !Object.keys(weatherForecast).length){
      const g = await wxFetch(`https://api.open-meteo.com/v1/forecast?${geo}&past_days=10&forecast_days=10`);
      const fc = {};
      Object.keys(g).forEach(d => {
        const rec = wxBuildRecord(d, g[d], false);
        if(!rec) return;
        if(d < today) keep(d, rec); else fc[d] = rec;
      });
      weatherForecast = fc;
      try{ localStorage.setItem('wx_fc_' + locId, JSON.stringify(fc)); localStorage.setItem('wx_last_' + locId, String(Date.now())); }catch(e){}
    }
    const dates = Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).map(o => o && o.date).filter(Boolean).sort();
    const limit = addDaysISO(today, -8); // архив ERA5 отстаёт на несколько дней
    const flush = async () => {
      wxPersistLocal();
      const keys = Object.keys(upd);
      if(weatherRef && keys.length){
        const part = {}; keys.forEach(k => { part[k] = upd[k]; delete upd[k]; });
        try{ await weatherRef.update(part); }catch(e){ wxStatus = 'Погода загружена, но не записана в базу: ' + e.message; }
      }
      wxRerender();
    };
    if(dates.length){
      const need = [];
      for(let d = dates[0]; d <= limit; d = addDaysISO(d, 1)){
        const r = weatherStore[d];
        if((!r || !r.final || !r.hk) && !wxSkip.has(d)) need.push(d);
      }
      if(need.length){
        // историю грузим кусками по 20 дней: сначала архив, при неудаче — прогнозный сервис (он хранит последние ~90 дней)
        const chunks = []; let cur = [];
        need.forEach(d => {
          if(cur.length && (cur.length >= 20 || addDaysISO(cur[cur.length - 1], 1) !== d)){ chunks.push(cur); cur = []; }
          cur.push(d);
        });
        if(cur.length) chunks.push(cur);
        let ok = 0, fail = 0, lastErr = '', archiveDown = false;
        for(const ch of chunks){
          const a = ch[0], b = ch[ch.length - 1];
          let g = null;
          try{
            if(archiveDown && a >= addDaysISO(today, -90)) throw new Error('архив недоступен');
            g = await wxFetch(`https://archive-api.open-meteo.com/v1/archive?${geo}&start_date=${a}&end_date=${b}`, 30000);
          }catch(e){
            lastErr = e.message; archiveDown = true;
            if(a >= addDaysISO(today, -90)){
              try{ g = await wxFetch(`https://api.open-meteo.com/v1/forecast?${geo}&start_date=${a}&end_date=${b}`, 30000); }catch(e2){ lastErr = e2.message; }
            }
          }
          if(!g){ fail += ch.length; continue; }
          ch.forEach(d => {
            const rec = g[d] ? wxBuildRecord(d, g[d], true) : null;
            if(rec){ keep(d, rec); ok++; } else wxSkip.add(d);
          });
          await flush();
        }
        if(fail){ wxStatus = `Погода за прошлые дни: загружено ${ok} из ${need.length}, не удалось ${fail}. ${lastErr}`; wxRetryAt = Date.now() + 5 * 60 * 1000; }
      }
    }
    await flush();
  }catch(e){
    console.error('Ошибка загрузки погоды:', e);
    wxStatus = 'Погода не загружена: ' + e.message;
    wxRetryAt = Date.now() + 10 * 60 * 1000;
  }finally{
    weatherSyncing = false;
    wxRerender();
  }
}

function initWeatherSync(){
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()) return;
  try{
    weatherStore = JSON.parse(localStorage.getItem('wx_store_' + locId) || '{}');
    weatherForecast = JSON.parse(localStorage.getItem('wx_fc_' + locId) || '{}');
  }catch(e){ weatherStore = {}; weatherForecast = {}; }
  weatherRef = firebase.database().ref('locations/' + locId + '/weather');
  let first = true;
  weatherRef.on('value', snap => {
    weatherStore = Object.assign({}, weatherStore, snap.val() || {});
    wxPersistLocal();
    wxRerender();
    if(first){ first = false; weatherSync(); }
  }, err => { console.error(err); if(first){ first = false; weatherSync(); } });
}

/* Значок погоды и отметка праздника в клетке календаря */
function calWxIcon(date){
  const r = weatherStore[date] || weatherForecast[date], hol = holidayName(date);
  let h = '';
  if(r && WX_CATS[r.cat]){
    const c = WX_CATS[r.cat];
    h += `<span class="cal-wx ${c.g !== 'dry' ? 'wet' : ''}" title="${c.t}, ${r.tmin}…${r.tmax}°C">${wxIcon(c.i)}</span>`;
  }
  if(hol) h += `<span class="cal-hol" title="${hol}"></span>`;
  return h;
}

const WX_HK = { s: ['Ясно', '#f2b84b'], p: ['Переменная облачность', '#f6dc9b'], c: ['Пасмурно', '#aeb6c2'], f: ['Туман', '#d3d8de'],
  d: ['Небольшой дождь', '#8ec1ee'], r: ['Дождь', '#3b82c4'], h: ['Сильный дождь', '#1d5a99'], t: ['Гроза', '#7a52c7'], n: ['Снег', '#e4eef8'] };

/* Погода по часам: цветная полоса из 24 клеток + подписи часов + легенда только по встретившимся состояниям */
function wxHoursHtml(r){
  if(!r || typeof r.hk !== 'string' || r.hk.length !== 24) return '';
  const hp = wxHp(r), ht = Array.isArray(r.ht) ? r.ht : Object.values(r.ht || {});
  const pad = x => String(x).padStart(2, '0');
  const cells = r.hk.split('').map((k, h) => `<i style="background:${WX_HK[k][1]}" title="${pad(h)}:00 · ${WX_HK[k][0]} · ${ht[h]}°C${hp[h] >= 0.1 ? ' · ' + hp[h] + ' мм' : ''}"></i>`).join('');
  const lbl = Array.from({ length: 24 }, (_, h) => `<span>${h % 3 === 0 ? h : ''}</span>`).join('');
  const kinds = [...new Set(r.hk.split(''))].map(k => `<span class="wx-leg"><i style="background:${WX_HK[k][1]}"></i>${WX_HK[k][0]}</span>`).join('');
  return `<div class="wx-hours">${cells}</div><div class="wx-hours-lbl">${lbl}</div><div class="wx-legend">${kinds}</div>`;
}

/* Строка погоды в карточке выбранного дня */
function weatherDayHtml(date){
  const r = wxRec(date), hol = holidayName(date);
  if(!r && !hol) return '';
  let h = '<div class="wx-row">';
  if(r && WX_CATS[r.cat]){
    const c = WX_CATS[r.cat];
    h += `<span class="wx-chip">${wxIcon(c.i)} <b>${c.t}</b> · ${r.tmin}…${r.tmax}°C</span>`;
    if(r.precip >= 0.2) h += `<span class="wx-chip">Осадки: <b>${r.precip} мм</b> · ${r.rainHours} ч</span>`;
  }
  if(hol) h += `<span class="wx-chip wx-hol">${hol}</span>`;
  return h + '</div>' + (r ? wxHoursHtml(r) : '');
}
