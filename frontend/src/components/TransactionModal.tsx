import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAssets, useTransactions } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const TransactionModal: React.FC = () => {
  const { modals, closeModal, activeAssetId, openModal } = useStore();
  const { data: assets = [] } = useAssets();
  const { createTransaction } = useTransactions();
  const { t, language } = useTranslation();

  const [assetId, setAssetId] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy'); // Buy/Deposit -> 'buy', Sell/Withdraw -> 'sell'
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedAsset = assets.find((a) => a.id === assetId);
  const isDeposit = selectedAsset?.type === 'deposit';

  useEffect(() => {
    if (modals.tx) {
      if (activeAssetId) {
        setAssetId(activeAssetId);
      } else if (assets.length > 0) {
        setAssetId(assets[0].id);
      }
      setSide('buy');
      setQuantity('');
      setFee('');
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [modals.tx, activeAssetId, assets]);

  useEffect(() => {
    if (selectedAsset) {
      if (selectedAsset.type === 'deposit') {
        setPrice('1');
        setFee('0');
      } else {
        setPrice(selectedAsset.currentPrice?.toString() || '');
        setFee('');
      }
    }
  }, [selectedAsset]);

  if (!modals.tx) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError(
        language === 'th'
          ? 'กรุณาเลือกสินทรัพย์ก่อน — ถ้ายังไม่มีให้กด "+ เพิ่มสินทรัพย์ใหม่"'
          : 'Please select an asset first - if none exist, click "+ Add New Asset"'
      );
      return;
    }

    const q = parseFloat(quantity);
    const p = isDeposit ? 1 : parseFloat(price);
    const f = isDeposit ? 0 : parseFloat(fee || '0');

    if (isNaN(q) || q <= 0) {
      setError(language === 'th' ? 'กรุณากรอกจำนวนให้ถูกต้อง (> 0)' : 'Please enter a valid quantity (> 0)');
      return;
    }
    if (!isDeposit && (isNaN(p) || p <= 0)) {
      setError(language === 'th' ? 'กรุณากรอกราคาให้ถูกต้อง (> 0)' : 'Please enter a valid price (> 0)');
      return;
    }
    if (!isDeposit && (isNaN(f) || f < 0)) {
      setError(language === 'th' ? 'กรุณากรอกค่าธรรมเนียมให้ถูกต้อง (>= 0)' : 'Please enter a valid fee (>= 0)');
      return;
    }

    // Verify sell limit
    if (side === 'sell' && selectedAsset) {
      const currentQty = selectedAsset.position?.quantity || 0;
      if (q > currentQty + 1e-9) {
        setError(
          language === 'th'
            ? `ไม่สามารถขายเกินจำนวนที่ถืออยู่ได้ (ปัจจุบันถืออยู่ ${currentQty.toLocaleString()} หน่วย)`
            : `Cannot sell more than you hold (currently holding ${currentQty.toLocaleString()} units)`
        );
        return;
      }
    }

    setLoading(true);
    try {
      await createTransaction.mutateAsync({
        assetId,
        side: isDeposit ? (side === 'buy' ? 'deposit' : 'withdraw') : side,
        quantity: q,
        price: p,
        fee: f,
        date,
      });
      // Reset & close
      closeModal('tx');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleSideBtn = (active: boolean) =>
    `flex-1 py-3 rounded-full border font-bold text-[13.5px] cursor-pointer text-center transition-colors ${
      active
        ? 'bg-terracotta border-terracotta text-white'
        : 'bg-white border-inputBorder text-muted hover:bg-surface'
    }`;

  return (
    <div
      onClick={() => closeModal('tx')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[32px] p-8 w-full max-w-[480px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[22px] font-bold text-dark mb-6">{t('modals.transaction.title')}</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Asset select */}
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{t('transactions.colAsset')}</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer shadow-sm"
              id="select-txn-asset"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.portfolio?.name || '—'}
                </option>
              ))}
            </select>
            <div
              onClick={() => {
                closeModal('tx');
                openModal('asset');
              }}
              className="text-xs text-terracotta hover:text-terracotta-hover font-semibold mt-2.5 cursor-pointer underline select-none inline-block"
            >
              + {t('portfolios.addAssetBtn')}
            </div>
          </div>

          {/* Segmented Buy/Sell toggle */}
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{t('transactions.colType')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={toggleSideBtn(side === 'buy')}
                id="btn-txn-side-buy"
              >
                {isDeposit ? (language === 'th' ? 'ฝากเงิน' : 'Deposit') : (language === 'th' ? 'ซื้อ' : 'Buy')}
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={toggleSideBtn(side === 'sell')}
                id="btn-txn-side-sell"
              >
                {isDeposit ? (language === 'th' ? 'ถอนเงิน' : 'Withdraw') : (language === 'th' ? 'ขาย' : 'Sell')}
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">
              {isDeposit
                ? (language === 'th' ? 'จำนวนเงิน (฿)' : 'Amount (฿)')
                : (language === 'th' ? 'จำนวน (หน่วย/เหรียญ/หุ้น)' : 'Quantity (units/coins/shares)')}
            </label>
            <input
              type="number"
              placeholder="0.00"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              id="input-txn-qty"
            />
          </div>

          {/* Price & Fee (hidden for deposit) */}
          {!isDeposit && (
            <>
              <div>
                <label className="block text-[14px] font-semibold text-muted mb-2">
                  {language === 'th'
                    ? `ราคาต่อหน่วย (${selectedAsset?.currency === 'USD' ? '$' : '฿'})`
                    : `Price per Unit (${selectedAsset?.currency === 'USD' ? '$' : '฿'})`}
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                  id="input-txn-price"
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-muted mb-2">
                  {language === 'th' ? 'ค่าธรรมเนียม (ถ้ามี)' : 'Fee (Optional)'}
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                  id="input-txn-fee"
                />
              </div>
            </>
          )}

          {/* Date */}
          <div>
            <label className="block text-[14px] font-semibold text-muted mb-2">{t('transactions.colDate')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-inputBorder bg-white text-[13px] text-dark focus:outline-none focus:border-terracotta transition-colors cursor-pointer shadow-sm"
              id="input-txn-date"
            />
          </div>

          {error && (
            <div className="bg-[#f3ded6] text-[#84422e] text-xs px-4 py-2.5 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => closeModal('tx')}
              className="px-7 py-3 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[14px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-txn"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

