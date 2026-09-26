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
    if (!h || !h.date) return;
    // Всегда берём запись с самой свежей меткой времени time
    if (!map[h.date] || new Date(h.time).getTime() >= new Date(map[h.date].time).getTime()) {
      map[h.date] = h;
    }
  });
  return Object.values(map).sort((a,b) => b.date.localeCompare(a.date));
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
  if(!dateInput.value || !uniqueReports.some(r => r.date === dateInput.value)){
    dateInput.value = uniqueReports.length ? uniqueReports[0].date : (currentShiftDate || yesterdayISO());
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
  const entry = uniqueReports.find(e => e.date === dateVal);

  if(!entry){
    const dStr = new Date(dateVal + 'T00:00:00').toLocaleDateString('ru-RU');
    container.innerHTML = `<div class="empty">За ${dStr} сохранённый отчёт не найден</div>`;
    return;
  }

  const rep = entry.report || {};
  const washed = rep.washed || {};
  const hoses = rep.hoses || {};
  const consumption = rep.consumption || {};
  const boxCountNum = Number(settings.boxCount) || 0;

  let dayCarsTotal = 0;
  for (let b = 1; b <= boxCountNum; b++) {
    dayCarsTotal += Number(washed[b]) || 0;
  }

  const formattedDate = new Date(entry.date + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});

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

  container.innerHTML = `
    <div class="day-summary-strip">
      <div class="day-summary-info">
        <b>${formattedDate}</b><br>
        Ответственный: <span>${esc(entry.author || 'Не указан')}</span> • TDS: <span>${esc(rep.tds || '—')}</span>
      </div>
      <div class="day-summary-stat">
        Помыто за день
        <strong>${dayCarsTotal} машин</strong>
      </div>
    </div>
    <div class="day-boxes-grid">
      ${boxesHtml || '<div class="empty">Боксы не настроены</div>'}
    </div>
  `;
}

