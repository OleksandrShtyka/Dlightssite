"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

function validNetflixUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && (url.hostname === "netflix.com" || url.hostname.endsWith(".netflix.com"));
  } catch { return false; }
}

function movieUrl(path) {
  return typeof path === "string" && path.startsWith("/") ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

export default function KadrPage() {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  }, []);
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [ready, setReady] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(4);
  const [netflixUrl, setNetflixUrl] = useState("");
  const [note, setNote] = useState("");

  const loadDiary = useCallback(async (activeClient, activeUser) => {
    const { data, error } = await activeClient.from("movie_diaries").select("payload").eq("user_id", activeUser.id).maybeSingle();
    if (error) { setMessage("Не вдалося завантажити щоденник. Перевірте, чи додана таблиця movie_diaries у Supabase."); return; }
    const payload = data?.payload || {};
    const tombstones = Array.isArray(payload.deletedIds) ? payload.deletedIds : [];
    setDeletedIds(tombstones);
    setEntries((Array.isArray(payload.entries) ? payload.entries : []).filter((entry) => entry?.id && !tombstones.includes(entry.id)).sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)));
    setMessage("Колекцію синхронізовано з акаунтом.");
  }, []);

  useEffect(() => {
    if (!client) { setMessage("Додайте Supabase URL та publishable key у Production env Vercel."); setReady(true); return undefined; }
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const nextUser = data.session?.user || null;
      setUser(nextUser);
      if (nextUser) void loadDiary(client, nextUser);
      setReady(true);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (nextUser) void loadDiary(client, nextUser);
      else { setEntries([]); setDeletedIds([]); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [client, loadDiary]);

  const persist = async (nextEntries, nextDeleted) => {
    if (!client || !user) return;
    const payload = { entries: nextEntries, deletedIds: [...new Set(nextDeleted)] };
    setEntries(nextEntries);
    setDeletedIds(payload.deletedIds);
    const { error } = await client.from("movie_diaries").upsert({ user_id: user.id, payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setMessage(error ? "Не вдалося зберегти в хмарі. Перевірте підключення або таблицю Supabase." : "Збережено у вашій хмарній колекції.");
  };

  const authenticate = async (event) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true); setMessage(signup ? "Створюємо акаунт…" : "Входимо…");
    const result = signup
      ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/kadr` } })
      : await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (signup && !result.data.session) { setMessage("Перевірте пошту та підтвердьте email. Потім увійдіть в акаунт."); return; }
    const nextUser = result.data.user;
    setUser(nextUser);
    await loadDiary(client, nextUser);
  };

  const clearForm = () => { setEditing(null); setTitle(""); setRating(4); setNetflixUrl(""); setNote(""); };
  const editEntry = (entry) => { setEditing(entry); setTitle(entry.title || ""); setRating(entry.rating || 4); setNetflixUrl(entry.netflixUrl || ""); setNote(entry.note || ""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const saveEntry = async (event) => {
    event.preventDefault();
    if (!title.trim() || !validNetflixUrl(netflixUrl) || !user) return;
    const now = Date.now();
    const entry = {
      ...(editing || {}), id: editing?.id || crypto.randomUUID(), title: title.trim(), rating: Number(rating),
      netflixUrl: netflixUrl.trim(), note: note.trim(), watchedAt: editing?.watchedAt || now, modifiedAt: now,
      posterPath: editing?.posterPath || null, tmdbId: editing?.tmdbId || null,
    };
    const next = [entry, ...entries.filter((item) => item.id !== entry.id)].sort((a, b) => b.watchedAt - a.watchedAt);
    await persist(next, deletedIds.filter((id) => id !== entry.id));
    clearForm();
  };
  const deleteEntry = async (entry) => {
    if (!window.confirm(`Видалити «${entry.title}» зі щоденника?`)) return;
    await persist(entries.filter((item) => item.id !== entry.id), [...deletedIds, entry.id]);
    if (editing?.id === entry.id) clearForm();
  };

  return (
    <main className="kadr-page">
      <header className="kadr-top wrap">
        <a className="brand" href="/"><span className="kadr-brand-mark">К</span><span>Кадр<span className="brand-dot">.</span></span></a>
        <nav><a href="/">Світло</a><a className="active" href="/kadr">Кінощоденник</a><a href="/downloads/kadr-moviediary-v1.0.2.apk">Завантажити Android ↗</a></nav>
        {user ? <button className="button button-dark" onClick={async () => { await client.auth.signOut(); setUser(null); setMessage("Вийшли з акаунта."); }}>Вийти · {user.email?.split("@")[0]}</button> : <a href="#account" className="button button-dark">Мій акаунт ↗</a>}
      </header>

      <div className="kadr-wrap wrap">
        <section className="kadr-hero">
          <div><div className="eyebrow"><span className="eyebrow-dot" /> КІНОЩОДЕННИК · ПРОЄКТ № 02</div><h1>Історії, які<br /><span>залишилися з тобою.</span></h1><p>Зберігайте переглянуті фільми, ставте оцінки й діліться своїм списком. Увійдіть тим самим акаунтом, що й у застосунку «Кадр» на Android.</p><a className="button button-green" href="/downloads/kadr-moviediary-v1.0.2.apk">Завантажити застосунок <span>↓</span></a></div>
          <div className="kadr-hero-art" aria-hidden="true"><div className="film-orbit" /><div className="film-ticket"><span>ВАША КОЛЕКЦІЯ</span><strong>КАДР</strong><i>✦ ✦ ✦ ✦ ✦</i><small>ФІЛЬМИ, ЩО ВАРТІ УВАГИ</small></div><b>✳</b></div>
        </section>

        <section className="kadr-library" id="account">
          <div className="kadr-section-head"><div><div className="eyebrow">ВАША КОЛЕКЦІЯ</div><h2>{user ? "Кінощоденник" : "Ваші фільми — в одному місці"}</h2><p>{user ? `${entries.length} ${entries.length === 1 ? "фільм" : "фільмів"} у хмарі` : "Увійдіть або створіть акаунт, щоб синхронізувати колекцію на сайті й у застосунку."}</p></div>{user && <span className="kadr-sync-pill"><i /> Синхронізовано</span>}</div>

          {!user ? <div className="kadr-auth-card">
            <div className="kadr-auth-intro"><span className="kadr-auth-icon">⌁</span><h3>{signup ? "Створіть акаунт Кадр" : "Увійдіть у Кадр"}</h3><p>Той самий email і пароль працюють у застосунку та на сайті. Без акаунта застосунок і далі зберігає щоденник локально.</p><div className="kadr-auth-note">🔒 Паролі обробляє Supabase Auth. Сайт їх не зберігає.</div></div>
            <form className="auth-form" onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label><label>Пароль<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Щонайменше 8 символів" required /></label><button className="button button-green" disabled={busy || !ready} type="submit">{busy ? "Зачекайте…" : signup ? "Створити акаунт" : "Увійти"} <span>↗</span></button><button className="auth-switch" type="button" onClick={() => { setSignup(!signup); setMessage(""); }}>{signup ? "Вже є акаунт? Увійти" : "Ще немає акаунта? Створити"}</button>{message && <p className="auth-message" role="status">{message}</p>}</form>
          </div> : <>
            <form className="kadr-entry-form" onSubmit={saveEntry}>
              <div className="kadr-form-title"><span>{editing ? "РЕДАГУВАННЯ" : "НОВИЙ ЗАПИС"}</span><button type="button" className="text-button" onClick={clearForm}>{editing ? "Скасувати" : ""}</button></div>
              <div className="kadr-form-grid"><label>Назва фільму<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Наприклад, Інтерстеллар" maxLength={100} required /></label><label>Оцінка<select value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{"★".repeat(value)} · {value}/5</option>)}</select></label><label className="wide">Посилання на Netflix · обов’язково<input type="url" value={netflixUrl} onChange={(event) => setNetflixUrl(event.target.value)} placeholder="https://www.netflix.com/title/..." required /></label><label className="wide">Враження · необов’язково<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Що запам’яталося?" rows="3" maxLength={400} /></label></div>
              {netflixUrl && !validNetflixUrl(netflixUrl) && <p className="kadr-form-error">Потрібне HTTPS-посилання на netflix.com або його піддомен.</p>}
              <button className="button button-green" disabled={!title.trim() || !validNetflixUrl(netflixUrl)} type="submit">{editing ? "Зберегти зміни" : "Додати до щоденника"} <span>↗</span></button>
            </form>
            {entries.length === 0 ? <div className="kadr-empty"><span>✳</span><h3>Колекція поки порожня</h3><p>Додайте перший переглянутий фільм. Він з’явиться і в Android-застосунку після синхронізації.</p></div> : <div className="kadr-movie-grid">{entries.map((entry) => <article className="kadr-movie-card" key={entry.id}><div className="kadr-poster">{movieUrl(entry.posterPath) ? <img src={movieUrl(entry.posterPath)} alt={`Постер «${entry.title}»`} /> : <span>К</span>}<b>{entry.rating} ★</b></div><div className="kadr-movie-copy"><h3>{entry.title}</h3><span className="kadr-rating">{"★".repeat(Math.max(0, Math.min(5, Number(entry.rating))))}{"☆".repeat(5 - Math.max(0, Math.min(5, Number(entry.rating))))}</span>{entry.note && <p>{entry.note}</p>}<div className="kadr-movie-actions"><a href={entry.netflixUrl} target="_blank" rel="noreferrer">Netflix ↗</a><button onClick={() => editEntry(entry)}>Змінити</button><button onClick={() => void deleteEntry(entry)}>Видалити</button></div></div></article>)}</div>}
          </>}
        </section>

        <section className="kadr-privacy"><div><span>01</span><strong>Працює офлайн</strong><p>Android-застосунок зберігає записи на пристрої навіть без входу.</p></div><div><span>02</span><strong>Один акаунт</strong><p>Використовуйте той самий email у «Кадрі» на сайті й Android.</p></div><div><span>03</span><strong>Окремі дані</strong><p>Кінощоденник зберігається окремо від адрес і графіків ДТЕК.</p></div></section>
        <p className="kadr-credits">Постери та дані про доступність надаються TMDB. Дані провайдерів Netflix в Україні базуються на інформації JustWatch. Цей продукт використовує TMDB API, але не схвалений і не сертифікований TMDB.</p>
      </div>
      <footer className="wrap footer"><a className="brand" href="/"><span className="brand-mark">✳</span><span>Світло<span className="brand-dot">.</span> × Кадр<span className="brand-dot">.</span></span></a><a href="/">Проєкт 01 · графіки ДТЕК ↗</a><span>Кіно, яке хочеться пам’ятати.</span></footer>
    </main>
  );
}
