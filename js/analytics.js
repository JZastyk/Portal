/* ===== Вкладка «Аналитика» (только для суперадминистратора) ===== */
/* Очистка всей аналитики автомойки с подтверждением */
function clearAnalytics(){
  const ok = confirm("Вы точно хотите очистить аналитику? Все сохранённые отчёты за предыдущие дни будут безвозвратно удалены.");
  if(!ok) return;

  reportsHistoryCache = [];
  localStorage.removeItem(reportHistKey());

  if(reportsHistoryRef){
    reportsHistoryRef.remove().then(()=>{
      toast('Аналитика успешно очищена');
      renderAnalytics();
    }).catch(()=>{
      toast('Аналитика очищена локально');
      renderAnalytics();
    });
  } else {
    toast('Аналитика очищена');
    renderAnalytics();
  }
}


/* ===== Аналитика: точная дедупликация и актуальные срезы ===== */
function getUniqueDailyReports(){
  const map = {};
  reportsHistoryCache.forEach(h => {
    if (!h) return;
    const key = h.reportDate || (h.date ? addDaysISO(h.date, 1) : h.id);
    if (!key) return;
    // Всегда берём запись с самой свежей меткой времени time
    if (!map[key] || new Date(h.time).getTime() >= new Date(map[key].time).getTime()) {
      map[key] = h;
    }
  });
  return Object.values(map).sort((a,b) => {
    const da = a.reportDate || (a.date ? addDaysISO(a.date, 1) : '');
    const db = b.reportDate || (b.date ? addDaysISO(b.date, 1) : '');
    return db.localeCompare(da);
  });
}

function renderAnalytics(){
  if(!isCurrentSuperAdmin()) return;
  const uniqueReports = getUniqueDailyReports();
  let totalCars = 0;
  const weekdayCounts = [0,0,0,0,0,0,0];
  const boxCountNum = Number(settings.boxCount) || 0;
  const boxCounts = {};

  for (let i = 1; i <= boxCountNum; i++) {
    boxCounts[i] = 0;
  }

  uniqueReports.forEach(h => {
    const rep = h.report || {};
    const washed = rep.washed || {};
    let dayTotal = 0;

    for (let b = 1; b <= boxCountNum; b++) {
      const n = Number(washed[b]) || 0;
      totalCars += n;
      dayTotal += n;
      boxCounts[b] = (boxCounts[b] || 0) + n;
    }

    const d = new Date(h.date + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      weekdayCounts[d.getDay()] += dayTotal;
    }
  });

  document.getElementById('anTotalCars').textContent = fmt(totalCars);
  const daysCount = Math.max(1, uniqueReports.length);
  document.getElementById('anAvgCars').textContent = fmt(Math.round(totalCars / daysCount));

  // График дней недели (Пн-Вс)
  const daysOrder = [1,2,3,4,5,6,0];
  const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const maxDay = Math.max(1, ...weekdayCounts);

  document.getElementById('weekdayChart').innerHTML = daysOrder.map((dayIdx, i) => {
    const val = weekdayCounts[dayIdx];
    const pct = Math.round((val / maxDay) * 100);
    const isPeak = val > 0 && val === maxDay;
    return `
      <div class="weekday-bar-col">
        <span class="weekday-val">${val ? val : ''}</span>
        <div class="weekday-bar ${isPeak ? 'peak' : ''}" style="height:${Math.max(6, pct)}%"></div>
        <span class="weekday-label">${dayNames[i]}</span>
      </div>`;
  }).join('');

  // Загрузка по боксам (строго с 1 по N, без «Бокса 0»)
  const maxBox = Math.max(1, ...Object.values(boxCounts));
  const boxHtml = Object.entries(boxCounts).map(([b, cnt]) => {
    const pct = Math.round((cnt / maxBox) * 100);
    const share = totalCars > 0 ? Math.round((cnt / totalCars) * 100) : 0;
    return `
      <div class="box-metric-row">
        <span class="box-metric-name">Бокс ${b}</span>
        <div class="box-metric-bar-wrap"><div class="box-metric-fill" style="width:${pct}%"></div></div>
        <span class="box-metric-val">${cnt} шт (${share}%)</span>
      </div>`;
  }).join('');
  document.getElementById('boxesMetricList').innerHTML = boxHtml || '<div class="empty">Нет данных о помытых машинах</div>';

  // Инициализация календаря для детального среза по дате
  const dateInput = document.getElementById('anDateSelect');
  const getEntryDisplayDate = r => r.reportDate || (r.date ? addDaysISO(r.date, 1) : '');
  if(!dateInput.value || !uniqueReports.some(r => getEntryDisplayDate(r) === dateInput.value || (r.shiftDate || r.date) === dateInput.value)){
    dateInput.value = uniqueReports.length ? getEntryDisplayDate(uniqueReports[0]) : todayISO();
  }
  renderDateDetailCard();
  if(typeof renderInteljetAnalytics === 'function'){
    renderInteljetAnalytics();
  }
}

/* Отрисовка большой интерактивной карточки для выбранной даты */
function renderDateDetailCard(){
  const dateVal = document.getElementById('anDateSelect').value;
  const container = document.getElementById('anDateDetailContainer');
  if(!dateVal){
    container.innerHTML = '<div class="empty">Выберите дату в поле выше</div>';
    return;
  }

  const uniqueReports = getUniqueDailyReports();

  // Вычисляем эффективную дату замеров: для старых отчётов без reportDate = date + 1 день
  function getEffectiveReportDate(entry){
    if(entry.reportDate) return entry.reportDate;
    if(entry.date) return addDaysISO(entry.date, 1);
    return '';
  }

  // Машины — ищем по дате смены (shiftDate или date)
  const washedEntry = uniqueReports.find(e => (e.shiftDate || e.date) === dateVal);
  // TDS, рукава, расход — ищем по дате составления отчёта (reportDate или date+1 для старых)
  const metricsEntry = uniqueReports.find(e => getEffectiveReportDate(e) === dateVal);

  const allInteljet = (typeof inteljetOrdersCache !== 'undefined' && inteljetOrdersCache) ? Object.values(inteljetOrdersCache) : [];
  const shiftInteljet = (typeof isCurrentSuperAdmin === 'function' && isCurrentSuperAdmin())
    ? allInteljet.filter(o => o && o.date === dateVal)
    : [];

  if(!washedEntry && !metricsEntry && !shiftInteljet.length){
    const dStr = new Date(dateVal + 'T00:00:00').toLocaleDateString('ru-RU');
    container.innerHTML = `<div class="empty">За ${dStr} сохранённый отчёт не найден</div>`;
    if(typeof renderInteljetAnalytics === 'function'){
      renderInteljetAnalytics();
    }
    return;
  }

  const boxCountNum = Number(settings.boxCount) || 0;
  const formattedDate = new Date(dateVal + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});

  // --- Данные о машинах (из washedEntry или INTELJET Live) ---
  const washedRep = (washedEntry && washedEntry.report) || {};
  let washed = Object.assign({}, washedRep.washed || {});
  let dayCarsTotal = 0;
  for (let b = 1; b <= boxCountNum; b++) {
    dayCarsTotal += Number(washed[b]) || 0;
  }

  let isFromInteljetLive = false;
  if(shiftInteljet.length > 0 && dayCarsTotal === 0){
    for (let b = 1; b <= boxCountNum; b++) {
      washed[b] = shiftInteljet.filter(o => Number(o.box) === b).length;
    }
    dayCarsTotal = shiftInteljet.length;
    isFromInteljetLive = true;
  }

  // --- Данные замеров (из metricsEntry) ---
  const metricsRep = (metricsEntry && metricsEntry.report) || {};
  const hoses = metricsRep.hoses || {};
  const consumption = metricsRep.consumption || {};
  const tdsValue = metricsRep.tds || '—';
  const metricsAuthor = (metricsEntry && metricsEntry.author) || (washedEntry && washedEntry.author) || (isFromInteljetLive ? 'INTELJET (онлайн)' : 'Не указан');

  let boxesHtml = '';
  for(let b = 1; b <= boxCountNum; b++){
    const bCars = Number(washed[b]) || 0;
    const bPct = dayCarsTotal > 0 ? Math.round((bCars / dayCarsTotal) * 100) : 0;
    const h = hoses[b] || {};
    const c = consumption[b] || {};

    const consEntries = (settings.consumptionItems || []).filter(name => c[name]);

    boxesHtml += `
      <div class="box-detail-card">
        <div class="bd-head">
          <span class="bd-title">Бокс ${b}</span>
          <span class="bd-cars">${bCars} машин (${bPct}%)</span>
        </div>
        
        <div class="bd-section-label">Проход рукава</div>
        <div class="bd-hoses-row">
          <div><span>Слева</span><b>${h.left || '—'}</b></div>
          <div><span>Сзади</span><b>${h.back || '—'}</b></div>
          <div><span>Справа</span><b>${h.right || '—'}</b></div>
        </div>

        <div class="bd-section-label">Расход химии</div>
        ${consEntries.length ? `
          <div class="bd-cons-list">
            ${consEntries.map(name => `
              <div class="bd-cons-item">
                <span>${esc(name)}</span>
                <b>${c[name]} г.</b>
              </div>`).join('')}
          </div>
        ` : '<div style="font-size:11.5px;color:var(--muted)">Расход не заполнен</div>'}
      </div>
    `;
  }

  // Подсказки об источниках данных
  let sourceHints = '';
  if(isFromInteljetLive){
    sourceHints = `<div style="font-size:11px;color:var(--accent);margin-top:8px">⚡ Данные о количестве машин получены напрямую из терминала INTELJET</div>`;
  } else if(washedEntry && metricsEntry && washedEntry !== metricsEntry){
    const washedDateStr = new Date(washedEntry.date + 'T00:00:00').toLocaleDateString('ru-RU');
    const metricsDateStr = metricsEntry.reportDate
      ? new Date(metricsEntry.reportDate + 'T00:00:00').toLocaleDateString('ru-RU')
      : new Date(metricsEntry.date + 'T00:00:00').toLocaleDateString('ru-RU');
    sourceHints = `<div style="font-size:11px;color:var(--muted);margin-top:8px">Машины: отчёт за ${washedDateStr} • Замеры: отчёт от ${metricsDateStr}</div>`;
  }

  container.innerHTML = `
    <div class="day-summary-strip">
      <div class="day-summary-info">
        <b>${formattedDate}</b><br>
        Ответственный: <span>${esc(metricsAuthor)}</span> • TDS: <span>${esc(tdsValue)}</span>
      </div>
      <div class="day-summary-stat">
        Помыто за день
        <strong>${dayCarsTotal} машин${isFromInteljetLive ? ' <span style="font-size:11px;font-weight:normal;color:var(--accent);">⚡ Live</span>' : ''}</strong>
      </div>
    </div>
    <div class="day-boxes-grid">
      ${boxesHtml || '<div class="empty">Боксы не настроены</div>'}
    </div>
    ${sourceHints}
  `;

  if(typeof renderInteljetAnalytics === 'function'){
    renderInteljetAnalytics();
  }
}

/* ===== Аналитика INTELJET Live (только для Таганрогская 134Б) ===== */
function renderInteljetAnalytics(){
  const container = document.getElementById('inteljetContainer');
  if(!container) return;

  if(!isCurrentSuperAdmin()){
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const dateInput = document.getElementById('anDateSelect');
  const selectedDate = (dateInput && dateInput.value) || todayISO();

  const allOrders = Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {});
  const dayOrders = allOrders.filter(o => o && o.date === selectedDate);

  if(!dayOrders.length){
    container.innerHTML = `
      <div class="inteljet-card">
        <div class="inteljet-head">
          <div class="inteljet-badge">⚡ INTELJET Live • Таганрогская 134Б</div>
          <span style="font-size:12px;color:var(--muted)">Дата: ${isoToRuDate(selectedDate)}</span>
        </div>
        <div class="empty" style="padding:16px 0">
          Заказов из терминала INTELJET за эту дату пока не поступало.<br>
          <small style="color:var(--muted);margin-top:6px;display:block">
            Убедитесь, что расширение <b>INTELJET Sync</b> установлено в Chrome на компьютере оператора и открыта вкладка <code>192.168.11.50:8080/RemoteMonitor</code>.
          </small>
        </div>
      </div>
    `;
    return;
  }

  const totalOrders = dayOrders.length;
  let totalRevenue = 0;
  const payMethods = {};
  const washTypes = {};
  const boxStats = {};

  dayOrders.forEach(o => {
    const amt = Number(o.amount) || 0;
    totalRevenue += amt;

    const pm = o.payMethod || 'Карта';
    payMethods[pm] = (payMethods[pm] || 0) + amt;

    const wt = o.washType || 'Стандартная';
    washTypes[wt] = (washTypes[wt] || 0) + 1;

    const b = o.box || 1;
    if(!boxStats[b]) boxStats[b] = { count: 0, revenue: 0 };
    boxStats[b].count += 1;
    boxStats[b].revenue += amt;
  });

  const avgCheck = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Сверка с данными смены отчёта
  const uniqueReports = getUniqueDailyReports();
  const washedEntry = uniqueReports.find(e => (e.shiftDate || e.date) === selectedDate);
  let operatorCars = 0;
  if(washedEntry && washedEntry.report && washedEntry.report.washed){
    Object.values(washedEntry.report.washed).forEach(v => {
      operatorCars += Number(v) || 0;
    });
  }

  const diffCars = totalOrders - operatorCars;
  let reconcileHtml = '';
  if(operatorCars > 0){
    if(diffCars === 0){
      reconcileHtml = `
        <div class="ij-reconcile">
          <span style="color:#15803d;font-weight:700">✅ Сверка с отчётом оператора: полное совпадение (${totalOrders} авто)</span>
          <span style="color:#166534;font-size:11.5px">INTELJET: ${totalOrders} | Оператор: ${operatorCars}</span>
        </div>
      `;
    } else {
      const sign = diffCars > 0 ? `+${diffCars}` : `${diffCars}`;
      reconcileHtml = `
        <div class="ij-reconcile warning">
          <span style="color:#854d0e;font-weight:700">⚠️ Расхождение с отчётом оператора: ${sign} авто</span>
          <span style="color:#713f12;font-size:11.5px">INTELJET: ${totalOrders} авто | Оператор указал: ${operatorCars} авто</span>
        </div>
      `;
    }
  }

  const payListHtml = Object.entries(payMethods).map(([pm, sum]) => {
    const pct = totalRevenue > 0 ? Math.round((sum / totalRevenue) * 100) : 0;
    return `<tr><td><b>${esc(pm)}</b></td><td style="text-align:right"><b>${fmt(sum)} ₽</b> <small style="color:var(--muted)">(${pct}%)</small></td></tr>`;
  }).join('');

  const washListHtml = Object.entries(washTypes).map(([wt, cnt]) => {
    const pct = totalOrders > 0 ? Math.round((cnt / totalOrders) * 100) : 0;
    return `<tr><td><b>${esc(wt)}</b></td><td style="text-align:right"><b>${cnt} шт.</b> <small style="color:var(--muted)">(${pct}%)</small></td></tr>`;
  }).join('');

  const boxCardsHtml = Object.entries(boxStats).sort(([a],[b])=>Number(a)-Number(b)).map(([b, st]) => {
    return `
      <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">
        <span style="display:block;font-size:11px;color:var(--muted);font-weight:700">Бокс ${b}</span>
        <b style="font-size:16px;color:var(--accent-dark);display:block;margin:2px 0">${st.count} авто</b>
        <span style="font-size:12px;font-weight:800;color:#10b981">${fmt(st.revenue)} ₽</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="inteljet-card">
      <div class="inteljet-head">
        <div class="inteljet-badge">⚡ INTELJET Live • Таганрогская 134Б</div>
        <span style="font-size:12px;color:var(--muted)">Данные терминала за <b>${isoToRuDate(selectedDate)}</b></span>
      </div>

      <div class="inteljet-stats">
        <div class="ij-stat-item money">
          <span>Выручка терминала</span>
          <b>${fmt(totalRevenue)} ₽</b>
        </div>
        <div class="ij-stat-item">
          <span>Средний чек</span>
          <b>${fmt(avgCheck)} ₽</b>
        </div>
        <div class="ij-stat-item">
          <span>Количество моек</span>
          <b>${totalOrders} авто</b>
        </div>
      </div>

      <div class="ij-row">
        <div class="ij-subblock">
          <h4>💳 Способы оплаты</h4>
          <table class="ij-table">
            ${payListHtml}
          </table>
        </div>
        <div class="ij-subblock">
          <h4>🚿 Программы мойки</h4>
          <table class="ij-table">
            ${washListHtml}
          </table>
        </div>
      </div>

      <div class="ij-subblock" style="margin-bottom:12px">
        <h4>📦 Выручка и загрузка по боксам</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
          ${boxCardsHtml}
        </div>
      </div>

      ${reconcileHtml}
    </div>
  `;
}


