'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import * as UI from './ui';
import { jsend } from '@/lib/api';
import { useI18n } from '@/i18n';
import {
  MAX_IMPORT_ROWS,
  importNumber,
  importTemplateCsv,
  rowsFromCsv,
  validateImportRows,
  type ImportIssue,
  type ImportRow,
  type ImportSummary,
} from '@/lib/productImport';

// Products → Import. Parses a CSV client-side, previews it with per-row
// validation, then posts the rows to `POST /api/products/import` (which
// re-validates and upserts by SKU). `onImported` lets the parent reload.
export default function ImportProductsModal({ open, onClose, onImported }: any) {
  const { t } = useI18n();
  const toast = UI.useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [lines, setLines] = useState<number[]>([]);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const reset = () => {
    setFileName('');
    setRows([]);
    setLines([]);
    setFileError('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const issues = useMemo(() => validateImportRows(rows), [rows]);
  const validCount = issues.filter((i) => !i.length).length;
  const issueText = (list: ImportIssue[]) =>
    list.map((i) => t(`productImport.issues.${i.code}`, { field: i.field })).join('; ');

  const close = () => {
    if (!submitting) onClose();
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([importTemplateCsv()], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name)) {
      setFileError(t('productImport.errors.notCsv'));
      return;
    }
    setReading(true);
    try {
      const parsed = rowsFromCsv(await file.text());
      if (parsed.missingColumns.length)
        setFileError(
          t('productImport.errors.missingColumns', { columns: parsed.missingColumns.join(', ') }),
        );
      else if (!parsed.rows.length) setFileError(t('productImport.errors.empty'));
      else if (parsed.rows.length > MAX_IMPORT_ROWS)
        setFileError(
          t('productImport.errors.tooMany', { count: parsed.rows.length, max: MAX_IMPORT_ROWS }),
        );
      else {
        setRows(parsed.rows);
        setLines(parsed.lines);
      }
    } catch {
      setFileError(t('productImport.errors.unreadable'));
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (submitting || !validCount) return;
    setSubmitting(true);
    try {
      // Invalid rows are sent too so the server's summary covers the whole file.
      const summary: ImportSummary = await jsend('/api/products/import', 'POST', { rows });
      setResult(summary);
      toast({
        message: t('productImport.done', summary as any),
        icon: summary.failed ? 'alert' : 'check',
        type: summary.failed ? 'danger' : undefined,
      });
      if (summary.created || summary.updated) onImported?.();
    } catch (e: any) {
      toast({
        message: t('productImport.errors.failed', { message: e.message }),
        icon: 'alert',
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const failedResults = result?.results.filter((r) => r.status === 'failed') || [];

  return (
    <UI.Modal open={open} onClose={close} large>
      <div
        style={{
          padding: 'var(--s-4) var(--s-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>
          {t('productImport.title')}
        </h3>
        <button
          className="icon-btn"
          style={{ marginLeft: 'auto' }}
          onClick={close}
          disabled={submitting}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div
        style={{
          padding: 'var(--s-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '60vh',
          overflow: 'auto',
        }}
      >
        {result ? (
          <>
            <div style={{ fontWeight: 600 }}>{t('productImport.resultTitle', result as any)}</div>
            {failedResults.length > 0 && (
              <>
                <div style={{ fontSize: 'var(--t-sm)', color: 'var(--fg-secondary)' }}>
                  {t('productImport.failedRows')}
                </div>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>{t('productImport.colLine')}</th>
                      <th>{t('productImport.colSku')}</th>
                      <th>{t('productImport.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedResults.map((r) => (
                      <tr key={r.index}>
                        <td className="mono">{lines[r.index]}</td>
                        <td className="mono">{r.sku || '—'}</td>
                        <td style={{ color: 'var(--danger)' }}>{issueText(r.issues || [])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--fg-secondary)' }}>
              {t('productImport.intro')}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <button
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
                disabled={reading || submitting}
              >
                <Icon name="upload" size={14} />{' '}
                {fileName ? t('productImport.changeFile') : t('productImport.chooseFile')}
              </button>
              <button className="btn btn-ghost" onClick={downloadTemplate}>
                <Icon name="download" size={14} /> {t('productImport.downloadTemplate')}
              </button>
              {fileName && (
                <span className="mono" style={{ fontSize: 'var(--t-sm)' }}>
                  {fileName}
                </span>
              )}
            </div>
            {reading && <div>{t('productImport.reading')}</div>}
            {fileError && (
              <div style={{ color: 'var(--danger)', display: 'flex', gap: 6 }}>
                <Icon name="alert" size={14} /> {fileError}
              </div>
            )}
            {rows.length > 0 && (
              <>
                <div style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>
                  {t('productImport.summary', {
                    total: rows.length,
                    valid: validCount,
                    invalid: rows.length - validCount,
                  })}
                </div>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>{t('productImport.colLine')}</th>
                      <th>{t('productImport.colName')}</th>
                      <th>{t('productImport.colSku')}</th>
                      <th style={{ textAlign: 'right' }}>{t('productImport.colStock')}</th>
                      <th style={{ textAlign: 'right' }}>{t('productImport.colPrice')}</th>
                      <th>{t('productImport.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const price = importNumber(r.price);
                      return (
                        <tr key={lines[i]}>
                          <td className="mono">{lines[i]}</td>
                          <td>{r.name || '—'}</td>
                          <td className="mono">{r.sku || '—'}</td>
                          <td className="col-num">{r.stock || '—'}</td>
                          <td className="col-num">
                            {Number.isFinite(price) ? UI.fmt.money(price) : r.price || '—'}
                          </td>
                          <td
                            style={{
                              color: issues[i].length ? 'var(--danger)' : 'var(--success)',
                            }}
                          >
                            {issues[i].length ? issueText(issues[i]) : t('productImport.ok')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
      <div
        style={{
          padding: 'var(--s-3) var(--s-5)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          background: 'var(--bg-muted)',
        }}
      >
        {result ? (
          <button className="btn btn-primary" onClick={close}>
            {t('productImport.close')}
          </button>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={close} disabled={submitting}>
              {t('productImport.cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || reading || !validCount}
            >
              <Icon name="upload" size={14} />{' '}
              {submitting
                ? t('productImport.importing')
                : t('productImport.importRows', { count: validCount })}
            </button>
          </>
        )}
      </div>
    </UI.Modal>
  );
}
