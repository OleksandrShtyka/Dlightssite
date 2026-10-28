export default function ProjectsSection() {
  return (
    <section className="projects-hub" id="projects">
      <div className="projects-hub-head"><div><div className="eyebrow">ТРИ ПРОЄКТИ · ОДИН АКАУНТ</div><h2>Технології для щоденного життя.</h2></div><p>Стежте за світлом, зберігайте кіно й ведіть історію свого фітнес-прогресу.</p></div>
      <div className="project-grid">
        <article className="project-card project-lights"><div className="project-number">ПРОЄКТ 01</div><div className="project-symbol">ϟ</div><h3>Світло</h3><p>Графіки ДТЕК Київської області, адреси, кілька груп і локальні нагадування.</p><div className="project-tags"><span>Android</span><span>Вебсайт</span><span>Офлайн</span></div><a href="#schedule" className="project-link">Переглянути графік <span>↗</span></a></article>
        <article className="project-card project-kadr"><div className="project-number">ПРОЄКТ 02</div><div className="project-symbol">К</div><h3>Кадр</h3><p>Особистий кінощоденник: фільми, оцінки, постери та посилання на Netflix.</p><div className="project-tags"><span>Android</span><span>Хмарна синхронізація</span></div><div className="project-links"><a href="/kadr" className="project-link">Відкрити Кадр <span>↗</span></a><a href="/api/releases/kadr" className="project-download">Завантажити APK ↓</a></div></article>
        <article className="project-card project-fitness"><div className="project-number">ПРОЄКТ 03</div><div className="project-symbol">↗</div><h3>Fitness Tracker</h3><p>Тренування, харчування, вага, добавки й план — у спільному акаунті з Android-застосунком.</p><div className="project-tags"><span>Тренування</span><span>Харчування</span><span>Прогрес</span></div><div className="project-links"><a href="/fitness" className="project-link">Відкрити трекер <span>↗</span></a><a href="/api/releases/fitness" className="project-download">Завантажити APK ↓</a></div></article>
      </div>
    </section>
  );
}
