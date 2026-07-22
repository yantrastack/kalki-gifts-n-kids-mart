'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import { useUser } from '@/components/UserContext';
import { useBrand, applyAccent } from '@/components/BrandProvider';

const BRANDING = [
  { key: 'appName', label: 'App / store name', type: 'text' },
  { key: 'brandInitial', label: 'Logo initial (1–2 chars)', type: 'text' },
  { key: 'tagline', label: 'Tagline', type: 'text' },
  { key: 'plan', label: 'Plan label', type: 'text' },
  { key: 'seats', label: 'Seats', type: 'number' },
];
const COMPANY = [
  { key: 'companyName', label: 'Legal company name', type: 'text' },
  { key: 'email', label: 'Contact email', type: 'email' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'currency', label: 'Currency symbol', type: 'text' },
  { key: 'taxRate', label: 'Default tax rate (e.g. 0.08)', type: 'text' },
  { key: 'lowStockThreshold', label: 'Low-stock threshold (units)', type: 'number' },
];

export default function SettingsPage() {
  const { useToast } = UI;
  const { isAdmin } = useUser();
  const { refresh } = useBrand();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jget('/api/settings').then(setValues);
  }, []);
  const set = (k: string, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (k === 'accentColor') applyAccent(v); // live preview
  };
  const save = async () => {
    setSaving(true);
    try {
      const r = await jsend('/api/settings', 'PUT', values);
      setValues(r);
      refresh();
      toast({ message: 'Settings saved', icon: 'check' });
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ f }: any) => (
    <label className="field">
      <span>{f.label}</span>
      <input
        className="input"
        type={f.type}
        value={values[f.key] ?? ''}
        disabled={!isAdmin}
        onChange={(e) => set(f.key, e.target.value)}
      />
    </label>
  );

  const accent = values.accentColor || '#9a3a3a';

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Settings</div>
          <div className="ph-sub">Workspace, branding and preferences.</div>
        </div>
        {isAdmin && (
          <div className="ph-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              <Icon name="check" size={14} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
      {!isAdmin && (
        <div className="auth-hint" style={{ marginBottom: 16 }}>
          <Icon name="info" size={13} /> Only admins can change settings.
        </div>
      )}

      <div className="dash-row-2">
        {/* Branding (white-label) */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Branding</div>
              <div className="card-subtitle">White-label this deployment</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="row" style={{ gap: 12 }}>
              <div
                className="brand-mark"
                style={{ width: 44, height: 44, fontSize: 20, background: 'var(--accent)' }}
              >
                {(values.brandInitial || '?').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{values.appName || '—'}</div>
                <div className="muted tiny">{values.tagline}</div>
              </div>
            </div>
            <label className="field">
              <span>Accent color</span>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="color"
                  value={accent}
                  disabled={!isAdmin}
                  onChange={(e) => set('accentColor', e.target.value)}
                  style={{
                    width: 44,
                    height: 34,
                    padding: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    background: 'none',
                  }}
                />
                <input
                  className="input"
                  value={accent}
                  disabled={!isAdmin}
                  onChange={(e) => set('accentColor', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </label>
            {BRANDING.map((f) => (
              <Field key={f.key} f={f} />
            ))}
          </div>
        </div>

        {/* Company & preferences */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Company &amp; preferences</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {COMPANY.map((f) => (
              <Field key={f.key} f={f} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
