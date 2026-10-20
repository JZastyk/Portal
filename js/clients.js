/* ===== Клиенты и приложение: номера телефонов из терминала + отметки «воронки» (только суперадмин) =====
   Откуда берутся номера: расширение INTELJET Sync кладёт телефон в заказ (поле phone) — карточка собирает из заказов
   список уникальных номеров. Дата в строке — когда номер впервые появился в терминале.
   Отметки (зелёный / жёлтый / красный) ставит оператор и хранятся отдельно: locations/<id>/client_marks/<номер>,
   поэтому повторная синхронизация заказов их не затирает. */

const CL_PAGE = 10;
const CL_RANK = { green: 0, yellow: 1, red: 2, none: 3 };
const CL_ST = {
  green:  { name: 'Согласились', hint: 'Согласился установить приложение и купить абонемент, либо приложение уже установлено' },
  yellow: { name: 'Презентация', hint: 'Проведена презентация приложения и абонемента' },
  red:    { name: 'Отказались',  hint: 'Отказался' },
  none:   { name: 'Без отметки', hint: 'Отметки пока нет' }
};

let clientMarks = {};        // номер (11 цифр, 7XXXXXXXXXX) -> { s: 'green'|'yellow'|'red', t: время отметки }
let clientMarksRef = null;
let clState = { page: 1, sort: 'date', dir: 'desc', filter: '' };
let _clMemo = { src: null, list: [] };

/* ---------- Номера ---------- */
function clNormPhone(v){
  if(v == null) return '';
  let d = String(v).replace(/\D/g, '');
  if(d.length === 11 && (d[0] === '7' || d[0] === '8')) return '7' + d.slice(1);
  if(d.length === 10) return '7' + d;
  return '';
}
function clFmtPhone(p){
  return `+7 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9, 11)}`;
}

/* ---------- Данные ---------- */
function clStatusOf(p){
  const m = clientMarks[p];
  const s = m && typeof m === 'object' ? m.s : m;
  return (s === 'green' || s === 'yellow' || s === 'red') ? s : 'none';
}

/* Уникальные номера из заказов терминала; пересобираем только когда пришёл новый снимок заказов */
function clBuildClients(){
  const src = (typeof inteljetOrdersCache !== 'undefined' && inteljetOrdersCache) || {};
  if(_clMemo.src === src) return _clMemo.list;
  const by = {};
  Object.values(src).forEach(o => {
    if(!o || !o.phone || !o.date) return;
    const p = clNormPhone(o.phone); if(!p) return;
    const dt = o.date + ' ' + String(o.time || '00:00').padStart(5, '0');
    const c = by[p] || (by[p] = { phone: p, first: dt, last: dt, visits: 0 });
    c.visits++;
    if(dt < c.first) c.first = dt;
    if(dt > c.last) c.last = dt;
  });
  const list = Object.values(by);
  _clMemo = { src, list };
  return list;
}

function clSorted(list){
  const k = clState.dir === 'asc' ? 1 : -1;
  const byDate = (a, b) => a.first.localeCompare(b.first) || a.phone.localeCompare(b.phone);
  const cmp = clState.sort === 'phone' ? (a, b) => a.phone.localeCompare(b.phone)
    : clState.sort === 'status' ? (a, b) => (CL_RANK[clStatusOf(a.phone)] - CL_RANK[clStatusOf(b.phone)]) || byDate(b, a)
    : byDate;
  return list.slice().sort((a, b) => k * cmp(a, b));
}

/* ---------- Действия ---------- */
function clPersistMarks(){
  try{ localStorage.setItem('client_marks_' + locId, JSON.stringify(clientMarks)); }catch(e){}
}

/* Повторное нажатие на уже выбранный индикатор снимает отметку */
function clSetStatus(phone, status){
  if(!isCurrentSuperAdmin() || !clNormPhone(phone) || !CL_ST[status]) return;
  const next = clStatusOf(phone) === status ? 'none' : status;
  if(next === 'none') delete clientMarks[phone]; else clientMarks[phone] = { s: next, t: Date.now() };
  clPersistMarks();
  renderClients();
  if(!clientMarksRef){ toast('Отметка сохранена только на этом устройстве'); return; }
  const op = next === 'none' ? clientMarksRef.child(phone).remove() : clientMarksRef.child(phone).set(clientMarks[phone]);
  op.catch(() => toast('Отметка сохранена только на этом устройстве — нет доступа к базе'));
}

function clSetFilter(f){ clState.filter = (clState.filter === f ? '' : f); clState.page = 1; renderClients(); }
function clSetSort(key){
  if(clState.sort === key) clState.dir = clState.dir === 'asc' ? 'desc' : 'asc';
  else { clState.sort = key; clState.dir = key === 'date' ? 'desc' : 'asc'; }
  clState.page = 1; renderClients();
}
function clGoPage(p){ clState.page = p; renderClients(); }

/* Подписка на отметки (вызывается из app.js вместе с остальной синхронизацией терминала) */
function initClientsSync(){
  if(!isCurrentSuperAdmin()) return;
  try{ clientMarks = JSON.parse(localStorage.getItem('client_marks_' + locId) || '{}') || {}; }catch(e){ clientMarks = {}; }
  clientMarksRef = firebase.database().ref('locations/' + locId + '/client_marks');
  clientMarksRef.on('value', snap => {
    clientMarks = snap.val() || {};
    clPersistMarks();
    renderClients();
  }, err => console.warn('Отметки клиентов не прочитаны:', err && err.message));
}

/* ---------- Вид ---------- */
function clCss(){
  if(document.getElementById('clStyle')) return;
  const st = document.createElement('style'); st.id = 'clStyle';
  st.textContent = `
  .cl-sub{font-size:12px;color:var(--muted)}
  .cl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin-bottom:14px}
  .cl-stat{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}
  .cl-stat b{font-size:20px;line-height:1.1}
  .cl-stat span{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px}
  .cl-stat.on{border-color:var(--accent);background:var(--accent-soft)}
  .cl-stat .cl-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
  .cl-dot.green{background:var(--success)}.cl-dot.yellow{background:var(--warning)}.cl-dot.red{background:var(--danger)}.cl-dot.none{background:var(--muted-light,#b5b5ba)}
  .cl-list{display:flex;flex-direction:column;gap:6px}
  .cl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card)}
  .cl-client{min-width:0;display:flex;flex-direction:column;gap:2px}
  .cl-phone{font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
  .cl-client small{font-size:11.5px;color:var(--muted)}
  .cl-marks{display:flex;gap:10px;flex:none}
  .cl-mark{width:28px;height:28px;border-radius:50%;border:2px solid;padding:0;cursor:pointer;background:transparent;opacity:.55;transition:all .15s}
  .cl-mark:hover{opacity:1;transform:scale(1.08)}
  .cl-mark.green{border-color:var(--success)}.cl-mark.yellow{border-color:var(--warning)}.cl-mark.red{border-color:var(--danger)}
  .cl-mark.green.on{background:var(--success);box-shadow:0 0 0 3px var(--success-soft)}
  .cl-mark.yellow.on{background:var(--warning);box-shadow:0 0 0 3px var(--warning-soft)}
  .cl-mark.red.on{background:var(--danger);box-shadow:0 0 0 3px var(--danger-soft)}
  .cl-mark.on{opacity:1}
  .cl-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--muted)}
  .cl-pager .cl-pg{display:inline-flex;gap:4px;align-items:center}
  .cl-pager button{border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:8px;padding:5px 11px;font:inherit;font-weight:700;cursor:pointer}
  .cl-pager button:disabled{opacity:.4;cursor:default}
  .cl-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:12px;font-size:11.5px;color:var(--muted)}
  .cl-legend span{display:flex;align-items:center;gap:6px}
  `;
  document.head.appendChild(st);
}

function renderClients(){
  const box = document.getElementById('clientsContainer');
  if(!box) return;
  if(typeof isCurrentSuperAdmin !== 'function' || !isCurrentSuperAdmin()){ box.style.display = 'none'; box.innerHTML = ''; return; }
  clCss();
  box.style.display = 'block';

  const all = clBuildClients();
  const cnt = { green: 0, yellow: 0, red: 0, none: 0 };
  all.forEach(c => cnt[clStatusOf(c.phone)]++);

  const stat = (key, label, n, dot) => `<button type="button" class="cl-stat ${clState.filter === key ? 'on' : ''}" onclick="clSetFilter('${key}')" title="Показать только: ${label}">
      <b>${n}</b><span>${dot ? `<i class="cl-dot ${dot}"></i>` : ''}${label}</span></button>`;
  const stats = `<div class="cl-stats">
      <button type="button" class="cl-stat ${clState.filter === '' ? 'on' : ''}" onclick="clSetFilter('')" title="Показать всех"><b>${all.length}</b><span>Всего номеров</span></button>
      ${stat('green', CL_ST.green.name, cnt.green, 'green')}${stat('yellow', CL_ST.yellow.name, cnt.yellow, 'yellow')}${stat('red', CL_ST.red.name, cnt.red, 'red')}${stat('none', CL_ST.none.name, cnt.none, 'none')}
    </div>`;

  const head = `<div class="inteljet-head">
      <div class="inteljet-badge">${getSvg('car')} Клиенты и приложение</div>
      <span class="cl-sub">номера из терминала INTELJET</span>
    </div>`;

  if(!all.length){
    box.innerHTML = `<div class="inteljet-card cl-card">${head}${stats}
      <div class="empty" style="padding:14px 0">Номеров пока нет.<br>
      <small style="color:var(--muted);display:block;margin-top:6px">Они появятся, когда расширение <b>INTELJET Sync</b> (версия 1.1 и новее) начнёт передавать телефон клиента вместе с заказом.</small></div></div>`;
    return;
  }

  const filtered = clState.filter ? all.filter(c => clStatusOf(c.phone) === clState.filter) : all;
  const rows = clSorted(filtered);
  const pages = Math.max(1, Math.ceil(rows.length / CL_PAGE));
  if(clState.page > pages) clState.page = pages;
  if(clState.page < 1) clState.page = 1;
  const from = (clState.page - 1) * CL_PAGE;
  const slice = rows.slice(from, from + CL_PAGE);

  const arrow = key => clState.sort === key ? (clState.dir === 'asc' ? ' ↑' : ' ↓') : '';
  const pill = (key, label, title) => `<button type="button" class="mt-pill ${clState.sort === key ? 'active' : ''}" title="${title}" onclick="clSetSort('${key}')">${label}${arrow(key)}</button>`;
  const sortBar = `<div class="mt-controls-row" style="margin-bottom:10px">
      <div class="mt-pills" title="Сортировка: нажмите ещё раз, чтобы развернуть порядок">
        ${pill('date', 'Дата', 'По дате: ↓ — новые сверху')}${pill('phone', 'Номер', 'По номеру телефона')}${pill('status', 'Статус', 'По статусу: ↑ — зелёные, жёлтые, красные, без отметки')}
      </div>
    </div>`;

  const list = slice.length ? slice.map(c => {
    const cur = clStatusOf(c.phone);
    const when = isoToRuDate(c.first.slice(0, 10)) + ' ' + c.first.slice(11);
    const sub = when + (c.visits > 1 ? ` · визитов: ${c.visits}` : '');
    const dots = ['green', 'yellow', 'red'].map(s =>
      `<button type="button" class="cl-mark ${s} ${cur === s ? 'on' : ''}" aria-pressed="${cur === s}" aria-label="${CL_ST[s].name}" title="${CL_ST[s].hint}" onclick="clSetStatus('${c.phone}','${s}')"></button>`).join('');
    return `<div class="cl-row"><div class="cl-client"><b class="cl-phone">${clFmtPhone(c.phone)}</b><small>${sub}</small></div><div class="cl-marks">${dots}</div></div>`;
  }).join('') : '<div class="empty" style="padding:14px 0">Нет номеров с таким статусом.</div>';

  const pager = `<div class="cl-pager">
      <span>${rows.length ? `${from + 1}–${from + slice.length} из ${rows.length}` : '0 из 0'}</span>
      <span class="cl-pg">
        <button type="button" ${clState.page <= 1 ? 'disabled' : ''} onclick="clGoPage(1)" aria-label="Первая страница">«</button>
        <button type="button" ${clState.page <= 1 ? 'disabled' : ''} onclick="clGoPage(${clState.page - 1})" aria-label="Назад">‹</button>
        <span style="padding:0 6px">стр. <b style="color:var(--text)">${clState.page}</b> из ${pages}</span>
        <button type="button" ${clState.page >= pages ? 'disabled' : ''} onclick="clGoPage(${clState.page + 1})" aria-label="Вперёд">›</button>
        <button type="button" ${clState.page >= pages ? 'disabled' : ''} onclick="clGoPage(${pages})" aria-label="Последняя страница">»</button>
      </span>
    </div>`;

  const legend = `<div class="cl-legend">
      <span><i class="cl-dot green" style="width:9px;height:9px;border-radius:50%"></i>согласился установить приложение и купить абонемент / приложение уже установлено</span>
      <span><i class="cl-dot yellow" style="width:9px;height:9px;border-radius:50%"></i>презентация приложения и абонемента</span>
      <span><i class="cl-dot red" style="width:9px;height:9px;border-radius:50%"></i>отказался</span>
    </div>
    <div class="cl-legend" style="margin-top:6px"><span>Нажмите на индикатор, чтобы поставить отметку; повторное нажатие снимает её. Дата — когда номер впервые появился в терминале.</span></div>`;

  box.innerHTML = `<div class="inteljet-card cl-card">${head}${stats}${sortBar}<div class="cl-list">${list}</div>${pager}${legend}</div>`;
}
