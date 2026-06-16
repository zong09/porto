import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useLiabilities } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const LiabilityModal: React.FC = () => {
  const { modals, closeModal } = useStore();
  const { createLiability } = useLiabilities();
  const { t, language } = useTranslation();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!modals.liability) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimName = name.trim();
    const parsedAmount = parseFloat(amount);

    if (!trimName) {
      setError(language === 'th' ? 'กรุณากรอกชื่อรายการหนี้สิน' : 'Please enter a liability name');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(
        language === 'th'
          ? 'กรุณากรอกจำนวนยอดหนี้สินให้ถูกต้อง (> 0)'
          : 'Please enter a valid outstanding balance (> 0)'
      );
      return;
    }

    setLoading(true);
    try {
      await createLiability.mutateAsync({ name: trimName, amount: parsedAmount });
      setName('');
      setAmount('');
      closeModal('liability');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => closeModal('liability')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[32px] p-8 w-full max-w-[480px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[22px] font-bold text-dark mb-6">{t('modals.liability.createTitle')}</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{language === 'th' ? 'ชื่อหนี้สิน' : 'Liability Name'}</label>
            <input
              type="text"
              placeholder={language === 'th' ? 'เช่น บัตรเครดิต, สินเชื่อบ้าน' : 'e.g. Credit Card, Mortgage'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              autoFocus
              id="input-debt-name"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{language === 'th' ? 'ยอดหนี้สิน (THB)' : 'Outstanding Balance (THB)'}</label>
            <input
              type="number"
              placeholder="0.00"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              id="input-debt-amount"
            />
          </div>

          {error && (
            <div className="bg-[#f3ded6] text-[#84422e] text-xs px-4 py-2.5 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => closeModal('liability')}
              className="px-7 py-3 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[14px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-debt"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
