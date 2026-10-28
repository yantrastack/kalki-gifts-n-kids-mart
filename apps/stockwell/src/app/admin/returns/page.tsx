'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import { jget, jsend } from '@/lib/api';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';

export default function ReturnsPage() {
  const { fmt, statusBadge, Kpi2, Modal, Dropdown, MenuItem, useToast } = UI;
  const toast = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [refunding, setRefunding] = useState<any>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => jget('/api/returns').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const pending = rows.filter((r) => r.status === 'pending');
  const refunded = rows.filter((r) => r.status === 'refunded');
  // What has been refunded comes from refund payment rows, not from the status.
  const refundValue = rows.reduce((s, r) => s + (r.refundedAmount || 0), 0);

  const setStatus = async (id: string, status: string) => {
    try {
      await jsend(`/api/returns/${id}`, 'PUT', { status });
      toast({ message: `${id} → ${status}`, icon: 'check' });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };

  const startRefund = (r: any) => {
    if (r.status !== 'approved') {
      toast({ message: t('payments.approveFirst'), icon: 'alert', type: 'danger' });
      return;
    }
    if (!(r.refundableAmount > 0)) {
      toast({ message: t('payments.nothingToRefund'), icon: 'alert', type: 'danger' });
      return;
    }
    setRefunding(r);
    setMethod('cash');
    setAmount(r.refundableAmount.toFixed(2));
    setReference('');
  };
  const submitRefund = async () => {
    setBusy(true);
    try {
      await jsend(`/api/returns/${refunding.id}/refund`, 'POST', {
        method,
        amount: Number(amount),
        reference: reference.trim() || undefined,
      });
      toast({
        message: t('payments.refunded', { amount: fmt.money(Number(amount)), id: refunding.id }),
        icon: 'check',
      });
      setRefunding(null);
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Returns</div>
          <div className="ph-sub">
            {rows.length} RMAs · {pending.length} pending · {fmt.moneyCompact(refundValue)} refunded
          </div>
        </div>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2
          label="Open RMAs"
          value={String(pending.length)}
          sub="awaiting review"
          color="var(--warn)"
        />
        <Kpi2
          label="Refunded"
          value={String(refunded.length)}
          sub={`${fmt.moneyCompact(refundValue)} total`}
        />
        <Kpi2
          label="Approved"
          value={String(rows.filter((r) => r.status === 'approved').length)}
          sub="ready to refund"
          color="var(--info)"
        />
        <Kpi2 label="Total" value={String(rows.length)} sub="all returns" />
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>RMA</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th className="col-num">Items</th>
                <th className="col-num">Value</th>
                <th className="col-num">{t('payments.refundRow')}</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {r.id}
                  </td>
                  <td>{r.customer}</td>
                  <td className="mono muted">{r.invoiceRef}</td>
                  <td className="col-num">{r.items}</td>
                  <td className="col-num mono">{fmt.money(r.total)}</td>
                  <td className="col-num mono muted">
                    {r.refundedAmount > 0 ? fmt.money(r.refundedAmount) : '—'}
                  </td>
                  <td className="muted">{r.reason}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="muted">{r.date}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={
                        <button className="icon-btn" style={{ width: 26, height: 26 }}>
                          <Icon name="more" size={14} />
                        </button>
                      }
                    >
                      {r.status === 'pending' && (
                        <MenuItem
                          icon="check"
                          label="Approve"
                          onClick={() => setStatus(r.id, 'approved')}
                        />
                      )}
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <MenuItem
                          icon="refund"
                          label={t('payments.refundAction')}
                          onClick={() => startRefund(r)}
                        />
                      )}
                      {(r.status === 'pending' || r.status === 'approved') &&
                        !(r.refundedAmount > 0) && (
                          <MenuItem
                            icon="x"
                            label="Reject"
                            danger
                            onClick={() => setStatus(r.id, 'rejected')}
                          />
                        )}
                    </Dropdown>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <UI.EmptyState
                      icon="refund"
                      title="No returns"
                      body="Return requests will appear here."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!refunding} onClose={() => !busy && setRefunding(null)}>
        {refunding && (
          <>
            <div
              style={{
                padding: 'var(--s-4) var(--s-5)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>
                {t('payments.refundTitle')}
              </h3>
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => setRefunding(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--s-5)', display: 'grid', gap: 12 }}>
              <div className="muted tiny">
                {refunding.id} · {refunding.customer} · {refunding.invoiceRef} ·{' '}
                {t('payments.refundHint', { max: fmt.money(refunding.refundableAmount) })}
              </div>
              <label className="field">
                <span>{t('payments.method')}</span>
                <select
                  className="select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`payments.methods.${m}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('payments.amount')}</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('payments.reference')}</span>
                <input
                  className="input"
                  placeholder={t('payments.referenceHint')}
                  maxLength={120}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
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
              <button className="btn btn-secondary" onClick={() => setRefunding(null)}>
                {t('payments.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={submitRefund}
                disabled={busy || !(Number(amount) > 0)}
              >
                <Icon name="check" size={14} /> {t('payments.record')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
