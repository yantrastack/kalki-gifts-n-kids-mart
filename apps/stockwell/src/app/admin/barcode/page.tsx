'use client';
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function BarcodePage() {
  const { fmt } = UI;
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [format, setFormat] = useState('CODE128');
  const svgRef = useRef<SVGSVGElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    jget('/api/products').then((p) => {
      setProducts(p);
      if (p[0]) setSelected(p[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected || !svgRef.current) return;
    const value =
      format === 'EAN13' ? (selected.barcode || '').slice(0, 12) : selected.barcode || selected.sku;
    try {
      setErr('');
      JsBarcode(svgRef.current, value, {
        format,
        width: 2,
        height: 90,
        fontSize: 16,
        margin: 10,
        displayValue: true,
        background: '#ffffff',
        lineColor: '#111111',
      });
    } catch (_e: any) {
      setErr(`Can't encode this value as ${format}`);
    }
  }, [selected, format]);

  const filtered = products.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()),
  );

  const printLabel = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.outerHTML;
    const w = window.open('', '_blank', 'width=420,height=320');
    if (!w) return;
    w.document.write(`<html><head><title>${selected.sku}</title></head><body style="font-family:sans-serif;text-align:center;padding:20px">
      <div style="font-weight:600;margin-bottom:4px">${selected.name}</div>
      <div style="font-size:13px;color:#555;margin-bottom:10px">${fmt.money(selected.price)} · ${selected.sku}</div>
      ${svg}
      <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Barcode</div>
          <div className="ph-sub">Generate and print SKU barcodes and labels.</div>
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--s-4)' }}
        className="reports-layout"
      >
        <div className="table-wrap" style={{ alignSelf: 'start' }}>
          <div className="table-toolbar">
            <div className="input-group" style={{ width: '100%' }}>
              <Icon name="search" size={14} style={{ color: 'var(--fg-tertiary)' }} />
              <input
                placeholder="Find product"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div style={{ maxHeight: 460, overflow: 'auto' }}>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="bc-item"
                style={{ background: selected?.id === p.id ? 'var(--bg-active)' : 'transparent' }}
              >
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 'var(--t-sm)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.name}
                  </div>
                  <div className="muted tiny mono">{p.sku}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <div className="card-title">Label preview</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="select"
                style={{ width: 130 }}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="CODE128">CODE128 (SKU)</option>
                <option value="EAN13">EAN-13</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={printLabel}
                disabled={!selected || !!err}
              >
                <Icon name="printer" size={14} /> Print
              </button>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            {selected ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{selected.name}</div>
                <div className="muted tiny" style={{ marginBottom: 14 }}>
                  {fmt.money(selected.price)} · {selected.category}
                </div>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 'var(--r-md)',
                    padding: 8,
                    display: 'inline-block',
                    border: '1px solid var(--border)',
                  }}
                >
                  <svg ref={svgRef} />
                </div>
                {err && (
                  <div className="auth-error" style={{ marginTop: 12, justifyContent: 'center' }}>
                    <Icon name="alert" size={14} /> {err}
                  </div>
                )}
              </div>
            ) : (
              <UI.EmptyState icon="barcode" title="Select a product" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
