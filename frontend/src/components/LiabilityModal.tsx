import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useLiabilities } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

type EditMode = 'set' | 'pay' | 'add';

const currencySym = (c: 'THB' | 'USD') => (c === 'USD' ? '$' : '฿');
const fmtMoney = (n: number, c: 'THB' | 'USD') =>
  `${currencySym(c)}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const selectStyle = {
  backgroundImage:
    'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23EC6530%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px top 50%',
  backgroundSize: '0.65rem auto',
} as const;

export const LiabilityModal: React.FC = () => {
  const { modals, closeModal, activeLiabilityId } = useStore();
  const { data: liabilities = [], createLiability, updateLiability, adjustLiability } = useLiabilities();
  const { t, language } = useTranslation();

  const editing = liabilities.find((l) => l.id === activeLiabilityId) || null;
  const isEdit = !!editing;
  const th = language === 'th';

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [mode, setMode] = useState<EditMode>('set');
  const [delta, setDelta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!modals.liability) return;
    if (editing) {
      setName(editing.name);
      setAmount(String(editing.amount));
      setCurrency(editing.currency);
    } else {
      setName('');
      setAmount('');
      setCurrency('THB');
    }
    setMode('set');
    setDelta('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modals.liability, activeLiabilityId]);

  if (!modals.liability) return null;

  const close = () => closeModal('liability');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Delta modes: จ่ายหนี้ / เพิ่มหนี้
    if (isEdit && mode !== 'set') {
      const d = parseFloat(delta);
      if (isNaN(d) || d <= 0) {
        setError(th ? 'กรุณากรอกจำนวนเงินให้ถูกต้อง (> 0)' : 'Please enter a valid amount (> 0)');
        return;
      }
      setLoading(true);
      try {
        await adjustLiability.mutateAsync({
          id: editing!.id,
          type: mode === 'pay' ? 'pay' : 'add',
          amount: d,
          date: new Date().toISOString().slice(0, 10),
        });
        close();
      } catch (err: any) {
        setError(err.response?.data?.message || t('common.error'));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Create / set net balance
    const trimName = name.trim();
    const parsedAmount = parseFloat(amount);
    if (!trimName) {
      setError(th ? 'กรุณากรอกชื่อรายการหนี้สิน' : 'Please enter a liability name');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError(th ? 'กรุณากรอกยอดหนี้สินให้ถูกต้อง' : 'Please enter a valid balance');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateLiability.mutateAsync({ id: editing!.id, name: trimName, amount: parsedAmount, currency });
      } else {
        await createLiability.mutateAsync({ name: trimName, amount: parsedAmount, currency });
      }
      close();
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 py-[8px] rounded-[10px] text-[12.5px] font-bold border-none cursor-pointer transition-colors ${
      active ? 'bg-terracotta text-white' : 'bg-chipBg text-chipBg-text hover:bg-[#e8dcc8]'
    }`;

  const current = editing ? Number(editing.amount) : 0;
  const d = parseFloat(delta);
  const hasPreview = isEdit && mode !== 'set' && !isNaN(d) && d > 0;
  const nextBalance = Math.max(0, mode === 'pay' ? current - d : current + d);

  const title = isEdit ? (th ? 'แก้ไขหนี้สิน' : 'Edit Liability') : t('modals.liability.createTitle');
  const submitLabel = loading
    ? t('common.loading')
    : isEdit && mode === 'pay'
    ? th ? 'จ่ายหนี้' : 'Pay'
    : isEdit && mode === 'add'
    ? th ? 'เพิ่มหนี้' : 'Add Debt'
    : t('common.save');

  const inputClass =
    'w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm';

  return (
    <div onClick={close} className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[18px] font-bold text-dark mb-[18px]">{title}</h3>

        {isEdit && (
          <>
            <div className="bg-[#f7f0e4] rounded-[12px] px-[16px] py-[11px] mb-[14px] flex items-baseline gap-2">
              <span className="text-[12.5px] text-muted">{th ? 'ยอดปัจจุบัน' : 'Current balance'}</span>
              <span className="ml-auto text-[16px] font-bold text-[#A8341C] tabular-nums">{fmtMoney(current, currency)}</span>
            </div>
            <div className="flex gap-1.5 mb-[16px]">
              <button type="button" onClick={() => setMode('set')} className={tabClass(mode === 'set')}>
                {th ? 'แก้ไขยอดสุทธิ' : 'Set balance'}
              </button>
              <button type="button" onClick={() => setMode('pay')} className={tabClass(mode === 'pay')}>
                {th ? 'จ่ายหนี้' : 'Pay'}
              </button>
              <button type="button" onClick={() => setMode('add')} className={tabClass(mode === 'add')}>
                {th ? 'เพิ่มหนี้' : 'Add debt'}
              </button>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          {(!isEdit || mode === 'set') && (
            <>
              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{th ? 'ชื่อหนี้สิน' : 'Liability Name'}</label>
                <input
                  type="text"
                  placeholder={th ? 'เช่น บัตรเครดิต, สินเชื่อบ้าน' : 'e.g. Credit Card, Mortgage'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  autoFocus
                  id="input-debt-name"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{th ? `ยอดหนี้สิน (${currency})` : `Outstanding Balance (${currency})`}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="0.00"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`flex-1 ${inputClass}`}
                    id="input-debt-amount"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'THB' | 'USD')}
                    className="w-[85px] py-[10px] px-[12px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark font-semibold focus:outline-none focus:border-terracotta transition-colors cursor-pointer shadow-sm appearance-none"
                    style={selectStyle}
                  >
                    <option value="THB">THB</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {isEdit && mode !== 'set' && (
            <>
              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                  {mode === 'pay'
                    ? th ? `จำนวนเงินที่จ่าย (${currency})` : `Payment amount (${currency})`
                    : th ? `จำนวนหนี้ที่เพิ่ม (${currency})` : `Debt added (${currency})`}
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className={inputClass}
                  autoFocus
                  id="input-debt-delta"
                />
              </div>
              {hasPreview && (
                <div className="bg-[#eef3ea] text-[#4a6b3f] text-[13px] font-semibold px-[14px] py-[9px] rounded-[12px] tabular-nums">
                  {th ? 'ยอดใหม่' : 'New balance'}: {fmtMoney(nextBalance, currency)}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-negative-bg text-[#A8341C] text-xs px-4 py-2.5 rounded-xl border border-negative-text/10">{error}</div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={close}
              className="py-[9px] px-[18px] rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[13.5px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-[9px] px-[22px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13.5px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-debt"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
