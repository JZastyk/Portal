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
    // Один отчёт = одна дата отчёта; при дублях берём самый свежий по времени сохранения
    const key = getEntryReportDate(h);
    if (!key) return;
    if (!map[key] || new Date(h.time).getTime() >= new Date(map[key].time).getTime()) {
      map[key] = h;
    }
  });
  return Object.values(map).sort((a,b) => getEntryReportDate(b).localeCompare(getEntryReportDate(a)));
}

/* ===== Состояние интерактивного календаря аналитики ===== */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = '';

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const RU_WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

function renderAnalytics(){
  if(!isCurrentSuperAdmin()) return;
  const uniqueReports = getUniqueDailyReports();
  let totalCars = 0;
  const boxCountNum = Number(settings.boxCount) || 0;
  const boxCounts = {};

  for (let i = 1; i <= boxCountNum; i++) {
    boxCounts[i] = 0;
  }

  uniqueReports.forEach(h => {
    const rep = h.report || {};
    const washed = rep.washed || {};
    for (let b = 1; b <= boxCountNum; b++) {
      const n = Number(washed[b]) || 0;
      totalCars += n;
      boxCounts[b] = (boxCounts[b] || 0) + n;
    }
  });

  // Герои аналитики вверху
  document.getElementById('anTotalCars').textContent = fmt(totalCars);
  const daysCount = Math.max(1, uniqueReports.length);
  document.getElementById('anAvgCars').textContent = fmt(Math.round(totalCars / daysCount));

  // Инициализация выбранной даты по самому свежему отчёту или сегодня
  if(!calSelectedDate){
    if(uniqueReports.length > 0){
      const latest = uniqueReports[0];
      calSelectedDate = getEntryReportDate(latest) || todayISO();
    } else {
      calSelectedDate = todayISO();
    }
    const [y, m] = calSelectedDate.split('-').map(Number);
    if(!isNaN(y) && !isNaN(m)){
      calYear = y;
      calMonth = m - 1;
    }
  }

  const dateInput = document.getElementById('anDateSelect');
  if(dateInput) dateInput.value = calSelectedDate;

  // Отрисовка календаря и карточки выбранного дня
  renderCalendar();
  renderDayDetailCard();

  // Отрисовка нижних аналитических карточек (рейтинг дней недели + рекорд)
  renderBusiestDaysRanking(uniqueReports);
  renderRecordDayCard(uniqueReports);

  // Отрисовка общей загрузки по боксам за всё время
  renderBoxesMetricList(boxCounts, totalCars, boxCountNum);

  if(typeof renderInteljetAnalytics === 'function'){
    renderInteljetAnalytics();
  }

  // Проход рукава и расход химии (таблицы + графики)
  renderMetricAnalytics();
}

/**
 * Единый источник правды для статистики за конкретный день (смену).
 * Гарантирует абсолютную точность и согласованность между календарем и карточкой!
 */
function getDayStats(dateVal, uniqueReports){
  if(!uniqueReports) uniqueReports = getUniqueDailyReports();
  const boxCountNum = Number(settings.boxCount) || 0;

  // 1. МАШИНЫ — из отчёта, у которого дата мойки (shiftDate) = выбранный день.
  //    ЗАМЕРЫ (рукава, расход, TDS, остатки, оператор) — из отчёта, у которого дата отчёта (reportDate) = выбранный день.
  const washedEntry = uniqueReports.find(e => getEntryShiftDate(e) === dateVal);
  const metricsEntry = uniqueReports.find(e => getEntryReportDate(e) === dateVal);

  // 2. Ищем заказы INTELJET Live для этой даты
  const allInteljet = (typeof inteljetOrdersCache !== 'undefined' && inteljetOrdersCache) ? Object.values(inteljetOrdersCache) : [];
  const shiftInteljet = (typeof isCurrentSuperAdmin === 'function' && isCurrentSuperAdmin())
    ? allInteljet.filter(o => o && o.date === dateVal)
    : [];

  const washedRep = (washedEntry && washedEntry.report) || {};
  let washed = Object.assign({}, washedRep.washed || {});
  let dayCarsTotal = 0;
  for (let b = 1; b <= boxCountNum; b++) {
    dayCarsTotal += Number(washed[b]) || 0;
  }

  let isFromInteljetLive = false;
  // Если отчёта нет или помыто 0, но в Inteljet есть заказы за этот день — берём ВСЕ заказы терминала
  if(shiftInteljet.length > 0 && dayCarsTotal === 0){
    for (let b = 1; b <= boxCountNum; b++) {
      washed[b] = shiftInteljet.filter(o => Number(o.box) === b).length;
    }
    dayCarsTotal = shiftInteljet.length;
    isFromInteljetLive = true;
  }

  // 3. Замеры (рукава, расход, TDS, автор)
  const metricsRep = (metricsEntry && metricsEntry.report) || {};
  const hoses = metricsRep.hoses || {};
  const consumption = metricsRep.consumption || {};
  const tdsValue = metricsRep.tds || '';
  const metricsAuthor = (metricsEntry && metricsEntry.author) || (isFromInteljetLive ? 'INTELJET (онлайн)' : '');
  const stock = (metricsEntry && metricsEntry.stock) || [];

  const hasData = Boolean(washedEntry || metricsEntry || shiftInteljet.length > 0);

  return {
    date: dateVal,
    totalCars: dayCarsTotal,
    boxCars: washed,
    hoses: hoses,
    consumption: consumption,
    tdsValue: tdsValue,
    stock: stock,
    author: metricsAuthor,
    washedEntry: washedEntry,
    metricsEntry: metricsEntry,
    shiftInteljet: shiftInteljet,
    isFromInteljetLive: isFromInteljetLive,
    hasData: hasData
  };
}

/**
 * Построение карты статистики по дням для календаря и аналитики
 */
function buildDailyStatsMap(uniqueReports){
  const map = {};
  const datesSet = new Set();

  uniqueReports.forEach(h => {
    const sd = getEntryShiftDate(h);
    const rd = getEntryReportDate(h);
    if(sd) datesSet.add(sd);
    if(rd) datesSet.add(rd);
  });

  if (typeof isCurrentSuperAdmin === 'function' && isCurrentSuperAdmin() && typeof inteljetOrdersCache !== 'undefined' && inteljetOrdersCache) {
    Object.values(inteljetOrdersCache).forEach(o => {
      if(o && o.date) datesSet.add(o.date);
    });
  }

  if(calSelectedDate) datesSet.add(calSelectedDate);
  datesSet.add(todayISO());

  datesSet.forEach(dStr => {
    map[dStr] = getDayStats(dStr, uniqueReports);
  });

  return map;
}

/**
 * Отрисовка кастомного календаря с переключением месяца и пометками
 */
function renderCalendar(){
  const titleEl = document.getElementById('calMonthTitle');
  const gridEl = document.getElementById('calDaysGrid');
  if(!titleEl || !gridEl) return;

  titleEl.textContent = `${RU_MONTHS[calMonth]} ${calYear}`;

  const uniqueReports = getUniqueDailyReports();
  const dailyStatsMap = buildDailyStatsMap(uniqueReports);

  const firstDay = new Date(calYear, calMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Понедельник = 0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  let html = '';

  // Дни предыдущего месяца
  const prevY = calMonth === 0 ? calYear - 1 : calYear;
  const prevM = calMonth === 0 ? 12 : calMonth;
  for(let i = 0; i < startOffset; i++){
    const d = daysInPrevMonth - startOffset + i + 1;
    const isoStr = `${prevY}-${String(prevM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const stat = dailyStatsMap[isoStr];
    const hasCars = stat && stat.totalCars > 0;
    const isSelected = (isoStr === calSelectedDate);
    const isToday = (isoStr === todayISO());

    html += `
      <button type="button" class="cal-cell other-month ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasCars ? 'has-cars' : ''}" onclick="selectCalendarDate('${isoStr}')" title="${hasCars ? stat.totalCars + ' авто' : ''}">
        <span class="cal-cell-num">${d}</span>
        ${hasCars ? `<span class="cal-cell-badge">${stat.totalCars}</span>` : ''}
      </button>
    `;
  }

  // Дни текущего месяца
  const curM = calMonth + 1;
  for(let d = 1; d <= daysInMonth; d++){
    const isoStr = `${calYear}-${String(curM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const stat = dailyStatsMap[isoStr];
    const hasCars = stat && stat.totalCars > 0;
    const isSelected = (isoStr === calSelectedDate);
    const isToday = (isoStr === todayISO());

    html += `
      <button type="button" class="cal-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasCars ? 'has-cars' : ''}" onclick="selectCalendarDate('${isoStr}')" title="${hasCars ? stat.totalCars + ' авто' : ''}">
        <span class="cal-cell-num">${d}</span>
        ${hasCars ? `<span class="cal-cell-badge">${stat.totalCars}</span>` : ''}
      </button>
    `;
  }

  // Дни следующего месяца для завершения сетки
  const totalCells = startOffset + daysInMonth;
  const remaining = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
  const nextY = calMonth === 11 ? calYear + 1 : calYear;
  const nextM = calMonth === 11 ? 1 : calMonth + 2;

  for(let d = 1; d <= remaining; d++){
    const isoStr = `${nextY}-${String(nextM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const stat = dailyStatsMap[isoStr];
    const hasCars = stat && stat.totalCars > 0;
    const isSelected = (isoStr === calSelectedDate);
    const isToday = (isoStr === todayISO());

    html += `
      <button type="button" class="cal-cell other-month ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasCars ? 'has-cars' : ''}" onclick="selectCalendarDate('${isoStr}')" title="${hasCars ? stat.totalCars + ' авто' : ''}">
        <span class="cal-cell-num">${d}</span>
        ${hasCars ? `<span class="cal-cell-badge">${stat.totalCars}</span>` : ''}
      </button>
    `;
  }

  gridEl.innerHTML = html;
}

function prevCalMonth(){
  calMonth--;
  if(calMonth < 0){
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
}

function nextCalMonth(){
  calMonth++;
  if(calMonth > 11){
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
}

function goCalToday(){
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  selectCalendarDate(todayISO());
}

function selectCalendarDate(isoStr){
  if(!isoStr) return;
  calSelectedDate = isoStr;
  const [y, m] = isoStr.split('-').map(Number);
  if(!isNaN(y) && !isNaN(m)){
    calYear = y;
    calMonth = m - 1;
  }
  const dateInput = document.getElementById('anDateSelect');
  if(dateInput) dateInput.value = calSelectedDate;

  renderCalendar();
  renderDayDetailCard();
}

/**
 * Отрисовка правой карточки с данными выбранного дня:
 * Общее количество машин + разбивка по боксам + параметры смены
 */
function renderDayDetailCard(){
  const summaryContainer = document.getElementById('anDaySummaryContainer');
  const boxesContainer = document.getElementById('anDayBoxesContainer');
  const legacyContainer = document.getElementById('anDayDetailContainer');

  if(!summaryContainer && !legacyContainer) return;

  const dateVal = calSelectedDate || todayISO();
  const dateInput = document.getElementById('anDateSelect');
  if(dateInput) dateInput.value = dateVal;

  const uniqueReports = getUniqueDailyReports();
  const stat = getDayStats(dateVal, uniqueReports);

  const boxCountNum = Number(settings.boxCount) || 0;
  const dObj = new Date(dateVal + 'T00:00:00');
  const weekdayName = RU_WEEKDAYS[dObj.getDay()] || '';
  const formattedDate = formatRuFullDate(dateVal);

  // Формируем список детальных карточек по каждому боксу с проходом рукава и расходом химии
  let boxesHtml = '';
  for(let b = 1; b <= boxCountNum; b++){
    const bCars = Number(stat.boxCars[b]) || 0;
    const bPct = stat.totalCars > 0 ? Math.round((bCars / stat.totalCars) * 100) : 0;
    const h = (stat.hoses && stat.hoses[b]) || {};
    const c = (stat.consumption && stat.consumption[b]) || {};

    const consEntries = (settings.consumptionItems || []).filter(name => c[name]);

    boxesHtml += `
      <div class="box-detail-card">
        <div class="bd-head">
          <span class="bd-title">Бокс ${b}</span>
          <span class="bd-cars">${bCars} авто (${bPct}%)</span>
        </div>

        <div class="day-box-bar-wrap" style="margin: 6px 0 10px;">
          <div class="day-box-bar-fill" style="width:${bPct}%"></div>
        </div>
        
        <div class="bd-section-label">Проход рукава</div>
        <div class="bd-hoses-row">
          <div><span>Слева</span><b>${esc(h.left) || '—'}</b></div>
          <div><span>Сзади</span><b>${esc(h.back) || '—'}</b></div>
          <div><span>Справа</span><b>${esc(h.right) || '—'}</b></div>
        </div>

        <div class="bd-section-label">Расход химии</div>
        ${consEntries.length ? `
          <div class="bd-cons-list">
            ${consEntries.map(name => `
              <div class="bd-cons-item">
                <span>${esc(name)}</span>
                <b>${esc(c[name])} г.</b>
              </div>`).join('')}
          </div>
        ` : '<div style="font-size:11.5px;color:var(--muted)">Расход не заполнен</div>'}
      </div>
    `;
  }

  // Подсказки об источниках данных
  let sourceHints = '';
  if(stat.isFromInteljetLive){
    sourceHints = `<div style="font-size:11.5px;color:var(--accent);margin-top:10px;display:flex;align-items:center;gap:5px">${getSvg('zap')} Данные о количестве машин получены напрямую из терминала INTELJET Live</div>`;
  } else if(stat.washedEntry && !stat.metricsEntry){
    sourceHints = `<div style="font-size:11px;color:var(--muted);margin-top:10px">Машины учтены из отчёта от ${isoToRuDate(getEntryReportDate(stat.washedEntry))}. Отчёта с замерами за эту дату нет.</div>`;
  } else if(!stat.washedEntry && stat.metricsEntry){
    sourceHints = `<div style="font-size:11px;color:var(--muted);margin-top:10px">Замеры из отчёта за эту дату. Машины за этот день появятся с отчётом следующего дня.</div>`;
  }

  // Остаток химии на дату отчёта
  let stockHtml = '';
  if(stat.stock && stat.stock.length){
    stockHtml = `
      <div class="box-detail-card" style="margin-top:12px">
        <div class="bd-section-label">Остаток химии</div>
        <div class="bd-cons-list">
          ${stat.stock.map(it => {
            let shown = (it.measures || []).filter(m => Number(m.qty) !== 0);
            if(!shown.length) shown = it.measures || [];
            return `<div class="bd-cons-item"><span>${esc(it.name)}</span><b>${shown.map(m => fmt(m.qty) + esc(m.unit) + '.').join(' и ')}</b></div>`;
          }).join('')}
        </div>
      </div>`;
  }

  const summaryHtml = `
    <div class="day-stat-head">
      <div class="day-stat-date">
        ${getSvg('calendar')}
        <span>${formattedDate}${weekdayName ? ', ' + weekdayName : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${stat.author ? `<span style="font-size:12px;color:var(--muted)">Оператор: <b style="color:var(--text)">${esc(stat.author)}</b></span>` : ''}
        ${stat.tdsValue ? `<span style="font-size:12px;color:var(--muted)">TDS: <b style="color:var(--text)">${esc(stat.tdsValue)} ppm</b></span>` : ''}
        <span class="day-stat-badge ${stat.hasData ? 'ok' : 'empty'}">
          ${stat.hasData ? (stat.isFromInteljetLive ? getSvg('zap') + ' Live Terminal' : getSvg('check') + ' Смена зафиксирована') : 'Нет отчёта'}
        </span>
      </div>
    </div>

    <div class="day-total-banner">
      <div class="day-total-label">
        ${getSvg('car')}
        <span>Всего помыто машин за день:</span>
      </div>
      <div class="day-total-num">
        ${stat.totalCars} <span>авто</span>
      </div>
    </div>

  `;

  const boxesCardHtml = `
    <div class="day-boxes-grid">
      ${boxesHtml || '<div class="empty">Боксы не настроены</div>'}
    </div>
    ${stockHtml}
    ${sourceHints}
    ${!stat.hasData ? `
      <div class="empty" style="margin-top:12px;padding:12px">
        Отчёт смены за эту дату не сохранялся. Нажмите на любой день с числовой пометкой в календаре выше.
      </div>
    ` : ''}
  `;

  if(summaryContainer){
    summaryContainer.innerHTML = summaryHtml;
  }
  if(boxesContainer){
    boxesContainer.innerHTML = boxesCardHtml;
  }
  if(legacyContainer){
    legacyContainer.innerHTML = summaryHtml + `
      <div class="day-boxes-title" style="margin-top:14px">
        <span>Состояние боксов и замеры смены</span>
        <small style="font-size:11.5px;color:var(--muted)">машины • рукава • расход</small>
      </div>
    ` + boxesCardHtml;
  }

  if(typeof renderInteljetAnalytics === 'function'){
    renderInteljetAnalytics();
  }
}

/**
 * Прокси-функция для обратной совместимости со старыми вызовами
 */
function renderDateDetailCard(){
  renderDayDetailCard();
}

/**
 * Карточка 1 внизу: Самые загруженные дни недели (рейтинг от большего к меньшему)
 */
function renderBusiestDaysRanking(uniqueReports){
  const el = document.getElementById('busiestDaysRanking');
  if(!el) return;

  const daysMeta = [
    { dayIdx: 1, name: 'Понедельник', short: 'Пн', total: 0, shiftsCount: 0 },
    { dayIdx: 2, name: 'Вторник', short: 'Вт', total: 0, shiftsCount: 0 },
    { dayIdx: 3, name: 'Среда', short: 'Ср', total: 0, shiftsCount: 0 },
    { dayIdx: 4, name: 'Четверг', short: 'Чт', total: 0, shiftsCount: 0 },
    { dayIdx: 5, name: 'Пятница', short: 'Пт', total: 0, shiftsCount: 0 },
    { dayIdx: 6, name: 'Суббота', short: 'Сб', total: 0, shiftsCount: 0 },
    { dayIdx: 0, name: 'Воскресенье', short: 'Вс', total: 0, shiftsCount: 0 }
  ];

  const dailyStatsMap = buildDailyStatsMap(uniqueReports);

  Object.values(dailyStatsMap).forEach(stat => {
    if(!stat || stat.totalCars === 0) return;
    const d = new Date(stat.date + 'T00:00:00');
    if(!isNaN(d.getTime())){
      const idx = d.getDay();
      const item = daysMeta.find(m => m.dayIdx === idx);
      if(item){
        item.total += stat.totalCars;
        item.shiftsCount++;
      }
    }
  });

  // Сортировка от большего к меньшему
  const sorted = [...daysMeta].sort((a, b) => b.total - a.total);
  const maxCars = Math.max(1, ...sorted.map(s => s.total));

  const rankClasses = ['gold', 'silver', 'bronze'];

  el.innerHTML = sorted.map((item, idx) => {
    const pct = Math.round((item.total / maxCars) * 100);
    const avg = item.shiftsCount > 0 ? Math.round(item.total / item.shiftsCount) : 0;
    const rankClass = idx < 3 ? rankClasses[idx] : 'other';

    return `
      <div class="busiest-row">
        <span class="busiest-rank ${rankClass}">${idx + 1}</span>
        <span class="busiest-name">${item.name}</span>
        <div class="busiest-bar-wrap">
          <div class="busiest-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="busiest-val">
          ${item.total} <span class="busiest-sub">авто</span>
          ${item.shiftsCount > 1 ? `<div style="font-size:10px;color:var(--muted);font-weight:600">ср. ${avg}/см</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Карточка 2 внизу: Рекордное число машин за день
 */
function renderRecordDayCard(uniqueReports){
  const el = document.getElementById('recordDayContent');
  if(!el) return;

  const boxCountNum = Number(settings.boxCount) || 0;
  const dailyStatsMap = buildDailyStatsMap(uniqueReports);

  let recordDate = '';
  let recordCars = 0;
  let recordBoxCars = {};
  let recordStats = null;

  Object.values(dailyStatsMap).forEach(stat => {
    if(stat && stat.totalCars > recordCars){
      recordCars = stat.totalCars;
      recordDate = stat.date;
      recordBoxCars = stat.boxCars || {};
      recordStats = stat;
    }
  });

  if(!recordStats || recordCars === 0){
    el.innerHTML = `
      <div class="record-box">
        <div class="empty" style="padding:16px 0">Данных для рекорда пока недостаточно. Сохраните первый отчёт смены.</div>
      </div>
    `;
    return;
  }

  const dObj = new Date(recordDate + 'T00:00:00');
  const weekdayName = RU_WEEKDAYS[dObj.getDay()] || '';
  const formattedDate = formatRuFullDate(recordDate);

  let pillsHtml = '';
  for(let b = 1; b <= boxCountNum; b++){
    pillsHtml += `<span class="record-box-pill">Бокс ${b}: <b>${recordBoxCars[b] || 0}</b></span>`;
  }

  el.innerHTML = `
    <div class="record-box">
      <div class="record-top-meta">
        <span class="record-badge">${getSvg('zap')} Абсолютный максимум</span>
        <span style="font-size:11.5px;color:var(--muted)">за всю историю</span>
      </div>

      <div class="record-val">
        ${recordCars} <span>машин за смену</span>
      </div>

      <div class="record-date-row">
        ${getSvg('calendar')}
        <span>${formattedDate}${weekdayName ? ', ' + weekdayName : ''}</span>
      </div>

      <div class="record-boxes-pills">
        ${pillsHtml}
      </div>

      <button type="button" class="record-jump-btn" onclick="selectCalendarDate('${recordDate}')">
        ${getSvg('play')} Открыть этот день в календаре
      </button>
    </div>
  `;
}

/**
 * Отрисовка списка общей загрузки по боксам за всё время (как на скрине пользователя)
 */
function renderBoxesMetricList(boxCounts, totalCars, boxCountNum){
  const el = document.getElementById('boxesMetricList');
  if(!el) return;

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

  el.innerHTML = boxHtml || '<div class="empty">Нет данных о помытых машинах</div>';
}

/* ===== Аналитика INTELJET Live (только для Таганрогская 134Б) ===== */
function renderInteljetAnalytics(){
  renderHourlyStats();
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
          <div class="inteljet-badge">${getSvg('zap')} INTELJET Live • Таганрогская 134Б</div>
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
  const washedEntry = uniqueReports.find(e => getEntryShiftDate(e) === selectedDate);
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
          <span style="color:var(--success);font-weight:700;display:flex;align-items:center;gap:6px">${getSvg('checkCircle')} Сверка с отчётом оператора: полное совпадение (${totalOrders} авто)</span>
          <span style="color:var(--muted);font-size:11.5px">INTELJET: ${totalOrders} | Оператор: ${operatorCars}</span>
        </div>
      `;
    } else {
      const sign = diffCars > 0 ? `+${diffCars}` : `${diffCars}`;
      reconcileHtml = `
        <div class="ij-reconcile warning">
          <span style="color:var(--warning-text);font-weight:700;display:flex;align-items:center;gap:6px">${getSvg('alert')} Расхождение с отчётом оператора: ${sign} авто</span>
          <span style="color:var(--muted);font-size:11.5px">INTELJET: ${totalOrders} авто | Оператор указал: ${operatorCars} авто</span>
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
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">
        <span style="display:block;font-size:11px;color:var(--muted);font-weight:700">Бокс ${b}</span>
        <b style="font-size:16px;color:var(--text);display:block;margin:2px 0">${st.count} авто</b>
        <span style="font-size:12px;font-weight:800;color:var(--success)">${fmt(st.revenue)} ₽</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="inteljet-card">
      <div class="inteljet-head">
        <div class="inteljet-badge">${getSvg('zap')} INTELJET Live • Таганрогская 134Б</div>
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
          <h4>${getSvg('card')} Способы оплаты</h4>
          <table class="ij-table">
            ${payListHtml}
          </table>
        </div>
        <div class="ij-subblock">
          <h4>${getSvg('shower')} Программы мойки</h4>
          <table class="ij-table">
            ${washListHtml}
          </table>
        </div>
      </div>

      <div class="ij-subblock" style="margin-bottom:12px">
        <h4>${getSvg('box')} Выручка и загрузка по боксам</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
          ${boxCardsHtml}
        </div>
      </div>

      ${reconcileHtml}
    </div>
  `;
}




/* ===== Аналитика: проход рукава и расход химии (данные из ежедневных отчётов) =====
   Слева — таблица по выбранному боксу, справа — динамический график по тем же данным.
   Дата строки = дата отчёта (reportDate), как и остальные замеры. */
const MT_COLORS = ['#5856d6', '#ff5014', '#34c759', '#0a84ff', '#ff9500', '#ff2d92', '#00c7be', '#a2845e'];
const MT_UP = '#ff3b30';    // значение выше нормы
const MT_DOWN = '#0a84ff';  // значение ниже нормы
const MT_HOSE_KEYS = [
  { key: 'left', label: 'Слева' },
  { key: 'back', label: 'Сзади' },
  { key: 'right', label: 'Справа' }
];
const MT_CFG = {
  hose: {
    title: 'Проход рукава', unit: '', thr: 0.25, emptyText: 'Нет данных по проходу рукава. Они появятся после сохранения отчётов.',
    ids: { tabs: 'anHoseTabs', table: 'anHoseTable', controls: 'anHoseControls', chart: 'anHoseChart', alerts: 'anHoseAlerts' }
  },
  cons: {
    title: 'Расход химии', unit: ' г', thr: 0.4, emptyText: 'Нет данных по расходу химии. Они появятся после сохранения отчётов.',
    ids: { tabs: 'anConsTabs', table: 'anConsTable', controls: 'anConsControls', chart: 'anConsChart', alerts: 'anConsAlerts' }
  }
};
const anMetricState = {
  hose: { box: 1, period: 30, mode: 'abs', hidden: {} },
  cons: { box: 1, period: 30, mode: 'abs', hidden: {} }
};
const anMetricCache = { hose: null, cons: null };

function mtNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function mtMedian(arr) {
  const a = arr.filter(x => x != null).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mtFmtVal(v) {
  if (v == null) return '—';
  return String(Number(v.toFixed(3)));
}
function mtShortDate(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  return `${p[2]}.${p[1]}`;
}
function mtLongDate(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  return `${p[2]}.${p[1]}.${p[0].slice(2)}`;
}
function mtPct(dev) {
  const p = Math.round(dev * 100);
  return (p > 0 ? '+' : '') + p + '%';
}

/* Набор данных для выбранного бокса и периода */
function mtBuildDataset(kind) {
  const st = anMetricState[kind];
  const cfg = MT_CFG[kind];
  const boxN = Number(settings.boxCount) || 0;
  if (st.box > boxN || st.box < 1) st.box = 1;

  const reports = getUniqueDailyReports().slice()
    .sort((a, b) => getEntryReportDate(a).localeCompare(getEntryReportDate(b)));

  const srcOf = (e) => {
    const rep = e.report || {};
    return kind === 'hose' ? (rep.hoses && rep.hoses[st.box]) : (rep.consumption && rep.consumption[st.box]);
  };

  let keys;
  if (kind === 'hose') {
    keys = MT_HOSE_KEYS.map(k => k.key);
  } else {
    keys = (settings.consumptionItems || []).slice();
    // Позиции, которые были в старых отчётах, но убраны из настроек, тоже показываем
    reports.forEach(e => {
      const src = srcOf(e);
      if (src) Object.keys(src).forEach(k => { if (!keys.includes(k)) keys.push(k); });
    });
  }
  const labelOf = (k) => kind === 'hose' ? (MT_HOSE_KEYS.find(x => x.key === k) || {}).label || k : k;

  const cutoff = st.period > 0 ? addDaysISO(todayISO(), -(st.period - 1)) : '';
  const rows = [];
  reports.forEach(e => {
    const date = getEntryReportDate(e);
    if (!date || (cutoff && date < cutoff)) return;
    const src = srcOf(e);
    if (!src) return;
    const vals = {};
    let any = false;
    keys.forEach(k => {
      const n = mtNum(src[k]);
      vals[k] = n;
      if (n != null) any = true;
    });
    if (any) rows.push({ date, vals, author: e.author || '' });
  });

  const series = keys.map((k, i) => {
    const values = rows.map(r => r.vals[k]);
    const nonNull = values.filter(v => v != null);
    const median = mtMedian(values);
    const enough = nonNull.length >= 4 && median;
    const devs = values.map(v => (v != null && enough) ? (v - median) / median : null);
    const flags = devs.map(d => (d != null && Math.abs(d) >= cfg.thr) ? (d > 0 ? 'up' : 'down') : null);
    return { key: k, label: labelOf(k), color: MT_COLORS[i % MT_COLORS.length], values, median, enough: Boolean(enough), devs, flags };
  }).filter(s => s.values.some(v => v != null));

  return { rows, series };
}

/* ===== Отрисовка одного блока (таблица + график) ===== */
function renderMetric(kind) {
  const cfg = MT_CFG[kind];
  const st = anMetricState[kind];
  const ids = cfg.ids;
  if (!document.getElementById(ids.table)) return;

  const boxN = Number(settings.boxCount) || 0;
  const tabsEl = document.getElementById(ids.tabs);
  const controlsEl = document.getElementById(ids.controls);
  const tableEl = document.getElementById(ids.table);
  const chartEl = document.getElementById(ids.chart);
  const alertsEl = document.getElementById(ids.alerts);

  if (boxN <= 0) {
    tabsEl.innerHTML = '';
    controlsEl.innerHTML = '';
    alertsEl.innerHTML = '';
    tableEl.innerHTML = '<div class="empty">Боксы не настроены</div>';
    chartEl.innerHTML = '';
    return;
  }

  // Вкладки боксов
  let tabs = '';
  for (let b = 1; b <= boxN; b++) {
    tabs += `<button type="button" class="mt-tab ${b === st.box ? 'active' : ''}" onclick="setMetricBox('${kind}',${b})">Бокс ${b}</button>`;
  }
  tabsEl.innerHTML = tabs;

  const ds = mtBuildDataset(kind);
  anMetricCache[kind] = { ds };

  // Панель управления графиком: период, режим, легенда
  const periods = [[7, '7 дн'], [30, '30 дн'], [90, '90 дн'], [0, 'Всё']];
  const periodHtml = periods.map(([v, t]) =>
    `<button type="button" class="mt-pill ${st.period === v ? 'active' : ''}" onclick="setMetricPeriod('${kind}',${v})">${t}</button>`).join('');
  const modeHtml = [['abs', 'Значения'], ['pct', 'Отклонение, %']].map(([v, t]) =>
    `<button type="button" class="mt-pill ${st.mode === v ? 'active' : ''}" onclick="setMetricMode('${kind}','${v}')">${t}</button>`).join('');
  const legendHtml = ds.series.map((s, i) =>
    `<button type="button" class="mt-chip ${st.hidden[s.key] ? 'off' : ''}" onclick="toggleMetricSeries('${kind}',${i})" title="Показать / скрыть линию">
       <span class="mt-chip-dot" style="background:${s.color}"></span>${esc(s.label)}</button>`).join('');
  controlsEl.innerHTML = `
    <div class="mt-controls-row">
      <div class="mt-pills">${periodHtml}</div>
      <div class="mt-pills">${modeHtml}</div>
    </div>
    ${legendHtml ? `<div class="mt-legend">${legendHtml}</div>` : ''}`;

  if (!ds.rows.length) {
    const hint = st.period > 0 ? ' Попробуйте период «Всё».' : '';
    tableEl.innerHTML = `<div class="empty">${cfg.emptyText}${hint}</div>`;
    chartEl.innerHTML = '';
    alertsEl.innerHTML = '';
    return;
  }

  mtRenderTable(kind, ds);
  mtRenderChart(kind, ds);
  mtRenderAlerts(kind, ds);
}

function mtRenderTable(kind, ds) {
  const el = document.getElementById(MT_CFG[kind].ids.table);
  const head = ds.series.map(s => `<th><span class="mt-th-dot" style="background:${s.color}"></span>${esc(s.label)}</th>`).join('');
  let body = '';
  for (let i = ds.rows.length - 1; i >= 0; i--) {   // свежие даты сверху
    const r = ds.rows[i];
    const cells = ds.series.map(s => {
      const v = s.values[i];
      if (v == null) return '<td class="mt-empty">—</td>';
      const f = s.flags[i];
      if (!f) return `<td>${mtFmtVal(v)}</td>`;
      const title = `${f === 'up' ? 'Выше' : 'Ниже'} нормы: ${mtPct(s.devs[i])} от медианы ${mtFmtVal(s.median)}`;
      return `<td class="mt-${f}" title="${esc(title)}">${mtFmtVal(v)} <span class="mt-arrow">${f === 'up' ? '▲' : '▼'}</span></td>`;
    }).join('');
    body += `<tr data-i="${i}" onmouseenter="mtHoverRow('${kind}',${i})" onmouseleave="mtHoverRow('${kind}',-1)">
      <td class="mt-date">${mtLongDate(r.date)}</td>${cells}</tr>`;
  }
  const foot = ds.series.map(s => `<td>${s.median != null ? mtFmtVal(s.median) : '—'}</td>`).join('');
  el.innerHTML = `
    <div class="mt-table-wrap">
      <table class="mt-table">
        <thead><tr><th>Дата отчёта</th>${head}</tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td class="mt-date">Медиана</td>${foot}</tr></tfoot>
      </table>
    </div>`;
}

/* Список отклонений под графиком */
function mtRenderAlerts(kind, ds) {
  const cfg = MT_CFG[kind];
  const el = document.getElementById(cfg.ids.alerts);
  const thrPct = Math.round(cfg.thr * 100);
  const items = [];
  ds.series.forEach(s => {
    s.flags.forEach((f, i) => { if (f) items.push({ i, date: ds.rows[i].date, s, f, dev: s.devs[i], v: s.values[i] }); });
  });
  const anyEnough = ds.series.some(s => s.enough);
  if (!anyEnough) {
    el.innerHTML = `<div class="mt-alert neutral">Для оценки отклонений нужно минимум 4 отчёта с данными в выбранном периоде.</div>`;
    return;
  }
  if (!items.length) {
    el.innerHTML = `<div class="mt-alert ok">Отклонений не обнаружено (порог ±${thrPct}% от медианы)</div>`;
    return;
  }
  items.sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.dev) - Math.abs(a.dev));
  const shown = items.slice(0, 6).map(it => `
    <div class="mt-alert-row" onclick="mtHoverRow('${kind}',${it.i})">
      <span class="mt-alert-badge ${it.f}">${it.f === 'up' ? '▲' : '▼'} ${mtPct(it.dev)}</span>
      <span class="mt-alert-text"><b>${mtShortDate(it.date)}</b> · ${esc(it.s.label)}: ${mtFmtVal(it.v)}${cfg.unit} <small>(норма ${mtFmtVal(it.s.median)})</small></span>
    </div>`).join('');
  const more = items.length > 6 ? `<div class="mt-alert-more">и ещё ${items.length - 6} в выбранном периоде</div>` : '';
  el.innerHTML = `<div class="mt-alert warn"><div class="mt-alert-title">Отклонения от нормы (порог ±${thrPct}% от медианы): ${items.length}</div>${shown}${more}</div>`;
}

/* ===== График (SVG, без внешних библиотек) ===== */
function mtRenderChart(kind, ds) {
  const cfg = MT_CFG[kind];
  const st = anMetricState[kind];
  const el = document.getElementById(cfg.ids.chart);
  if (!el) return;

  const vis = ds.series.filter(s => !st.hidden[s.key]);
  if (!vis.length) {
    el.innerHTML = '<div class="empty">Все линии скрыты — включите нужные в легенде выше</div>';
    anMetricCache[kind].geo = null;
    return;
  }

  const W = Math.max(300, el.clientWidth || 520);
  const H = 280, L = 46, R = 14, T = 14, B = 32;
  const pw = W - L - R, ph = H - T - B;
  const pct = st.mode === 'pct';
  const thr = cfg.thr;

  const val = (s, i) => {
    const v = s.values[i];
    if (v == null) return null;
    if (!pct) return v;
    return s.median ? (v - s.median) / s.median * 100 : null;
  };

  // Диапазон оси Y
  let lo = Infinity, hi = -Infinity;
  vis.forEach(s => s.values.forEach((_, i) => {
    const v = val(s, i);
    if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }));
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (pct) {
    lo = Math.min(lo, -thr * 100 * 1.25);
    hi = Math.max(hi, thr * 100 * 1.25);
  } else if (vis.length === 1 && vis[0].median) {
    lo = Math.min(lo, vis[0].median * (1 - thr));
    hi = Math.max(hi, vis[0].median * (1 + thr));
  }
  const allNonNeg = !pct && lo >= 0;
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
  lo -= pad; hi += pad;
  if (allNonNeg && lo < 0) lo = 0;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;

  // Ось X — по календарю (пропущенные дни видны как разрывы)
  const t = (iso) => Date.parse(iso + 'T00:00:00');
  const t0 = t(ds.rows[0].date), t1 = t(ds.rows[ds.rows.length - 1].date);
  const xIn = 8, xw = pw - xIn * 2;
  const xs = ds.rows.map(r => ds.rows.length === 1 || t1 === t0 ? L + pw / 2 : L + xIn + (t(r.date) - t0) / (t1 - t0) * xw);

  const range = hi - lo;
  const tickFmt = (v) => pct ? `${Math.round(v)}%` : (range < 2 ? v.toFixed(2) : range < 20 ? v.toFixed(1) : String(Math.round(v)));

  let svg = '';
  // Сетка и подписи оси Y
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4;
    const yy = y(v);
    svg += `<line class="mt-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="mt-axis" x="${L - 6}" y="${yy + 3.5}" text-anchor="end">${tickFmt(v)}</text>`;
  }
  // Зона нормы и линии медианы
  if (pct) {
    svg += `<rect class="mt-band" x="${L}" y="${y(thr * 100)}" width="${pw}" height="${Math.max(0, y(-thr * 100) - y(thr * 100))}"/>`;
    svg += `<line class="mt-zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  } else if (vis.length === 1 && vis[0].median) {
    const m = vis[0].median;
    svg += `<rect class="mt-band" x="${L}" y="${y(m * (1 + thr))}" width="${pw}" height="${Math.max(0, y(m * (1 - thr)) - y(m * (1 + thr)))}"/>`;
    svg += `<line class="mt-zero" x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}"/>`;
  } else {
    vis.forEach(s => {
      if (s.median != null) svg += `<line class="mt-median" x1="${L}" x2="${W - R}" y1="${y(s.median)}" y2="${y(s.median)}" style="stroke:${s.color}"/>`;
    });
  }
  // Подписи дат
  const maxLabels = Math.max(2, Math.floor(pw / 62));
  const n = ds.rows.length;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  let lastLabelX = -999;
  for (let i = 0; i < n; i += step) {
    if (xs[i] - lastLabelX < 46) continue;
    lastLabelX = xs[i];
    svg += `<text class="mt-axis" x="${xs[i]}" y="${H - 10}" text-anchor="middle">${mtShortDate(ds.rows[i].date)}</text>`;
  }
  // Направляющая (двигается при наведении)
  svg += `<line id="mtGuide_${kind}" class="mt-guide" x1="0" x2="0" y1="${T}" y2="${T + ph}" style="display:none"/>`;
  // Линии
  vis.forEach(s => {
    let d = '', pen = false;
    for (let i = 0; i < n; i++) {
      const v = val(s, i);
      if (v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${xs[i].toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    }
    if (d) svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  // Точки (отклонения — крупные, красные/синие)
  vis.forEach(s => {
    for (let i = 0; i < n; i++) {
      const v = val(s, i);
      if (v == null) continue;
      const f = s.flags[i];
      if (f) {
        svg += `<circle cx="${xs[i].toFixed(1)}" cy="${y(v).toFixed(1)}" r="5.5" fill="${f === 'up' ? MT_UP : MT_DOWN}" class="mt-dot-flag"/>`;
      } else {
        svg += `<circle cx="${xs[i].toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${s.color}" class="mt-dot"/>`;
      }
    }
  });
  // Прозрачный слой для мыши / касаний
  svg += `<rect id="mtHit_${kind}" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent" style="touch-action:pan-y"/>`;

  el.innerHTML = `<div class="mt-chart-wrap"><svg class="mt-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(cfg.title)}">${svg}</svg><div class="mt-tip" id="mtTip_${kind}" style="display:none"></div></div>`;

  anMetricCache[kind].geo = { W, H, L, R, T, ph, xs, vis, pct };

  const hit = document.getElementById(`mtHit_${kind}`);
  if (hit) {
    const onMove = (ev) => {
      const svgEl = hit.ownerSVGElement;
      const rect = svgEl.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (W / rect.width);
      let best = 0, bd = Infinity;
      xs.forEach((x, i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } });
      mtShowAt(kind, best, true);
    };
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerdown', onMove);
    hit.addEventListener('pointerleave', () => mtHoverRow(kind, -1));
  }
}

/* Подсветка точки: направляющая + подсказка + строка таблицы */
function mtShowAt(kind, idx, fromChart) {
  const cache = anMetricCache[kind];
  if (!cache || !cache.geo) return;
  const { ds, geo } = cache;
  const guide = document.getElementById(`mtGuide_${kind}`);
  const tip = document.getElementById(`mtTip_${kind}`);
  if (!guide || !tip) return;

  const x = geo.xs[idx];
  guide.setAttribute('x1', x);
  guide.setAttribute('x2', x);
  guide.style.display = '';

  const cfg = MT_CFG[kind];
  const lines = geo.vis.map(s => {
    const v = s.values[idx];
    if (v == null) return '';
    const f = s.flags[idx];
    const badge = f ? ` <span class="mt-tip-badge ${f}">${f === 'up' ? '▲' : '▼'} ${mtPct(s.devs[idx])}</span>` : '';
    return `<div class="mt-tip-row"><span class="mt-chip-dot" style="background:${s.color}"></span>${esc(s.label)}: <b>${mtFmtVal(v)}${cfg.unit}</b>${badge}</div>`;
  }).join('');
  tip.innerHTML = `<div class="mt-tip-date">${isoToRuDate(ds.rows[idx].date)}</div>${lines}`;
  tip.style.display = 'block';

  const wrap = tip.parentElement;
  const wrapW = wrap.clientWidth || geo.W;
  const xpx = x * (wrapW / geo.W);
  const tipW = tip.offsetWidth || 160;
  let left = xpx + 12;
  if (left + tipW > wrapW) left = Math.max(0, xpx - tipW - 12);
  tip.style.left = left + 'px';
  tip.style.top = '8px';

  // Подсветка строки таблицы
  const tableEl = document.getElementById(cfg.ids.table);
  if (tableEl) {
    tableEl.querySelectorAll('tr.mt-row-hl').forEach(r => r.classList.remove('mt-row-hl'));
    const row = tableEl.querySelector(`tr[data-i="${idx}"]`);
    if (row) {
      row.classList.add('mt-row-hl');
      if (fromChart) {
        const wrapT = row.closest('.mt-table-wrap');
        if (wrapT) {
          const rt = row.offsetTop, h = row.offsetHeight;
          if (rt < wrapT.scrollTop + 30 || rt + h > wrapT.scrollTop + wrapT.clientHeight) wrapT.scrollTop = Math.max(0, rt - 60);
        }
      }
    }
  }
}

/* Наведение на строку таблицы (idx = -1 — снять подсветку) */
function mtHoverRow(kind, idx) {
  const cfg = MT_CFG[kind];
  if (idx < 0) {
    const guide = document.getElementById(`mtGuide_${kind}`);
    const tip = document.getElementById(`mtTip_${kind}`);
    if (guide) guide.style.display = 'none';
    if (tip) tip.style.display = 'none';
    const tableEl = document.getElementById(cfg.ids.table);
    if (tableEl) tableEl.querySelectorAll('tr.mt-row-hl').forEach(r => r.classList.remove('mt-row-hl'));
    return;
  }
  mtShowAt(kind, idx, false);
}

/* Переключатели */
function setMetricBox(kind, b) { anMetricState[kind].box = b; renderMetric(kind); }
function setMetricPeriod(kind, p) { anMetricState[kind].period = p; renderMetric(kind); }
function setMetricMode(kind, m) { anMetricState[kind].mode = m; renderMetric(kind); }
function toggleMetricSeries(kind, i) {
  const cache = anMetricCache[kind];
  if (!cache || !cache.ds.series[i]) return;
  const key = cache.ds.series[i].key;
  anMetricState[kind].hidden[key] = !anMetricState[kind].hidden[key];
  renderMetric(kind);
}

function renderMetricAnalytics() {
  renderMetric('hose');
  renderMetric('cons');
}

// График подгоняется под ширину карточки при изменении размера окна
(function () {
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const view = document.getElementById('viewAnalytics');
      if (view && view.classList.contains('active') && typeof isCurrentSuperAdmin === 'function' && isCurrentSuperAdmin()) {
        renderMetricAnalytics();
      }
    }, 200);
  });
})();


/* ===== Аналитика: количество моек по часам (данные терминала INTELJET Live) ===== */
let hourlyMode = 'day'; // 'day' — выбранная дата, 'week' — среднее по всем таким же дням недели
const RU_WD_PLURAL = ['воскресенья','понедельники','вторники','среды','четверги','пятницы','субботы'];

/* Достаём час мойки из заказа: поддерживает "14:35", ISO-строки и unix-время (сек/мс) */
function ijOrderHour(o){
  const keys = ['time','startTime','start','datetime','dateTime','timestamp','ts','createdAt','washTime','dt','hour'];
  for(const k of keys){
    const v = o[k];
    if(v == null || v === '') continue;
    if(k === 'hour' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 24) return Math.floor(Number(v));
    if(typeof v === 'number' || /^\d{9,}$/.test(String(v))){
      const n = Number(v);
      const d = new Date(n < 1e12 ? n * 1000 : n);
      if(!isNaN(d.getTime())) return d.getHours();
      continue;
    }
    const str = String(v);
    if(/\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(str)){
      const d = new Date(str);
      if(!isNaN(d.getTime())) return d.getHours();
    }
    const m = str.match(/(\d{1,2}):(\d{2})/);
    if(m && Number(m[1]) < 24) return Number(m[1]);
  }
  return null;
}

function setHourlyMode(m){ hourlyMode = m; renderHourlyStats(); }

function renderHourlyStats(){
  const box = document.getElementById('hourlyStatsContainer');
  if(!box) return;
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()){
    box.style.display = 'none'; box.innerHTML = ''; return;
  }
  box.style.display = 'block';

  const date = calSelectedDate || todayISO();
  const wd = new Date(date + 'T00:00:00').getDay();
  const all = Object.values(typeof inteljetOrdersCache !== 'undefined' ? inteljetOrdersCache : {}).filter(o => o && o.date);
  const isWeek = hourlyMode === 'week';
  const orders = isWeek ? all.filter(o => new Date(o.date + 'T00:00:00').getDay() === wd) : all.filter(o => o.date === date);
  const daysCnt = Math.max(1, new Set(orders.map(o => o.date)).size);
  const div = isWeek ? daysCnt : 1;

  const counts = Array(24).fill(0), rev = Array(24).fill(0);
  let noTime = 0;
  orders.forEach(o => {
    const h = ijOrderHour(o);
    if(h == null){ noTime++; return; }
    counts[h]++; rev[h] += Number(o.amount) || 0;
  });
  const vals = counts.map(c => Math.round(c / div * 10) / 10);

  const pills = [['day', 'Выбранный день'], ['week', 'Все ' + RU_WD_PLURAL[wd]]].map(([v, t]) =>
    `<button type="button" class="mt-pill ${hourlyMode === v ? 'active' : ''}" onclick="setHourlyMode('${v}')">${t}</button>`).join('');
  const head = `
    <div class="inteljet-head">
      <div class="inteljet-badge">${getSvg('zap')} Мойки по часам</div>
      <span style="font-size:12px;color:var(--muted)">${isWeek ? 'Среднее за день по ' + daysCnt + ' дн. · ' + RU_WEEKDAYS[wd] : '<b>' + isoToRuDate(date) + '</b>, ' + RU_WEEKDAYS[wd]}</span>
    </div>
    <div class="mt-pills" style="margin-bottom:12px">${pills}</div>`;

  const withTime = orders.length - noTime;
  if(!orders.length){
    box.innerHTML = `<div class="inteljet-card">${head}<div class="empty" style="padding:14px 0">Нет заказов из терминала за ${isWeek ? 'этот день недели' : 'выбранную дату'}.</div></div>`;
    return;
  }
  if(!withTime){
    const keys = Object.keys(orders[0]).join(', ');
    box.innerHTML = `<div class="inteljet-card">${head}<div class="empty" style="padding:14px 0">В заказах не найдено время мойки. Поля заказа: <code>${esc(keys)}</code></div></div>`;
    return;
  }

  let lo = 23, hi = 0, max = 0, peak = 0;
  counts.forEach((c, h) => { if(c > 0){ lo = Math.min(lo, h); hi = Math.max(hi, h); } if(vals[h] > max){ max = vals[h]; peak = h; } });
  const total = isWeek ? Math.round(withTime / daysCnt * 10) / 10 : withTime;

  let cols = '';
  for(let h = lo; h <= hi; h++){
    const v = vals[h];
    const pct = max > 0 ? Math.round(v / max * 100) : 0;
    const tip = `${String(h).padStart(2,'0')}:00–${String(h).padStart(2,'0')}:59 · ${v} авто · ${fmt(Math.round(rev[h] / div))} ₽`;
    cols += `<div class="hr-col ${h === peak ? 'peak' : ''}" title="${tip}">
      <span class="hr-val">${v || ''}</span>
      <div class="hr-bar-wrap"><div class="hr-bar" style="height:${v > 0 ? Math.max(pct, 3) : 0}%"></div></div>
      <span class="hr-lbl">${h}</span>
    </div>`;
  }

  box.innerHTML = `<div class="inteljet-card">${head}
    <div class="hr-chart">${cols}</div>
    <div class="hr-summary">
      <span>Всего: <b>${total} авто</b>${isWeek ? ' в день' : ''}</span>
      <span>Пик: <b>${String(peak).padStart(2,'0')}:00–${String(peak + 1).padStart(2,'0')}:00</b> (${max} авто)</span>
      ${noTime ? `<span style="color:var(--muted)">без времени: ${noTime}</span>` : ''}
    </div>
  </div>`;
}
