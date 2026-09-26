/* ===== Вкладка «Обзор сети» (только для суперадминистратора) ===== */
/* ===== Обзор сети (Суперадминистратор) ===== */
function initSuperAdminView(){
  const isSuper = isCurrentSuperAdmin();
  document.getElementById('tabBtnAnalytics').style.display = isSuper ? 'flex' : 'none';
  document.getElementById('tabBtnNetwork').style.display = isSuper ? 'flex' : 'none';

  if(!isSuper){
    const activeTab = document.querySelector('.tab-btn.active');
    if(activeTab && (activeTab.id === 'tabBtnAnalytics' || activeTab.id === 'tabBtnNetwork')){
      switchTab('inventory');
    }
  }

  if(isSuper){
    const sel = document.getElementById('networkLocSelect');
    sel.innerHTML = '<option value="">Выберите автомойку сети...</option>' +
      Object.entries(locationsCache).filter(([id]) => id !== locId).map(([id,l]) => `<option value="${id}">${esc(l.name)}</option>`).join('');
  }
}

function onNetworkLocChange(){
  const otherId=document.getElementById('networkLocSelect').value;
  const cont=document.getElementById('networkContent');
  if(!otherId){cont.innerHTML='<div class="empty">Выберите автомойку из списка выше</div>';return}

  cont.innerHTML='<div class="empty">Загрузка данных автомойки...</div>';
  Promise.all([
    firebase.database().ref('locations/'+otherId+'/inventory').once('value'),
    firebase.database().ref('locations/'+otherId+'/dailyReport').once('value'),
    firebase.database().ref('locations/'+otherId+'/settings').once('value')
  ]).then(([invS, repS, setS])=>{
    const otherData=sanitizeData(invS.val());
    const otherSettings=sanitizeSettings(setS.val());
    const otherReport=sanitizeReport(repS.val());

    let html=`<div style="display:flex;flex-direction:column;gap:14px">
      <div class="card">
        <h3 style="margin:0 0 10px;font-size:16px">Остатки химии на складе</h3>
        <div class="grid">${otherData.items.length?otherData.items.map(x=>`
          <div class="card">
            <b>${esc(x.name)}</b>
            <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${x.inReport?'✓ В отчёте дня':''}</div>
            ${x.measures.map(m=>`<div style="font-size:13px;display:flex;justify-content:space-between"><span>${esc(m.unit)}:</span><b>${fmt(m.qty)}</b></div>`).join('')}
          </div>`).join(''):'<div class="empty">Химия не добавлена</div>'}
        </div>
      </div>
      <div class="card">
        <h3 style="margin:0 0 10px;font-size:16px">Текущий отчёт дня</h3>
        <div class="form-row-inline">
          <div><label>Ответственный</label><input disabled value="${esc(otherReport.author||'Не указан')}"></div>
          <div><label>TDS</label><input disabled value="${esc(otherReport.tds||'—')}"></div>
        </div>
        <label>Помыто машин</label>
        <div class="washed-grid" style="margin-bottom:12px">
          ${range(otherSettings.boxCount).map(b=>`<div><span>Бокс ${b}</span><input disabled value="${otherReport.washed[b]||0}"></div>`).join('')}
        </div>
        <label>Предпросмотр сводки</label>
        <textarea class="report-preview" disabled rows="9">${buildDailyReportTextCustom(otherReport, otherSettings, otherData.items)}</textarea>
      </div>
    </div>`;
    cont.innerHTML=html;
  }).catch(()=>{
    cont.innerHTML='<div class="empty">Не удалось загрузить данные выбранной автомойки</div>';
  });
}

