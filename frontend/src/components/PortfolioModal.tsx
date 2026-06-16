import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const PortfolioModal: React.FC = () => {
  const { modals, closeModal } = useStore();
  const { createPortfolio } = usePortfolios();
  const { t, language } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!modals.portfolio) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimName = name.trim();
    if (!trimName) {
      setError(t('portfolios.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      await createPortfolio.mutateAsync({ name: trimName });
      setName('');
      closeModal('portfolio');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => closeModal('portfolio')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[32px] p-8 w-full max-w-[480px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[22px] font-bold text-dark mb-6">{t('portfolios.createPortTitle')}</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{t('portfolios.portNameLabel')}</label>
            <input
              type="text"
              placeholder={t('portfolios.placeholderName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              autoFocus
              id="input-port-name"
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
              onClick={() => closeModal('portfolio')}
              className="px-7 py-3 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[14px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-port"
            >
              {loading ? t('common.loading') : (language === 'th' ? 'สร้างพอร์ต' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
