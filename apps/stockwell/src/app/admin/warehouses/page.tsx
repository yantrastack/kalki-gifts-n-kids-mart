'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';

function AddWarehouseModal({ open, onClose, onAdded }: any) {
  const toast = UI.useToast();
  const empty = { name: '', id: '', city: '', staff: '', capacity: '' };
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(empty);
  }, [open]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) {
      toast({ message: 'Warehouse name is required', icon: 'alert', type: 'danger' });
      return;
    }
    setSaving(true);
    try {
      const row = await jsend('/api/warehouses', 'POST', {
        name: form.name,
        id: form.id || undefined,
        city: form.city,
        staff: Number(form.staff) || 0,
        // Entered as a percentage (0–100), stored as a 0–1 fraction.
        capacity: (Number(form.capacity) || 0) / 100,
      });
      toast({ message: `Warehouse ${row.id} added`, icon: 'check' });
      onAdded(row);
      onClose();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <UI.Modal open={open} onClose={() => !saving && onClose()}>
      <div
        style={{
          padding: 'var(--s-4) var(--s-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>Add warehouse</h3>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div
        style={{ padding: 'var(--s-5)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
      >
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Name *</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Hyderabad Store"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Code</span>
          <input
            className="input"
            value={form.id}
            onChange={(e) => set('id', e.target.value.toUpperCase())}
            placeholder="Auto (e.g. WH-HYD)"
          />
        </label>
        <label className="field">
          <span>City</span>
          <input
            className="input"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="Hyderabad"
          />
        </label>
        <label className="field">
          <span>Staff</span>
          <input
            className="input"
            type="number"
            min={0}
            value={form.staff}
            onChange={(e) => set('staff', e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span>Capacity used (%)</span>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <div
        style={{
          padding: 'var(--s-3) var(--s-5)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          background: 'var(--bg-muted)',
        }}
      >
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Icon name="check" size={14} /> {saving ? 'Saving…' : 'Add warehouse'}
        </button>
      </div>
    </UI.Modal>
  );
}

export default function WarehousesPage() {
  const { fmt } = UI;
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  useEffect(() => {
    jget('/api/warehouses').then(setWarehouses);
  }, []);

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Warehouses</div>
          <div className="ph-sub">
            {warehouses.length} locations ·{' '}
            {fmt.int(warehouses.reduce((s, w) => s + w.products, 0))} product lines
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Add warehouse
          </button>
        </div>
      </div>
      <div className="card-grid">
        {warehouses.map((w) => (
          <div key={w.id} className="card" style={{ padding: 'var(--s-4)' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--bg-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Icon name="warehouse" size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div className="muted tiny mono">
                    {w.id} · {w.city}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="muted tiny">Capacity</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {fmt.pct(w.capacity)}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-muted)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${w.capacity * 100}%`,
                    background: w.capacity > 0.7 ? 'var(--warn)' : 'var(--accent)',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div className="muted tiny">Products</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {fmt.int(w.products)}
                </div>
              </div>
              <div>
                <div className="muted tiny">Stock value</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {fmt.moneyCompact(w.value)}
                </div>
              </div>
              <div>
                <div className="muted tiny">Staff</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {w.staff}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <AddWarehouseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(w: any) => setWarehouses((ws) => [...ws, w])}
      />
    </div>
  );
}
