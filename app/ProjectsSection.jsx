export default function ProjectsSection() {
  return (
    <section className="projects-hub" id="projects">
      <div className="projects-hub-head"><div><div className="eyebrow">ДВА ЗАСТОСУНКИ · ОДНА КОМАНДА</div><h2>Технології для щоденного життя.</h2></div><p>Виберіть сервіс: стежте за світлом або зберігайте кіно, яке хочеться пам’ятати.</p></div>
      <div className="project-grid">
        <article className="project-card project-lights"><div className="project-number">ПРОЄКТ 01</div><div className="project-symbol">ϟ</div><h3>Світло</h3><p>Графіки ДТЕК Київської області, адреси, кілька груп і локальні нагадування.</p><div className="project-tags"><span>Android</span><span>Вебсайт</span><span>Офлайн</span></div><a href="#schedule" className="project-link">Переглянути графік <span>↗</span></a></article>
        <article className="project-card project-kadr"><div className="project-number">ПРОЄКТ 02</div><div className="project-symbol">К</div><h3>Кадр</h3><p>Особистий кінощоденник: фільми, оцінки, постери та посилання на Netflix.</p><div className="project-tags"><span>Android</span><span>Хмарна синхронізація</span></div><div className="project-links"><a href="/kadr" className="project-link">Відкрити Кадр <span>↗</span></a><a href="/api/releases/kadr" className="project-download">Завантажити APK ↓</a></div></article>
      </div>
    </section>
  );
}
