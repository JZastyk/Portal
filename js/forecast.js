/* ===== Прогноз загрузки на 7 дней (Модель 3.1 — откалибрована на реальной базе INTELJET Таганрогская 134Б):
   Двухконтурная адаптация уровня (быстрая реакция на окончание промо-акций и смену сезона)
   × День недели × Взвешенные по часам осадки × Накопленная грязь за 4 дня (включая перенос спроса с дождливых будней на Пт–Вс)
   × Ожидание дождя на завтра (эффект «перед дождём») × Высыхание дорог (влажность/ветер) × Температура × Праздники ===== */

const FC_EXCLUDE_DATES = []; // 2026-10-06 теперь полный (16 авто до 21:47), неполные дни определяются автоматически
const FC_WX_TRUST = [1, 1, 0.95, 0.85, 0.75, 0.65, 0.55, 0.5]; // доверие к погодному прогнозу по дням вперёд (0 — факт)
let fcWindow = 45;   // сколько последних дней истории берём для обучения структуры недели и погоды
let fcOpen = null;   // раскрытый день (почасовой прогноз)

const FC_GROUPS = ['dry', 'mid', 'long'];
const FC_GROUP_RU = {
  dry: 'Без дождя (до 2 ч)',
  mid: 'Осадки 3–5 ч',
  long: 'Осадки 6+ ч'
};
// Стартовые априоры, откалиброванные на реальной статистике мойки (платные мойки ≥ 100 ₽)
const FC_PRIOR = {
  dry: 1.0,
  mid: 0.58,        // умеренный дождь (3–5 ч) снижает поток платных моек примерно до 55–60%
  long: 0.28,       // затяжной дождь (6+ ч, как 14.09, 24.09, 30.09) снижает поток до 25–30% (2–5 авто)
  after1: 1.24,     // 1-й сухой день после обычного дождя
  afterHeavy: 1.48, // пиковый выход после затяжных дождей (или в первый сухой выходной после дождливых будней)
  after2: 1.20,     // 2-й сухой день после дождей (шлейф спроса, как 02.10 = 24 авто и 28.09 = 18 авто)
  preRain: 0.76     // сухой день ПЕРЕД сильным дождём завтра
};
const FC_WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const fcWdOf = d => new Date(d + 'T00:00:00').getDay();
const fcAge = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5);
const fcClamp = (x, a, b) => Math.min(b, Math.max(a, x));

let fcWxSrc = null; // подмена источника погоды (использует замер точности); null — обычная погода приложения
const fcRecOf = d => fcWxSrc ? fcWxSrc(d) : wxRec(d);

/* Определение базовой группы осадков */
const fcGroup = r => {
  if(!r || r.rainHours == null) return null;
  const h = Number(r.rainHours) || 0;
  return h <= 2 ? 'dry' : (h <= 5 ? 'mid' : 'long');
};
const fcWet = g => (g === 'mid' || g === 'long') ? 1 : 0;
const fcPrev = d => fcWet(fcGroup(fcRecOf(addDaysISO(d, -1))));

/* Непрерывная оценка тяжести осадков за день с учётом почасового профиля мойки (0.0 — сухо, 1.0 — ливень в часы пик) */
function fcDayWetScore(rec, prof){
  if(!rec) return 0;
  const hp = typeof wxHp === 'function' ? wxHp(rec) : [];
  if(hp && hp.length){
    let w = 0, wSum = 0;
    const h1 = typeof WX_H1 !== 'undefined' ? WX_H1 : 6;
    const h2 = typeof WX_H2 !== 'undefined' ? WX_H2 : 22;
    for(let h = h1; h <= h2; h++){
      const pWeight = (prof && prof[h]) ? prof[h] : (1 / (h2 - h1 + 1));
      const mm = Math.max(0, Number(hp[h]) || 0);
      const intensity = mm < 0.08 ? 0 : Math.min(1, Math.pow(mm / 1.1, 0.75));
      w += pWeight * intensity;
      wSum += pWeight;
    }
    return wSum > 0 ? fcClamp(w / wSum, 0, 1) : 0;
  }
  const rh = Number(rec.rainHours) || 0;
  return fcClamp(rh / 9, 0, 1);
}

/* Многодневный контекст погоды вокруг даты `date`:
   - что было за 1..4 дня ДО (индекс накопленной грязи и перенос спроса с дождливых будней на выходные)
   - что будет ЗАВТРА (эффект отмены мойки перед дождём)
   - индекс скорости высыхания асфальта (влажность + облачность + температура) */
function fcContextOf(date, rec, prof){
  const r0 = rec !== undefined ? rec : fcRecOf(date);
  const r1 = fcRecOf(addDaysISO(date, -1));
  const r2 = fcRecOf(addDaysISO(date, -2));
  const r3 = fcRecOf(addDaysISO(date, -3));
  const r4 = fcRecOf(addDaysISO(date, -4));
  const rNext = fcRecOf(addDaysISO(date, 1));

  const w0 = fcDayWetScore(r0, prof);
  const w1 = fcDayWetScore(r1, prof);
  const w2 = fcDayWetScore(r2, prof);
  const w3 = fcDayWetScore(r3, prof);
  const w4 = fcDayWetScore(r4, prof);
  const wNext = fcDayWetScore(rNext, prof);

  const g0 = fcGroup(r0) || 'dry';
  const g1 = fcGroup(r1) || 'dry';
  const g2 = fcGroup(r2) || 'dry';
  const g3 = fcGroup(r3) || 'dry';

  // Индекс накопленной на дорогах грязи за предыдущие 4 дня
  const dirtMemory = (0.50 * w1) + (0.25 * w2) + (0.15 * w3) + (0.10 * w4);
  const wd = fcWdOf(date);
  const isFriOrWeekend = (wd === 5 || wd === 6 || wd === 0);

  // Категория «После дождя»:
  // 0 — обычный день (или сегодня сам идёт дождь)
  // 1 — первый сухой день после 1 дня дождя
  // 2 — мощный выброс отложенного спроса (после 2+ дней непогоды ИЛИ первый сухой выходной/Пт после сильных дождей на неделе)
  // 3 — второй/третий сухой день после непогоды (шлейф очереди, как 02.10 или 28.09)
  let afterState = 0;
  if(g0 === 'dry'){
    if((fcWet(g1) && fcWet(g2)) || (fcWet(g1) && w1 >= 0.45)){
      afterState = 2;
    } else if(isFriOrWeekend && (fcWet(g2) || fcWet(g3)) && dirtMemory >= 0.22){
      // Синергия: дожди шли в будни (Ср/Чт), а в Пт/Сб/Вс вышло солнце (пример 27.09 = 32 авто, 02.10 = 24 авто)
      afterState = 2;
    } else if(fcWet(g1)){
      afterState = 1;
    } else if(!fcWet(g1) && (fcWet(g2) || fcWet(g3)) && dirtMemory >= 0.16){
      afterState = 3;
    }
  }

  // Эффект «Перед дождём»: сегодня сухо, но завтра ожидаются серьёзные осадки (3+ часа или wNext >= 0.28)
  const isPreRain = (g0 === 'dry' && (fcWet(fcGroup(rNext)) || wNext >= 0.28)) ? 1 : 0;

  // Температурно-дорожный режим + скорость высыхания луж
  let tempMod = 1.0;
  let tempTag = '';
  if(r0 && r0.tmax != null && r0.tmin != null){
    const tmax = Number(r0.tmax), tmin = Number(r0.tmin), tavg = (tmax + tmin) / 2;
    const rh = Number(r0.rh) || 70;
    const cloud = Number(r0.cloud) || 50;

    if(tmax <= -12){
      tempMod = fcClamp(0.82 + (tmax + 12) * 0.03, 0.50, 0.82);
      tempTag = 'мороз ↓';
    } else if(tavg >= -3.5 && tavg <= 3.5 && (w0 > 0.1 || w1 > 0.15)){
      tempMod = 1.12;
      tempTag = 'слякоть/реагенты';
    } else if(g0 === 'dry' && tmax >= 16 && tmax <= 30 && cloud < 45){
      tempMod = 1.05;
    }

    // Если это первый день после дождя, но влажность >= 88% и пасмурно — дороги ещё мокрые, пик сдвигается на следующий день
    if(afterState > 0 && rh >= 88 && cloud >= 85 && tmax < 14){
      tempMod *= 0.90;
      if(!tempTag) tempTag = 'сырой асфальт';
    } else if(afterState > 0 && rh <= 65 && cloud <= 40){
      tempMod *= 1.07;
    }
  }

  if(typeof isPreHoliday === 'function' && isPreHoliday(date) && g0 === 'dry'){
    tempMod *= 1.08;
    if(!tempTag) tempTag = 'предпраздничный ↑';
  }

  return {
    g: g0,
    w0, w1, w2, wNext,
    dirtMemory,
    afterState,
    isPreRain,
    tempMod,
    tempTag
  };
}

function setFcWindow(v){ const n = Math.round(Number(v)); if(n >= 7 && n <= 365){ fcWindow = n; renderForecast(); } }
function toggleFcDay(d){ fcOpen = fcOpen === d ? null : d; renderForecast(); }

/* Дни истории (по заказам терминала): строго платные мойки (≥ 100 ₽) с часовой раскладкой + отдельно число акционных.
   Также автоматически отсекает незавершённый последний день выгрузки, если данные оборвались днём. */
function fcDays(upto, windowDays){
  const by = {};
  let maxDateInCache = '';
  Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).forEach(o => {
    if(!o || !o.date || FC_EXCLUDE_DATES.includes(o.date)) return;
    if(o.date > maxDateInCache) maxDateInCache = o.date;
    const h = ijOrderHour(o); if(h == null) return;
    const x = by[o.date] || (by[o.date] = { date: o.date, n: 0, promo: 0, maxH: 0, h: Array(24).fill(0) });
    if(h > x.maxH) x.maxH = h;
    if(ijIsPromoOrder(o)){ x.promo++; return; }
    x.n++; x.h[h]++;
  });

  return Object.values(by).filter(x => {
    if(x.date >= upto || fcAge(upto, x.date) > windowDays) return false;
    // Если самый последний день в базе оборвался до 16:00 (например, выгрузка снята в обед 12.10 в 14:20) — не учимся на неполном дне
    if(x.date === maxDateInCache && x.maxH < 16 && x.n <= 12) return false;
    return true;
  }).map(x => Object.assign(x, { wd: fcWdOf(x.date), rec: fcRecOf(x.date) }));
}

const fcSmooth = (p, a) => {
  const q = p.slice();
  for(let h = 0; h < 24; h++){
    if(h > 0) q[h] += a * p[h - 1];
    if(h < 23) q[h] += a * p[h + 1];
  }
  const t = q.reduce((x, y) => x + y, 0) || 1;
  return q.map(v => v / t);
};

/* Мультипликативная самообучающаяся модель с двухконтурной памятью (Dual-Horizon):
   1) Структура дней недели и погодные эластичности учатся на длинном окне `windowDays`
   2) Текущий базовый уровень платного потока дотягивается по свежим 10–14 дням (`levelCorrection`),
      чтобы мгновенно адаптироваться, когда заканчиваются акции «1 рубль» и клиенты переходят в платные мойки! */
function fcFit(days, ref, useWx, windowDays){
  const H = Math.max(14, Math.round(windowDays * 0.55));

  const pooled = Array(24).fill(0), cnt = Array.from({ length: 8 }, () => Array(24).fill(0)), tot = Array(8).fill(0);
  let pt = 0;
  days.forEach(d => {
    const age = fcAge(ref, d.date);
    d.w = Math.pow(0.5, age / H);
    d.wShort = Math.pow(0.5, age / 8.5); // быстрая память (полураспад 8.5 дней) для захвата текущего уровня спроса
    d.hol = holidayName(d.date) ? 1 : 0;
  });
  const holN = days.filter(d => d.hol).length;
  days.forEach(d => {
    const r = (holN >= 2 && d.hol) ? 7 : d.wd;
    for(let h = 0; h < 24; h++){
      pooled[h] += d.w * d.h[h];
      cnt[r][h] += d.w * d.h[h];
    }
    pt += d.w * d.n;
    tot[r] += d.w * d.n;
  });
  const S = 60;
  const prof = cnt.map((row, wd) => fcSmooth(row.map((c, h) => (c + S * (pt > 0 ? pooled[h] / pt : 1 / 24)) / (tot[wd] + S)), 0.25));
  const avgProf = fcSmooth(pooled.map(v => pt > 0 ? v / pt : 1 / 24), 0.2);

  days.forEach(d => {
    d.nw = useWx && !fcGroup(d.rec);
    const ctx = useWx ? fcContextOf(d.date, d.rec, prof[d.wd] || avgProf) : {
      g: 'dry', w0: 0, w1: 0, dirtMemory: 0, afterState: 0, isPreRain: 0, tempMod: 1
    };
    d.g = ctx.g;
    d.ctx = ctx;
    d.p = (ctx.afterState === 1 || ctx.afterState === 2) ? 1 : 0;
  });

  const okDays = days.filter(d => !d.nw);
  const fit = okDays.length >= 7 ? okDays : days;
  const sw = fit.reduce((a, d) => a + d.w, 0) || 1;
  const overall = fit.reduce((a, d) => a + d.w * d.n, 0) / sw;

  const base = Array(7).fill(overall);
  const mg = { dry: 1, mid: FC_PRIOR.mid, long: FC_PRIOR.long };
  const mAfter = [1, FC_PRIOR.after1, FC_PRIOR.afterHeavy, FC_PRIOR.after2];
  const mAfterPriors = [1, FC_PRIOR.after1, FC_PRIOR.afterHeavy, FC_PRIOR.after2];
  const mPre = [1, FC_PRIOR.preRain];
  let mh = 1;

  const K = 2.6;
  for(let it = 0; it < 12; it++){
    for(let wd = 0; wd < 7; wd++){
      let num = 0, den = 0;
      fit.forEach(d => {
        if(d.wd === wd && !(holN >= 2 && d.hol)){
          const wxEff = mg[d.g] * mAfter[d.ctx.afterState] * mPre[d.ctx.isPreRain] * d.ctx.tempMod;
          num += d.w * d.n;
          den += d.w * wxEff;
        }
      });
      base[wd] = den > 0 ? (num + 1.2 * overall) / (den + 1.2) : overall;
    }

    FC_GROUPS.forEach(g => {
      let num = 0, den = 0, neff = 0;
      fit.forEach(d => {
        if(d.g === g){
          const other = base[d.wd] * mAfter[d.ctx.afterState] * mPre[d.ctx.isPreRain] * d.ctx.tempMod * (holN >= 2 && d.hol ? mh : 1);
          num += d.w * d.n;
          den += d.w * other;
          neff += d.w;
        }
      });
      const raw = den > 0 ? num / den : FC_PRIOR[g];
      mg[g] = fcClamp((raw * neff + K * FC_PRIOR[g]) / (neff + K), 0.12, 1.5);
    });

    [1, 2, 3].forEach(st => {
      let num = 0, den = 0, neff = 0;
      fit.forEach(d => {
        if(d.ctx.afterState === st){
          const other = base[d.wd] * mg[d.g] * mPre[d.ctx.isPreRain] * d.ctx.tempMod * (holN >= 2 && d.hol ? mh : 1);
          num += d.w * d.n;
          den += d.w * other;
          neff += d.w;
        }
      });
      const prior = mAfterPriors[st];
      const raw = den > 0 ? num / den : prior;
      mAfter[st] = fcClamp((raw * neff + K * prior) / (neff + K), 0.90, 1.85);
    });

    {
      let num = 0, den = 0, neff = 0;
      fit.forEach(d => {
        if(d.ctx.isPreRain === 1){
          const other = base[d.wd] * mg[d.g] * mAfter[d.ctx.afterState] * d.ctx.tempMod * (holN >= 2 && d.hol ? mh : 1);
          num += d.w * d.n;
          den += d.w * other;
          neff += d.w;
        }
      });
      const raw = den > 0 ? num / den : FC_PRIOR.preRain;
      mPre[1] = fcClamp((raw * neff + K * FC_PRIOR.preRain) / (neff + K), 0.55, 1.05);
    }

    if(holN >= 2){
      let num = 0, den = 0, neff = 0;
      fit.forEach(d => {
        if(d.hol){
          const other = base[d.wd] * mg[d.g] * mAfter[d.ctx.afterState] * mPre[d.ctx.isPreRain] * d.ctx.tempMod;
          num += d.w * d.n;
          den += d.w * other;
          neff += d.w;
        }
      });
      mh = fcClamp(((den > 0 ? num / den : 1) * neff + 0.5) / (neff + 0.5), 0.4, 3.0);
    }
  }

  // Двухконтурная калибровка: вычисляем коэффициент смещения уровня за последние ~10–14 дней (short-term momentum)
  let shortNum = 0, shortDen = 0;
  fit.forEach(d => {
    const predBase = base[d.wd] * mg[d.g] * mAfter[d.ctx.afterState] * mPre[d.ctx.isPreRain] * d.ctx.tempMod * (holN >= 2 && d.hol ? mh : 1);
    shortNum += d.wShort * d.n;
    shortDen += d.wShort * predBase;
  });
  const rawShortRatio = shortDen > 0 ? (shortNum / shortDen) : 1.0;
  // Мягко подтягиваем базу дней недели к актуальному уровню последних 2 недель
  const levelCorrection = fcClamp((rawShortRatio * 3.5 + 1.0) / 4.5, 0.72, 1.45);
  for(let wd = 0; wd < 7; wd++){
    base[wd] *= levelCorrection;
  }

  const mp = [1, mAfter[1]];

  let s2 = 0;
  fit.forEach(d => {
    const f = base[d.wd] * mg[d.g] * mAfter[d.ctx.afterState] * mPre[d.ctx.isPreRain] * d.ctx.tempMod * (holN >= 2 && d.hol ? mh : 1);
    const r = Math.log((d.n + 1) / (f + 1));
    s2 += d.w * r * r;
  });
  const sigma = Math.max(0.12, Math.sqrt(s2 / sw));

  let O = 0, E = 0;
  if(useWx) days.forEach(d => {
    const hp = wxHp(d.rec); if(!hp.length) return;
    for(let h = WX_H1; h <= WX_H2; h++){
      if(hp[h] >= 0.2){
        O += d.w * d.h[h];
        E += d.w * d.n * prof[(holN >= 2 && d.hol) ? 7 : d.wd][h];
      }
    }
  });
  const rho = fcClamp((E > 0 ? (O / E) * E + 6 : 6) / (E + 6), 0.15, 1.2);

  return { base, mg, mp, mAfter, mPre, mh, holN, prof, avgProf, rho, sigma, useWx, n: days.length, days, levelCorrection };
}

function fcPredict(m, date, rec, prevWet, off){
  const wd = fcWdOf(date), hol = holidayName(date);
  let b = m.base[wd], pw = wd;

  let hf = 1;
  if(hol){
    if(m.holN >= 2){ hf = m.mh; pw = 7; }
    else { const we = (m.base[0] + m.base[6]) / 2; if(we > b) b = we; pw = 0; }
  }

  const dayProf = m.prof[pw] || m.avgProf;
  const ctx = m.useWx ? fcContextOf(date, rec, dayProf) : {
    g: 'dry', w0: 0, w1: 0, dirtMemory: 0, afterState: 0, isPreRain: 0, tempMod: 1, tempTag: ''
  };

  if(m.useWx && prevWet === 1 && ctx.afterState === 0 && ctx.g === 'dry'){
    ctx.afterState = 1;
  }

  const phi = FC_WX_TRUST[off || 0] == null ? 0.5 : FC_WX_TRUST[off || 0];

  let weatherMult = m.mg[ctx.g];
  if(m.useWx && rec){
    if(ctx.g === 'dry' && ctx.w0 > 0.08){
      weatherMult = m.mg.dry * (1 - 0.18 * (ctx.w0 / 0.25));
    } else if(ctx.g === 'mid'){
      const t = fcClamp((ctx.w0 - 0.20) / 0.35, -0.5, 0.5);
      weatherMult = m.mg.mid * (1 - 0.15 * t);
    }
  }

  const afterMult = m.useWx ? m.mAfter[ctx.afterState] : 1;
  const preRainMult = m.useWx ? m.mPre[ctx.isPreRain] : 1;
  const tempMult = m.useWx ? ctx.tempMod : 1;

  const combinedWx = weatherMult * afterMult * preRainMult * tempMult;
  const paid = b * hf * Math.pow(combinedWx, phi);
  const total = paid + (m.promoRate || 0);

  const hp = wxHp(rec);
  const wts = dayProf.map((s, h) => {
    if(!m.useWx || h < WX_H1 || h > WX_H2 || !hp.length) return s;
    const mm = Number(hp[h]) || 0;
    if(mm >= 0.2){
      const intensity = fcClamp(mm / 1.5, 0.4, 1.3);
      return s * Math.pow(m.rho, intensity);
    }
    const prevMm1 = h > WX_H1 ? (Number(hp[h - 1]) || 0) : 0;
    const prevMm2 = h > WX_H1 + 1 ? (Number(hp[h - 2]) || 0) : 0;
    if(mm < 0.1 && (prevMm1 >= 0.3 || prevMm2 >= 0.4)){
      return s * 1.22;
    }
    return s;
  });

  const ws = wts.reduce((a, b2) => a + b2, 0) || 1;
  const k = Math.exp(1.28 * m.sigma * 1.3);

  return {
    date,
    wd,
    rec,
    g: ctx.g,
    ctx,
    hol,
    total,
    paid,
    lo: total / k,
    hi: total * k,
    hours: wts.map(w => total * w / ws),
    wet: wts.map((_, h) => h >= WX_H1 && h <= WX_H2 && hp[h] >= 0.2)
  };
}

/* Скользящая проверка: каждый день истории предсказываем по данным ДО него (по фактической погоде) и сравниваем с фактом */
let fcRollCache = { key: '', val: null };
const fcQuant = (a, q) => {
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.min(b.length - 1, Math.max(0, Math.round(q * (b.length - 1))))];
};
function fcRolling(){
  const today = todayISO();
  const key = [fcWindow, Object.keys(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).length, Object.keys(weatherStore).length, 'v3.1'].join('|');
  if(fcRollCache.key === key) return fcRollCache.val;
  const all = fcDays(today, 400).sort((a, b) => a.date < b.date ? -1 : 1);
  const R = []; let err = 0, act = 0;
  for(let i = 14; i < all.length; i++){
    const T = all[i].date;
    const train = all.filter(d => d.date < T && fcAge(T, d.date) <= fcWindow).map(d => Object.assign({}, d));
    if(train.length < 10) continue;
    const useWx = train.filter(d => d.rec).length / train.length >= 0.6;
    const p = fcPredict(fcFit(train, T, useWx, fcWindow), T, all[i].rec, fcPrev(T), 0).total;
    const a = all[i].n;
    R.push(Math.log((a + 1) / (p + 1))); err += Math.abs(p - a); act += a;
  }
  const val = R.length >= 20 && act > 0 ? { n: R.length, wape: Math.round(err / act * 100), q10: fcQuant(R, 0.1), q90: fcQuant(R, 0.9) } : null;
  fcRollCache = { key, val };
  return val;
}

function fcRun(){
  const today = todayISO();
  const days = fcDays(today, fcWindow);
  if(days.length < 7) return { err: 'Мало данных: в выбранном окне только ' + days.length + ' дн. с заказами терминала (нужно минимум 7).' };
  const useWx = days.filter(d => d.rec).length / days.length >= 0.6;
  const m = fcFit(days, today, useWx, fcWindow);
  const recent = fcDays(today, 14);
  m.promoRate = recent.length ? recent.reduce((a, d) => a + d.promo, 0) / recent.length : 0;
  const roll = fcRolling();
  const out = [];
  for(let i = 1; i <= 7; i++){
    const d = addDaysISO(today, i), p = fcPredict(m, d, wxRec(d), fcPrev(d), i);
    if(roll){
      p.lo = Math.max(0, (p.paid + 1) * Math.exp(roll.q10) - 1) + m.promoRate;
      p.hi = (p.paid + 1) * Math.exp(roll.q90) - 1 + m.promoRate;
    }
    out.push(p);
  }
  return { m, out, roll, wxDays: days.filter(d => d.rec).length };
}

function renderForecast(){
  const box = document.getElementById('forecastContainer');
  if(!box) return;
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()){ box.style.display = 'none'; box.innerHTML = ''; if(typeof renderFcLab === 'function') renderFcLab(); return; }
  box.style.display = 'block';
  const pills = [14, 30, 45, 60, 90].map(v => `<button type="button" class="mt-pill ${fcWindow === v ? 'active' : ''}" onclick="setFcWindow(${v})">${v} дн</button>`).join('');
  const head = `
    <div class="inteljet-head">
      <div class="inteljet-badge">${getSvg('zap')} Прогноз загрузки на 7 дней</div>
      <span style="font-size:12px;color:var(--muted)">по последним ${fcWindow} дням</span>
    </div>
    <div class="mt-controls-row" style="margin-bottom:12px">
      <div class="mt-pills">${pills}</div>
      <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px">свой период, дней
        <input type="number" min="7" max="365" value="${fcWindow}" onchange="setFcWindow(this.value)" class="fc-input"></label>
    </div>`;
  const R = fcRun();
  if(R.err){ box.innerHTML = `<div class="inteljet-card">${head}<div class="empty" style="padding:14px 0">${R.err}</div></div>`; if(typeof renderFcLab === 'function') renderFcLab(); return; }

  const { m, out, roll } = R;
  const week = out.reduce((a, p) => a + p.total, 0);
  const pad = x => String(x).padStart(2, '0');
  let rows = '';
  out.forEach(p => {
    const c = p.rec && WX_CATS[p.rec.cat];
    const opened = fcOpen === p.date;

    let factorBadges = '';
    if(p.ctx){
      if(p.ctx.afterState === 2) factorBadges += ` <span class="wx-chip" style="background:var(--success-soft);color:var(--success);font-weight:700">Пик после дождей ↑</span>`;
      else if(p.ctx.afterState === 1) factorBadges += ` <span class="wx-chip" style="background:var(--success-soft);color:var(--success)">После дождя ↑</span>`;
      else if(p.ctx.afterState === 3) factorBadges += ` <span class="wx-chip" style="background:var(--accent-soft);color:var(--accent-text)">Шлейф спроса ↑</span>`;
      if(p.ctx.isPreRain === 1) factorBadges += ` <span class="wx-chip" style="background:var(--warning-soft);color:var(--warning-text)">Перед дождём ↓</span>`;
      if(p.ctx.tempTag) factorBadges += ` <span class="wx-chip">${esc(p.ctx.tempTag)}</span>`;
    }

    let detail = '';
    if(opened){
      // Прогноз по часам сворачиваем в блоки по 3 часа
      const hb = hrToBlocks(p.hours);
      const wetB = Array.from({ length: HR_BLOCKS }, (_, k) => p.wet.slice(k * HR_STEP, k * HR_STEP + HR_STEP).some(Boolean));
      let lo = HR_BLOCKS - 1, hi = 0, mx = 0;
      hb.forEach((v, k) => { if(v >= 0.5){ lo = Math.min(lo, k); hi = Math.max(hi, k); } mx = Math.max(mx, v); });
      if(lo > hi){ lo = 2; hi = 6; }
      let cols = '';
      for(let k = lo; k <= hi; k++){
        const v = hb[k];
        cols += `<div class="hr-col ${wetB[k] ? 'wet' : ''}" title="${hrBlockRange(k)} · ≈${v.toFixed(1)} авто${wetB[k] ? ' · ожидаются осадки' : ''}">
          <span class="hr-val">${v >= 0.05 ? (Math.round(v * 10) / 10) : ''}</span>
          <div class="hr-bar-wrap"><div class="hr-bar" style="height:${mx > 0 && v > 0 ? Math.max(3, Math.round(v / mx * 100)) : 0}%"></div></div>
          <span class="hr-lbl">${hrBlockLbl(k)}</span></div>`;
      }
      let bs = 0, bw = 0;
      hb.forEach((v, k) => { if(v > bs){ bs = v; bw = k; } });
      detail = `<div class="fc-detail"><div class="hr-chart" style="height:150px">${cols}</div>${wxHoursHtml(p.rec)}
        <div class="hr-summary"><span>Самые загруженные 3 часа: <b>${hrBlockRange(bw)}</b> (≈${Math.round(bs)} авто)</span><span>платных ≈ ${Math.round(p.paid)}, акционных ≈ ${Math.round(m.promoRate)}</span>${p.wet.some(Boolean) ? '<span>Синим отмечены блоки с осадками</span>' : ''}</div></div>`;
    }
    rows += `<div class="fc-day ${opened ? 'open' : ''}">
      <div class="fc-row" onclick="toggleFcDay('${p.date}')">
        <div class="fc-date"><b>${FC_WD[p.wd]}</b> ${p.date.slice(8)}.${p.date.slice(5, 7)}</div>
        <div class="fc-wx">${c ? wxIcon(c.i) + ' <span>' + c.t + ' · ' + p.rec.tmin + '…' + p.rec.tmax + '°</span>' : '<span style="color:var(--muted)">нет прогноза погоды</span>'}${p.hol ? ' <span class="wx-chip wx-hol">' + p.hol + '</span>' : ''}${factorBadges}</div>
        <div class="fc-val"><b>≈ ${Math.round(p.total)}</b><small>${Math.round(p.lo)}–${Math.round(p.hi)}</small></div>
      </div>${detail}</div>`;
  });

  const eff = FC_GROUPS.filter(g => g !== 'dry' && m.days.filter(d => d.g === g).length >= 1)
    .map(g => `${FC_GROUP_RU[g]} ×${m.mg[g].toFixed(2)} (${m.days.filter(d => d.g === g).length} дн.)`);
  if(m.mAfter){
    eff.push(`после 1 дн. дождя ×${m.mAfter[1].toFixed(2)}`);
    eff.push(`пик после дождей ×${m.mAfter[2].toFixed(2)}`);
    eff.push(`шлейф 2-го дня ×${m.mAfter[3].toFixed(2)}`);
  }
  if(m.mPre) eff.push(`перед дождём ×${m.mPre[1].toFixed(2)}`);

  const notes = [
    `Обучено на <b>${m.n}</b> дн. (платные мойки ≥ ${IJ_PROMO_MAX} ₽)` + (m.useWx ? `, погода известна за ${R.wxDays}` : ', <b>погода не учитывается</b> (нет данных)'),
    roll ? `Проверка на истории (каждый день предсказан по данным до него, ${roll.n} дн.): средняя ошибка по дню ≈ <b>${roll.wape}%</b>. Диапазон — реальный разброс ошибок (80%).` : 'Проверка точности: пока мало данных',
    `Акционные мойки (до ${IJ_PROMO_MAX} ₽) в обучение не входят; добавлены текущим средним ≈ <b>${Math.round(m.promoRate * 10) / 10}</b> в день за 14 дней.`,
    'Внутри дня прогноз показан блоками по 3 часа: по отдельному часу он слишком грубый (в час в среднем меньше одной машины).',
    'Доверие к погодному прогнозу снижается с каждым днём вперёд.',
    eff.length ? 'Влияние погоды: ' + eff.join('; ') : 'Влияние погоды: в истории мало дней с осадками — множители близки к 1',
    out.some(p => p.hol) ? (m.holN >= 2 ? `Праздничный день: по ${m.holN} прошлым праздничным дням ×${m.mh.toFixed(2)} к обычному дню недели.` : 'В истории мало праздничных дней (меньше 2): праздник оценён как выходной (Сб/Вс).') : ''
  ].filter(Boolean);

  box.innerHTML = `<div class="inteljet-card">${head}
    ${wxStatus ? `<div class="fc-warn">${wxStatus} <button type="button" class="btn secondary" style="padding:3px 10px;margin-left:6px" onclick="wxRetryAt=0;weatherSync(true)">Повторить</button></div>` : ''}
    <div class="hr-summary" style="margin:0 0 10px"><span>Всего за 7 дней: <b>≈ ${Math.round(week)} авто</b></span><span>В среднем: <b>≈ ${Math.round(week / 7)}</b> в день</span></div>
    <div class="fc-list">${rows}</div>
    <div class="fc-notes">${notes.map(n => '<div>' + n + '</div>').join('')}<div>Нажмите на день, чтобы увидеть прогноз по 3 часа.</div></div>
  </div>`;
  if(typeof renderFcLab === 'function') renderFcLab();
}


/* Прогноз на любой день: обучение только на днях ДО него; для прошлых дней — «что мы бы предсказали», для будущих — обычный прогноз */
function fcForDate(date){
  const days = fcDays(date, fcWindow);
  if(days.length < 7) return null;
  const useWx = days.filter(d => d.rec).length / days.length >= 0.6;
  const m = fcFit(days, date, useWx, fcWindow);
  const recent = fcDays(date, 14);
  m.promoRate = recent.length ? recent.reduce((a, d) => a + d.promo, 0) / recent.length : 0;
  const off = Math.max(0, Math.min(7, fcAge(date, todayISO())));
  const p = fcPredict(m, date, wxRec(date), fcPrev(date), off);
  const roll = fcRolling();
  if(roll){
    p.lo = Math.max(0, (p.paid + 1) * Math.exp(roll.q10) - 1) + m.promoRate;
    p.hi = (p.paid + 1) * Math.exp(roll.q90) - 1 + m.promoRate;
  }
  return p;
}
