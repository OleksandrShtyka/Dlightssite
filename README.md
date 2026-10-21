# Світло — сайт графіків ДТЕК

Сайт побудований на Next.js App Router і React та об’єднує два окремі проєкти: «Світло» для графіків ДТЕК і «Кадр» для кінощоденника. «Світло» зберігає профілі через `account_settings`, «Кадр» — записи через окрему `movie_diaries`. В обох застосунках працює один Supabase акаунт, але дані проєктів розділені.

## Локальний запуск

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Заповніть `.env.local` значеннями вашого Supabase-проєкту:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Це публічний клієнтський ключ Supabase. Не додавайте `service_role` або інший секретний ключ до змінних `NEXT_PUBLIC_`.

## Supabase

1. Увімкніть Email/Password у налаштуваннях Authentication.
2. Виконайте SQL з `supabase/schema.sql` у SQL Editor. Для наявного проєкту достатньо окремо запустити `supabase/migrations/20261021_movie_diaries.sql`; це створить таблицю «Кадр» з RLS-політиками, не змінюючи `account_settings`.
3. В Authentication → URL Configuration встановіть **Site URL** на production-домен сайту й додайте цей домен до **Redirect URLs** (наприклад, `https://your-domain.example/**`). Сайт передає адресу поточного домену під час реєстрації; Supabase надсилає посилання лише на дозволені Redirect URLs.
4. Встановіть обидві змінні з прикладу в локальному `.env.local` та в налаштуваннях Vercel для Production, Preview і Development.

Якщо змінних Supabase немає, сайт працює в локальному режимі без входу.

## Розгортання на Vercel

Імпортуйте репозиторій `OleksandrShtyka/Dlightssite` у Vercel. Платформа автоматично визначить Next.js. Коренева директорія — репозиторій, команда збірки — `npm run build`. Додайте `NEXT_PUBLIC_SUPABASE_URL` і `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` у Project Settings → Environment Variables та виконайте новий deployment.

## Публікація Android-застосунку

Створіть GitHub Release з новим тегом (наприклад, `v1.0.9`) і додайте підписаний release APK як asset із розширенням `.apk`. Сайт показує останню версію та посилання на файл, а Android-застосунок може перевірити й завантажити оновлення у своїх налаштуваннях. Сайт для кожного нового APK перевипускати не потрібно. Android перевіряє підпис APK, тому кожне оновлення має бути підписане тим самим ключем, що й попереднє; установлення завершується системним підтвердженням Android.

APK «Кадр» доступний на сторінці `/kadr` і через стабільне посилання `/api/releases/kadr`, яке переспрямовує на останній APK «Кадру» в GitHub Releases. Для публікації створіть GitHub Release та додайте asset з іменем на зразок `kadr-moviediary-v1.0.3.apk`; застосунок перевіряє ці релізи під час запуску.

Після входу в Android-застосунок локальна колекція об’єднується з `movie_diaries` і синхронізується. Refresh token у застосунку шифрується через Android Keystore. Видалені записи синхронізуються як tombstones, щоб не з’являлися знову на іншому пристрої. Без входу щоденник залишається локальним.

## Джерело графіка

Сайт працює як хмарне сховище профілів. Активну групу для конкретної інсталяції задає Android-застосунок; перемикання групи на сайті змінює лише попередній перегляд. Сайт не вигадує графік, якщо актуальних даних немає; перевіряйте планові й аварійні повідомлення в офіційних каналах ДТЕК.
