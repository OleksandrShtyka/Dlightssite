"use client";

import { useEffect, useState } from "react";

const RELEASES_URL = "https://github.com/OleksandrShtyka/Dlightssite/releases";

function formatSize(bytes) {
  if (!bytes) return "APK для Android";
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ · APK для Android`;
}

export default function DownloadSection() {
  const [release, setRelease] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/releases/latest", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result) setRelease(result); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const available = Boolean(release?.available && release.downloadUrl);

  return (
    <section className="download-section" id="download" aria-labelledby="download-title">
      <div className="download-icon" aria-hidden="true">↓</div>
      <div className="download-copy">
        <div className="eyebrow">ANDROID · ОФІЦІЙНІ ОНОВЛЕННЯ</div>
        <h2 id="download-title">Застосунок завжди актуальний.</h2>
        <p>Завантажуйте підписаний APK тут. Коли з’явиться нова версія, посилання оновиться автоматично — перевстановіть застосунок, щоб отримати оновлення.</p>
        {release?.version && <span className="download-version">Останній реліз: {release.version}{release.publishedAt ? ` · ${new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(release.publishedAt))}` : ""}</span>}
      </div>
      <div className="download-action">
        {available ? (
          <a className="button button-green" href={release.downloadUrl}>Завантажити APK <span>↓</span></a>
        ) : (
          <a className="button button-dark" href={release?.releasesUrl || RELEASES_URL} target="_blank" rel="noreferrer">{release?.notPublished || release?.unavailable ? "Відкрити релізи" : "Перевірити релізи"} <span>↗</span></a>
        )}
        <span>{available ? formatSize(release.size) : release?.notPublished ? "APK ще не опублікований" : release?.unavailable ? "Сторінка релізів GitHub" : "Перевіряємо останню версію…"}</span>
      </div>
      <div className="download-spark" aria-hidden="true">✳</div>
    </section>
  );
}

