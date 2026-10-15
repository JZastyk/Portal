/* ===== Замер точности прогноза (на прогнозной погоде) и новая Пуассоновская модель =====
   Зачем. Приложение проверяет прогноз по ФАКТИЧЕСКОЙ погоде, а завтра у него будет только ПРОГНОЗ погоды —
   поэтому показанная ошибка получается лучше настоящей. Здесь каждый прошлый день предсказывается так, как это было бы в жизни:
   только по данным ДО него и по прогнозу погоды, который существовал за 1, 3 и 5 дней до этого дня.
   Прогнозы прошлых дней берём из Open-Meteo Previous Runs API (хранит их с января 2024) и один раз кладём в базу. */

const WX_LEADS = [1, 3, 5];                   // за сколько дней до дня был сделан прогноз погоды
let weatherPrev = { 1: {}, 3: {}, 5: {} };    // срок -> дата -> запись погоды (как её предсказывали за k дней)
const wxPrevSkip = new Set();
let fcLabState = { loc: null, loading: false, running: false, res: null, status: '', err: '' };

/* ---------- Погода «как её предсказывали»: загрузка и хранение ---------- */
function wxPrevPersist(k){
  try{ localStorage.setItem(`wx_d${k}_${locId}`, JSON.stringify(weatherPrev[k])); }catch(e){}
}
function wxPrevInit(){
  WX_LEADS.forEach(k => {
    try{ Object.assign(weatherPrev[k], JSON.parse(localStorage.getItem(`wx_d${k}_${locId}`) || '{}')); }catch(e){}
    try{
      firebase.database().ref(`locations/${locId}/weather_d${k}`).once('value').then(snap => {
        const v = snap.val(); if(!v) return;
        Object.assign(weatherPrev[k], v); wxPrevPersist(k); renderFcLab();
      }).catch(e => console.warn('Прогнозы погоды прошлых дней: не прочитаны из базы', e && e.message));
    }catch(e){}
  });
}

/* Один запрос на период: часовые прогнозы всех сроков сразу -> { срок: { дата: массивы по часам } } */
async function wxFetchPrev(a, b){
  const vars = WX_VARS.split(','), hv = [];
  WX_LEADS.forEach(k => vars.forEach(v => hv.push(`${v}_previous_day${k}`)));
  const base = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&hourly=${hv.join(',')}&timezone=Europe%2FMoscow`;
  let j;
  try{ j = await wxGet(`${base}&start_date=${a}&end_date=${b}`, 30000); }
  catch(e1){
    const back = fcAge(todayISO(), a);
    if(!/HTTP 4\d\d/.test(String(e1 && e1.message)) || back > 90) throw e1;
    j = await wxGet(`${base}&past_days=${Math.min(92, back + 1)}&forecast_days=1`, 30000);
  }
  if(!j.hourly || !j.hourly.time || !j.hourly['precipitation_previous_day1']) throw new Error('сервис не вернул архивные прогнозы осадков');
  const out = {};
  WX_LEADS.forEach(k => {
    const A = v => j.hourly[`${v}_previous_day${k}`] || [], T = A('temperature_2m'), P = A('precipitation'), S = A('snowfall'),
      C = A('cloud_cover'), W = A('weather_code'), RH = A('relative_humidity_2m'), WS = A('wind_speed_10m');
    const g = out[k] = {};
    j.hourly.time.forEach((ts, i) => {
      const d = ts.slice(0, 10), hh = Number(ts.slice(11, 13));
      const o = g[d] || (g[d] = { t: [], p: [], s: [], c: [], w: [], rh: [], ws: [] });
      o.t[hh] = T[i]; o.p[hh] = P[i]; o.s[hh] = S[i]; o.c[hh] = C[i]; o.w[hh] = W[i]; o.rh[hh] = RH[i]; o.ws[hh] = WS[i];
    });
  });
  return out;
}

async function wxPrevLoad(){
  if(fcLabState.loading) return;
  fcLabState.loading = true; fcLabState.err = ''; fcLabState.status = 'Загружаю прогнозы погоды прошлых дней…'; renderFcLab();
  try{
    const today = todayISO();
    const dates = Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).map(o => o && o.date).filter(Boolean).sort();
    if(!dates.length) throw new Error('нет заказов терминала — не за какие дни загружать погоду');
    const from = dates[0] > '2024-01-02' ? dates[0] : '2024-01-02';
    const need = [];
    for(let d = from; d < today; d = addDaysISO(d, 1)){
      if(WX_LEADS.some(k => !weatherPrev[k][d]) && !wxPrevSkip.has(d)) need.push(d);
    }
    if(!need.length){ fcLabState.status = 'Все прогнозы прошлых дней уже загружены.'; return; }
    const chunks = []; let cur = [];
    need.forEach(d => {
      if(cur.length && (cur.length >= 30 || addDaysISO(cur[cur.length - 1], 1) !== d)){ chunks.push(cur); cur = []; }
      cur.push(d);
    });
    if(cur.length) chunks.push(cur);
    let ok = 0, fail = 0, lastErr = '', dbErr = '';
    for(let c = 0; c < chunks.length; c++){
      const ch = chunks[c];
      fcLabState.status = `Загружаю прогнозы погоды прошлых дней: ${c + 1} из ${chunks.length}…`; renderFcLab();
      let g;
      try{ g = await wxFetchPrev(ch[0], ch[ch.length - 1]); }
      catch(e){ lastErr = e.message; fail += ch.length; continue; }
      const upd = {}; WX_LEADS.forEach(k => upd[k] = {});
      ch.forEach(d => {
        let any = false;
        WX_LEADS.forEach(k => {
          const rec = g[k] && g[k][d] ? wxBuildRecord(d, g[k][d], true) : null;
          if(rec){ weatherPrev[k][d] = rec; upd[k][d] = rec; any = true; }
        });
        if(any) ok++; else wxPrevSkip.add(d);
      });
      for(const k of WX_LEADS){
        wxPrevPersist(k);
        if(Object.keys(upd[k]).length){
          try{ await firebase.database().ref(`locations/${locId}/weather_d${k}`).update(upd[k]); }
          catch(e){ dbErr = e.message; }
        }
      }
      renderFcLab();
    }
    fcLabState.status = `Прогнозы погоды прошлых дней: загружено ${ok} дн.` + (fail ? `, не удалось ${fail}` : '') + '.';
    if(fail) fcLabState.err = lastErr;
    if(dbErr) fcLabState.err = (fcLabState.err ? fcLabState.err + ' ' : '') + 'В базу не записано (останется только на этом устройстве): ' + dbErr;
  }catch(e){
    fcLabState.status = ''; fcLabState.err = 'Не удалось загрузить: ' + e.message;
  }finally{
    fcLabState.loading = false; renderFcLab();
  }
}

/* ---------- Новая Пуассоновская модель (с взаимодействием признаков: дождь сегодня, сухой выход после дождей, отмена перед завтрашним дождём) ---------- */
function fc2Slot(date, useHol){ return (useHol && holidayName(date)) ? 7 : fcWdOf(date); }

function fc2Wet(rec, prof){
  const hp = wxHp(rec); if(!hp.length) return null;
  let w = 0;
  for(let h = WX_H1; h <= WX_H2; h++){
    const mm = Math.max(0, Number(hp[h]) || 0);
    const intensity = mm < 0.08 ? 0 : Math.min(1, Math.pow(mm / 1.1, 0.75));
    w += prof[h] * intensity;
  }
  return w;
}

/* Вектор из 3 признаков погоды для даты `date`:
   x[0] — тяжесть осадков сегодня (w0)
   x[1] — выход на сухую погоду после 1–3 дней дождей (активируется только когда сегодня сухо!)
   x[2] — ожидание сильного дождя завтра в сухой день сегодня (эффект отмены мойки) */
function fc2Features(date, rec0, prof, useHol, src){
  const sl = fc2Slot(date, useHol);
  const w0 = fc2Wet(rec0, prof[sl]);
  if(w0 == null) return null;
  const a1 = addDaysISO(date, -1), a2 = addDaysISO(date, -2), a3 = addDaysISO(date, -3), next1 = addDaysISO(date, 1);
  const w1 = fc2Wet(src(a1), prof[fc2Slot(a1, useHol)]) || 0;
  const w2 = fc2Wet(src(a2), prof[fc2Slot(a2, useHol)]) || 0;
  const w3 = fc2Wet(src(a3), prof[fc2Slot(a3, useHol)]) || 0;
  const wNext = fc2Wet(src(next1), prof[fc2Slot(next1, useHol)]) || 0;

  const dryToday = Math.max(0, 1 - Math.min(1, w0 * 2.2)); // 1 если сегодня сухо, 0 если сегодня идут осадки
  const dirtAccum = 0.62 * w1 + 0.26 * w2 + 0.12 * w3;
  const afterRainFeature = dryToday * dirtAccum;
  const preRainFeature = dryToday * (wNext >= 0.22 ? wNext : 0);
  return [w0, afterRainFeature, preRainFeature];
}

function fc2Profile(days, useHol){
  const pooled = Array(24).fill(0), cnt = Array.from({ length: 8 }, () => Array(24).fill(0)), tot = Array(8).fill(0);
  let pt = 0;
  days.forEach(d => { const r = fc2Slot(d.date, useHol); for(let h = 0; h < 24; h++){ pooled[h] += d.wl * d.h[h]; cnt[r][h] += d.wl * d.h[h]; } pt += d.wl * d.n; tot[r] += d.wl * d.n; });
  const S = 60;
  return cnt.map((row, r) => fcSmooth(row.map((c, h) => (c + S * (pt > 0 ? pooled[h] / pt : 1 / 24)) / (tot[r] + S)), 0.25));
}

function fc2Solve(A, b){ // метод Гаусса с выбором ведущего элемента
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for(let c = 0; c < n; c++){
    let p = c; for(let r = c + 1; r < n; r++) if(Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if(Math.abs(M[p][c]) < 1e-12) return null;
    const t = M[c]; M[c] = M[p]; M[p] = t;
    for(let r = 0; r < n; r++){ if(r === c) continue; const f = M[r][c] / M[c][c]; for(let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function fc2Fit(days, ref, windowDays, src){
  const Hl = Math.max(14, Math.round(windowDays * 0.6));
  days.forEach(d => { const a = fcAge(ref, d.date); d.wl = Math.pow(0.5, a / Hl); d.ws = Math.pow(0.5, a / 14); d.hol = holidayName(d.date) ? 1 : 0; });
  const useHol = days.filter(d => d.hol).length >= 2;
  const prof = fc2Profile(days, useHol);
  days.forEach(d => {
    d.sl = fc2Slot(d.date, useHol);
    d.x = fc2Features(d.date, d.rec, prof, useHol, src);
  });
  const withWx = days.filter(d => d.x);
  const useWx = withWx.length >= 7 && withWx.length / days.length >= 0.6;
  const use = useWx ? withWx : days;
  const sw = use.reduce((a, d) => a + d.wl, 0) || 1;
  const lamBar = Math.max(0.1, use.reduce((a, d) => a + d.wl * d.n, 0) / sw);

  // Априоры для [w0 (дождь сегодня), afterRain (выход из дождя), preRain (перед завтрашним дождём)]
  const th0 = [-1.15, 0.55, -0.35], lo = [-3.2, -0.1, -1.2], hi = [0.2, 1.5, 0.2];
  const th = useWx ? th0.slice() : [0, 0, 0];
  const Lam = 2.5 * lamBar * 0.25, K = 1;
  const s = Array(8).fill(1); let L = lamBar;
  const xv = d => useWx ? d.x : [0, 0, 0];

  for(let it = 0; it < 14; it++){
    use.forEach(d => { const x = xv(d); d.f = Math.exp(th[0] * x[0] + th[1] * x[1] + th[2] * x[2]); });
    for(let r = 0; r < 8; r++){
      let num = 0, den = 0;
      use.forEach(d => { if(d.sl === r){ num += d.wl * d.n; den += d.wl * d.f; } });
      s[r] = (num + K * L) / (L * (den + K));
    }
    let mean = 0; for(let r = 0; r < 7; r++) mean += s[r] / 7;
    for(let r = 0; r < 8; r++) s[r] /= mean;
    let a1 = 0, a2 = 0;
    use.forEach(d => { a1 += d.ws * d.n; a2 += d.ws * s[d.sl] * d.f; });
    if(a2 > 0) L = a1 / a2;
    if(useWx){
      const g = [0, 1, 2].map(j => -Lam * (th[j] - th0[j])), H = [[Lam, 0, 0], [0, Lam, 0], [0, 0, Lam]];
      use.forEach(d => {
        const mu = L * s[d.sl] * d.f, e = d.wl * (d.n - mu);
        for(let j = 0; j < 3; j++){ g[j] += e * d.x[j]; for(let k = 0; k < 3; k++) H[j][k] += d.wl * mu * d.x[j] * d.x[k]; }
      });
      const st = fc2Solve(H, g);
      if(st) for(let j = 0; j < 3; j++) th[j] = fcClamp(th[j] + fcClamp(st[j], -0.5, 0.5), lo[j], hi[j]);
    }
  }
  return { L, s, th, prof, useHol, useWx, n: days.length };
}

function fc2Predict(m, date, src){
  const hol = holidayName(date), wd = fcWdOf(date);
  let sv = m.s[wd];
  if(hol){
    if(m.useHol){ sv = m.s[7]; }
    else { sv = Math.max(m.s[wd], (m.s[0] + m.s[6]) / 2); }
  }
  let f = 1;
  if(m.useWx){
    const x = fc2Features(date, src(date), m.prof, m.useHol, src) || [0, 0, 0];
    f = Math.exp(m.th[0] * x[0] + m.th[1] * x[1] + m.th[2] * x[2]);
  }
  return m.L * sv * f;
}

/* ---------- Замер ---------- */
const fcLabWk = d => addDaysISO(d, -((new Date(d + 'T00:00:00').getDay() + 6) % 7));

function fcLabMad(lam){
  if(!(lam > 0)) return 0;
  let s = 0, lp = -lam;
  const top = Math.ceil(lam + 10 * Math.sqrt(lam) + 20);
  for(let k = 0; k <= top; k++){ if(k > 0) lp += Math.log(lam) - Math.log(k); s += Math.exp(lp) * Math.abs(k - lam); }
  return s;
}

function fcLabBase(all, i){
  const T = all[i].date, wd = all[i].wd, xs = [];
  for(let j = i - 1; j >= 0 && xs.length < 4; j--){ if(fcAge(T, all[j].date) > 35) break; if(all[j].wd === wd) xs.push(all[j].n); }
  if(xs.length) return xs.reduce((a, b) => a + b, 0) / xs.length;
  const ys = all.slice(Math.max(0, i - 14), i).map(d => d.n);
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
}

function fcLabCompute(opts){
  opts = opts || {};
  const N = opts.days || 100, today = opts.today || todayISO(), saved = fcWxSrc;
  try{
    const all = fcDays(today, 400).sort((a, b) => a.date < b.date ? -1 : 1);
    const SRC = { 0: d => wxRec(d) };
    WX_LEADS.forEach(k => { SRC[k] = d => weatherPrev[k][d] || null; });
    const leads = WX_LEADS.filter(k => all.filter(d => SRC[k](d.date)).length >= 20);
    const cand = [];
    for(let i = 14; i < all.length; i++){
      const T = all[i].date;
      if(SRC[0](T) && leads.every(k => SRC[k](T))) cand.push(i);
    }
    const idx = cand.slice(-N);
    if(idx.length < 15) return { err: leads.length ? `Мало дней для замера: ${idx.length} (нужно хотя бы 15 дней с известной погодой и фактом).` : 'Нет прогнозов погоды прошлых дней — сначала нажмите «Загрузить прогнозы погоды».' };

    const acc = {}, lam = [];
    const add = (key, T, p, a) => {
      const o = acc[key] || (acc[key] = { ae: 0, e: 0, a: 0, wk: {}, errs: [] });
      o.ae += Math.abs(p - a); o.e += p - a; o.a += a; o.errs.push(Math.abs(p - a));
      const w = fcLabWk(T), q = o.wk[w] || (o.wk[w] = { p: 0, a: 0, n: 0 }); q.p += p; q.a += a; q.n++;
    };
    const trainWith = (hist, src) => hist.map(d => Object.assign({}, d, { rec: src(d.date) }));
    const fitV1 = (hist, T, src) => {
      fcWxSrc = src;
      try{ const tr = trainWith(hist, src); const useWx = tr.filter(d => d.rec).length / tr.length >= 0.6; return fcFit(tr, T, useWx, fcWindow); }
      finally{ fcWxSrc = saved; }
    };
    const predV1 = (m, T, src, off) => { fcWxSrc = src; try{ return fcPredict(m, T, src(T), fcPrev(T), off).total; } finally{ fcWxSrc = saved; } };

    let used = 0;
    idx.forEach(i => {
      const T = all[i].date, a = all[i].n;
      const hist = all.slice(0, i).filter(d => fcAge(T, d.date) <= fcWindow);
      if(hist.length < 10) return;
      const pb = fcLabBase(all, i); if(pb == null) return;
      used++;
      add('base', T, pb, a);
      const m0 = fitV1(hist, T, SRC[0]);
      const p0 = predV1(m0, T, SRC[0], 0);
      add('cur:0', T, p0, a); lam.push(p0);
      add('new:0', T, fc2Predict(fc2Fit(trainWith(hist, SRC[0]), T, fcWindow, SRC[0]), T, SRC[0]), a);
      leads.forEach(k => {
        add('cur:' + k, T, predV1(m0, T, SRC[k], k), a);
        add('curM:' + k, T, predV1(fitV1(hist, T, SRC[k]), T, SRC[k], 0), a);
        add('new:' + k, T, fc2Predict(fc2Fit(trainWith(hist, SRC[k]), T, fcWindow, SRC[k]), T, SRC[k]), a);
      });
    });
    if(used < 15) return { err: 'Мало дней для замера после отбора (' + used + ').' };

    const cell = o => {
      if(!o || !(o.a > 0)) return null;
      let we = 0, wa = 0;
      Object.values(o.wk).forEach(q => { if(q.n >= 5){ we += Math.abs(q.p - q.a); wa += q.a; } });
      return { wape: Math.round(o.ae / o.a * 100), bias: Math.round(o.e / o.a * 100), week: wa > 0 ? Math.round(we / wa * 100) : null };
    };
    const cells = {}; Object.keys(acc).forEach(k => { cells[k] = cell(acc[k]); });
    const diff = (A, B) => {
      if(!acc[A] || !acc[B]) return null;
      const d = acc[A].errs.map((e, i) => e - acc[B].errs[i]), n = d.length, m = d.reduce((x, y) => x + y, 0) / n;
      const sd = Math.sqrt(d.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, n - 1));
      return { d: m * n / acc[B].a * 100, se: Math.sqrt(n) * sd / acc[B].a * 100 };
    };
    const diffs = {};
    leads.forEach(k => { diffs['cur-base:' + k] = diff('cur:' + k, 'base'); diffs['curM-cur:' + k] = diff('curM:' + k, 'cur:' + k); diffs['new-cur:' + k] = diff('new:' + k, 'cur:' + k); diffs['opt:' + k] = diff('cur:' + k, 'cur:0'); });
    const sumA = acc.base.a, floorAbs = lam.reduce((x, l) => x + fcLabMad(Math.max(0.3, l)), 0);
    return { n: used, from: all[idx[0]].date, to: all[idx[idx.length - 1]].date, meanA: sumA / used, floor: Math.round(floorAbs / sumA * 100), leads, cells, diffs, win: fcWindow };
  } finally{ fcWxSrc = saved; }
}

/* ---------- Вывод ---------- */
function fcLabVerdict(r){
  const c = r.cells, D = r.diffs || {}, out = [], k = r.leads[0];
  const f = x => x == null ? null : x.wape;
  const sig = x => x && Math.abs(x.d) >= 2 * x.se;
  const say = (x, better, worse, same) => !x ? '' : (!sig(x) ? same : (x.d < 0 ? better : worse)).replace('{d}', Math.abs(x.d).toFixed(1));
  if(k != null && c['cur:0'] && c['cur:' + k]){
    const o = D['opt:' + k];
    out.push(`«Модель сейчас» по фактической погоде ошибается на ${f(c['cur:0'])}% (так считает приложение), по прогнозу погоды за ${k} дн. — на ${f(c['cur:' + k])}%. ` +
      say(o, '', 'Показанная ошибка оптимистична на {d} п.п.', 'Разница в пределах случайности.'));
  }
  if(k != null && c.base && c['cur:' + k]){
    out.push(`Простая база даёт ${f(c.base)}%. ` + say(D['cur-base:' + k], 'Погода в текущем виде помогает: выигрыш {d} п.п.', 'Погода в текущем виде ХУЖЕ простой базы на {d} п.п. — усложнение не окупается.', 'Выигрыша от погоды в текущем виде пока не видно (разница в пределах случайности).'));
  }
  if(k != null && c['new:' + k]){
    out.push(`Пуассоновская регрессия: ${f(c['new:' + k])}%. ` + say(D['new-cur:' + k], 'Лучше основной модели на {d} п.п.', 'Хуже основной модели на {d} п.п.', 'От основной модели статистически не отличается.'));
    if(c['curM:' + k]) out.push(`Обучение на прогнозах погоды: ${f(c['curM:' + k])}%. ` + say(D['curM-cur:' + k], 'Помогает на {d} п.п.', 'Не помогает: хуже на {d} п.п.', 'Заметной разницы нет.'));
  }
  if(r.floor != null) out.push(`Ориентир предела: при ≈${r.meanA.toFixed(0)} платных авто в день одна лишь случайность даёт ≈${r.floor}% — ниже не опустится никакая модель. Разница меньше ≈2–3 п.п. на ${r.n} днях — шум.`);
  const bs = ['cur', 'new'].map(p => k != null && c[p + ':' + k] ? c[p + ':' + k].bias : null);
  if(bs[0] != null) out.push(`Смещение (прогноз минус факт) за ${k} дн.: сейчас ${bs[0] > 0 ? '+' : ''}${bs[0]}%, регрессия ${bs[1] > 0 ? '+' : ''}${bs[1]}%. Около нуля — хорошо; заметно выше нуля — завышает.`);
  return out.filter(Boolean);
}

function fcLabText(r){
  const L = ['Замер точности прогноза: ' + r.n + ' дн., ' + r.from + ' … ' + r.to + ', окно обучения ' + r.win + ' дн.', 'Ошибка по дню (WAPE), в скобках по неделе, смещение:'];
  const name = { base: 'База (среднее 4 таких дней недели)', cur: 'Модель 3.0 (основная)', curM: 'Модель 3.0 + обучение на прогнозах', new: 'Пуассоновская регрессия (плавный дождь)' };
  const cols = [['0', 'факт']].concat(r.leads.map(k => [String(k), '+' + k + 'д']));
  Object.keys(name).forEach(row => {
    const cells = cols.map(([k, t]) => { const x = row === 'base' ? r.cells.base : r.cells[row + ':' + k]; return t + ' ' + (x ? x.wape + '% (' + (x.week == null ? '–' : x.week + '%') + ', ' + (x.bias > 0 ? '+' : '') + x.bias + '%)' : '–'); });
    L.push(name[row] + ': ' + cells.join('; '));
  });
  L.push('Предел по случайности ≈ ' + r.floor + '%, объём ≈ ' + r.meanA.toFixed(1) + ' авто/день');
  return L.join('\n');
}

function fcLabCss(){
  if(document.getElementById('fclStyle')) return;
  const st = document.createElement('style'); st.id = 'fclStyle';
  st.textContent = `
  .fcl-text{font-size:12.5px;color:var(--muted);line-height:1.45;margin-bottom:10px}
  .fcl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
  .fcl-tbl{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0 6px}
  .fcl-tbl th{font-weight:700;color:var(--muted);font-size:11px;text-align:center;padding:4px 2px;border-bottom:1px solid var(--border)}
  .fcl-tbl th:first-child,.fcl-tbl td:first-child{text-align:left;padding-right:6px}
  .fcl-tbl td{padding:6px 2px;border-bottom:1px solid var(--border);text-align:center;vertical-align:top}
  .fcl-tbl td b{display:block;font-size:14px}
  .fcl-tbl td small{display:block;font-size:10px;color:var(--muted)}
  .fcl-tbl td.best b{color:var(--success-text)}
  .fcl-tbl td.na{color:var(--muted-light)}
  .fcl-tbl .nm{font-size:11.5px;line-height:1.25}
  .fcl-ver{display:flex;flex-direction:column;gap:5px;font-size:12px;margin-top:8px}
  .fcl-err{font-size:12px;color:var(--danger-text);background:var(--danger-soft);border-radius:8px;padding:6px 10px;margin:8px 0}
  `;
  document.head.appendChild(st);
}

function fcLabRun(){
  if(fcLabState.running) return;
  fcLabState.running = true; fcLabState.err = ''; fcLabState.status = 'Считаю…'; renderFcLab();
  setTimeout(() => {
    try{
      const r = fcLabCompute({});
      if(r.err){ fcLabState.err = r.err; fcLabState.res = null; } else { fcLabState.res = r; fcLabState.err = ''; }
    }catch(e){ console.error(e); fcLabState.err = 'Ошибка расчёта: ' + e.message; }
    fcLabState.running = false; fcLabState.status = ''; renderFcLab();
  }, 40);
}
function fcLabCopy(){
  if(!fcLabState.res) return;
  const t = fcLabText(fcLabState.res);
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => { fcLabState.status = 'Скопировано.'; renderFcLab(); }).catch(() => prompt('Скопируйте:', t));
  else prompt('Скопируйте:', t);
}

function renderFcLab(){
  const f = document.getElementById('forecastContainer');
  let box = document.getElementById('fcLabContainer');
  const admin = typeof isCurrentSuperAdmin === 'function' && isCurrentSuperAdmin();
  if(!f || !admin){ if(box){ box.style.display = 'none'; box.innerHTML = ''; } return; }
  if(!box){ box = document.createElement('div'); box.id = 'fcLabContainer'; f.insertAdjacentElement('afterend', box); }
  if(fcLabState.loc !== locId){
    fcLabState = { loc: locId, loading: false, running: false, res: null, status: '', err: '' };
    weatherPrev = { 1: {}, 3: {}, 5: {} }; wxPrevSkip.clear(); wxPrevInit();
  }
  fcLabCss();
  box.style.display = 'block';
  const cnt = k => Object.keys(weatherPrev[k] || {}).length;
  const st = fcLabState, r = st.res, busy = st.loading || st.running;
  const have = WX_LEADS.map(k => `за ${k} дн. — ${cnt(k)}`).join(', ');
  let table = '', ver = '';
  if(r){
    const cols = [['0', 'Факт']].concat(r.leads.map(k => [String(k), '+' + k + ' дн']));
    const nm = { base: 'Простая база (среднее 4 таких же дня недели)', cur: 'Модель 3.0 (основная)', curM: 'Модель 3.0 + обучение на прогнозах', new: 'Пуассоновская регрессия (плавный дождь)' };
    const get = (row, k) => row === 'base' ? r.cells.base : (row === 'curM' && k === '0' ? null : r.cells[row + ':' + k]);
    const best = {}; cols.forEach(([k]) => { let b = 1e9; Object.keys(nm).forEach(row => { const x = get(row, k); if(x && x.wape < b) b = x.wape; }); best[k] = b; });
    let body = '';
    Object.keys(nm).forEach(row => {
      body += `<tr><td class="nm">${nm[row]}</td>` + cols.map(([k]) => {
        const x = get(row, k);
        if(!x) return '<td class="na">–</td>';
        return `<td class="${x.wape === best[k] ? 'best' : ''}"><b>${x.wape}%</b><small>нед. ${x.week == null ? '–' : x.week + '%'}</small></td>`;
      }).join('') + '</tr>';
    });
    table = `<table class="fcl-tbl"><tr><th></th>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr>${body}</table>
      <div class="fc-notes"><div>Ошибка по дню (WAPE); мелко — по неделе. Зелёное — лучшее в столбце. «Факт» — как считает приложение сейчас (по фактической погоде), «+N дн» — по прогнозу погоды, известному за N дней.</div>
      <div>Проверено на ${r.n} днях (${r.from} … ${r.to}), окно обучения ${r.win} дн. Каждый день предсказан только по данным до него.</div></div>`;
    ver = `<div class="fcl-ver">${fcLabVerdict(r).map(t => '<div>' + t + '</div>').join('')}</div>`;
  }
  box.innerHTML = `<div class="inteljet-card">
    <div class="inteljet-head"><div class="inteljet-badge">Замер точности прогноза</div></div>
    <div class="fcl-text">Приложение проверяет прогноз по фактической погоде, а завтра у него будет только её прогноз — поэтому показанная ошибка оптимистична. Здесь прошлые дни прогнозируются по прогнозу погоды, который существовал за 1, 3 и 5 дней до них.</div>
    <div class="fcl-text">Прогнозы погоды прошлых дней загружены: ${have}.</div>
    <div class="fcl-row">
      <button type="button" class="btn secondary" style="padding:7px 14px" ${busy ? 'disabled' : ''} onclick="wxPrevLoad()">${st.loading ? 'Загружаю…' : 'Загрузить прогнозы погоды'}</button>
      <button type="button" class="btn" style="padding:7px 14px" ${busy || !cnt(1) ? 'disabled' : ''} onclick="fcLabRun()">${st.running ? 'Считаю…' : 'Запустить замер'}</button>
      ${r ? `<button type="button" class="btn secondary" style="padding:7px 14px" onclick="fcLabCopy()">Скопировать итог</button>` : ''}
    </div>
    ${st.status ? `<div class="fcl-text">${st.status}</div>` : ''}
    ${st.err ? `<div class="fcl-err">${st.err}</div>` : ''}
    ${table}${ver}
  </div>`;
}
