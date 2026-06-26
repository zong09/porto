import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAssets } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

const formatInputWithCommas = (val: string, minDecimals = 0, maxDecimals = 8) => {
  if (val === '') return '';
  const hasDollar = val.trim().startsWith('$');
  const clean = val.replace(/[$,]/g, '');
  const parts = clean.split('.');
  
  if (parts[0]) {
    const num = Number(parts[0]);
    if (!isNaN(num)) {
      parts[0] = num.toLocaleString('en-US');
    }
  }
  
  let decimalPart = parts[1] || '';
  if (minDecimals > 0) {
    while (decimalPart.length < minDecimals) {
      decimalPart += '0';
    }
  }
  if (decimalPart.length > maxDecimals) {
    decimalPart = decimalPart.slice(0, maxDecimals);
  }
  
  let formatted = parts[0];
  if (decimalPart || clean.includes('.')) {
    formatted = parts[0] + '.' + decimalPart;
  }
  return hasDollar ? '$' + formatted : formatted;
};

export const PriceModal: React.FC = () => {
  const { modals, closeModal, activeAssetId } = useStore();
  const { data: assets = [], updateAsset } = useAssets();
  const { t, language } = useTranslation();
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

    const parsedPrice = parseFloat(price.replace(/[$,]/g, ''));
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
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[18px] font-bold text-dark mb-1">{t('modals.price.title')}</h3>
        <p className="text-[12.5px] text-muted mb-[18px]">{activeAsset.symbol} — {activeAsset.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{language === 'th' ? 'NAV ปัจจุบัน (฿/หน่วย)' : 'Current NAV (฿/Unit)'}</label>
            <input
              type="text"
              placeholder="0.00"
              value={focusedField === 'price' ? price : formatInputWithCommas(price, 2, 8)}
              onChange={(e) => setPrice(e.target.value.replace(/,/g, ''))}
              onFocus={() => setFocusedField('price')}
              onBlur={() => setFocusedField(null)}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              autoFocus
              id="input-nav-price"
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
              onClick={() => closeModal('price')}
              className="py-[9px] px-[18px] rounded-full bg-chipBg hover:bg-softH text-chipBg-text text-[13.5px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-[9px] px-[22px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13.5px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
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
