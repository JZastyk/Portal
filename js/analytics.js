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


