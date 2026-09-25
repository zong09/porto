import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';
import { apiErrorMessage } from '../api/apiError';

export const PortfolioModal: React.FC = () => {
  const { modals, activePortfolioId } = useStore();
  const { data: portfolios = [] } = usePortfolios();
  if (!modals.portfolio) return null;
  // A fresh form per open (and per edited portfolio) starts from its initial values.
  const editing = activePortfolioId ? portfolios.find((p) => p.id === activePortfolioId) : undefined;
  return <PortfolioModalForm key={editing?.id ?? 'new'} />;
};

const PortfolioModalForm: React.FC = () => {
  const { closeModal, activePortfolioId } = useStore();
  const { data: portfolios = [], createPortfolio, updatePortfolio } = usePortfolios();
  const { t, language } = useTranslation();

  const editing = activePortfolioId ? portfolios.find((p) => p.id === activePortfolioId) : undefined;
  const isEdit = !!editing;

  // Prefilled with the current name in edit mode
  const [name, setName] = useState(() => editing?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (isEdit && editing) {
        await updatePortfolio.mutateAsync({ id: editing.id, name: trimName });
      } else {
        await createPortfolio.mutateAsync({ name: trimName });
      }
      setName('');
      closeModal('portfolio');
    } catch (err) {
      setError(apiErrorMessage(err, t('common.error')));
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
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[18px] font-bold text-dark mb-[18px]">{isEdit ? (language === 'th' ? 'แก้ไขชื่อพอร์ต' : 'Rename Portfolio') : t('portfolios.createPortTitle')}</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('portfolios.portNameLabel')}</label>
            <input
              type="text"
              placeholder={t('portfolios.placeholderName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              autoFocus
              id="input-port-name"
            />
          </div>

          {error && (
            <div className="bg-negative-bg text-lossD text-xs px-4 py-2.5 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => closeModal('portfolio')}
              className="py-[9px] px-[18px] rounded-full bg-chipBg hover:bg-softH text-chipBg-text text-[13.5px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-[9px] px-[22px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13.5px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-port"
            >
              {loading ? t('common.loading') : (isEdit ? t('common.save') : (language === 'th' ? 'สร้างพอร์ต' : 'Create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
