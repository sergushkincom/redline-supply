'use client';

import { Boxes, House, PieChart, Send, Building2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { useDemo } from '@/lib/store';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', key: 'home' as const, icon: House },
  { href: '/suppliers', key: 'suppliers' as const, icon: Building2 },
  { href: '/articles', key: 'articles' as const, icon: Boxes },
  { href: '/requests', key: 'requests' as const, icon: Send },
  { href: '/reports/cbam', key: 'reports' as const, icon: PieChart },
];

function active(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href.startsWith('/reports')) return pathname.startsWith('/reports');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useDemo((state) => state.role);
  const locale = useDemo((state) => state.locale);
  const notice = useDemo((state) => state.notice);
  const data = useDemo((state) => state.data);
  const setRole = useDemo((state) => state.setRole);
  const setLocale = useDemo((state) => state.setLocale);
  const reset = useDemo((state) => state.reset);
  const clearNotice = useDemo((state) => state.clearNotice);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = data.users.find((item) => item.role === role) ?? data.users[0];

  useEffect(() => {
    void useDemo.persist.rehydrate()?.catch(() => {
      useDemo.persist.clearStorage();
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function chooseRole(next: Role) {
    setRole(next);
    if (pathname.includes('/review')) return;
    if (next === 'compliance') router.push('/reports/cbam');
    else router.push('/');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        {t(locale, 'skip')}
      </a>
      <aside className="flex w-[240px] shrink-0 flex-col bg-nav">
        <div className="flex items-center gap-2 px-3 py-4">
          <span className="flex size-8 items-center justify-center rounded-[8px] bg-brand-fill text-[13px] font-semibold text-white">R</span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] leading-5 font-medium">{t(locale, 'product')}</span>
            <span className="block truncate text-[12px] leading-4 text-tertiary">{t(locale, 'workspace')}</span>
          </span>
        </div>
        <form
          className="px-3"
          onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget).get('q');
            router.push(`/suppliers?q=${encodeURIComponent(String(query ?? ''))}`);
          }}
        >
          <input
            name="q"
            aria-label={t(locale, 'searchSuppliers')}
            placeholder={t(locale, 'search')}
            className="h-[34px] w-full rounded-[6px] border border-line-strong bg-white px-3 text-[13px] outline-none"
          />
        </form>
        <nav className="mt-4 px-2" aria-label={t(locale, 'groupSupply')}>
          <p className="px-2 pb-1 text-[11px] leading-4 font-medium tracking-[0.06em] text-tertiary">{t(locale, 'groupSupply')}</p>
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const on = active(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-[8px] px-2 text-[13px] leading-[18px]',
                      on ? 'bg-brand-soft font-medium text-brand' : 'text-secondary hover:bg-white/60',
                    )}
                    aria-current={on ? 'page' : undefined}
                  >
                    <Icon size={16} aria-hidden />
                    {t(locale, item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto border-t border-line/70 p-3">
          <button type="button" className="flex w-full items-center gap-2 rounded-[8px] p-1 text-left hover:bg-white/60" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label={t(locale, 'menu')}>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-[12px] font-medium text-brand">
              {user?.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-[18px]">{user?.name}</span>
              <span className="block truncate text-[12px] leading-4 text-tertiary">{t(locale, role)}</span>
            </span>
          </button>
          {menuOpen ? (
            <div className="mt-2 rounded-[8px] bg-white p-2 shadow-card">
              <p className="px-1 text-[12px] leading-4 text-tertiary">{t(locale, 'resetHint')}</p>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                data-testid="reset-demo"
                onClick={() => {
                  reset();
                  setMenuOpen(false);
                  router.push('/');
                }}
              >
                {t(locale, 'reset')}
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-3 px-4">
          <div className="flex items-center gap-1 text-[12px] leading-4 font-medium" role="group" aria-label={t(locale, 'language')}>
            {(['en', 'de'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLocale(item)}
                className={cn('rounded-[6px] px-2 py-1', locale === item ? 'bg-white text-brand' : 'text-tertiary')}
                aria-pressed={locale === item}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex rounded-[8px] bg-white p-0.5 shadow-card" role="radiogroup" aria-label={t(locale, 'roleSwitch')} data-testid="role-switcher">
            {(['buyer', 'compliance', 'head'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={role === item}
                onClick={() => chooseRole(item)}
                className={cn('h-7 rounded-[6px] px-2 text-[12px] leading-4 font-medium', role === item ? 'bg-brand-soft text-brand' : 'text-secondary')}
              >
                {t(locale, item)}
              </button>
            ))}
          </div>
        </header>
        {notice ? (
          <div className="mx-3 mb-2 flex items-center justify-between rounded-[8px] bg-white px-3 py-2 text-[13px] shadow-card" role="status">
            <span>{t(locale, notice === 'applied' ? 'appliedNotice' : notice === 'reminded' ? 'remindedNotice' : notice === 'sent' ? 'sentNotice' : 'resetHint')}</span>
            <button type="button" className="text-tertiary" onClick={clearNotice}>
              {t(locale, 'close')}
            </button>
          </div>
        ) : null}
        <div id="content" className="min-h-0 flex-1 px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}
