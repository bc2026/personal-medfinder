import { Link, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../store/theme";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/search/new", label: "New search" },
];

function LogoMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect
        width="40"
        height="40"
        rx="10"
        className="fill-[var(--color-accent)]"
      />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fill="#fffcf7"
        fontSize="15"
        fontWeight="600"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        Rx
      </text>
    </svg>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group min-w-0">
            <LogoMark />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight truncate group-hover:text-[var(--color-accent)] transition-colors">
                Personal Medfinder
              </p>
              <p className="text-xs text-[var(--color-muted)] tracking-wide uppercase">
                Pharmacy outreach
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 shrink-0">
            {nav.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-[var(--color-accent)] text-[#fffcf7] shadow-sm"
                      : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={toggle}
              className="ml-1 p-2.5 rounded-xl text-[var(--color-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] transition-colors"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <ThemeIcon dark={dark} />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)] py-5 text-center">
        <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto leading-relaxed px-4">
          Stock must be confirmed directly with each pharmacy.
          <span className="block mt-0.5 opacity-80">Not real-time inventory.</span>
        </p>
      </footer>
    </div>
  );
}
