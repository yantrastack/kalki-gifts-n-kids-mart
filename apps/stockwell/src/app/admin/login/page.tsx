'use client';
import type React from 'react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { useBrand } from '@/components/BrandProvider';
import { useI18n } from '@/i18n';

function LoginForm() {
  const { brand } = useBrand();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('auth.genericError'));
      router.push(params.get('from') || '/admin');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 18 }}>
            {brand.brandInitial}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--t-lg)', letterSpacing: '-0.01em' }}>
              {brand.appName}
            </div>
            <div className="muted tiny">{brand.tagline}</div>
          </div>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? t('auth.signInTitle') : t('auth.registerTitle')}
        </h1>
        <p className="auth-sub">{mode === 'login' ? t('auth.signInSub') : t('auth.registerSub')}</p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label className="field">
              <span>{t('auth.fullName')}</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="field">
            <span>{t('auth.email')}</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>{t('auth.password')}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {error && (
            <div className="auth-error">
              <Icon name="alert" size={14} /> {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', height: 38 }}
          >
            {loading
              ? t('auth.pleaseWait')
              : mode === 'login'
                ? t('auth.signIn')
                : t('auth.createAccount')}
          </button>
        </form>

        {mode === 'login' && (
          <div className="auth-hint">
            <Icon name="info" size={13} /> {t('auth.demoLogin')} <strong>owen@ridgemont.co</strong>{' '}
            / <strong>stockwell123</strong>
          </div>
        )}

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              {t('auth.newHere')}{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                {t('auth.createOne')}
              </button>
            </>
          ) : (
            <>
              {t('auth.haveAccount')}{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                {t('auth.signIn')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-wrap">
          <div className="auth-card">…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
