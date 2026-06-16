import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAssets } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const PriceModal: React.FC = () => {
  const { modals, closeModal, activeAssetId } = useStore();
  const { data: assets = [], updateAsset } = useAssets();
  const { t, language } = useTranslation();
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeAsset = assets.find((a) => a.id === activeAssetId);

  useEffect(() => {
    if (activeAsset) {
      setPrice(activeAsset.manualPrice?.toString() || '');
    }
  }, [activeAsset]);

  if (!modals.price || !activeAsset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError(language === 'th' ? 'กรุณากรอกราคา NAV ให้ถูกต้อง (> 0)' : 'Please enter a valid NAV price (> 0)');
      return;
    }

    setLoading(true);
    try {
      await updateAsset.mutateAsync({
        id: activeAsset.id,
        manualPrice: parsedPrice,
      });
      setPrice('');
      closeModal('price');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => closeModal('price')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[32px] p-8 w-full max-w-[480px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[22px] font-bold text-dark mb-1">{t('modals.price.title')}</h3>
        <p className="text-sm.5 text-muted mb-6">{activeAsset.symbol} — {activeAsset.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{language === 'th' ? 'NAV ปัจจุบัน (฿/หน่วย)' : 'Current NAV (฿/Unit)'}</label>
            <input
              type="number"
              placeholder="0.00"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-5 py-3.5 rounded-[20px] border border-inputBorder bg-white text-[15px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              autoFocus
              id="input-nav-price"
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
              onClick={() => closeModal('price')}
              className="px-7 py-3 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[14px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-nav"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
