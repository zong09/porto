import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAssets, useTransactions } from '../hooks/useApi';
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

export const TransactionModal: React.FC = () => {
  const { modals, closeModal, activeAssetId, activeTransactionId, openModal } = useStore();
  const { data: assets = [] } = useAssets();
  const { data: transactions = [], createTransaction, updateTransaction } = useTransactions();
  const { t, language } = useTranslation();

  const [assetId, setAssetId] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy'); // Buy/Deposit -> 'buy', Sell/Withdraw -> 'sell'
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const activeTransaction = transactions.find((t) => t.id === activeTransactionId);
  const selectedAsset = assets.find((a) => a.id === assetId);
  const isDeposit = selectedAsset?.type === 'deposit';
  const isShort = (selectedAsset?.direction || 'long') === 'short';
  const assetCcy = selectedAsset?.currency || 'USD';

  useEffect(() => {
    if (!modals.tx) {
      setHasInitialized(false);
      return;
    }

    if (modals.tx && !hasInitialized && assets.length > 0) {
      if (activeTransactionId && activeTransaction) {
        setAssetId(activeTransaction.assetId);
        
        const asset = assets.find((a) => a.id === activeTransaction.assetId);
        const isDep = asset?.type === 'deposit';
        if (isDep) {
          setSide(activeTransaction.side === 'buy' ? 'buy' : 'sell');
        } else {
          setSide(activeTransaction.side as 'buy' | 'sell');
        }
        
        let prefilledQty = Number(activeTransaction.quantity);
        setQuantity(prefilledQty ? Number(prefilledQty.toFixed(8)).toString() : '');

        let prefilledPrice = Number(activeTransaction.price);
        let prefilledFee = Number(activeTransaction.fee || 0);
        
        setPrice(prefilledPrice ? Number(prefilledPrice.toFixed(8)).toString() : (Number(activeTransaction.price) === 0 ? '0' : ''));
        setFee(prefilledFee ? Number(prefilledFee.toFixed(8)).toString() : (Number(activeTransaction.fee) === 0 ? '0' : ''));
        setDate(activeTransaction.date.slice(0, 10));
      } else {
        if (activeAssetId) {
          setAssetId(activeAssetId);
        } else if (assets.length > 0) {
          setAssetId(assets[0].id);
        }
        setSide(isShort ? 'sell' : 'buy');
        setQuantity('');
        setFee('');
        setDate(new Date().toISOString().slice(0, 10));
      }
      setHasInitialized(true);
    }
  }, [modals.tx, hasInitialized, activeTransactionId, activeAssetId]);

  useEffect(() => {
    const asset = assets.find((a) => a.id === assetId);
    if (asset && !activeTransactionId) {
      if (asset.type === 'deposit') {
        setPrice('1');
        setFee('0');
      } else {
        let val = asset.currentPrice || 0;
        setPrice(val ? Number(val.toFixed(8)).toString() : '');
        setFee('');
      }
    }
  }, [assetId, activeTransactionId]);

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

    const qInput = parseFloat(quantity);
    const pInput = isDeposit ? 1 : parseFloat(price.replace(/[$,]/g, ''));
    const fInput = isDeposit ? 0 : parseFloat((fee || '0').replace(/[$,]/g, ''));

    if (isNaN(qInput) || qInput <= 0) {
      setError(language === 'th' ? 'กรุณากรอกจำนวนให้ถูกต้อง (> 0)' : 'Please enter a valid quantity (> 0)');
      return;
    }
    if (!isDeposit && (isNaN(pInput) || pInput <= 0)) {
      setError(language === 'th' ? 'กรุณากรอกราคาให้ถูกต้อง (> 0)' : 'Please enter a valid price (> 0)');
      return;
    }
    if (!isDeposit && (isNaN(fInput) || fInput < 0)) {
      setError(language === 'th' ? 'กรุณากรอกค่าธรรมเนียมให้ถูกต้อง (>= 0)' : 'Please enter a valid fee (>= 0)');
      return;
    }

    let q = qInput;
    let p = pInput;
    let f = fInput;

    // Verify quantity limit
    if (selectedAsset) {
      if (isShort) {
        // Short: validate buy (cover) does not exceed short quantity
        if (side === 'buy') {
          const currentQty = selectedAsset.position?.quantity || 0;
          const oldQty = activeTransactionId && activeTransaction ? Number(activeTransaction.quantity) : 0;
          if (q > (currentQty + oldQty) + 1e-9) {
            const formattedQty = (currentQty + oldQty).toLocaleString('en-US', { maximumFractionDigits: 8 });
            setError(
              language === 'th'
                ? `ไม่สามารถ cover เกินจำนวนที่ short อยู่ได้ (ปัจจุบัน short อยู่ ${formattedQty} หน่วย)`
                : `Cannot cover more than you are short (currently short ${formattedQty} units)`
            );
            return;
          }
        }
      } else {
        // Long: validate sell does not exceed held quantity
        if (side === 'sell') {
          const currentQty = selectedAsset.position?.quantity || 0;
          const oldQty = activeTransactionId && activeTransaction ? Number(activeTransaction.quantity) : 0;
          if (q > (currentQty + oldQty) + 1e-9) {
            const formattedQty = (currentQty + oldQty).toLocaleString('en-US', { maximumFractionDigits: 8 });
            setError(
              language === 'th'
                ? `ไม่สามารถขายเกินจำนวนที่ถืออยู่ได้ (ปัจจุบันถืออยู่ ${formattedQty} หน่วย)`
                : `Cannot sell more than you hold (currently holding ${formattedQty} units)`
            );
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      if (activeTransactionId) {
        await updateTransaction.mutateAsync({
          id: activeTransactionId,
          assetId,
          side: isDeposit ? (side === 'buy' ? 'deposit' : 'withdraw') : side,
          quantity: q,
          price: p,
          fee: f,
          date,
        });
      } else {
        await createTransaction.mutateAsync({
          assetId,
          side: isDeposit ? (side === 'buy' ? 'deposit' : 'withdraw') : side,
          quantity: q,
          price: p,
          fee: f,
          date,
        });
      }
      // Reset & close
      closeModal('tx');
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleSideBtn = (active: boolean) =>
    `flex-1 py-[9px] rounded-[12px] border font-bold text-[13.5px] cursor-pointer text-center transition-colors ${
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
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[18px] font-bold text-dark mb-[18px]">
          {activeTransactionId ? (language === 'th' ? 'แก้ไขรายการธุรกรรม' : 'Edit Transaction') : t('modals.transaction.title')}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          {/* Asset select */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('transactions.colAsset')}</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={!!activeTransactionId}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              id="select-txn-asset"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.portfolio?.name || '—'}
                </option>
              ))}
            </select>
            {!activeTransactionId && (
              <div
                onClick={() => {
                  closeModal('tx');
                  openModal('asset');
                }}
                className="text-xs text-terracotta hover:text-terracotta-hover font-semibold mt-2.5 cursor-pointer underline select-none inline-block"
              >
                + {t('portfolios.addAssetBtn')}
              </div>
            )}
          </div>

          {/* Segmented Buy/Sell toggle */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('transactions.colType')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={toggleSideBtn(side === 'buy')}
                id="btn-txn-side-buy"
              >
                {isDeposit ? (language === 'th' ? 'ฝากเงิน' : 'Deposit') : isShort ? (language === 'th' ? 'ขาย (เปิด)' : 'Sell (Open)') : (language === 'th' ? 'ซื้อ' : 'Buy')}
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={toggleSideBtn(side === 'sell')}
                id="btn-txn-side-sell"
              >
                {isDeposit ? (language === 'th' ? 'ถอนเงิน' : 'Withdraw') : isShort ? (language === 'th' ? 'ซื้อ (ปิด)' : 'Buy (Cover)') : (language === 'th' ? 'ขาย' : 'Sell')}
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
              {isDeposit
                ? (language === 'th' ? `จำนวนเงิน (${assetCcy === 'USD' ? '$' : '฿'})` : `Amount (${assetCcy === 'USD' ? '$' : '฿'})`)
                : (language === 'th' ? 'จำนวน (หน่วย/เหรียญ/หุ้น)' : 'Quantity (units/coins/shares)')}
            </label>
            <input
              type="text"
              placeholder="0.00"
              value={focusedField === 'qty' ? quantity : formatInputWithCommas(quantity, isDeposit ? 2 : 0, isDeposit ? 2 : 8)}
              onChange={(e) => setQuantity(e.target.value.replace(/,/g, ''))}
              onFocus={() => setFocusedField('qty')}
              onBlur={() => setFocusedField(null)}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              id="input-txn-qty"
            />
          </div>

          {/* Price & Fee (hidden for deposit) */}
          {!isDeposit && (
            <>
              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                  {language === 'th'
                    ? `ราคาต่อหน่วย (${assetCcy === 'USD' ? '$' : '฿'})`
                    : `Price per Unit (${assetCcy === 'USD' ? '$' : '฿'})`}
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={focusedField === 'price' ? price : formatInputWithCommas(price, 2, 8)}
                  onChange={(e) => setPrice(e.target.value.replace(/,/g, ''))}
                  onFocus={() => setFocusedField('price')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                  id="input-txn-price"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                  {language === 'th' ? `ค่าธรรมเนียม (ถ้ามี) (${assetCcy === 'USD' ? '$' : '฿'})` : `Fee (Optional) (${assetCcy === 'USD' ? '$' : '฿'})`}
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={focusedField === 'fee' ? fee : formatInputWithCommas(fee, 2, 8)}
                  onChange={(e) => setFee(e.target.value.replace(/,/g, ''))}
                  onFocus={() => setFocusedField('fee')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                  id="input-txn-fee"
                />
              </div>
            </>
          )}

          {/* Date */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('transactions.colDate')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors cursor-pointer shadow-sm"
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
              className="py-[9px] px-[18px] rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[13.5px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-[9px] px-[22px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13.5px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
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

