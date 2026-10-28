"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "../lib/supabaseClient";

const links = [
  ["/", "Світло"],
  ["/kadr", "Кадр"],
  ["/fitness", "Фітнес"],
  ["/account", "Кабінет"],
];

export default function SiteHeader({ variant = "default" }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return undefined;
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user || null);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const kadr = variant === "kadr";
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Мій кабінет";
  return (
    <header className={`suite-topbar wrap ${kadr ? "suite-topbar-kadr" : ""}`}>
      <a className="suite-brand" href="/" aria-label="На головну">
        <span className={`suite-brand-mark ${kadr ? "suite-mark-kadr" : ""}`}>{kadr ? "К" : "✳"}</span>
        <span>{kadr ? "Кадр" : "Світло × Кадр"}<i>.</i></span>
      </a>
      <nav className={`suite-nav ${menuOpen ? "is-open" : ""}`} aria-label="Головна навігація">
        {links.map(([href, label]) => <a key={href} className={pathname === href ? "active" : ""} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <div className="suite-actions">
        <a className="suite-account" href="/account">
          <span className="suite-avatar">{user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" /> : user ? name.slice(0, 1).toUpperCase() : "↗"}</span>
          <span>{user ? "Мій кабінет" : "Увійти"}</span>
        </a>
        <button className="suite-menu-button" type="button" aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "×" : "☰"}</button>
      </div>
    </header>
  );
}
