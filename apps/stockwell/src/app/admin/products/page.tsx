'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import AddProductModal from '@/components/AddProductModal';
import { useUser } from '@/components/UserContext';
import { GIFT_OCCASIONS, GIFT_RECIPIENTS, GIFT_TYPES } from '@stockwell/shared';

export default function ProductsPage() {
  const {
    fmt,
    ProductThumb,
    Slideover,
    statusBadge,
    Dropdown,
    MenuItem,
    MenuSep,
    EmptyState,
    useToast,
  } = UI;
  const toast = useToast();
  const { isAdmin } = useUser();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [view, setView] = useState('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openProduct, setOpenProduct] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const pageSize = 10;

  const load = () => {
    setLoading(true);
    jget('/api/products').then((p) => {
      setProducts(p);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const brands = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))],
    [products],
  );

  const filtered = useMemo(() => {
    let r = products.filter((p) => {
      if (
        query &&
        !(
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.sku.toLowerCase().includes(query.toLowerCase())
        )
      )
        return false;
      if (category !== 'all' && p.category !== category) return false;
      if (brand !== 'all' && p.brand !== brand) return false;
      if (stockFilter !== 'all' && p.status !== stockFilter) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [products, query, category, brand, stockFilter, sort]);

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [query, category, brand, stockFilter]);

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () => {
    const ids = pageItems.map((p) => p.id);
    const all = ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (all) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await jsend(`/api/products/${id}`, 'DELETE');
      setOpenProduct(null);
      toast({ message: 'Product deleted', icon: 'trash', type: 'danger' });
      load();
    } catch (e: any) {
      toast({ message: e.message || 'Delete failed', icon: 'alert', type: 'danger' });
    }
  };
  const handleAdd = async (form: any) => {
    try {
      await jsend('/api/products', 'POST', form);
      setAddOpen(false);
      toast({ message: `Published "${form.name}"`, icon: 'check' });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };

  const SortHeader = ({ k, children, align }: any) => {
    const isActive = sort.key === k;
    return (
      <th
        className="sortable col-num"
        style={{ textAlign: align || 'left' }}
        onClick={() =>
          setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))
        }
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {children}
          {isActive && <Icon name={sort.dir === 'asc' ? 'chevUp' : 'chevDown'} size={11} />}
        </span>
      </th>
    );
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Products</div>
          <div className="ph-sub">
            {filtered.length} of {products.length} products ·{' '}
            {products.filter((p) => p.status === 'low').length} low stock ·{' '}
            {products.filter((p) => p.status === 'out').length} out of stock
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary">
            <Icon name="upload" size={14} /> Import
          </button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={14} /> Add product
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="input-group" style={{ width: 280 }}>
            <Icon name="search" size={14} style={{ color: 'var(--fg-tertiary)' }} />
            <input
              placeholder="Search by name or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <Icon
                name="x"
                size={12}
                style={{ cursor: 'pointer', color: 'var(--fg-tertiary)' }}
                onClick={() => setQuery('')}
              />
            )}
          </div>
          <select
            className="select"
            style={{ width: 140 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All categories' : c}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 140 }}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b === 'all' ? 'All brands' : b}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 150 }}
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="all">All stock states</option>
            <option value="active">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {selected.size > 0 && (
              <span style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>
                {selected.size} selected
              </span>
            )}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--r-md)',
                padding: 2,
              }}
            >
              <button
                onClick={() => setView('table')}
                className="icon-btn"
                style={{
                  width: 28,
                  height: 24,
                  background: view === 'table' ? 'var(--bg-elev)' : 'transparent',
                }}
              >
                <Icon name="list" size={14} />
              </button>
              <button
                onClick={() => setView('grid')}
                className="icon-btn"
                style={{
                  width: 28,
                  height: 24,
                  background: view === 'grid' ? 'var(--bg-elev)' : 'transparent',
                }}
              >
                <Icon name="grid" size={14} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="page-loading">Loading products…</div>
        ) : view === 'table' ? (
          <div className="table-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={pageItems.length > 0 && pageItems.every((p) => selected.has(p.id))}
                      onChange={toggleAll}
                    />
                  </th>
                  <SortHeader k="name">Product</SortHeader>
                  <SortHeader k="sku">SKU</SortHeader>
                  <SortHeader k="category">Category</SortHeader>
                  <SortHeader k="warehouse">Warehouse</SortHeader>
                  <SortHeader k="stock" align="right">
                    Stock
                  </SortHeader>
                  <SortHeader k="price" align="right">
                    Price
                  </SortHeader>
                  <th>Status</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr
                    key={p.id}
                    className={selected.has(p.id) ? 'selected' : ''}
                    onClick={() => setOpenProduct(p)}
                  >
                    <td
                      className="col-check"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(p.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selected.has(p.id)}
                        readOnly
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ProductThumb name={p.name} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 280,
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)' }}>
                            {p.brand}
                            {p.tag ? ` · ${p.tag}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--t-sm)' }}>
                      {p.sku}
                    </td>
                    <td className="muted">{p.category}</td>
                    <td className="mono" style={{ fontSize: 'var(--t-sm)' }}>
                      {p.warehouse}
                    </td>
                    <td className="col-num">
                      <span
                        style={{
                          fontWeight: 500,
                          color:
                            p.stock === 0
                              ? 'var(--danger)'
                              : p.status === 'low'
                                ? 'var(--warn)'
                                : 'inherit',
                        }}
                      >
                        {fmt.int(p.stock)}
                      </span>
                    </td>
                    <td className="col-num mono">{fmt.money(p.price)}</td>
                    <td>{statusBadge(p.status)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <button className="icon-btn" style={{ width: 26, height: 26 }}>
                            <Icon name="more" size={14} />
                          </button>
                        }
                      >
                        <MenuItem icon="eye" label="View" onClick={() => setOpenProduct(p)} />
                        {isAdmin && <MenuSep />}
                        {isAdmin && (
                          <MenuItem
                            icon="trash"
                            label="Delete"
                            danger
                            onClick={() => handleDelete(p.id)}
                          />
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        icon="search"
                        title="No products match"
                        body="Try clearing filters or adjusting your search."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              padding: 'var(--s-4)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 'var(--s-4)',
            }}
          >
            {pageItems.map((p) => (
              <div key={p.id} onClick={() => setOpenProduct(p)} className="prod-card">
                <div className="img-placeholder" style={{ aspectRatio: 1, marginBottom: 10 }}>
                  <span>
                    {p.name
                      .split(' ')
                      .slice(0, 2)
                      .map((w: string) => w[0])
                      .join('')}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 'var(--t-base)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}
                    >
                      {p.sku}
                    </div>
                  </div>
                  {statusBadge(p.status)}
                </div>
                <div className="spread" style={{ marginTop: 10 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {fmt.money(p.price)}
                  </span>
                  <span className="muted tiny">{fmt.int(p.stock)} in stock</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 'var(--t-sm)',
          }}
        >
          <span className="muted">
            Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <Icon name="chevLeft" size={12} /> Previous
            </button>
            {Array.from({ length: totalPages })
              .slice(0, 5)
              .map((_, i) => (
                <button
                  key={i}
                  className={`btn btn-sm ${page === i + 1 ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => setPage(i + 1)}
                  style={{ minWidth: 30, justifyContent: 'center' }}
                >
                  {i + 1}
                </button>
              ))}
            <button
              className="btn btn-ghost btn-sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <Icon name="chevRight" size={12} />
            </button>
          </div>
        </div>
      </div>

      <Slideover open={!!openProduct} onClose={() => setOpenProduct(null)} wide>
        {openProduct && (
          <ProductDetail
            product={openProduct}
            onClose={() => setOpenProduct(null)}
            onDelete={handleDelete}
            onSaved={load}
            isAdmin={isAdmin}
          />
        )}
      </Slideover>

      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAdd} />
    </div>
  );
}

function StockStat({ label, value, color }: any) {
  return (
    <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-md)', padding: 12 }}>
      <div className="muted tiny">{label}</div>
      <div
        style={{
          fontSize: 'var(--t-xl)',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: color || 'inherit',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ProductDetail({ product: p, onClose, onDelete, onSaved, isAdmin }: any) {
  const { fmt, statusBadge, useToast } = UI;
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [adjust, setAdjust] = useState('');

  const applyAdjust = async () => {
    const qty = parseInt(adjust, 10);
    if (!qty) return;
    await jsend('/api/stock-moves', 'POST', {
      type: qty > 0 ? 'add' : 'remove',
      productId: p.id,
      product: p.name,
      qty,
      who: 'You',
      warehouse: p.warehouse,
      meta: 'Manual adjustment',
    });
    toast({ message: `Stock adjusted by ${qty > 0 ? '+' : ''}${qty}`, icon: 'check' });
    setAdjust('');
    onClose();
    onSaved();
  };

  return (
    <>
      <div
        style={{
          padding: 'var(--s-4) var(--s-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div className="img-placeholder" style={{ width: 56, height: 56 }}>
          <span>
            {p.name
              .split(' ')
              .slice(0, 2)
              .map((w: string) => w[0])
              .join('')}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>{p.name}</h3>
            {statusBadge(p.status)}
          </div>
          <div className="muted tiny mono" style={{ marginTop: 4 }}>
            {p.sku} · {p.barcode}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          padding: '0 var(--s-5)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {['overview', 'media', 'gifting', 'adjust'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 12px',
              fontSize: 'var(--t-sm)',
              fontWeight: 500,
              color: tab === t ? 'var(--fg)' : 'var(--fg-secondary)',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
              textTransform: 'capitalize',
              background: 'none',
            }}
          >
            {t === 'adjust' ? 'Adjust stock' : t}
          </button>
        ))}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {tab === 'overview' && (
          <>
            <div className="dp-section">
              <h4>Pricing</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div className="muted tiny">Price (Excl. GST)</div>
                  <div
                    style={{
                      fontSize: 'var(--t-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {fmt.money(p.price)}
                  </div>
                </div>
                <div>
                  <div className="muted tiny">GST Rate</div>
                  <div
                    style={{
                      fontSize: 'var(--t-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {p.gstRate || 0}%{' '}
                    <span
                      style={{
                        fontSize: 'var(--t-xs)',
                        fontWeight: 400,
                        color: 'var(--fg-tertiary)',
                      }}
                    >
                      ({fmt.money((p.price * (p.gstRate || 0)) / 100)})
                    </span>
                  </div>
                </div>
                <div>
                  <div className="muted tiny">Price (Incl. GST)</div>
                  <div
                    style={{
                      fontSize: 'var(--t-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                    }}
                  >
                    {fmt.money(p.price * (1 + (p.gstRate || 0) / 100))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div className="muted tiny">Cost</div>
                  <div
                    style={{
                      fontSize: 'var(--t-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {fmt.money(p.cost)}
                  </div>
                </div>
                <div>
                  <div className="muted tiny">Margin</div>
                  <div
                    style={{
                      fontSize: 'var(--t-xl)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--success)',
                    }}
                  >
                    {p.price ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 0}%
                  </div>
                </div>
                <div></div>
              </div>
            </div>
            <div className="dp-section">
              <h4>Inventory</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StockStat
                  label="On hand"
                  value={fmt.int(p.stock)}
                  color={
                    p.stock === 0
                      ? 'var(--danger)'
                      : p.status === 'low'
                        ? 'var(--warn)'
                        : 'var(--success)'
                  }
                />
                <StockStat label="Reserved" value={fmt.int(p.reserved)} />
                <StockStat label="Incoming" value={fmt.int(p.incoming)} color="var(--info)" />
                <StockStat
                  label="Damaged"
                  value={fmt.int(p.damaged)}
                  color={p.damaged > 0 ? 'var(--warn)' : 'inherit'}
                />
              </div>
            </div>
            <div className="dp-section">
              <h4>Details</h4>
              <dl className="dp-kv">
                <dt>Category</dt>
                <dd>{p.category}</dd>
                <dt>Brand</dt>
                <dd>{p.brand}</dd>
                <dt>Warehouse</dt>
                <dd className="mono">{p.warehouse}</dd>
                <dt>Supplier</dt>
                <dd>{p.supplier}</dd>
                <dt>SKU</dt>
                <dd className="mono">{p.sku}</dd>
                <dt>Barcode</dt>
                <dd className="mono">{p.barcode}</dd>
                <dt>HSN Code</dt>
                <dd className="mono">{p.hsnCode || '—'}</dd>
              </dl>
            </div>
          </>
        )}
        {tab === 'media' && <MediaTab productId={p.id} isAdmin={isAdmin} />}
        {tab === 'gifting' && <GiftingTab product={p} onSaved={onSaved} />}
        {tab === 'adjust' && (
          <div className="dp-section">
            <h4>Adjust stock level</h4>
            <p className="muted tiny" style={{ marginBottom: 12 }}>
              Current on hand: <strong className="mono">{fmt.int(p.stock)}</strong>. Enter a
              positive number to add stock or a negative number to remove. This records a stock
              movement.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="number"
                placeholder="e.g. +50 or -10"
                value={adjust}
                onChange={(e) => setAdjust(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={applyAdjust} disabled={!adjust}>
                <Icon name="check" size={14} /> Apply
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          padding: 'var(--s-3) var(--s-5)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          background: 'var(--bg-muted)',
        }}
      >
        {isAdmin && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: 'var(--danger)' }}
            onClick={() => onDelete(p.id)}
          >
            <Icon name="trash" size={12} /> Delete
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setTab('adjust')}
        >
          <Icon name="layers" size={12} /> Adjust stock
        </button>
      </div>
    </>
  );
}

function MediaTab({ productId, isAdmin }: { productId: string; isAdmin: boolean }) {
  const { useToast } = UI;
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => jget(`/api/products/${productId}/media`).then(setItems);
  useEffect(() => {
    load();
  }, [productId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const r = await fetch(`/api/products/${productId}/media`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Upload failed');
      toast({
        message: `Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`,
        icon: 'check',
      });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'x' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (mediaId: string) => {
    const r = await fetch(`/api/products/${productId}/media?mediaId=${mediaId}`, {
      method: 'DELETE',
    });
    if (r.ok) {
      toast({ message: 'Media removed', icon: 'check' });
      load();
    } else toast({ message: 'Delete failed', icon: 'x' });
  };

  return (
    <div className="dp-section">
      <h4>Photos &amp; videos</h4>
      <p className="muted tiny" style={{ marginBottom: 12 }}>
        Shown to customers in the storefront app. The first item is the cover. Images
        (JPG/PNG/WebP/GIF) and videos (MP4/MOV/WebM), up to 50&nbsp;MB each.
      </p>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        style={{ display: 'none' }}
        onChange={(e) => upload(e.target.files)}
      />
      <button
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon name="plus" size={12} /> {busy ? 'Uploading…' : 'Upload files'}
      </button>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}
      >
        {items.map((m, i) => (
          <div
            key={m.id}
            style={{
              position: 'relative',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bg-muted)',
              aspectRatio: '1',
            }}
          >
            {m.type === 'video' ? (
              <video
                src={m.url}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <img
                src={m.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {i === 0 && (
              <span
                className="badge badge-accent"
                style={{ position: 'absolute', top: 6, left: 6 }}
              >
                Cover
              </span>
            )}
            {m.type === 'video' && (
              <span className="badge" style={{ position: 'absolute', bottom: 6, left: 6 }}>
                Video
              </span>
            )}
            {isAdmin && (
              <button
                className="icon-btn"
                title="Remove"
                onClick={() => remove(m.id)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            )}
          </div>
        ))}
        {!items.length && (
          <div className="muted tiny" style={{ gridColumn: '1 / -1', padding: '16px 0' }}>
            No media yet — upload photos or a short video of this product.
          </div>
        )}
      </div>
    </div>
  );
}

function ChipToggles({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={on ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            style={{ textTransform: 'capitalize' }}
          >
            {o.replace(/-/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}

// Tags a product so the storefront's Gift Finder can rank it.
function GiftingTab({ product: p, onSaved }: any) {
  const { useToast } = UI;
  const toast = useToast();
  const csv = (s: string | null) =>
    (s || '')
      .split(',')
      .map((x: string) => x.trim())
      .filter(Boolean);
  const [occasions, setOccasions] = useState<string[]>(csv(p.giftOccasions));
  const [recipients, setRecipients] = useState<string[]>(csv(p.giftRecipients));
  const [types, setTypes] = useState<string[]>(csv(p.giftTypes));
  const [interests, setInterests] = useState((p.giftInterests || '') as string);
  const [ageMin, setAgeMin] = useState(p.giftAgeMin ?? '');
  const [ageMax, setAgeMax] = useState(p.giftAgeMax ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await jsend(`/api/products/${p.id}`, 'PUT', {
        giftOccasions: occasions.join(','),
        giftRecipients: recipients.join(','),
        giftTypes: types.join(','),
        giftInterests: interests,
        giftAgeMin: ageMin === '' ? null : Number(ageMin),
        giftAgeMax: ageMax === '' ? null : Number(ageMax),
      });
      toast({ message: 'Gift details saved', icon: 'check' });
      onSaved();
    } catch (e: any) {
      toast({ message: e.message, icon: 'x' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dp-section">
      <h4>Gift finder details</h4>
      <p className="muted tiny" style={{ marginBottom: 14 }}>
        Tag this product so customers can discover it with <strong>Find a gift</strong> in the
        storefront. Leave everything empty if it isn't a gift item.
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            Occasions
          </div>
          <ChipToggles options={GIFT_OCCASIONS} value={occasions} onChange={setOccasions} />
        </div>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            Who it suits
          </div>
          <ChipToggles options={GIFT_RECIPIENTS} value={recipients} onChange={setRecipients} />
        </div>
        <div>
          <div className="muted tiny" style={{ marginBottom: 6 }}>
            Gift type
          </div>
          <ChipToggles options={GIFT_TYPES} value={types} onChange={setTypes} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field">
            <span>Age from</span>
            <input
              className="input"
              type="number"
              min={0}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              placeholder="e.g. 3"
            />
          </label>
          <label className="field">
            <span>Age to</span>
            <input
              className="input"
              type="number"
              min={0}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              placeholder="e.g. 12"
            />
          </label>
        </div>
        <label className="field">
          <span>Interests (comma separated)</span>
          <input
            className="input"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="music, sports, cooking, reading"
          />
        </label>
        <div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Icon name="check" size={14} /> {saving ? 'Saving…' : 'Save gift details'}
          </button>
        </div>
      </div>
    </div>
  );
}

