"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { getSupabaseClient } from "../lib/supabaseClient";

const emptyStats = { groups: 0, movies: 0, workouts: 0, supplements: 0, latestWorkout: null };

export default function AccountPage() {
  const client = useMemo(() => getSupabaseClient(), []);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [stats, setStats] = useState(emptyStats);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async (activeClient, activeUser) => {
    const [settings, diary, fitness] = await Promise.all([
      activeClient.from("account_settings").select("payload").eq("user_id", activeUser.id).maybeSingle(),
      activeClient.from("movie_diaries").select("payload").eq("user_id", activeUser.id).maybeSingle(),
      activeClient.from("fitness_tracker_data").select("payload").eq("user_id", activeUser.id).maybeSingle(),
    ]);
    const lightProfiles = settings.data?.payload?.profiles || [];
    const movies = diary.data?.payload?.entries || [];
    const payload = fitness.data?.payload || {};
    const workouts = payload.sessions || [];
    setStats({
      groups: Array.isArray(lightProfiles) ? lightProfiles.length : 0,
      movies: Array.isArray(movies) ? movies.length : 0,
      workouts: Array.isArray(workouts) ? workouts.length : 0,
      supplements: Array.isArray(payload.supplements) ? payload.supplements.length : 0,
      latestWorkout: Array.isArray(workouts) ? workouts.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null : null,
    });
  }, []);

  useEffect(() => {
    if (!client) { setMessage("Supabase не налаштовано для цього середовища. Додайте URL та publishable key у змінні середовища Vercel."); setReady(true); return undefined; }
    let alive = true;
    const applySession = (nextUser) => {
      setUser(nextUser);
      setDisplayName(nextUser?.user_metadata?.display_name || "");
      setAvatarUrl(nextUser?.user_metadata?.avatar_url || "");
      if (nextUser) void loadStats(client, nextUser);
      else setStats(emptyStats);
      setReady(true);
    };
    client.auth.getSession().then(({ data }) => { if (alive) applySession(data.session?.user || null); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { if (alive) applySession(session?.user || null); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [client, loadStats]);

  const authenticate = async (event) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage(signup ? "Створюємо ваш простір…" : "Входимо у ваш акаунт…");
    const result = signup
      ? await client.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/account` } })
      : await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (signup && !result.data.session) { setMessage("Перевірте пошту й підтвердьте email. Потім увійдіть у цей акаунт."); return; }
    const nextUser = result.data.user;
    setUser(nextUser);
    setDisplayName(nextUser?.user_metadata?.display_name || displayName);
    setMessage("Ви увійшли. Завантажуємо дані ваших проєктів…");
    if (nextUser) await loadStats(client, nextUser);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!client || !user) return;
    setBusy(true);
    const { data, error } = await client.auth.updateUser({ data: { display_name: displayName.trim(), avatar_url: avatarUrl.trim() } });
    setBusy(false);
    setMessage(error ? error.message : "Профіль оновлено.");
    if (!error) setUser(data.user);
  };

  const sendReset = async () => {
    if (!client || !user?.email) return;
    setBusy(true);
    const { error } = await client.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/account` });
    setBusy(false);
    setMessage(error ? error.message : "Надіслали лист із посиланням для зміни пароля.");
  };

  const signOut = async () => {
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);
    setMessage(error ? error.message : "Ви вийшли з акаунта. Локальні дані у застосунках залишилися на пристроях.");
  };

  const initial = (displayName || user?.email || "П").slice(0, 1).toUpperCase();
  return (
    <main className="suite-page account-page">
      <div className="suite-glow suite-glow-one" /><div className="suite-glow suite-glow-two" />
      <SiteHeader />
      <div className="suite-wrap">
        <section className="suite-hero account-hero">
          <div>
            <span className="suite-eyebrow"><i /> ОДИН АКАУНТ · УСІ ПРОЄКТИ</span>
            <h1>Ваш простір.<br /><em>Ваші правила.</em></h1>
            <p>Єдиний вхід для «Світла», «Кадру» й фітнес-трекера. Дані кожного проєкту зберігаються окремо та синхронізуються між сайтом і застосунками.</p>
          </div>
          <div className="account-hero-stamp"><span>✳</span><b>YOUR<br />SPACE</b><small>SYNCED · PRIVATE</small></div>
        </section>

        {!ready ? <div className="suite-card suite-loading"><span className="suite-spinner" />Перевіряємо акаунт…</div> : !user ? (
          <section className="account-auth suite-card">
            <div className="account-auth-copy"><span className="suite-icon">↗</span><h2>{signup ? "Створіть свій акаунт" : "Раді бачити знову"}</h2><p>Використовуйте один email у всіх застосунках. Після входу сайт збереже профілі й покаже дані ваших проєктів.</p><ul><li>Синхронізація графіків і груп</li><li>Спільна колекція «Кадру»</li><li>Тренування, харчування та прогрес</li></ul><small>Ваш пароль обробляє Supabase Auth — сайт його не зберігає.</small></div>
            <form className="suite-form" onSubmit={authenticate}>
              {signup && <label>Як до вас звертатися<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ваше ім’я" maxLength={60} required /></label>}
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
              <label>Пароль<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менше 8 символів" required /></label>
              <button className="suite-primary" type="submit" disabled={busy || !ready}>{busy ? "Зачекайте…" : signup ? "Створити акаунт" : "Увійти в акаунт"}<span>↗</span></button>
              <button className="suite-text-button" type="button" onClick={() => { setSignup((value) => !value); setMessage(""); }}>{signup ? "Вже маєте акаунт? Увійти" : "Ще немає акаунта? Зареєструватися"}</button>
              {message && <p className="suite-message" role="status">{message}</p>}
            </form>
          </section>
        ) : (
          <>
            <section className="account-profile suite-card">
              <div className="account-profile-head"><div className="account-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="Аватар профілю" /> : initial}</div><div><span className="suite-eyebrow"><i /> АКАУНТ ПІДКЛЮЧЕНО</span><h2>{displayName || user.email?.split("@")[0] || "Мій акаунт"}</h2><p>{user.email}</p></div><button className="suite-signout" type="button" onClick={signOut} disabled={busy}>Вийти з акаунта ↗</button></div>
              <div className="account-divider" />
              <form className="suite-form account-profile-form" onSubmit={saveProfile}>
                <label>Ім’я<input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ваше ім’я" maxLength={60} /></label>
                <label>Посилання на аватар<input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" /></label>
                <div className="account-form-actions"><button className="suite-primary" type="submit" disabled={busy}>{busy ? "Зберігаємо…" : "Зберегти профіль"}<span>↗</span></button><button className="suite-text-button" type="button" onClick={sendReset} disabled={busy}>Змінити пароль</button></div>
                {message && <p className="suite-message" role="status">{message}</p>}
              </form>
            </section>
            <section className="account-stats" aria-label="Дані проєктів">
              <article className="account-stat suite-card"><span>01 · СВІТЛО</span><b>{stats.groups}</b><p>збережених профілів / груп</p><a href="/#schedule">Відкрити графіки ↗</a></article>
              <article className="account-stat suite-card"><span>02 · КАДР</span><b>{stats.movies}</b><p>фільмів у кінощоденнику</p><a href="/kadr">Відкрити колекцію ↗</a></article>
              <article className="account-stat suite-card"><span>03 · ФІТНЕС</span><b>{stats.workouts}</b><p>тренувань · {stats.supplements} добавок</p><a href="/fitness">Відкрити трекер ↗</a></article>
            </section>
            {stats.latestWorkout && <section className="account-last-workout suite-card"><div><span className="suite-eyebrow">ОСТАННЄ ТРЕНУВАННЯ</span><h2>{stats.latestWorkout.workoutType || "Силове тренування"}</h2><p>{stats.latestWorkout.date || "Дата не вказана"} · {stats.latestWorkout.durationMin || 0} хв</p></div><a className="suite-outline" href="/fitness">Перейти до прогресу ↗</a></section>}
          </>
        )}
        <section className="account-privacy"><span>ВАШІ ДАНІ · ОКРЕМІ СХОВИЩА · ОДИН ВХІД</span><p>Без акаунта «Світло» й Android-застосунки продовжують працювати. Вхід потрібен, щоб синхронізувати дані між пристроями.</p></section>
      </div>
      <footer className="suite-footer suite-wrap"><a href="/">Світло × Кадр<span>.</span></a><span>Один спокійний простір для щоденних справ.</span><a href="/fitness">Фітнес-трекер ↗</a></footer>
    </main>
  );
}
