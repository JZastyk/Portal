/* ===== Интерактивное обучение (слайды) ===== */
/* ===== Обучающие слайды ===== */
const guideData = {
  inventory: {
    tag: 'Склад химии',
    slides: [
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
        title: '1. Создание химии и упаковки',
        desc: 'Нажмите «Химия» вверху. Для каждой позиции можно завести несколько единиц: целые канистры, килограммы или литры.',
        preview: `<div style="background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center"><b>Эмульсия эконом</b><span style="font-size:12px;background:#f0f4f8;padding:3px 8px;border-radius:6px;font-weight:600;color:#0a4f78">кан + кг</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L14.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>`,
        title: '2. Отслеживание минимального остатка',
        desc: 'Тумблер «Отслеживать» включен для основной единицы (канистры). Для вскрытых упаковок (кг) отслеживание можно отключить, чтобы избежать ложных тревог.',
        preview: `<div style="display:flex;align-items:center;justify-content:space-between;background:#fef5f5;border:1.5px solid #f8c9c9;border-radius:10px;padding:9px 12px"><span style="font-weight:700;color:#b63838">⚠️ Заканчивается</span><span style="font-size:12px;color:#6b7a86">Остаток: 1 кан (мин: 2)</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
        title: '3. Быстрое списание остатка',
        desc: 'Списывайте химию за 1 секунду кнопками прямо с телефона: крупные «+ / −» на 1 или быстрые плашки «−5», «−0.5», «+0.5», «+5». Любое действие пишется в историю склада с точными значениями.',
        preview: `<div style="display:flex;gap:5px;justify-content:center"><span style="background:#fbe8e8;color:#b63838;padding:5px 8px;border-radius:6px;font-weight:700">−5</span><span style="background:#fbe8e8;color:#b63838;padding:5px 8px;border-radius:6px;font-weight:700">−0.5</span><span style="background:#e5f1f7;color:#0d6fa5;padding:5px 8px;border-radius:6px;font-weight:700">+0.5</span><span style="background:#e5f1f7;color:#0d6fa5;padding:5px 8px;border-radius:6px;font-weight:700">+5</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>`,
        title: '4. Перенос остатка в отчёт дня',
        desc: 'Нажмите значок документа (📄) на карточке. Карточка подсветится зелёным бейджем «В отчёте дня», и её остаток автоматически появится в блоке «Остаток химии» ежедневной сводки.',
        preview: `<div style="border:1.5px solid #1f9254;background:#f6fbf8;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center"><b>Пена розовая</b><span style="background:#e7f6ee;color:#1f9254;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:6px">✓ В отчёте дня</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,
        title: '5. Редактирование и удаление',
        desc: 'Нажмите «⋮» в карточке, чтобы переименовать химию или настроить единицы. Внизу окна доступна красная кнопка «Удалить карточку» для вывода позиции из базы.',
        preview: `<div style="display:flex;gap:8px;justify-content:center"><span style="background:#fbe8e8;color:#b63838;padding:6px 12px;border-radius:8px;font-weight:700;font-size:12px">Удалить карточку</span><span style="background:#0a4f78;color:#fff;padding:6px 12px;border-radius:8px;font-weight:700;font-size:12px">Сохранить</span></div>`
      }
    ]
  },
  report: {
    tag: 'Отчёт дня',
    slides: [
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        title: '1. Настройки автомойки',
        desc: 'Нажмите «Настройки отчёта»: добавьте ФИО сотрудников, укажите количество боксов, компрессоров, помп и нужные статьи расхода химии.',
        preview: `<div style="background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-around;font-size:12px"><span>Боксов: <b>3</b></span><span>Помп: <b>3</b></span><span>Компрессоров: <b>2</b></span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        title: '2. Логика двух дат смены',
        desc: 'Машины мылись вчера за всю смену («Дата смены отчёта»). А замеры (TDS, рукава, расход химии) берутся сегодня утром при передаче смены. Система сама распределяет данные по нужным датам в аналитику!',
        preview: `<div style="background:#f1f5f9;border-radius:8px;padding:8px 10px;font-size:12px;text-align:center"><b>Вчера (26.09):</b> Машины 🚗<br><b>Сегодня (27.09):</b> TDS, рукава, расход 🧪</div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
        title: '3. Заполнение показателей',
        desc: 'Отметьте статус боксов, укажите помытые машины, TDS осмоса, давление помп, проход поворотных рукавов (слева, сзади, справа) и расход реагентов по боксам в граммах.',
        preview: `<div style="display:flex;gap:6px;justify-content:center"><span style="background:#e7f6ee;color:#1f9254;padding:4px 8px;border-radius:6px;font-weight:700;font-size:11.5px">Боксы 1, 2, 3: Норма</span><span style="background:#eef6fc;color:#0a4f78;padding:4px 8px;border-radius:6px;font-weight:700;font-size:11.5px">TDS: 18</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        title: '4. Текст и копирование в 1 клик',
        desc: 'Текст формируется на лету без ручной вёрстки. Нажмите «Копировать отчёт», и структурированное сообщение готово для отправки руководству в Telegram или WhatsApp.',
        preview: `<div style="background:#f1f5f9;border-radius:8px;padding:8px 10px;font-family:monospace;font-size:11px;color:#152632">27.09.2026 Трофименко<br>Помыто машин за 26.09.2026:<br>1 бокс - 0, 2 бокс - 3, 3 бокс - 15...</div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        title: '5. Сохранение в облако и архив',
        desc: 'Нажмите «Сохранить в историю». Отчёт зафиксируется в облаке под сегодняшней датой сдачи. В кнопке «История отчётов» можно просмотреть архив или удалить ошибочную запись.',
        preview: `<div style="border:1px solid #d0d7de;background:#fff;border-radius:8px;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;font-size:12px"><b>27.09.2026 • Трофименко</b><span style="color:#1f9254;font-weight:700">✓ Сохранено</span></div>`
      }
    ]
  }
};

let currentGuideKey = 'inventory';
let currentGuideIndex = 0;

function openGuide(key){
 currentGuideKey = key || 'inventory';
 currentGuideIndex = 0;
 renderGuideSlide();
 document.getElementById('guideModal').classList.add('show');
}
function closeGuide(){document.getElementById('guideModal').classList.remove('show')}
function renderGuideSlide(){
 const g = guideData[currentGuideKey];
 const total = g.slides.length;
 const s = g.slides[currentGuideIndex];

 document.getElementById('guideTag').textContent = g.tag;
 document.getElementById('guideCounter').textContent = `Слайд ${currentGuideIndex + 1} из ${total}`;

 document.getElementById('guideSlidesContainer').innerHTML = `
   <div class="guide-slide active">
     <div class="slide-icon">${s.icon}</div>
     <div class="slide-title">${s.title}</div>
     <div class="slide-desc">${s.desc}</div>
     <div class="slide-preview-box">${s.preview}</div>
   </div>
 `;

 document.getElementById('guideDots').innerHTML = g.slides.map((_, i) =>
   `<span class="guide-dot ${i === currentGuideIndex ? 'active' : ''}" onclick="goToGuideSlide(${i})"></span>`
 ).join('');

 document.getElementById('guidePrevBtn').style.visibility = currentGuideIndex === 0 ? 'hidden' : 'visible';
 document.getElementById('guideNextBtn').textContent = (currentGuideIndex === total - 1) ? 'Понятно!' : 'Далее';
}
function goToGuideSlide(i){currentGuideIndex = i;renderGuideSlide()}
function nextGuideSlide(){
 const g = guideData[currentGuideKey];
 if (currentGuideIndex < g.slides.length - 1) {
   currentGuideIndex++;
   renderGuideSlide();
 } else {
   closeGuide();
 }
}
function prevGuideSlide(){
 if (currentGuideIndex > 0) {
   currentGuideIndex--;
   renderGuideSlide();
 }
}

