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

  if(!washedEntry && !metricsEntry){
    const dStr = new Date(dateVal + 'T00:00:00').toLocaleDateString('ru-RU');
    container.innerHTML = `<div class="empty">За ${dStr} сохранённый отчёт не найден</div>`;
    return;
  }

  const boxCountNum = Number(settings.boxCount) || 0;
  const formattedDate = new Date(dateVal + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});

  // --- Данные о машинах (из washedEntry) ---
  const washedRep = (washedEntry && washedEntry.report) || {};
  const washed = washedRep.washed || {};
  let dayCarsTotal = 0;
  for (let b = 1; b <= boxCountNum; b++) {
    dayCarsTotal += Number(washed[b]) || 0;
  }

  // --- Данные замеров (из metricsEntry) ---
  const metricsRep = (metricsEntry && metricsEntry.report) || {};
  const hoses = metricsRep.hoses || {};
  const consumption = metricsRep.consumption || {};
  const tdsValue = metricsRep.tds || '—';
  const metricsAuthor = (metricsEntry && metricsEntry.author) || (washedEntry && washedEntry.author) || 'Не указан';

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
  if(washedEntry && metricsEntry && washedEntry !== metricsEntry){
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
        <strong>${dayCarsTotal} машин</strong>
      </div>
    </div>
    <div class="day-boxes-grid">
      ${boxesHtml || '<div class="empty">Боксы не настроены</div>'}
    </div>
    ${sourceHints}
  `;
}

