/* ===== Интерактивное обучение (слайды) ===== */
/* ===== Обучающие слайды ===== */
const guideData = {
  inventory: {
    tag: 'Склад химии',
    slides: [
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
        title: 'Добавление химии',
        desc: 'Нажмите кнопку «Химия» вверху. Для каждой позиции можно завести сразу несколько единиц: канистры, килограммы, штуки или литры.',
        preview: `<div style="background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center"><b>Пена жёлтая</b><span style="font-size:12px;color:#6b7a86">2 единицы (кан, кг)</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
        title: 'Управление остатками',
        desc: 'Списывайте химию за секунду. Используйте быстрые кнопки −5, −0.5, +0.5, +5 или нажимайте крупные кнопки + / − прямо с экрана телефона.',
        preview: `<div style="display:flex;gap:5px;justify-content:center"><span style="background:#fff;border:1px solid #e0e6ea;padding:5px 8px;border-radius:6px;font-weight:700">−5</span><span style="background:#fff;border:1px solid #e0e6ea;padding:5px 8px;border-radius:6px;font-weight:700">−0.5</span><span style="background:#e5f1f7;color:#0d6fa5;border:1px solid #b7d6e8;padding:5px 8px;border-radius:6px;font-weight:700">+0.5</span><span style="background:#e5f1f7;color:#0d6fa5;border:1px solid #b7d6e8;padding:5px 8px;border-radius:6px;font-weight:700">+5</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>`,
        title: 'Включение в отчёт дня',
        desc: 'Нажмите на карточке значок документа (📄). Карточка выделится зелёной рамкой «В отчёте дня» и её текущий остаток автоматически добавится в ежедневную сводку!',
        preview: `<div style="border:1.5px solid #1f9254;background:#f6fbf8;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-between;align-items:center"><b>Эмульсия</b><span style="background:#e7f6ee;color:#1f9254;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px">✓ В отчёте дня</span></div>`
      }
    ]
  },
  report: {
    tag: 'Отчёт дня',
    slides: [
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        title: 'Настройки параметров',
        desc: 'Нажмите «Настройки отчёта». Добавьте имена сотрудников, количество боксов, компрессоров, помп и нужные пункты расхода химии.',
        preview: `<div style="background:#fff;border:1px solid #e0e6ea;border-radius:10px;padding:9px 12px;display:flex;justify-content:space-around;font-size:12.5px"><span>Боксов: <b>4</b></span><span>Помп: <b>4</b></span><span>Компрессоров: <b>2</b></span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
        title: 'Заполнение за смену',
        desc: 'Укажите статус боксов, помытые машины, давление помп и расход химии. Форма динамически подстраивается под настройки автомойки.',
        preview: `<div style="display:flex;gap:6px;justify-content:center"><span style="background:#e7f6ee;color:#1f9254;padding:4px 9px;border-radius:7px;font-weight:700;font-size:12px">Бокс 1: Норма</span><span style="background:#fbe8e8;color:#b63838;padding:4px 9px;border-radius:7px;font-weight:700;font-size:12px">Бокс 2: Не работает</span></div>`
      },
      {
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        title: 'Копирование в 1 клик',
        desc: 'Сводный отчёт формируется автоматически. Нажмите «Копировать отчёт» и сразу отправляйте структурированный отчёт руководству в мессенджер.',
        preview: `<div style="background:#f1f5f9;border-radius:8px;padding:8px 10px;font-family:monospace;font-size:11px;color:#152632">26.09.2026 Иванов<br>Боксы 1, 2, 3 - работают штатно...<br>Остаток химии: Пена - 4кан...</div>`
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

