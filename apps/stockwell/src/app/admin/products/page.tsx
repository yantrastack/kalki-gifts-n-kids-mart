'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import AddProductModal from '@/components/AddProductModal';
import ImportProductsModal from '@/components/ImportProductsModal';
import { useI18n } from '@/i18n';
import { useUser } from '@/components/UserContext';
import GiftFields, { type GiftValue } from '@/components/GiftFields';
import { MIN_PRODUCT_PHOTOS, giftTagLabel, photoCount } from '@stockwell/shared';
import { missingForActivation } from '@/lib/catalog';
import { UPLOAD_ACCEPT, moveItem } from '@/lib/mediaRules';
import { filePhotoCount } from '@/components/MediaPicker';
import {
  MediaHelp,
  PhotoCount,
  ProductMediaGrid,
  problemMessage,
  screenFiles,
} from '@/components/ProductMediaGrid';
import MediaPreview from '@/components/MediaPreview';
import { MediaUploadError, replaceMediaFile, uploadMediaFile } from '@/lib/uploadMedia';

// Live products published before the photo rule (YAN-109) stay live, but are flagged so
// the shop can add photos. Drafts are blocked from publishing instead.
const needsPhotos = (p: any) =>
  p.lifecycle === 'active' && (Number(p.photoCount) || 0) < MIN_PRODUCT_PHOTOS;

function NeedsPhotosBadge({ p }: { p: any }) {
  const { t } = useI18n();
  if (!needsPhotos(p)) return null;
  return (
    <span
      className="badge badge-warn"
      title={t('media.needsPhotosHint', { min: MIN_PRODUCT_PHOTOS })}
      style={{ whiteSpace: 'nowrap' }}
    >
      {t('media.needsPhotos', { n: Number(p.photoCount) || 0, min: MIN_PRODUCT_PHOTOS })}
    </span>
  );
}

// Uploads files to a product's media; throws `{ message, problem? }` when it is refused.
async function uploadMedia(productId: string, files: File[]) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  const r = await fetch(`/api/products/${productId}/media`, { method: 'POST', body: fd });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || 'Upload failed'), { problem: body.problem });
  }
  return r.json();
}

export default function ProductsPage() {
  const {
    fmt,
    ProductThumb,
    Modal,
    Slideover,
    statusBadge,
    Dropdown,
    MenuItem,
    MenuSep,
    EmptyState,
    useToast,
  } = UI;
  const toast = useToast();
  const { t } = useI18n();
  const { isAdmin } = useUser();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [photoFilter, setPhotoFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [view, setView] = useState('table');
  const [openProduct, setOpenProduct] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [removing, setRemoving] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 10;

  const load = () => {
    setLoading(true);
    jget('/api/products').then((p) => {
      setProducts(p);
      // Keep an open product panel current (e.g. its photo count after an upload).
      setOpenProduct((cur: any) => (cur ? (p.find((x: any) => x.id === cur.id) ?? cur) : cur));
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
      if (photoFilter === 'needs' && !needsPhotos(p)) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [products, query, category, brand, stockFilter, photoFilter, sort]);

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [query, category, brand, stockFilter, photoFilter]);

  // Both Delete entry points (row menu, detail panel) only set `removing`; the request
  // is sent from the confirmation dialog.
  const confirmDelete = async () => {
    if (!removing || deleting) return;
    setDeleting(true);
    try {
      await jsend(`/api/products/${removing.id}`, 'DELETE');
      setOpenProduct(null);
      toast({
        message: t('productDelete.deleted', { name: removing.name }),
        icon: 'trash',
        type: 'danger',
      });
      load();
    } catch (e: any) {
      // The API explains why (e.g. 409: the product has stock or purchase history).
      toast({ message: e.message || t('productDelete.failed'), icon: 'alert', type: 'danger' });
    } finally {
      setDeleting(false);
      setRemoving(null);
    }
  };
  // The API answers an incomplete product with `{ error, missing: [...] }` (status 400).
  const fieldNames = (missing: string[]) =>
    missing.map((f) => t(`productForm.missing.${f}`, { min: MIN_PRODUCT_PHOTOS })).join(', ');
  const missingFields = (e: any): string | null =>
    e?.status === 400 && Array.isArray(e.body?.missing) && e.body.missing.length
      ? fieldNames(e.body.missing)
      : null;

  // "Publish product" (activate) makes the product live in the customer app; "Save as
  // draft" keeps it out until someone activates it. Publishing needs MIN_PRODUCT_PHOTOS
  // photos, which can only be uploaded once the product has an id, so publishing is:
  // create as draft → upload media → activate. The form is checked here first with the
  // API's own rules, so a product that can't be published isn't created at all.
  // Returns 'needsPhotos' so the popup can open its photo section.
  const handleAdd = async (
    form: any,
    files: File[] = [],
    opts: { activate?: boolean } = {},
  ): Promise<'needsPhotos' | undefined> => {
    const activate = opts.activate ?? true;
    if (activate) {
      const missing = missingForActivation(form, { imageCount: filePhotoCount(files) });
      if (missing.length) {
        toast({
          message: t('productForm.cantPublish', { fields: fieldNames(missing) }),
          icon: 'alert',
          type: 'danger',
        });
        // Keep the popup open so they can fix it or save a draft.
        return missing.includes('photos') ? 'needsPhotos' : undefined;
      }
    }
    let created: any;
    try {
      created = await jsend('/api/products', 'POST', { ...form, activate: false });
    } catch (e: any) {
      const fields = missingFields(e);
      toast({
        message: fields ? t('productForm.cantPublish', { fields }) : e.message,
        icon: 'alert',
        type: 'danger',
      });
      return;
    }
    setAddOpen(false);
    // If the upload fails the product still exists as a draft; say so and let them retry
    // from its Media tab.
    if (files.length) {
      try {
        await uploadMedia(created.id, files);
      } catch (e: any) {
        toast({
          message: t('productForm.mediaFailed', { error: uploadError(e) }),
          icon: 'alert',
          type: 'danger',
        });
        load();
        return;
      }
    }
    if (!activate) {
      toast({ message: t('productForm.draftSaved', { name: form.name }), icon: 'check' });
      load();
      return;
    }
    try {
      await jsend(`/api/products/${created.id}/lifecycle`, 'POST', { to: 'active' });
    } catch (e: any) {
      // e.g. a photo the server rejected after all: nothing is lost, it stays a draft.
      const fields = missingFields(e);
      toast({
        message: fields
          ? t('productForm.savedNotPublished', { name: form.name, fields })
          : t('productForm.activateFailed', { name: form.name }),
        icon: 'alert',
        type: 'danger',
      });
      load();
      return;
    }
    if (!(Number(form.stock) > 0)) {
      // Live, but the customer app hides products with no stock.
      toast({ message: t('productForm.publishedNoStock', { name: form.name }), icon: 'alert' });
    } else {
      toast({ message: `Published "${form.name}"`, icon: 'check' });
    }
    load();
  };

  // A rejected upload explains itself as `problem` (translated here) or as `error`.
  const uploadError = (e: any): string =>
    e?.problem ? problemMessage(t, e.problem) : e?.message || 'Upload failed';

  // Draft (or discontinued) → active. The API checks the product is complete first.
  const activateProduct = async (p: any) => {
    try {
      const row = await jsend(`/api/products/${p.id}/lifecycle`, 'POST', { to: 'active' });
      setOpenProduct((cur: any) => (cur?.id === row.id ? row : cur));
      toast(
        row.stock > 0
          ? { message: t('productForm.activated', { name: p.name }), icon: 'check' }
          : { message: t('productForm.activatedNoStock', { name: p.name }), icon: 'alert' },
      );
      load();
    } catch (e: any) {
      const fields = missingFields(e);
      toast({
        message: fields
          ? t('productForm.cantActivate', { name: p.name, fields })
          : t('productForm.activateFailed', { name: p.name }),
        icon: 'alert',
        type: 'danger',
      });
    }
  };

  const SortHeader = ({ k, children, align }: any) => {
    const isActive = sort.key === k;
    return (
      <th
        className={align === 'right' ? 'sortable col-num' : 'sortable'}
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
          <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={14} /> {t('productImport.button')}
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
          <UI.Select
            aria-label="Category"
            style={{ width: 140 }}
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({
              value: c,
              label: c === 'all' ? 'All categories' : c,
            }))}
          />
          <UI.Select
            aria-label="Brand"
            style={{ width: 140 }}
            value={brand}
            onChange={setBrand}
            options={brands.map((b) => ({ value: b, label: b === 'all' ? 'All brands' : b }))}
          />
          <UI.Select
            aria-label="Stock status"
            style={{ width: 150 }}
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { value: 'all', label: 'All stock states' },
              { value: 'active', label: 'In stock' },
              { value: 'low', label: 'Low stock' },
              { value: 'out', label: 'Out of stock' },
            ]}
          />
          <UI.Select
            aria-label={t('media.filterNeeds')}
            style={{ width: 160 }}
            value={photoFilter}
            onChange={setPhotoFilter}
            options={[
              { value: 'all', label: t('media.filterAll') },
              {
                value: 'needs',
                label: `${t('media.filterNeeds')} (${products.filter(needsPhotos).length})`,
              },
            ]}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
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
            {/* dt-fixed: widths come from the colgroup, not cell content. Every column but
                Product is content-sized in px (percentages would inflate them all on wide
                screens); Product has no width so it alone absorbs the leftover space. */}
            <table className="dt dt-fixed" style={{ minWidth: 1040 }}>
              <colgroup>
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr>
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
                  <th className="col-gutter">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} onClick={() => setOpenProduct(p)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ProductThumb name={p.name} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                            {p.lifecycle && p.lifecycle !== 'active' && statusBadge(p.lifecycle)}
                            <NeedsPhotosBadge p={p} />
                          </div>
                          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)' }}>
                            {p.brand}
                            {p.tag ? ` · ${giftTagLabel(p.tag)}` : ''}
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
                    <td className="col-gutter">{statusBadge(p.status)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <button className="icon-btn" style={{ width: 26, height: 26 }}>
                            <Icon name="more" size={14} />
                          </button>
                        }
                      >
                        <MenuItem icon="eye" label="View" onClick={() => setOpenProduct(p)} />
                        {p.lifecycle && p.lifecycle !== 'active' && (
                          <MenuItem
                            icon="check"
                            label={t('productForm.activate')}
                            onClick={() => activateProduct(p)}
                          />
                        )}
                        {isAdmin && <MenuSep />}
                        {isAdmin && (
                          <MenuItem
                            icon="trash"
                            label="Delete"
                            danger
                            onClick={() => setRemoving(p)}
                          />
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={8}>
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    {statusBadge(p.status)}
                    {p.lifecycle && p.lifecycle !== 'active' && statusBadge(p.lifecycle)}
                    <NeedsPhotosBadge p={p} />
                  </div>
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
            onDelete={setRemoving}
            deleting={deleting}
            onSaved={load}
            onActivate={activateProduct}
            isAdmin={isAdmin}
          />
        )}
      </Slideover>

      <Modal open={!!removing} onClose={() => !deleting && setRemoving(null)} small>
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
          <button
            type="button"
            className="icon-btn confirm-close"
            aria-label={t('productDelete.cancel')}
            onClick={() => setRemoving(null)}
            disabled={deleting}
          >
            <Icon name="x" size={16} />
          </button>
          <div className="confirm-icon">
            <Icon name="trash" size={22} />
          </div>
          <div id="confirm-title" className="confirm-title">
            {t('productDelete.title')}
          </div>
          <div className="confirm-name" title={removing?.name}>
            {removing?.name}
          </div>
          <ul className="confirm-points">
            <li>
              <Icon name="alert" size={16} />
              <span>{t('productDelete.permanent')}</span>
            </li>
            <li>
              <Icon name="archive" size={16} />
              <span>{t('productDelete.historyKept')}</span>
            </li>
          </ul>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRemoving(null)}
              disabled={deleting}
            >
              {t('productDelete.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={confirmDelete}
              disabled={deleting}
            >
              <Icon name="trash" size={14} />{' '}
              {t(deleting ? 'productDelete.deleting' : 'productDelete.confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <AddProductModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        customizable
        draftable
      />
      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
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

function ProductDetail({
  product: p,
  onClose,
  onDelete,
  deleting,
  onSaved,
  onActivate,
  isAdmin,
}: any) {
  const { t } = useI18n();
  const { fmt, statusBadge, useToast } = UI;
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [adjust, setAdjust] = useState('');
  const [activating, setActivating] = useState(false);

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
            {p.lifecycle && p.lifecycle !== 'active' && statusBadge(p.lifecycle)}
            <NeedsPhotosBadge p={p} />
          </div>
          <div className="muted tiny mono" style={{ marginTop: 4 }}>
            {p.sku} · {p.barcode}
          </div>
        </div>
        {p.lifecycle && p.lifecycle !== 'active' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={activating}
            onClick={async () => {
              setActivating(true);
              try {
                await onActivate(p);
              } finally {
                setActivating(false);
              }
            }}
          >
            <Icon name="check" size={12} />{' '}
            {activating ? t('productForm.activating') : t('productForm.activate')}
          </button>
        )}
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
        {tab === 'media' && <MediaTab productId={p.id} isAdmin={isAdmin} onChanged={onSaved} />}
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
            disabled={deleting}
            onClick={() => onDelete(p)}
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

// One file's upload state in the Media tab progress list (YAN-108). A failed file keeps
// its File handle so it can be retried without picking it again.
type UploadEntry = {
  key: string;
  name: string;
  percent: number; // 0–100
  status: 'uploading' | 'done' | 'error';
  error?: string;
  file?: File;
  replaceId?: string; // set when this entry replaces an existing media item
};

function MediaTab({
  productId,
  isAdmin,
  onChanged,
}: {
  productId: string;
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const { useToast } = UI;
  const toast = useToast();
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [preview, setPreview] = useState<{
    url: string;
    type: 'image' | 'video';
    label: string;
  } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const entrySeq = useRef(0);

  const load = () => jget(`/api/products/${productId}/media`).then(setItems);
  useEffect(() => {
    load();
  }, [productId]);

  const patchEntry = (key: string, patch: Partial<UploadEntry>) =>
    setUploads((us) => us.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  // Uploads one file with progress; when `replaceId` is set it replaces that item in place.
  const runEntry = async (entry: UploadEntry) => {
    patchEntry(entry.key, { status: 'uploading', percent: 0, error: undefined });
    const onProgress = (loaded: number, total: number) =>
      patchEntry(entry.key, { percent: total ? Math.round((loaded / total) * 100) : 0 });
    try {
      if (entry.replaceId)
        await replaceMediaFile(productId, entry.replaceId, entry.file!, onProgress);
      else await uploadMediaFile(productId, entry.file!, onProgress);
      patchEntry(entry.key, { status: 'done', percent: 100 });
      load();
      onChanged?.();
    } catch (e: any) {
      const msg =
        e instanceof MediaUploadError && e.problem
          ? problemMessage(t, e.problem as any)
          : e.message || t('media.uploadFailedGeneric');
      patchEntry(entry.key, { status: 'error', error: msg });
    }
  };

  const upload = async (picked: FileList | null) => {
    if (!picked?.length) return;
    const list = Array.from(picked);
    if (fileRef.current) fileRef.current.value = '';
    setBusy(true);
    try {
      // Same checks as the API, so a bad file is explained before anything uploads.
      const { accepted, problems } = await screenFiles(list);
      setErrors(problems.map((p) => problemMessage(t, p)));
      if (!accepted.length) return;
      const entries: UploadEntry[] = accepted.map((f) => ({
        key: `u${++entrySeq.current}`,
        name: f.name,
        percent: 0,
        status: 'uploading',
        file: f,
      }));
      setUploads((us) => [...us.filter((u) => u.status !== 'done'), ...entries]);
      // One request per file: each reports its own progress and fails on its own.
      for (const e of entries) await runEntry(e);
    } finally {
      setBusy(false);
    }
  };

  // Replace one item in place: same position, same cover status (YAN-108).
  const replace = async (index: number, file: File) => {
    const m = items[index];
    if (!m) return;
    const { accepted, problems } = await screenFiles([file]);
    if (problems.length) {
      setErrors(problems.map((p) => problemMessage(t, p)));
      return;
    }
    if (!accepted.length) return;
    const entry: UploadEntry = {
      key: `u${++entrySeq.current}`,
      name: file.name,
      percent: 0,
      status: 'uploading',
      file,
      replaceId: m.id,
    };
    setUploads((us) => [...us.filter((u) => u.status !== 'done'), entry]);
    await runEntry(entry);
  };

  const remove = async (index: number) => {
    const m = items[index];
    const r = await fetch(`/api/products/${productId}/media?mediaId=${m.id}`, {
      method: 'DELETE',
    });
    if (r.ok) {
      toast({ message: t('media.removed'), icon: 'check' });
      load();
      onChanged?.();
    } else toast({ message: t('media.removeFailed'), icon: 'x' });
  };

  // Reorder (and "Set as cover" = move to the front): show it at once, then save.
  const move = async (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (next === items) return;
    setItems(next);
    try {
      const saved = await jsend(`/api/products/${productId}/media`, 'PATCH', {
        order: next.map((m) => m.id),
      });
      setItems(saved);
      toast({ message: t('media.reordered'), icon: 'check' });
    } catch {
      toast({ message: t('media.reorderFailed'), icon: 'x' });
      load();
    }
  };

  const activeUploads = uploads.filter((u) => u.status !== 'done');

  return (
    <div className="dp-section">
      <h4>{t('media.title')}</h4>
      <MediaHelp />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => upload(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Icon name="plus" size={12} /> {busy ? t('media.uploading') : t('media.add')}
      </button>
      {errors.length > 0 && (
        <ul className="field-error" role="alert" style={{ marginTop: 8, paddingLeft: 16 }}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {activeUploads.length > 0 && (
        <ul style={{ marginTop: 10, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
          {activeUploads.map((u) => (
            <li key={u.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.name}
              </span>
              {u.status === 'uploading' && (
                <>
                  <progress
                    value={u.percent}
                    max={100}
                    style={{ width: 120 }}
                    aria-label={t('media.uploading')}
                  />
                  <span className="muted tiny">{u.percent}%</span>
                </>
              )}
              {u.status === 'error' && (
                <>
                  <span className="field-error tiny" role="alert" style={{ margin: 0 }}>
                    {u.error}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => runEntry(u)}
                  >
                    <Icon name="refresh" size={11} /> {t('media.retry')}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('media.dismiss')}
                    title={t('media.dismiss')}
                    onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <PhotoCount photos={photoCount(items)} />
      <ProductMediaGrid
        items={items.map((m) => ({ key: m.id, url: m.url, type: m.type }))}
        disabled={busy}
        onMove={move}
        onRemove={isAdmin ? (i) => setConfirming(i) : undefined}
        onReplace={isAdmin ? replace : undefined}
        onPreview={(i) => {
          const m = items[i];
          if (!m) return;
          // Same per-kind numbering the grid uses for its aria labels ("Video 2").
          const n = items.slice(0, i + 1).filter((x) => x.type === m.type).length;
          setPreview({
            url: m.url,
            type: m.type,
            label: m.type === 'video' ? t('media.videoN', { n }) : t('media.photoN', { n }),
          });
        }}
      />
      {!items.length && (
        <p className="muted tiny" style={{ padding: '16px 0' }}>
          {t('media.empty')}
        </p>
      )}
      {preview && (
        <MediaPreview
          url={preview.url}
          type={preview.type}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
      <UI.Modal open={confirming != null} onClose={() => setConfirming(null)} small>
        <div className="confirm" role="alertdialog" aria-labelledby="media-confirm-title">
          <button
            type="button"
            className="icon-btn confirm-close"
            aria-label={t('media.cancelRemove')}
            onClick={() => setConfirming(null)}
          >
            <Icon name="x" size={16} />
          </button>
          <div className="confirm-icon">
            <Icon name="trash" size={22} />
          </div>
          <div id="media-confirm-title" className="confirm-title">
            {t('media.removeConfirmTitle')}
          </div>
          <ul className="confirm-points">
            <li>
              <Icon name="alert" size={16} />
              <span>{t('media.removeConfirmBody')}</span>
            </li>
          </ul>
          <div className="confirm-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)}>
              {t('media.cancelRemove')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const i = confirming;
                setConfirming(null);
                if (i != null) remove(i);
              }}
            >
              <Icon name="trash" size={12} /> {t('media.remove')}
            </button>
          </div>
        </div>
      </UI.Modal>
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
  const [gift, setGift] = useState<GiftValue>({
    occasions: csv(p.giftOccasions),
    recipients: csv(p.giftRecipients),
    types: csv(p.giftTypes),
    interests: (p.giftInterests || '') as string,
    ageMin: p.giftAgeMin ?? '',
    ageMax: p.giftAgeMax ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await jsend(`/api/products/${p.id}`, 'PUT', {
        giftOccasions: gift.occasions.join(','),
        giftRecipients: gift.recipients.join(','),
        giftTypes: gift.types.join(','),
        giftInterests: gift.interests,
        giftAgeMin: gift.ageMin === '' ? null : Number(gift.ageMin),
        giftAgeMax: gift.ageMax === '' ? null : Number(gift.ageMax),
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
    <>
      <GiftFields value={gift} onChange={(patch) => setGift((g) => ({ ...g, ...patch }))} />
      <div className="dp-section" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Icon name="check" size={14} /> {saving ? 'Saving…' : 'Save gift details'}
        </button>
      </div>
    </>
  );
}
