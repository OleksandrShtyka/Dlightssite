"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import DownloadSection from "./DownloadSection";

const STORAGE_KEY = "svitlo.web.v1";
const initialData = () => ({
  activeId: "local-home",
  profiles: [{ id: "local-home", name: "Мій дім", city: "", street: "", house: "", group: "", schedule: Array(24).fill("unknown") }],
  preferences: { outage: 30, powerOn: 10, notifications: true },
});
const statusLabels = { on: "Є світло", off: "Немає світла", maybe: "Можливе вимкнення", unknown: "Графік невідомий" };
const addressOf = (profile) => [profile?.city, profile?.street, profile?.house].filter(Boolean).join(", ");

function decodeCloud(payload) {
  const profiles = (payload?.profiles || []).map((profile) => ({
    id: profile.id,
    name: profile.name || "",
    city: profile.address?.city || "",
    street: profile.address?.street || "",
    house: profile.address?.house || "",
    group: profile.group || "",
    updatedAt: profile.updatedAt || 0,
    schedule: (profile.slots || []).slice().sort((a, b) => a.hour - b.hour).map((slot) => String(slot.state || "UNKNOWN").toLowerCase()),
  }));
  const merged = [...profiles];
  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    (local.profiles || []).filter((profile) => addressOf(profile) || profile.group).forEach((profile) => {
      const duplicate = merged.some((remote) => remote.id === profile.id || (remote.city === profile.city && remote.street === profile.street && remote.house === profile.house && remote.group === profile.group));
      if (!duplicate) merged.push(profile);
    });
  } catch { /* Keep the cloud snapshot if local storage is unavailable. */ }
  const active = merged.find((profile) => profile.id === payload?.activeProfileId) || merged[0];
  return {
    activeId: active?.id || "local-home",
    profiles: merged.length ? merged : initialData().profiles,
    updatedAt: active?.updatedAt || Date.now(),
    preferences: {
      notifications: payload?.notifications?.enabled ?? true,
      outage: payload?.notifications?.beforeOutageMinutes ?? 30,
      powerOn: payload?.notifications?.beforePowerOnMinutes ?? 10,
    },
  };
}

function encodeCloud(data) {
  return {
    activeProfileId: data.activeId,
    profiles: data.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name || "",
      address: { city: profile.city || "", street: profile.street || "", house: profile.house || "" },
      group: profile.group || "",
      slots: (profile.schedule || []).map((state, hour) => ({ hour, state: String(state).toUpperCase() })),
      updatedAt: data.updatedAt || 0,
      addressVerified: false,
    })),
    notifications: {
      enabled: data.preferences?.notifications ?? true,
      beforeOutageMinutes: data.preferences?.outage ?? 30,
      beforePowerOnMinutes: data.preferences?.powerOn ?? 10,
    },
  };
}

function ProfileDialog({ profile, onClose, onSave, addMode }) {
  const [city, setCity] = useState(profile?.city || "");
  const [street, setStreet] = useState(profile?.street || "");
  const [house, setHouse] = useState(profile?.house || "");
  const [group, setGroup] = useState(profile?.group || "1.1");
  const groups = Array.from({ length: 12 }, (_, index) => `${Math.floor(index / 2) + 1}.${(index % 2) + 1}`);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="modal-close-button" aria-label="Закрити" onClick={onClose}>×</button>
        <div className="eyebrow">НАЛАШТУВАННЯ ГРАФІКА</div>
        <h2 id="profile-title">{addMode ? "Додати профіль" : "Змінити профіль"}</h2>
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); onSave({ city, street, house, group }); }}>
          <label>Населений пункт<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Наприклад, Бровари" /></label>
          <label>Вулиця<input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Назва вулиці" /></label>
          <label>Будинок<input value={house} onChange={(event) => setHouse(event.target.value)} placeholder="Номер" /></label>
          <label>Група ДТЕК<select value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button className="button button-green" type="submit">Зберегти профіль <span>↗</span></button>
        </form>
        <p className="auth-privacy">Перевіряйте групу й актуальний графік на офіційному сайті ДТЕК.</p>
      </section>
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState(initialData);
  const [ready, setReady] = useState(false);
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [syncLabel, setSyncLabel] = useState("Локальний режим");
  const [authOpen, setAuthOpen] = useState(false);
  const [signup, setSignup] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const currentProfile = data.profiles.find((profile) => profile.id === data.activeId) || data.profiles[0];
  const address = addressOf(currentProfile);
  const status = dayOffset === 0 ? (currentProfile?.schedule?.[now.getHours()] || "unknown") : "unknown";
  const activeSchedule = dayOffset === 0 && currentProfile?.schedule?.length === 24 ? currentProfile.schedule : Array(24).fill("unknown");

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const cloudClient = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  }, []);

  const pushData = useCallback(async (nextData) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData)); } catch { /* Browser storage can be disabled. */ }
    if (cloudClient && user) {
      const { error } = await cloudClient.from("account_settings").upsert({ user_id: user.id, payload: encodeCloud(nextData), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) { setSyncLabel("Збережено на пристрої"); showToast("Не вдалося синхронізувати. Дані залишилися локально."); }
      else setSyncLabel("Синхронізовано");
    }
  }, [cloudClient, user, showToast]);

  const pullCloud = useCallback(async (client, activeUser, notify = false) => {
    if (!client || !activeUser) return;
    const { data: row, error } = await client.from("account_settings").select("payload").eq("user_id", activeUser.id).maybeSingle();
    if (error) { showToast("Не вдалося завантажити дані акаунта."); return; }
    if (row?.payload) {
      const restored = decodeCloud(row.payload);
      setData(restored);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(restored)); } catch { /* Optional cache. */ }
      if (notify) showToast("Налаштування акаунта завантажено.");
    } else {
      const local = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || initialData(); } catch { return initialData(); } })();
      const { error: saveError } = await client.from("account_settings").upsert({ user_id: activeUser.id, payload: encodeCloud(local), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (saveError) showToast("Не вдалося зберегти початкові налаштування.");
    }
    setSyncLabel("Синхронізовано");
  }, [showToast]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.profiles) && parsed.profiles.length) setData({ ...initialData(), ...parsed });
      }
    } catch { /* Use offline defaults. */ }
    setReady(true);
    if (!cloudClient) return undefined;
    let alive = true;
    cloudClient.auth.getSession().then(({ data: sessionData }) => {
      if (!alive) return;
      const sessionUser = sessionData.session?.user || null;
      setUser(sessionUser);
      if (sessionUser) void pullCloud(cloudClient, sessionUser);
    });
    const { data: listener } = cloudClient.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      if (sessionUser) { setSyncLabel("Синхронізація увімкнена"); void pullCloud(cloudClient, sessionUser); }
      else setSyncLabel("Локальний режим");
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [cloudClient, pullCloud]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const saveProfile = async (values) => {
    const previous = data.profiles.find((profile) => profile.id === data.activeId);
    const nextProfile = {
      id: addMode ? crypto.randomUUID() : (previous?.id || crypto.randomUUID()),
      name: values.city.trim() || "Мій профіль",
      ...Object.fromEntries(["city", "street", "house"].map((key) => [key, values[key].trim()])),
      group: values.group,
      schedule: previous?.group === values.group ? (previous.schedule || Array(24).fill("unknown")) : Array(24).fill("unknown"),
    };
    const profiles = addMode ? [...data.profiles, nextProfile] : data.profiles.map((profile) => profile.id === previous?.id ? nextProfile : profile);
    if (addMode && previous && !addressOf(previous) && !previous.group && data.profiles.length === 1) profiles[0] = { ...nextProfile, id: previous.id };
    const savedProfile = profiles.find((profile) => profile.id === (addMode && previous && !addressOf(previous) && !previous.group && data.profiles.length === 1 ? previous.id : nextProfile.id)) || nextProfile;
    const next = { ...data, activeId: savedProfile.id, profiles, updatedAt: Date.now() };
    setData(next); setProfileOpen(false); await pushData(next); showToast("Профіль збережено.");
  };

  const openProfile = (isAdd) => { setAddMode(isAdd); setProfileOpen(true); };
  const chooseProfile = async (id) => { const next = { ...data, activeId: id }; setData(next); await pushData(next); };
  const handleAuth = async (event) => {
    event.preventDefault();
    if (!cloudClient) { setAuthMessage("Supabase ще не підключений. Поки налаштування зберігаються на цьому пристрої."); return; }
    setBusy(true); setAuthMessage(signup ? "Створюємо акаунт…" : "Виконуємо вхід…");
    const result = signup ? await cloudClient.auth.signUp({ email: email.trim(), password }) : await cloudClient.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setAuthMessage(result.error.message); return; }
    if (signup && !result.data.session) { setAuthMessage("Перевірте пошту й підтвердьте email, щоб завершити реєстрацію."); return; }
    const signedInUser = result.data.user;
    setUser(signedInUser); setAuthMessage("Вхід виконано. Синхронізуємо профілі…");
    await pullCloud(cloudClient, signedInUser);
    setAuthOpen(false); setSyncLabel("Синхронізовано");
  };

  const dateLabel = dayOffset === 0 ? "Сьогодні" : dayOffset === -1 ? "Вчора" : dayOffset === 1 ? "Завтра" : new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(new Date(Date.now() + dayOffset * 86400000));
  const updatedLabel = dayOffset !== 0 ? "Для цієї дати графік не завантажено" : data.updatedAt ? `Оновлено ${new Date(data.updatedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}` : "Дані графіка ще не завантажено";

  return (
    <>
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <header className="topbar wrap">
        <a className="brand" href="#home" aria-label="Світло, на головну"><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18.2 2 7.7 17h7.1L13.9 30l10.4-16h-7.1L18.2 2Z" fill="currentColor" /></svg></span><span>світло<span className="brand-dot">.</span></span></a>
        <nav className={`nav ${menuOpen ? "open" : ""}`}><a href="#schedule" onClick={() => setMenuOpen(false)}>Графік</a><a href="#download" onClick={() => setMenuOpen(false)}>Застосунок</a><a href="#why-account" onClick={() => setMenuOpen(false)}>Можливості</a><a href="#about" onClick={() => setMenuOpen(false)}>Про сервіс</a></nav>
        <div className="top-actions"><span className={`sync-state ${user ? "online" : ""}`}><i /><span>{syncLabel}</span></span><button className="button button-dark" onClick={() => { setAuthMessage(user ? `Ви увійшли як ${user.email}. Профілі синхронізуються між пристроями.` : ""); setAuthOpen(true); }}>{user ? "Мій акаунт" : "Увійти"} <span>↗</span></button><button className="menu-button" aria-label="Відкрити меню" onClick={() => setMenuOpen(!menuOpen)}>☰</button></div>
      </header>

      <main className="wrap" id="home">
        <section className="hero">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> КИЇВСЬКА ОБЛАСТЬ <span className="eyebrow-line" /> ДТЕК</div><h1>Плануйте день.<br /><span>Навіть без світла.</span></h1><p className="hero-text">Ваш графік, адреси й групи — зібрані в одному спокійному місці. Працює без акаунта, синхронізується між пристроями після входу.</p><div className="hero-actions"><a href="#schedule" className="button button-green">Переглянути графік <span>↓</span></a><button className="text-button" onClick={() => setAuthOpen(true)}>Увійти та синхронізувати <span>↗</span></button></div><div className="hero-foot"><span className="avatars"><i>К</i><i>О</i><i>С</i></span><span>Ваші налаштування залишаються під вашим контролем</span></div></div>
          <div className="hero-art" aria-label="Ілюстрація графіка відключень"><div className="sun-orbit"><span /><i /></div><div className="floating-label label-top"><span className="pulse" /> ГРАФІК НА СЬОГОДНІ</div><div className="preview-card"><div className="preview-head"><div><span className="small-caps">ВАША АДРЕСА</span><strong>{address || "Додайте адресу або групу"}</strong></div><button className="icon-button" onClick={() => openProfile(false)} aria-label="Налаштувати адресу">↗</button></div><div className="preview-status"><span className="status-icon">✳</span><div><small>ЗАРАЗ ЗА ГРАФІКОМ</small><strong>{statusLabels[status]}</strong></div><span className="status-group">{currentProfile?.group || "—"}</span></div><div className="mini-bars">{activeSchedule.map((state, index) => <i className={`mini-bar ${state}`} key={index} />)}</div><div className="mini-hours"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><div className="preview-footer"><span><i className="legend on" /> Є світло</span><span><i className="legend off" /> Вимкнення</span><button onClick={() => document.querySelector("#schedule")?.scrollIntoView({ behavior: "smooth" })}>Детальніше ↗</button></div></div><div className="floating-label label-bottom"><span className="tiny-spark">✦</span> ЗБЕРЕЖЕНО НА ЦЬОМУ ПРИСТРОЇ</div><div className="hero-asterisk">✳</div></div>
        </section>

        <section className="dashboard" id="schedule"><div className="section-heading"><div><div className="eyebrow">ВАШ ПРОСТІР</div><h2>Графік на сьогодні</h2></div><div className="date-switch"><button onClick={() => setDayOffset((value) => value - 1)} aria-label="Попередній день">←</button><span>{dateLabel}</span><button onClick={() => setDayOffset((value) => value + 1)} aria-label="Наступний день">→</button></div></div>
          <div className="dashboard-grid"><div className="schedule-card glass"><div className="card-heading"><div><span className="small-caps muted">СТАН НА ЗАРАЗ</span><h3>{statusLabels[status]}</h3></div><span className="live-pill"><i /> За графіком</span></div><div className="address-line"><span className="pin">⌖</span><span>{address || "Адресу ще не додано · можна обрати групу вручну"}</span><button onClick={() => openProfile(false)}>Змінити ↗</button></div><p className="schedule-source">Графік показано з кешу застосунку або акаунта. Якщо даних ще немає, перевірте графік у ДТЕК-застосунку.</p><div className="timeline-wrap"><div className="time-now" style={{ "--hour-position": `${(now.getHours() + now.getMinutes() / 60) / 24 * 100}%` }}><b>ЗАРАЗ</b><i /></div><div className="timeline">{activeSchedule.map((state, index) => <div className={`hour-block ${state}`} title={`${String(index).padStart(2, "0")}:00 · ${statusLabels[state]}`} key={index} />)}</div><div className="hour-labels">{[0, 6, 12, 18, 24].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div></div><div className="schedule-legend"><span><i className="legend on" /> Є світло</span><span><i className="legend off" /> Немає світла</span><span><i className="legend maybe" /> Можливе вимкнення</span><span><i className="legend unknown" /> Немає даних</span><span className="legend-note">Плановий графік ДТЕК</span></div><div className="schedule-foot"><span>{updatedLabel}</span><button className="refresh-button" onClick={async () => { if (cloudClient && user) await pullCloud(cloudClient, user, true); else showToast("Показано локальний кеш. Увійдіть, щоб синхронізувати дані."); }}>↻ <span>Синхронізувати</span></button></div></div>
            <aside className="side-column"><div className="groups-card glass"><div className="card-heading"><div><span className="small-caps muted">ЗБЕРЕЖЕНІ ПРОФІЛІ</span><h3>Ваші групи</h3></div><button className="round-add" onClick={() => openProfile(true)} aria-label="Додати групу">+</button></div><p className="subtle">Перемикайтеся між адресами та групами в один дотик.</p><div className="group-list">{data.profiles.map((profile) => <button className={`group-item ${profile.id === data.activeId ? "active" : ""}`} key={profile.id} onClick={() => void chooseProfile(profile.id)}><span className="group-number">{profile.group || "—"}</span><span className="group-info"><strong>{profile.name || addressOf(profile) || "Профіль"}</strong><small>{addressOf(profile) || "Групу вибрано вручну"}</small></span><span>{profile.id === data.activeId ? "✓" : "↗"}</span></button>)}</div><button className="add-group-link" onClick={() => openProfile(true)}>＋ Додати групу або адресу</button></div><div className="note-card"><span className="note-icon">✦</span><div><strong>Завжди під рукою</strong><p>Додайте Світло на головний екран або встановіть Android-застосунок.</p><a href="#about">Про застосунок ↗</a></div></div></aside>
          </div>
        </section>

        <section className="account-promo" id="why-account"><div className="promo-icon">⌁</div><div className="promo-copy"><div className="eyebrow">ВАШ ВИБІР</div><h2>Без акаунта — теж працює.</h2><p>Адреси, групи та графік зберігаються на цьому пристрої. Увійдіть, якщо хочете мати ті самі налаштування на сайті й у застосунку — після входу дані можна синхронізувати між пристроями.</p></div><div className="promo-action"><button className="button button-dark" onClick={() => setAuthOpen(true)}>Створити акаунт <span>↗</span></button><span>Безкоштовно · можна продовжити без входу</span></div><div className="promo-decoration">✳</div></section>
        <DownloadSection />
        <section className="features" id="about"><div className="feature"><span>01</span><h3>Ваші групи поруч</h3><p>Кілька адрес і груп — під рукою. Перемикайте графік без зайвих кроків.</p></div><div className="feature"><span>02</span><h3>Працює офлайн</h3><p>Останній збережений графік доступний, навіть якщо мережа зникла.</p></div><div className="feature"><span>03</span><h3>Сповіщення вчасно</h3><p>Налаштуйте нагадування перед плановим вимкненням і ввімкненням у застосунку.</p></div><div className="feature"><span>04</span><h3>Офіційне джерело</h3><p>Планові графіки стосуються ДТЕК Київських регіональних електромереж.</p></div></section>
      </main>

      <footer className="wrap footer"><a className="brand" href="#home"><span className="brand-mark"><svg viewBox="0 0 32 32"><path d="M18.2 2 7.7 17h7.1L13.9 30l10.4-16h-7.1L18.2 2Z" fill="currentColor" /></svg></span><span>світло<span className="brand-dot">.</span></span></a><span>Плануйте з ясністю.</span><span>Дані графіків можуть оновлюватися ДТЕК.</span></footer>

      {authOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close-button" aria-label="Закрити" onClick={() => setAuthOpen(false)}>×</button><div className="modal-mark">✳</div><div className="eyebrow">ВАШІ ДАНІ — НА ВАШИХ ПРИСТРОЯХ</div><h2 id="auth-title">{user ? "Ваш акаунт" : signup ? "Створіть акаунт" : "Увійдіть у Світло"}</h2><p className="modal-copy">Синхронізуйте адреси й групи на сайті та в Android-застосунку. Без акаунта застосунок продовжить працювати як раніше.</p>{user ? <><p className="auth-message">Ви увійшли як {user.email}. Профілі синхронізуються між пристроями.</p><button className="button button-green modal-action" onClick={async () => { await cloudClient?.auth.signOut(); setUser(null); setSyncLabel("Локальний режим"); setAuthOpen(false); }}>Вийти з акаунта</button></> : <><form className="auth-form" onSubmit={handleAuth}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label><label>Пароль<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Щонайменше 8 символів" required /></label><button className="button button-green" disabled={busy} type="submit">{busy ? "Зачекайте…" : signup ? "Створити акаунт" : "Увійти"} <span>↗</span></button></form><button className="auth-switch" onClick={() => { setSignup(!signup); setAuthMessage(""); }}>{signup ? "Вже є акаунт? Увійти" : "Ще немає акаунта? Створити"}</button>{authMessage && <p className="auth-message" role="status">{authMessage}</p>}<p className="auth-privacy">Вхід захищений Supabase. Паролі не зберігаються на цьому сайті.</p></>}</section></div>}
      {profileOpen && <ProfileDialog profile={currentProfile} addMode={addMode} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {!ready && <div className="boot-screen" aria-label="Завантаження"><span className="brand-mark">✳</span></div>}
    </>
  );
}

