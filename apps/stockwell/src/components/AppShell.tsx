'use client';
import type React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './Icon';
import * as UI from './ui';
import { useUser } from './UserContext';
import { useBrand } from './BrandProvider';
import { useI18n, LANGS } from '@/i18n';

// `label`/`section` are i18n keys resolved with t() at render time.
const NAV_SECTIONS = [
  {
    section: 'nav.sectionWorkspace',
    items: [
      { href: '/admin', icon: 'dashboard', label: 'nav.dashboard' },
      { href: '/admin/analytics', icon: 'chart', label: 'nav.analytics' },
      { href: '/admin/engagement', icon: 'activity', label: 'nav.engagement' },
    ],
  },
  {
    section: 'nav.sectionCatalog',
    items: [
      { href: '/admin/products', icon: 'box', label: 'nav.products' },
      { href: '/admin/inventory', icon: 'layers', label: 'nav.inventory' },
      { href: '/admin/warehouses', icon: 'warehouse', label: 'nav.warehouses' },
    ],
  },
  {
    section: 'nav.sectionSales',
    items: [
      { href: '/admin/pos', icon: 'pos', label: 'nav.pos' },
      { href: '/admin/invoices', icon: 'receipt2', label: 'nav.invoices' },
      { href: '/admin/customers', icon: 'users', label: 'nav.customers' },
      { href: '/admin/returns', icon: 'refund', label: 'nav.returns' },
    ],
  },
  {
    section: 'nav.sectionOperations',
    items: [
      { href: '/admin/orders', icon: 'cart', label: 'nav.orders' },
      { href: '/admin/suppliers', icon: 'truck', label: 'nav.suppliers' },
      { href: '/admin/reports', icon: 'file', label: 'nav.reports' },
      { href: '/admin/barcode', icon: 'barcode', label: 'nav.barcode' },
    ],
  },
  {
    section: 'nav.sectionAdmin',
    items: [
      { href: '/admin/staff', icon: 'users', label: 'nav.staff' },
      { href: '/admin/settings', icon: 'settings', label: 'nav.settings' },
    ],
  },
];

function Sidebar({ pathname, mobileOpen, onClose, brand, t }: any) {
  return (
    <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">{brand.brandInitial}</div>
        <div className="brand-name">{brand.appName}</div>
      </div>
      {NAV_SECTIONS.map((section) => (
        <div className="nav-section" key={section.section}>
          <div className="nav-section-label">{t(section.section)}</div>
          {section.items.map((item) => {
            const active = pathname === item.href;
            const label = t(item.label);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? ' active' : ''}`}
                data-tip={label}
                onClick={onClose}
              >
                <span className="nav-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="nav-label">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <div className="sb-org-block">
        <div className="sb-avatar">{(brand.appName || '?').slice(0, 2).toUpperCase()}</div>
        <div className="sb-org">
          <div className="sb-org-name">{brand.appName}</div>
          <div className="sb-org-plan">
            {t('nav.seats', { plan: brand.plan, seats: brand.seats })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          className={`lang-opt${l.code === lang ? ' active' : ''}`}
          onClick={() => setLang(l.code)}
          type="button"
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

function Topbar({ onMenu, theme, onTheme, user, onSignOut, t }: any) {
  return (
    <header className="topbar">
      <button className="icon-btn tb-menu" onClick={onMenu} data-tip={t('topbar.menu')}>
        <Icon name="menu" size={18} />
      </button>
      <div className="tb-search">
        <Icon name="search" size={14} />
        <input placeholder={t('topbar.searchPlaceholder')} />
        <span className="shortcut">⌘K</span>
      </div>
      <div className="tb-actions">
        <LangToggle />
        <button className="icon-btn" data-tip={t('topbar.scan')}>
          <Icon name="scan" size={18} />
        </button>
        <button className="icon-btn" data-tip={t('topbar.notifications')}>
          <Icon name="bell" size={18} />
          <span className="dot" />
        </button>
        <button
          className="icon-btn"
          data-tip={theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
          onClick={onTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
        <UI.Dropdown
          trigger={
            <button className="icon-btn" style={{ width: 'auto', padding: '0 6px', gap: 6 }}>
              <UI.Avatar name={user?.name || 'User'} color="#6b4e8a" size={26} />
              <Icon name="chevDown" size={12} />
            </button>
          }
        >
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 4,
            }}
          >
            <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>{user?.name || '—'}</div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)' }}>
              {user?.email}
              {user?.role ? ` · ${user.role}` : ''}
            </div>
          </div>
          <UI.MenuItem icon="user" label={t('topbar.account')} />
          <UI.MenuItem icon="settings" label={t('topbar.workspaceSettings')} />
          <UI.MenuSep />
          <UI.MenuItem icon="arrowRight" label={t('topbar.signOut')} danger onClick={onSignOut} />
        </UI.Dropdown>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState('light');
  const [mobileNav, setMobileNav] = useState(false);
  const { user, setUser } = useUser();
  const { brand } = useBrand();
  const { t } = useI18n();

  const isAuthPage = pathname === '/admin/login';

  useEffect(() => {
    const saved = localStorage.getItem('stockwell-theme') || 'light';
    setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-density', 'comfortable');
    document.documentElement.setAttribute('data-sidebar', 'expanded');
    localStorage.setItem('stockwell-theme', theme);
  }, [theme]);
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/admin/login');
    router.refresh();
  };

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app">
      <Sidebar
        pathname={pathname}
        mobileOpen={mobileNav}
        onClose={() => setMobileNav(false)}
        brand={brand}
        t={t}
      />
      {mobileNav && <div className="slideover-backdrop" onClick={() => setMobileNav(false)} />}
      <div className="main">
        <Topbar
          onMenu={() => setMobileNav((v) => !v)}
          theme={theme}
          onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          user={user}
          onSignOut={signOut}
          t={t}
        />
        {children}
      </div>
    </div>
  );
}
