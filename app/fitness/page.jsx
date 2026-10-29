"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { getSupabaseClient } from "../lib/supabaseClient";

const emptyPayload = { profile: {}, sessions: [], supplements: [], local: {} };
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const decode = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
};
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function sessionDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.valueOf()) ? "Дата не вказана" : new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function FitnessPage() {
  const client = useMemo(() => getSupabaseClient(), []);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [payload, setPayload] = useState(emptyPayload);
  const payloadRef = useRef(emptyPayload);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionForm, setSessionForm] = useState({ date: localDate(), workoutType: "full_body", durationMin: 60, exercises: [], notes: "" });
  const [mealForm, setMealForm] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", meal: 0 });
  const [suppForm, setSuppForm] = useState({ name: "", totalWeightG: "", servingSizeG: "", servingsPerDay: 1, price: "", purchaseDate: localDate(), notes: "" });
  const [suppEditId, setSuppEditId] = useState(null);
  const [weightForm, setWeightForm] = useState("");
  const [profileForm, setProfileForm] = useState({ monthlyGymCost: "", fitnessGoal: "general", fitnessBadge: "" });

  const load = useCallback(async (activeClient, activeUser) => {
    setMessage("");
    const { data, error } = await activeClient.from("fitness_tracker_data").select("payload,updated_at").eq("user_id", activeUser.id).maybeSingle();
    if (error) {
      setMessage("Не вдалося завантажити фітнес-дані. Перевірте, чи виконана міграція fitness_tracker_data у Supabase.");
      return;
    }
    const next = { ...emptyPayload, ...(data?.payload || {}), local: { ...(data?.payload?.local || {}) } };
    payloadRef.current = next;
    setPayload(next);
    setProfileForm({
      monthlyGymCost: next.profile?.monthlyGymCost ?? "",
      fitnessGoal: next.profile?.fitnessGoal || "general",
      fitnessBadge: next.profile?.fitnessBadge || "",
    });
    setMessage(data ? `Синхронізовано ${new Date(data.updated_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}.` : "Хмарний фітнес-профіль поки порожній — можна почати з вебсайту.");
  }, []);

  useEffect(() => {
    if (!client) { setMessage("Додайте Supabase URL і publishable key у змінні середовища Vercel."); setReady(true); return undefined; }
    let alive = true;
    const apply = (nextUser) => {
      setUser(nextUser);
      if (nextUser) void load(client, nextUser);
      else { payloadRef.current = emptyPayload; setPayload(emptyPayload); }
      setReady(true);
    };
    client.auth.getSession().then(({ data }) => { if (alive) apply(data.session?.user || null); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { if (alive) apply(session?.user || null); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [client, load]);

  const local = payload.local || {};
  const sessions = Array.isArray(payload.sessions) ? payload.sessions.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))) : [];
  const supplements = Array.isArray(payload.supplements) ? payload.supplements : [];
  const nutrition = Array.isArray(decode(local.nutrition_entries, [])) ? decode(local.nutrition_entries, []) : [];
  const goals = decode(local.nutrition_goals, {}) || {};
  const weights = Array.isArray(decode(local.nutrition_weight, [])) ? decode(local.nutrition_weight, []) : [];
  const weightProgress = decode(local.weight_progression_v1, []);
  const workoutProgram = decode(local.workout_program_v1, null);
  const unlocked = decode(local.achievements_unlocked, []);
  const exp = num(local.exp_total);
  const streak = num(local.exp_streak_days);
  const todayKey = localDate();
  const todaysMeals = nutrition.filter((entry) => {
    const time = num(entry.loggedAt);
    return time > 0 && dateKey(new Date(time)) === todayKey;
  });
  const todayCalories = todaysMeals.reduce((sum, entry) => sum + num(entry.calories), 0);
  const targetCalories = num(goals.calories) || 2000;
  const latestWeight = weights.slice().sort((a, b) => num(b.date) - num(a.date))[0];
  const monthSessions = sessions.filter((session) => String(session.date || "").slice(0, 7) === todayKey.slice(0, 7)).length;
  const monthlyGymCost = num(payload.profile?.monthlyGymCost);
  const gymCostPerSession = monthSessions ? monthlyGymCost / monthSessions : monthlyGymCost;
  const supplementStatuses = supplements.map((item) => {
    const total = num(item.totalWeightG);
    const serving = num(item.servingSizeG);
    const perDay = Math.max(.1, num(item.servingsPerDay));
    const purchase = new Date(`${item.purchaseDate || todayKey}T00:00:00`);
    const elapsed = Number.isNaN(purchase.valueOf()) ? 0 : Math.max(0, Math.floor((new Date(`${todayKey}T00:00:00`) - purchase) / 86400000));
    const remaining = Math.max(0, total - elapsed * serving * perDay);
    const daysLeft = total && serving ? Math.floor(remaining / (serving * perDay)) : 0;
    const depletion = new Date(`${todayKey}T00:00:00`); depletion.setDate(depletion.getDate() + daysLeft);
    return { ...item, remaining, remainingPct: total ? Math.max(0, Math.min(100, remaining / total * 100)) : 0, daysLeft, depletionDate: sessionDate(depletion), costPerServing: total && serving ? num(item.price) * serving / total : 0 };
  });

  const persist = async (next) => {
    if (!client || !user) return;
    setBusy(true);
    setMessage("Зберігаємо зміни у хмарі…");
    payloadRef.current = next;
    setPayload(next);
    const { error } = await client.from("fitness_tracker_data").upsert({ user_id: user.id, payload: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setBusy(false);
    setMessage(error ? "Синхронізація не вдалася. Перевірте мережу й RLS-політики таблиці." : "Зміни збережено у вашому фітнес-профілі.");
  };

  const addSession = async (event) => {
    event.preventDefault();
    if (!sessionForm.workoutType || !sessionForm.date || num(sessionForm.durationMin) < 1) return;
    const exercises = sessionForm.exercises.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), sets: Math.max(1, num(item.sets)), reps: Math.max(1, num(item.reps)), weightKg: Math.max(0, num(item.weightKg)) }));
    const volumeKg = exercises.reduce((sum, item) => sum + item.sets * item.reps * item.weightKg, 0);
    const row = { id: crypto.randomUUID(), date: sessionForm.date, durationMin: num(sessionForm.durationMin), workoutType: sessionForm.workoutType, volumeKg, exercises, notes: sessionForm.notes.trim() || null };
    await persist({ ...payloadRef.current, sessions: [row, ...(payloadRef.current.sessions || [])] });
    setSessionForm({ date: localDate(), workoutType: "full_body", durationMin: 60, exercises: [], notes: "" });
  };

  const addExercise = () => setSessionForm((current) => ({ ...current, exercises: [...current.exercises, { name: "", sets: 3, reps: 10, weightKg: 0 }] }));
  const updateExercise = (index, patch) => setSessionForm((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const removeExercise = (index) => setSessionForm((current) => ({ ...current, exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index) }));

  const deleteSession = async (id) => {
    await persist({ ...payloadRef.current, sessions: (payloadRef.current.sessions || []).filter((entry) => entry.id !== id) });
  };

  const addMeal = async (event) => {
    event.preventDefault();
    if (!mealForm.name.trim() || !num(mealForm.calories)) return;
    const current = payloadRef.current;
    const entries = Array.isArray(decode(current.local?.nutrition_entries, [])) ? decode(current.local?.nutrition_entries, []) : [];
    const entry = { id: crypto.randomUUID(), name: mealForm.name.trim(), calories: num(mealForm.calories), protein: num(mealForm.protein), carbs: num(mealForm.carbs), fat: num(mealForm.fat), weight: 0, meal: num(mealForm.meal), loggedAt: Date.now() };
    await persist({ ...current, local: { ...current.local, nutrition_entries: JSON.stringify([entry, ...entries]) } });
    setMealForm({ name: "", calories: "", protein: "", carbs: "", fat: "", meal: 0 });
  };

  const deleteMeal = async (id) => {
    const current = payloadRef.current;
    const entries = Array.isArray(decode(current.local?.nutrition_entries, [])) ? decode(current.local?.nutrition_entries, []) : [];
    await persist({ ...current, local: { ...current.local, nutrition_entries: JSON.stringify(entries.filter((entry) => entry.id !== id)) } });
  };

  const addSupplement = async (event) => {
    event.preventDefault();
    if (!suppForm.name.trim() || num(suppForm.totalWeightG) <= 0 || num(suppForm.servingSizeG) <= 0 || num(suppForm.servingsPerDay) <= 0) return;
    const current = payloadRef.current;
    const item = { id: suppEditId || crypto.randomUUID(), name: suppForm.name.trim(), totalWeightG: num(suppForm.totalWeightG), servingSizeG: num(suppForm.servingSizeG), servingsPerDay: num(suppForm.servingsPerDay), price: num(suppForm.price), purchaseDate: suppForm.purchaseDate || todayKey, notes: suppForm.notes.trim() || null };
    const next = suppEditId ? current.supplements.map((entry) => entry.id === suppEditId ? item : entry) : [item, ...(current.supplements || [])];
    await persist({ ...current, supplements: next });
    setSuppEditId(null);
    setSuppForm({ name: "", totalWeightG: "", servingSizeG: "", servingsPerDay: 1, price: "", purchaseDate: localDate(), notes: "" });
  };

  const editSupplement = (item) => {
    setSuppEditId(item.id);
    setSuppForm({ name: item.name || "", totalWeightG: item.totalWeightG || "", servingSizeG: item.servingSizeG || "", servingsPerDay: item.servingsPerDay || 1, price: item.price || "", purchaseDate: item.purchaseDate || todayKey, notes: item.notes || "" });
  };

  const deleteSupplement = async (id) => {
    const current = payloadRef.current;
    await persist({ ...current, supplements: (current.supplements || []).filter((item) => item.id !== id) });
  };

  const logWeight = async (event) => {
    event.preventDefault();
    if (!num(weightForm)) return;
    const current = payloadRef.current;
    const history = Array.isArray(decode(current.local?.nutrition_weight, [])) ? decode(current.local?.nutrition_weight, []) : [];
    await persist({ ...current, local: { ...current.local, nutrition_weight: JSON.stringify([...history, { date: Date.now(), kg: num(weightForm) }]) } });
    setWeightForm("");
  };

  const saveGoals = async (event) => {
    event.preventDefault();
    const current = payloadRef.current;
    const nextGoals = { calories: num(goalsForm.calories), protein: num(goalsForm.protein), carbs: num(goalsForm.carbs), fat: num(goalsForm.fat) };
    await persist({ ...current, local: { ...current.local, nutrition_goals: JSON.stringify(nextGoals) } });
  };

  const [goalsForm, setGoalsForm] = useState({ calories: 2000, protein: 150, carbs: 200, fat: 65 });
  useEffect(() => {
    setGoalsForm({ calories: num(goals.calories) || 2000, protein: num(goals.protein) || 150, carbs: num(goals.carbs) || 200, fat: num(goals.fat) || 65 });
  }, [payload]);

  const saveProfile = async (event) => {
    event.preventDefault();
    const current = payloadRef.current;
    await persist({ ...current, profile: { ...current.profile, monthlyGymCost: num(profileForm.monthlyGymCost), fitnessGoal: profileForm.fitnessGoal, fitnessBadge: profileForm.fitnessBadge.trim() || "Athlete" } });
  };

  const macro = (key, value) => `${Math.round(value)} g ${key}`;
  const planTitle = typeof workoutProgram === "string" ? workoutProgram : (workoutProgram?.title || workoutProgram?.name || workoutProgram?.programName || "Ваш персональний план");

  return (
    <main className="suite-page fitness-page">
      <div className="suite-glow suite-glow-one" /><div className="suite-glow suite-glow-two" />
      <SiteHeader />
      <div className="suite-wrap">
        <section className="suite-hero fitness-hero">
          <div><span className="suite-eyebrow"><i /> FITNESS TRACKER · ПЕРСОНАЛЬНИЙ ПРОГРЕС</span><h1>Сильніше —<br /><em>у своєму ритмі.</em></h1><p>Тренування, харчування, добавки й прогрес — в одному зрозумілому просторі. Ваші записи з сайту синхронізуються з фітнес-застосунком через спільний акаунт.</p><div className="fitness-hero-actions"><a className="suite-primary" href={user ? "#workouts" : "/account"}>{user ? "Додати тренування" : "Увійти й почати"}<span>↓</span></a><a className="suite-outline" href="/api/releases/fitness">Завантажити Android ↗</a></div></div>
          <div className="fitness-orbit" aria-hidden="true"><div className="fitness-ring" /><div className="fitness-ring ring-two" /><div className="fitness-ring ring-three" /><div className="fitness-orbit-card"><small>СЬОГОДНІ · ТВОЯ ЦІЛЬ</small><strong>{user ? `${todayCalories} <i>/ ${targetCalories}</i>` : "MOVE"}</strong><span>{user ? "КАЛОРІЙ ЗАПИСАНО" : "MAKE IT COUNT"}</span></div><b>✳</b></div>
        </section>

        {!ready ? <div className="suite-card suite-loading"><span className="suite-spinner" />Завантажуємо фітнес-профіль…</div> : !user ? <section className="fitness-locked suite-card"><div className="suite-icon">⌁</div><div><span className="suite-eyebrow">ЗАХИЩЕНИЙ ОСОБИСТИЙ ПРОСТІР</span><h2>Увійдіть, щоб відкрити свій трекер</h2><p>Тренування, вага, харчові записи й добавки залишаються приватними та доступні тільки у вашому акаунті.</p></div><a className="suite-primary" href="/account">Увійти або створити акаунт <span>↗</span></a></section> : <>
          <div className="fitness-status-line"><span><i /> {message || "Ваші дані підключені до спільного акаунта"}</span><a href="/account">{user.email} ↗</a></div>
          <section className="fitness-metrics">
            <article className="fitness-metric suite-card"><span>ТРЕНУВАННЯ ЦЬОГО МІСЯЦЯ</span><b>{monthSessions}<i> сесій</i></b><small>{sessions.length} загалом збережено</small></article>
            <article className="fitness-metric suite-card"><span>ХАРЧУВАННЯ СЬОГОДНІ</span><b>{todayCalories}<i> ккал</i></b><div className="fitness-progress"><i style={{ width: `${Math.min(100, (todayCalories / targetCalories) * 100)}%` }} /></div><small>Ціль {targetCalories} ккал</small></article>
            <article className="fitness-metric suite-card"><span>ПОТОЧНА ВАГА</span><b>{latestWeight ? `${num(latestWeight.kg).toFixed(1)}` : "—"}<i> кг</i></b><small>{latestWeight ? `Останній запис · ${sessionDate(new Date(num(latestWeight.date)))}` : `${weights.length} вимірювань у журналі`}</small></article>
            <article className="fitness-metric suite-card"><span>АКТИВНІСТЬ</span><b>{streak}<i> днів</i></b><small>{exp.toLocaleString("uk-UA")} очок · {Array.isArray(unlocked) ? unlocked.length : 0} досягнень</small></article>
          </section>

          <section className="fitness-main-grid" id="workouts">
            <article className="fitness-panel suite-card">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">01 · ЗАЛ</span><h2>Записати тренування</h2><p>Запис з’явиться і в Android-застосунку.</p></div><span className="fitness-panel-icon">↗</span></div>
              <form className="fitness-form" onSubmit={addSession}>
                <div className="fitness-form-row"><label>Дата<input type="date" value={sessionForm.date} onChange={(event) => setSessionForm({ ...sessionForm, date: event.target.value })} required /></label><label>Тривалість, хв<input type="number" min="1" max="600" value={sessionForm.durationMin} onChange={(event) => setSessionForm({ ...sessionForm, durationMin: event.target.value })} required /></label></div>
                <label>Тип тренування<select value={sessionForm.workoutType} onChange={(event) => setSessionForm({ ...sessionForm, workoutType: event.target.value })}><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Ноги</option><option value="upper">Верх тіла</option><option value="lower">Низ тіла</option><option value="full_body">Все тіло</option><option value="cardio">Кардіо</option><option value="other">Інше</option></select></label>
                <div className="fitness-exercise-heading"><span>Вправи та робочі підходи</span><button type="button" className="suite-outline" onClick={addExercise}>＋ Додати вправу</button></div>
                {sessionForm.exercises.map((exercise, index) => <div className="fitness-exercise-row" key={index}><label>Вправа<input value={exercise.name} onChange={(event) => updateExercise(index, { name: event.target.value })} placeholder="Наприклад, жим лежачи" maxLength={70} /></label><label>Підходи<input type="number" min="1" value={exercise.sets} onChange={(event) => updateExercise(index, { sets: event.target.value })} /></label><label>Повторення<input type="number" min="1" value={exercise.reps} onChange={(event) => updateExercise(index, { reps: event.target.value })} /></label><label>Кг<input type="number" min="0" step="0.5" value={exercise.weightKg} onChange={(event) => updateExercise(index, { weightKg: event.target.value })} /></label><button className="fitness-remove-exercise" type="button" onClick={() => removeExercise(index)} aria-label="Прибрати вправу">×</button></div>)}
                <label>Нотатки<textarea rows="2" value={sessionForm.notes} onChange={(event) => setSessionForm({ ...sessionForm, notes: event.target.value })} maxLength={300} placeholder="Самопочуття, акценти, результати…" /></label>
                <button className="suite-primary" disabled={busy} type="submit">Зберегти тренування <span>↗</span></button>
              </form>
            </article>

            <article className="fitness-panel suite-card nutrition-panel">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">02 · ХАРЧУВАННЯ</span><h2>Щоденник їжі</h2><p>{todayCalories} із {targetCalories} ккал на сьогодні.</p></div><span className="fitness-panel-icon nutrition-icon">◒</span></div>
              <div className="macro-row"><span>{macro("білка", todaysMeals.reduce((s, e) => s + num(e.protein), 0))}</span><span>{macro("вуглеводів", todaysMeals.reduce((s, e) => s + num(e.carbs), 0))}</span><span>{macro("жирів", todaysMeals.reduce((s, e) => s + num(e.fat), 0))}</span></div>
              <form className="fitness-form" onSubmit={addMeal}>
                <label>Що з’їли?<input value={mealForm.name} onChange={(event) => setMealForm({ ...mealForm, name: event.target.value })} placeholder="Назва страви або продукту" maxLength={90} required /></label>
                <div className="fitness-form-row"><label>Ккал<input type="number" min="1" value={mealForm.calories} onChange={(event) => setMealForm({ ...mealForm, calories: event.target.value })} required /></label><label>Білок, г<input type="number" min="0" value={mealForm.protein} onChange={(event) => setMealForm({ ...mealForm, protein: event.target.value })} /></label><label>Вуглеводи, г<input type="number" min="0" value={mealForm.carbs} onChange={(event) => setMealForm({ ...mealForm, carbs: event.target.value })} /></label></div>
                <div className="fitness-form-row"><label>Жири, г<input type="number" min="0" value={mealForm.fat} onChange={(event) => setMealForm({ ...mealForm, fat: event.target.value })} /></label><label>Прийом їжі<select value={mealForm.meal} onChange={(event) => setMealForm({ ...mealForm, meal: event.target.value })}><option value="0">Сніданок</option><option value="1">Обід</option><option value="2">Вечеря</option><option value="3">Перекус</option></select></label></div>
                <button className="suite-primary" disabled={busy} type="submit">Додати запис <span>↗</span></button>
              </form>
              <div className="fitness-record-list">{todaysMeals.slice(0, 5).map((entry) => <div className="fitness-record" key={entry.id}><div><b>{entry.name}</b><small>{new Date(num(entry.loggedAt)).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} · {num(entry.calories)} ккал</small></div><button type="button" onClick={() => void deleteMeal(entry.id)} aria-label={`Видалити ${entry.name}`}>×</button></div>)}{todaysMeals.length === 0 && <div className="fitness-empty-inline">Записи за сьогодні з’являться тут.</div>}</div>
            </article>
          </section>

          <section className="fitness-secondary-grid">
            <article className="fitness-panel suite-card">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">03 · ВІДНОВЛЕННЯ</span><h2>Контроль ваги</h2><p>{weights.length} записів · актуальна вага {latestWeight ? `${num(latestWeight.kg).toFixed(1)} кг` : "ще не вказана"}</p></div><span className="fitness-panel-icon weight-icon">↗</span></div>
              <form className="fitness-inline-form" onSubmit={logWeight}><label>Нова вага, кг<input type="number" min="20" max="400" step="0.1" value={weightForm} onChange={(event) => setWeightForm(event.target.value)} placeholder="72.5" required /></label><button className="suite-primary" disabled={busy}>Записати</button></form>
              <div className="fitness-weight-list">{weights.slice().sort((a, b) => num(b.date) - num(a.date)).slice(0, 5).map((entry, index) => <div className="fitness-record" key={`${entry.date}-${index}`}><div><b>{num(entry.kg).toFixed(1)} кг</b><small>{sessionDate(new Date(num(entry.date)))}</small></div><span className="fitness-record-tag">ЗАМІР</span></div>)}{weights.length === 0 && <div className="fitness-empty-inline">Перший замір допоможе побачити тренд.</div>}</div>
            </article>

            <article className="fitness-panel suite-card">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">04 · ПІДТРИМКА</span><h2>Добавки</h2><p>{supplements.length ? `${supplements.length} позицій у вашому списку.` : "Відстежуйте запас і витрати."}</p></div><span className="fitness-panel-icon supp-icon">✳</span></div>
              <form className="fitness-form" onSubmit={addSupplement}>
                <label>Назва<input value={suppForm.name} onChange={(event) => setSuppForm({ ...suppForm, name: event.target.value })} placeholder="Протеїн, креатин…" maxLength={70} required /></label>
                <div className="fitness-form-row"><label>Упаковка, г<input type="number" min="1" value={suppForm.totalWeightG} onChange={(event) => setSuppForm({ ...suppForm, totalWeightG: event.target.value })} /></label><label>Порція, г<input type="number" min="0.1" step="0.1" value={suppForm.servingSizeG} onChange={(event) => setSuppForm({ ...suppForm, servingSizeG: event.target.value })} /></label></div>
                <div className="fitness-form-row"><label>Порцій на день<input type="number" min="0.1" step="0.1" value={suppForm.servingsPerDay} onChange={(event) => setSuppForm({ ...suppForm, servingsPerDay: event.target.value })} /></label><label>Ціна, ₴<input type="number" min="0" value={suppForm.price} onChange={(event) => setSuppForm({ ...suppForm, price: event.target.value })} /></label></div>
                <div className="fitness-form-row"><label>Дата покупки<input type="date" value={suppForm.purchaseDate} onChange={(event) => setSuppForm({ ...suppForm, purchaseDate: event.target.value })} /></label><label>Нотатки<input value={suppForm.notes} onChange={(event) => setSuppForm({ ...suppForm, notes: event.target.value })} placeholder="Необов’язково" /></label></div>
                <div className="fitness-form-row"><button className="suite-primary" disabled={busy}>{suppEditId ? "Зберегти зміни" : "Додати добавку"} <span>↗</span></button>{suppEditId && <button className="suite-outline" type="button" onClick={() => { setSuppEditId(null); setSuppForm({ name: "", totalWeightG: "", servingSizeG: "", servingsPerDay: 1, price: "", purchaseDate: localDate(), notes: "" }); }}>Скасувати</button>}</div>
              </form>
              <div className="fitness-record-list">{supplementStatuses.map((item) => <div className="fitness-record fitness-supplement-record" key={item.id}><div className="fitness-supplement-progress"><i style={{ width: `${item.remainingPct}%` }} /></div><div className="fitness-supplement-info"><b>{item.name}</b><small>{item.remaining.toFixed(0)} г залишилось · {item.daysLeft} дн. запасу</small><small>Закінчиться {item.depletionDate} · {item.costPerServing.toFixed(2)} ₴ / порція</small></div><div className="fitness-supplement-actions"><button type="button" onClick={() => editSupplement(item)} aria-label={`Редагувати ${item.name}`}>✎</button><button type="button" onClick={() => void deleteSupplement(item.id)} aria-label={`Видалити ${item.name}`}>×</button></div></div>)}{supplements.length === 0 && <div className="fitness-empty-inline">Додайте першу позицію у ваш стек.</div>}</div>
            </article>
          </section>

          <section className="fitness-lower-grid">
            <article className="fitness-panel suite-card">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">05 · ВАША ПРОГРАМА</span><h2>{planTitle}</h2><p>План тренувань із вашого застосунку синхронізується сюди автоматично.</p></div><span className="fitness-panel-icon plan-icon">⌁</span></div>
              {workoutProgram ? <div className="fitness-program-preview">{typeof workoutProgram === "string" ? workoutProgram : <><span>{workoutProgram.goal || workoutProgram.description || "План доступний у вашому фітнес-застосунку."}</span><span>{workoutProgram.daysPerWeek ? `${workoutProgram.daysPerWeek} тренувань на тиждень` : "Перегляньте повну програму в застосунку."}</span></>}</div> : <div className="fitness-empty-inline">Збережена програма з’явиться після синхронізації з Android-застосунком.</div>}
            </article>
            <article className="fitness-panel suite-card">
              <div className="fitness-panel-head"><div><span className="suite-eyebrow">06 · ОСОБИСТИЙ ПРОФІЛЬ</span><h2>Цілі та мотивація</h2><p>Основні параметри фітнес-акаунта.</p></div><span className="fitness-panel-icon goal-icon">✦</span></div>
              <form className="fitness-form" onSubmit={saveProfile}>
                <label>Місячний абонемент, ₴<input type="number" min="0" value={profileForm.monthlyGymCost} onChange={(event) => setProfileForm({ ...profileForm, monthlyGymCost: event.target.value })} placeholder="0" /></label>
                <label>Фокус<select value={profileForm.fitnessGoal} onChange={(event) => setProfileForm({ ...profileForm, fitnessGoal: event.target.value })}><option value="general">Загальна форма</option><option value="strength">Сила</option><option value="hypertrophy">Гіпертрофія</option><option value="endurance">Витривалість</option></select></label>
                <label>Ваш титул<input value={profileForm.fitnessBadge} onChange={(event) => setProfileForm({ ...profileForm, fitnessBadge: event.target.value })} maxLength={40} placeholder="Наприклад, Consistent" /></label>
                <button className="suite-primary" disabled={busy}>Зберегти цілі <span>↗</span></button>
              </form>
              <form className="fitness-goals-form" onSubmit={saveGoals}><div className="fitness-form-title">ДЕННІ ЦІЛІ ХАРЧУВАННЯ</div><div className="fitness-form-row"><label>Ккал<input type="number" min="500" value={goalsForm.calories} onChange={(event) => setGoalsForm({ ...goalsForm, calories: event.target.value })} /></label><label>Білок, г<input type="number" min="0" value={goalsForm.protein} onChange={(event) => setGoalsForm({ ...goalsForm, protein: event.target.value })} /></label></div><button className="suite-outline" disabled={busy}>Оновити денні цілі</button></form>
            </article>
          </section>

          <section className="fitness-roi-banner suite-card"><div><b>{monthSessions}</b><span>тренувань цього місяця</span></div><i /><div><b>{monthlyGymCost.toLocaleString("uk-UA")} ₴</b><span>вартість абонемента</span></div><i /><div><b>{gymCostPerSession.toFixed(2)} ₴</b><span>вартість одного тренування</span></div></section>
          <section className="fitness-history suite-card">
            <div className="fitness-panel-head"><div><span className="suite-eyebrow">ЖУРНАЛ АКТИВНОСТІ</span><h2>Останні тренування</h2><p>{sessions.length} сесій синхронізовано між сайтом і застосунком.</p></div><a className="suite-outline" href="#workouts">＋ Нове тренування</a></div>
            {sessions.length ? <div className="fitness-session-table"><div className="fitness-session-head"><span>ТРЕНУВАННЯ</span><span>ДАТА</span><span>ЧАС</span><span>ОБ’ЄМ</span><span /></div>{sessions.slice(0, 12).map((session) => <article className="fitness-session-row" key={session.id}><div><b>{session.workoutType || "Тренування"}</b><small>{(session.exercises || []).map((exercise) => exercise.name).filter(Boolean).join(" · ") || session.notes || "Особиста сесія"}</small></div><span>{sessionDate(session.date)}</span><span>{num(session.durationMin)} хв</span><span>{num(session.volumeKg).toLocaleString("uk-UA")} кг</span><button type="button" onClick={() => void deleteSession(session.id)} aria-label={`Видалити ${session.workoutType}`}>×</button></article>)}</div> : <div className="fitness-empty-history"><span>✳</span><h3>Ваш прогрес починається тут</h3><p>Збережіть тренування — і воно з’явиться у спільній історії.</p></div>}
          </section>
        </>}
      </div>
      <footer className="suite-footer suite-wrap"><a href="/">Світло × Кадр<span>.</span></a><span>Ваші фітнес-дані доступні лише вашому акаунту.</span><a href="/account">Особистий кабінет ↗</a></footer>
    </main>
  );
}
