/* ===== Прогноз загрузки на 7 дней: день недели × погода × дождь накануне × праздник, плюс почасовой профиль ===== */
let fcWindow = 45;   // сколько последних дней истории берём для обучения
let fcOpen = null;   // раскрытый день (почасовой прогноз)
const FC_GROUPS = ['dry', 'light', 'rain', 'heavy', 'snow'];
const FC_GROUP_RU = { dry: 'Без осадков', light: 'Небольшой дождь', rain: 'Дождь', heavy: 'Сильный дождь / гроза', snow: 'Снег' };
const FC_WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const fcWdOf = d => new Date(d + 'T00:00:00').getDay();
const fcAge = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 864e5);
const fcClamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fcGroup = r => (r && WX_CATS[r.cat]) ? WX_CATS[r.cat].g : null;
const fcWet = g => (g === 'rain' || g === 'heavy' || g === 'snow') ? 1 : 0;
const fcPrev = d => fcWet(fcGroup(wxRec(addDaysISO(d, -1))));

function setFcWindow(v){ const n = Math.round(Number(v)); if(n >= 7 && n <= 365){ fcWindow = n; renderForecast(); } }
function toggleFcDay(d){ fcOpen = fcOpen === d ? null : d; renderForecast(); }

/* Дни истории (по заказам терминала) с часовой раскладкой */
function fcDays(upto, windowDays){
  const by = {};
  Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).forEach(o => {
    if(!o || !o.date) return;
    const h = ijOrderHour(o); if(h == null) return;
    const x = by[o.date] || (by[o.date] = { date: o.date, n: 0, h: Array(24).fill(0) });
    x.n++; x.h[h]++;
  });
  return Object.values(by).filter(x => x.date < upto && fcAge(upto, x.date) <= windowDays)
    .map(x => Object.assign(x, { wd: fcWdOf(x.date), rec: wxRec(x.date) }));
}

/* Мультипликативная модель: машины = base[день недели] × mg[погода] × mp[был дождь вчера]; веса — свежие дни важнее */
function fcFit(days, ref, useWx, windowDays){
  const H = Math.max(14, Math.round(windowDays * 0.6));
  days.forEach(d => {
    d.w = Math.pow(0.5, fcAge(ref, d.date) / H);
    d.g = useWx ? (fcGroup(d.rec) || 'dry') : 'dry';
    d.p = useWx ? fcPrev(d.date) : 0;
    d.hol = holidayName(d.date) ? 1 : 0;
  });
  const holN = days.filter(d => d.hol).length;
  const sw = days.reduce((a, d) => a + d.w, 0) || 1;
  const overall = days.reduce((a, d) => a + d.w * d.n, 0) / sw;
  const base = Array(7).fill(overall), mg = {}, mp = [1, 1];
  let mh = 1; // множитель праздничного дня (обучается, когда в истории есть минимум 2 праздничных дня)
  FC_GROUPS.forEach(g => mg[g] = 1);
  const K = 3;
  for(let it = 0; it < 10; it++){
    for(let wd = 0; wd < 7; wd++){
      let num = 0, den = 0;
      days.forEach(d => { if(d.wd === wd && !(holN >= 2 && d.hol)){ num += d.w * d.n; den += d.w * mg[d.g] * mp[d.p]; } });
      base[wd] = den > 0 ? num / den : overall;
    }
    FC_GROUPS.forEach(g => {
      let num = 0, den = 0, neff = 0;
      days.forEach(d => { if(d.g === g){ num += d.w * d.n; den += d.w * base[d.wd] * mp[d.p] * (holN >= 2 && d.hol ? mh : 1); neff += d.w; } });
      const raw = den > 0 ? num / den : 1;
      mg[g] = fcClamp((raw * neff + K) / (neff + K), 0.15, 1.6);
    });
    [0, 1].forEach(p => {
      let num = 0, den = 0, neff = 0;
      days.forEach(d => { if(d.p === p){ num += d.w * d.n; den += d.w * base[d.wd] * mg[d.g] * (holN >= 2 && d.hol ? mh : 1); neff += d.w; } });
      const raw = den > 0 ? num / den : 1;
      mp[p] = fcClamp((raw * neff + K) / (neff + K), 0.7, 1.6);
    });
    if(holN >= 2){
      let num = 0, den = 0, neff = 0;
      days.forEach(d => { if(d.hol){ num += d.w * d.n; den += d.w * base[d.wd] * mg[d.g] * mp[d.p]; neff += d.w; } });
      mh = fcClamp(((den > 0 ? num / den : 1) * neff + 0.5) / (neff + 0.5), 0.4, 3);
    }
  }
  // разброс (лог-ошибка) -> интервал
  let s2 = 0;
  days.forEach(d => { const f = base[d.wd] * mg[d.g] * mp[d.p] * (holN >= 2 && d.hol ? mh : 1); const r = Math.log((d.n + 1) / (f + 1)); s2 += d.w * r * r; });
  const sigma = Math.max(0.12, Math.sqrt(s2 / sw));
  // почасовой профиль по дням недели, сглаженный общим профилем
  const pooled = Array(24).fill(0), cnt = Array.from({ length: 8 }, () => Array(24).fill(0)), tot = Array(8).fill(0);
  let pt = 0;
  days.forEach(d => { for(let h = 0; h < 24; h++){ const r = (holN >= 2 && d.hol) ? 7 : d.wd; pooled[h] += d.w * d.h[h]; cnt[r][h] += d.w * d.h[h]; } pt += d.w * d.n; tot[(holN >= 2 && d.hol) ? 7 : d.wd] += d.w * d.n; });
  const S = 15;
  const prof = cnt.map((row, wd) => row.map((c, h) => (c + S * (pt > 0 ? pooled[h] / pt : 1 / 24)) / (tot[wd] + S)));
  // во сколько раз в «дождливые» часы машин меньше, чем в сухие
  let O = 0, E = 0;
  if(useWx) days.forEach(d => { const hp = wxHp(d.rec); if(!hp.length) return;
    for(let h = WX_H1; h <= WX_H2; h++){ if(hp[h] >= 0.2){ O += d.w * d.h[h]; E += d.w * d.n * prof[(holN >= 2 && d.hol) ? 7 : d.wd][h]; } } });
  const rho = fcClamp((E > 0 ? (O / E) * E + 6 : 6) / (E + 6), 0.15, 1.2);
  return { base, mg, mp, mh, holN, prof, rho, sigma, useWx, n: days.length, days };
}

function fcPredict(m, date, rec, prevWet){
  const wd = fcWdOf(date), hol = holidayName(date);
  const g = (m.useWx && rec) ? (fcGroup(rec) || 'dry') : 'dry';
  let b = m.base[wd], pw = wd;
  // праздник в истории не встречался — считаем как выходной (среднее Сб/Вс), если он выше обычного дня
  let hf = 1;
  if(hol){
    if(m.holN >= 2){ hf = m.mh; pw = 7; }                       // есть свои данные по праздникам
    else { const we = (m.base[0] + m.base[6]) / 2; if(we > b) b = we; pw = 0; } // иначе — как выходной
  }
  const total = b * hf * m.mg[g] * m.mp[m.useWx ? prevWet : 0];
  const hp = wxHp(rec);
  const wts = m.prof[pw].map((s, h) => s * ((m.useWx && h >= WX_H1 && h <= WX_H2 && hp[h] >= 0.2) ? m.rho : 1));
  const ws = wts.reduce((a, b2) => a + b2, 0) || 1;
  const k = Math.exp(1.28 * m.sigma);
  return { date, wd, rec, g, hol, total, lo: total / k, hi: total * k, hours: wts.map(w => total * w / ws), wet: wts.map((_, h) => h >= WX_H1 && h <= WX_H2 && hp[h] >= 0.2) };
}

/* Проверка модели: обучаем без последних 7 дней и предсказываем их по фактической погоде */
function fcBacktest(){
  const today = todayISO(), cut = addDaysISO(today, -7);
  const train = fcDays(cut, fcWindow);
  if(train.length < 14) return null;
  const useWx = train.filter(d => d.rec).length / train.length >= 0.6;
  const m = fcFit(train, cut, useWx, fcWindow);
  let err = 0, act = 0, n = 0;
  fcDays(today, 8).filter(d => d.date >= cut).forEach(d => {
    const p = fcPredict(m, d.date, d.rec, fcPrev(d.date));
    err += Math.abs(p.total - d.n); act += d.n; n++;
  });
  return n >= 3 && act > 0 ? { wape: Math.round(err / act * 100), n } : null;
}

function fcRun(){
  const today = todayISO();
  const days = fcDays(today, fcWindow);
  if(days.length < 7) return { err: 'Мало данных: в выбранном окне только ' + days.length + ' дн. с заказами терминала (нужно минимум 7).' };
  const useWx = days.filter(d => d.rec).length / days.length >= 0.6;
  const m = fcFit(days, today, useWx, fcWindow);
  const out = [];
  for(let i = 1; i <= 7; i++){ const d = addDaysISO(today, i); out.push(fcPredict(m, d, wxRec(d), fcPrev(d))); }
  return { m, out, bt: fcBacktest(), wxDays: days.filter(d => d.rec).length };
}

function renderForecast(){
  const box = document.getElementById('forecastContainer');
  if(!box) return;
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()){ box.style.display = 'none'; box.innerHTML = ''; return; }
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
  if(R.err){ box.innerHTML = `<div class="inteljet-card">${head}<div class="empty" style="padding:14px 0">${R.err}</div></div>`; return; }

  const { m, out, bt } = R;
  const week = out.reduce((a, p) => a + p.total, 0);
  const pad = x => String(x).padStart(2, '0');
  let rows = '';
  out.forEach(p => {
    const c = p.rec && WX_CATS[p.rec.cat];
    const opened = fcOpen === p.date;
    let detail = '';
    if(opened){
      let lo = 23, hi = 0, mx = 0;
      p.hours.forEach((v, h) => { if(v >= 0.15){ lo = Math.min(lo, h); hi = Math.max(hi, h); } mx = Math.max(mx, v); });
      let cols = '';
      for(let h = lo; h <= hi; h++){
        const v = p.hours[h];
        cols += `<div class="hr-col ${p.wet[h] ? 'wet' : ''}" title="${pad(h)}:00 · ≈${v.toFixed(1)} авто${p.wet[h] ? ' · ожидаются осадки' : ''}">
          <span class="hr-val">${v >= 0.05 ? (Math.round(v * 10) / 10) : ''}</span>
          <div class="hr-bar-wrap"><div class="hr-bar" style="height:${mx > 0 && v > 0 ? Math.max(3, Math.round(v / mx * 100)) : 0}%"></div></div>
          <span class="hr-lbl">${h}</span></div>`;
      }
      const pk = p.hours.indexOf(Math.max(...p.hours));
      detail = `<div class="fc-detail"><div class="hr-chart" style="height:150px">${cols}</div>${wxHoursHtml(p.rec)}
        <div class="hr-summary"><span>Пик: <b>${pad(pk)}:00–${pad(pk + 1)}:00</b> (≈${Math.round(p.hours[pk] * 10) / 10} авто)</span>${p.wet.some(Boolean) ? '<span>Синим отмечены часы с осадками</span>' : ''}</div></div>`;
    }
    rows += `<div class="fc-day ${opened ? 'open' : ''}">
      <div class="fc-row" onclick="toggleFcDay('${p.date}')">
        <div class="fc-date"><b>${FC_WD[p.wd]}</b> ${p.date.slice(8)}.${p.date.slice(5, 7)}</div>
        <div class="fc-wx">${c ? wxIcon(c.i) + ' <span>' + c.t + ' · ' + p.rec.tmin + '…' + p.rec.tmax + '°</span>' : '<span style="color:var(--muted)">нет прогноза погоды</span>'}${p.hol ? ' <span class="wx-chip wx-hol">' + p.hol + '</span>' : ''}</div>
        <div class="fc-val"><b>≈ ${Math.round(p.total)}</b><small>${Math.round(p.lo)}–${Math.round(p.hi)}</small></div>
      </div>${detail}</div>`;
  });

  const eff = FC_GROUPS.filter(g => g !== 'dry' && m.days.filter(d => d.g === g).length >= 2)
    .map(g => `${FC_GROUP_RU[g]} ×${m.mg[g].toFixed(2)} (${m.days.filter(d => d.g === g).length} дн.)`);
  if(m.days.filter(d => d.p === 1).length >= 2) eff.push(`на следующий день после дождя ×${m.mp[1].toFixed(2)}`);
  const notes = [
    `Обучено на <b>${m.n}</b> дн.` + (m.useWx ? `, погода известна за ${R.wxDays}` : ', <b>погода не учитывается</b> (нет данных)'),
    bt ? `Проверка на последних ${bt.n} дн.: ошибка по сумме ≈ <b>${bt.wape}%</b>` : 'Проверка точности: пока мало данных',
    eff.length ? 'Влияние погоды: ' + eff.join('; ') : 'Влияние погоды: в истории мало дней с осадками — множители близки к 1',
    out.some(p => p.hol) ? (m.holN >= 2 ? `Праздничный день: по ${m.holN} прошлым праздничным дням ×${m.mh.toFixed(2)} к обычному дню недели.` : 'В истории мало праздничных дней (меньше 2): праздник оценён как выходной (Сб/Вс).') : ''
  ].filter(Boolean);

  box.innerHTML = `<div class="inteljet-card">${head}
    ${wxStatus ? `<div class="fc-warn">${wxStatus} <button type="button" class="btn secondary" style="padding:3px 10px;margin-left:6px" onclick="wxRetryAt=0;weatherSync(true)">Повторить</button></div>` : ''}
    <div class="hr-summary" style="margin:0 0 10px"><span>Всего за 7 дней: <b>≈ ${Math.round(week)} авто</b></span><span>В среднем: <b>≈ ${Math.round(week / 7)}</b> в день</span></div>
    <div class="fc-list">${rows}</div>
    <div class="fc-notes">${notes.map(n => '<div>' + n + '</div>').join('')}<div>Нажмите на день, чтобы увидеть прогноз по часам. Диапазон — вероятный разброс (≈80%).</div></div>
  </div>`;
}
