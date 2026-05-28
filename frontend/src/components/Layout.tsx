import { Link, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../store/theme";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/search/new", label: "New search" },
];

export function Layout() {
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              aria-hidden
              className="shrink-0"
            >
              <rect width="36" height="36" rx="10" className="fill-[var(--color-accent)]" />
              <path
                d="M11 18h14M18 11v14"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p className="font-semibold text-lg leading-tight group-hover:text-[var(--color-accent)] transition-colors">
                Personal Medfinder
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Organize pharmacy outreach
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.to
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={toggle}
              className="ml-1 p-2 rounded-lg text-[var(--color-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted)]">
        Stock must be confirmed directly with each pharmacy. Not real-time inventory.
      </footer>
    </div>
  );
}
