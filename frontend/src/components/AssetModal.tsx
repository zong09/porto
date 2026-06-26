import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useTransactions } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

const CG_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  NEAR: 'near',
  ATOM: 'cosmos',
  OP: 'optimism',
  ARB: 'arbitrum',
  SUI: 'sui',
  APT: 'aptos',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
  TON: 'the-open-network',
  TRX: 'tron',
  USDT: 'tether',
  USDC: 'usd-coin',
};

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

export const AssetModal: React.FC = () => {
  const { modals, closeModal, activePortfolioId, activeAssetId, openModal } = useStore();
  const { data: portfolios = [] } = usePortfolios();
  const { data: assets = [], createAsset, updateAsset } = useAssets();
  const { createTransaction } = useTransactions();
  const { t, language } = useTranslation();

  // Edit mode: an asset id is active. Only name + manualPrice (NAV) are editable; the rest is locked.
  const editing = activeAssetId ? assets.find((a) => a.id === activeAssetId) : undefined;
  const isEdit = !!editing;

  // Basic Fields
  const [portfolioId, setPortfolioId] = useState('');
  const [type, setType] = useState<'crypto' | 'th' | 'us' | 'fund' | 'deposit'>('crypto');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [cgId, setCgId] = useState('');
  const [nav, setNav] = useState('');
  // Native currency the asset is denominated in (stored on the asset; transactions are stored in this currency).
  const [assetCcy, setAssetCcy] = useState<'THB' | 'USD'>('USD');
  // Position direction: long (buy-to-open) or short (sell-to-open)
  const [direction, setDirection] = useState<'long' | 'short'>('long');

  // Opening Transaction Fields
  const [oQty, setOQty] = useState('');
  const [oPrice, setOPrice] = useState('');
  const [oFee, setOFee] = useState('');
  const [oDate, setODate] = useState(new Date().toISOString().slice(0, 10));

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!modals.asset) {
      setHasInitialized(false);
      return;
    }

    if (hasInitialized) return;

    setError(null);
    if (editing) {
      // Prefill from the asset being edited.
      setPortfolioId(editing.portfolioId);
      setType(editing.type);
      setAssetCcy(editing.currency);
      setDirection(editing.direction || 'long');
      setSymbol(editing.symbol);
      setName(editing.name && editing.name !== editing.symbol ? editing.name : '');
      setCgId(editing.cgId || '');
      setNav(editing.manualPrice != null ? String(editing.manualPrice) : '');
      setOQty('');
      setOPrice('');
      setOFee('');
      setHasInitialized(true);
    } else {
      if (activePortfolioId) {
        setPortfolioId(activePortfolioId);
      } else if (portfolios.length > 0) {
        setPortfolioId(portfolios[0].id);
      }
      setType('crypto');
      setAssetCcy('USD');
      setDirection('long');
      setSymbol('');
      setName('');
      setCgId('');
      setNav('');
      setOQty('');
      setOPrice('');
      setOFee('');
      setODate(new Date().toISOString().slice(0, 10));
      // Only mark initialized when portfolios are loaded (needed for fallback portfolioId)
      if (portfolios.length > 0 || activePortfolioId) {
        setHasInitialized(true);
      }
    }
  }, [modals.asset, activeAssetId, activePortfolioId, editing, portfolios, hasInitialized]);

  // Symbol auto-mapping to CoinGecko ID
  useEffect(() => {
    if (type === 'crypto') {
      const derived = CG_ID_MAP[symbol.toUpperCase()] || '';
      setCgId(derived);
    }
  }, [symbol, type]);

  if (!modals.asset) return null;

  const handleTypeChange = (newType: typeof type) => {
    setType(newType);
    setError(null);
    // Sensible default native currency per type; user can still override (th/us follow the Yahoo listing currency).
    setAssetCcy(newType === 'th' || newType === 'fund' || newType === 'deposit' ? 'THB' : 'USD');
    // Force long for fund/deposit types (short doesn't make sense for them)
    if (newType === 'fund' || newType === 'deposit') {
      setDirection('long');
    }
    if (newType === 'deposit') {
      setOPrice('1');
      setOFee('0');
    } else {
      setOPrice('');
      setOFee('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Edit mode: update only name + manualPrice (NAV). No transaction, no immutable fields.
    if (isEdit && editing) {
      setLoading(true);
      try {
        await updateAsset.mutateAsync({
          id: editing.id,
          name: name.trim(),
          manualPrice:
            editing.type === 'fund' && nav ? Number.parseFloat(nav.replace(/[$,]/g, '')) : undefined,
        });
        closeModal('asset');
      } catch (err: any) {
        setError(err.response?.data?.message || t('common.error'));
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimSymbol = symbol.trim();
    if (!portfolioId) {
      setError(
        language === 'th'
          ? 'กรุณาเลือกพอร์ตการลงทุนก่อน — หากยังไม่มีให้สร้างพอร์ตก่อน'
          : 'Please select a portfolio first - if you do not have one, please create it first.'
      );
      return;
    }
    if (!trimSymbol) {
      setError(language === 'th' ? 'กรุณากรอก Symbol' : 'Please enter symbol');
      return;
    }

    if (type === 'crypto' && !cgId.trim()) {
      setError(
        language === 'th'
          ? 'ไม่รู้จักเหรียญนี้ — กรุณากรอก CoinGecko ID (สามารถดูได้จาก url ของเหรียญใน coingecko.com)'
          : 'Unknown coin - please enter CoinGecko ID (can be found in the coin URL on coingecko.com)'
      );
      return;
    }

    // Prepare variables
    const yahooSymbol = type === 'th' ? `${trimSymbol}.BK` : type === 'us' ? trimSymbol : undefined;

    // All inputs are entered directly in the asset's native currency (assetCcy); stored as-is.
    const manualPrice = type === 'fund' && nav ? Number.parseFloat(nav.replace(/[$,]/g, '')) : undefined;

    // Validate opening buy details if filled
    const qty = parseFloat(oQty);
    const pr = type === 'deposit' ? 1 : parseFloat(oPrice.replace(/[$,]/g, ''));
    const fe = type === 'deposit' ? 0 : parseFloat((oFee || '0').replace(/[$,]/g, ''));

    const hasOpeningTransaction = oQty.trim() !== '';
    if (hasOpeningTransaction) {
      if (isNaN(qty) || qty <= 0) {
        setError(
          language === 'th'
            ? 'กรุณากรอกจำนวนเริ่มต้นให้ถูกต้อง (> 0)'
            : 'Please enter a valid starting quantity (> 0)'
        );
        return;
      }
      if (type !== 'deposit' && (isNaN(pr) || pr <= 0)) {
        setError(
          language === 'th'
            ? 'กรุณากรอกราคาเริ่มต้นให้ถูกต้อง (> 0)'
            : 'Please enter a valid starting price (> 0)'
        );
        return;
      }
      if (type !== 'deposit' && (isNaN(fe) || fe < 0)) {
        setError(
          language === 'th'
            ? 'กรุณากรอกค่าธรรมเนียมให้ถูกต้อง (>= 0)'
            : 'Please enter a valid fee (>= 0)'
        );
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Create asset
      const createdAsset = await createAsset.mutateAsync({
        portfolioId,
        type,
        symbol: type === 'crypto' || type === 'us' || type === 'th' ? trimSymbol.toUpperCase() : trimSymbol,
        name: name.trim(),
        currency: assetCcy,
        direction,
        cgId: type === 'crypto' ? cgId.trim().toLowerCase() : undefined,
        yahooSymbol,
        manualPrice,
      });

      // 2. Handle opening transaction
      if (hasOpeningTransaction) {
        await createTransaction.mutateAsync({
          assetId: createdAsset.id,
          side: type === 'deposit' ? 'deposit' : (direction === 'short' ? 'sell' : 'buy'),
          quantity: qty,
          price: pr,
          fee: fe,
          date: oDate,
        });
        closeModal('asset');
      } else {
        // Redirect to new transaction modal prefilled
        closeModal('asset');
        setTimeout(() => {
          openModal('tx', { assetId: createdAsset.id });
        }, 150);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const symbolPlaceholder = () => {
    switch (type) {
      case 'th':
        return language === 'th' ? 'เช่น PTT, AOT, CPALL' : 'e.g. PTT, AOT, CPALL';
      case 'us':
        return language === 'th' ? 'เช่น AAPL, NVDA, VOO' : 'e.g. AAPL, NVDA, VOO';
      case 'fund':
        return language === 'th' ? 'เช่น K-CHANGE-A(A)' : 'e.g. K-CHANGE-A(A)';
      case 'deposit':
        return language === 'th' ? 'เช่น บัญชีออมทรัพย์ SCB' : 'e.g. SCB Savings Account';
      default:
        return language === 'th' ? 'เช่น BTC, ETH, SOL' : 'e.g. BTC, ETH, SOL';
    }
  };

  const isDep = type === 'deposit';
  const cleanOPrice = oPrice.replace(/[$,]/g, '');
  const cleanOFee = oFee.replace(/[$,]/g, '');
  const oTotal = (parseFloat(oQty) || 0) * (isDep ? 1 : (parseFloat(cleanOPrice) || 0)) + (isDep ? 0 : (parseFloat(cleanOFee) || 0));
  const totalSpentFmt = (assetCcy === 'USD' ? '$' : '฿') + oTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      onClick={() => closeModal('asset')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[24px] py-[26px] px-[28px] w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <h3 className="text-[18px] font-bold text-dark mb-[18px]">
          {isEdit
            ? (language === 'th' ? 'แก้ไขสินทรัพย์' : 'Edit Asset')
            : t('modals.asset.createTitle')}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          {/* Portfolio Select */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('modals.asset.portLabel')}</label>
            <select
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              disabled={isEdit}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              id="select-asset-port"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Select */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('modals.asset.typeLabel')}</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as any)}
              disabled={isEdit}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              id="select-asset-type"
            >
              <option value="crypto">{language === 'th' ? 'Crypto (ราคาจาก CoinGecko)' : 'Crypto (Price from CoinGecko)'}</option>
              <option value="th">{language === 'th' ? 'หุ้นไทย (ราคาจาก Yahoo — .BK)' : 'Thai Stocks (Price from Yahoo — .BK)'}</option>
              <option value="us">{language === 'th' ? 'หุ้น / ETF สหรัฐ (ราคาจาก Yahoo)' : 'US Stocks / ETFs (Price from Yahoo)'}</option>
              <option value="fund">{language === 'th' ? 'กองทุนรวม (กรอก NAV เอง)' : 'Mutual Funds (Enter NAV manually)'}</option>
              <option value="deposit">{language === 'th' ? 'เงินฝาก / เงินสด' : 'Cash / Deposits'}</option>
            </select>
          </div>

          {/* Native Currency */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
              {language === 'th' ? 'สกุลเงินของสินทรัพย์' : 'Asset Currency'}
            </label>
            <div className="flex gap-2">
              {(['THB', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !isEdit && setAssetCcy(c)}
                  disabled={isEdit}
                  className={`flex-1 py-[9px] rounded-[12px] border font-bold text-[13.5px] text-center transition-colors disabled:cursor-not-allowed ${
                    assetCcy === c
                      ? 'bg-terracotta border-terracotta text-white'
                      : 'bg-white border-inputBorder text-muted hover:bg-surface'
                  } ${isEdit ? 'opacity-60' : 'cursor-pointer'}`}
                  id={`btn-asset-ccy-${c.toLowerCase()}`}
                >
                  {c === 'THB' ? '฿ THB' : '$ USD'}
                </button>
              ))}
            </div>
            {(type === 'th' || type === 'us') && (
              <p className="text-[11.5px] text-muted mt-[6px] leading-snug">
                {language === 'th'
                  ? 'ราคาหุ้นดึงจาก Yahoo ตามสกุลของตลาด — ควรตั้งให้ตรง (หุ้นไทย = THB, หุ้นสหรัฐ = USD)'
                  : 'Stock prices come from Yahoo in the listing currency — keep this matched (Thai = THB, US = USD)'}
              </p>
            )}
          </div>

          {/* Direction Toggle (only for crypto/th/us) */}
          {!isEdit && (type === 'crypto' || type === 'th' || type === 'us') && (
            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                {language === 'th' ? 'ทิศทาง' : 'Direction'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('long')}
                  className={`flex-1 py-[9px] rounded-[12px] border font-bold text-[13.5px] text-center transition-colors cursor-pointer ${
                    direction === 'long'
                      ? 'bg-terracotta border-terracotta text-white'
                      : 'bg-white border-inputBorder text-muted hover:bg-surface'
                  }`}
                  id="btn-asset-dir-long"
                >
                  ▲ Long
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('short')}
                  className={`flex-1 py-[9px] rounded-[12px] border font-bold text-[13.5px] text-center transition-colors cursor-pointer ${
                    direction === 'short'
                      ? 'bg-[#c4654a] border-[#c4654a] text-white'
                      : 'bg-white border-inputBorder text-muted hover:bg-surface'
                  }`}
                  id="btn-asset-dir-short"
                >
                  ▼ Short
                </button>
              </div>
              {direction === 'short' && (
                <p className="text-[11.5px] text-muted mt-[6px] leading-snug">
                  {language === 'th'
                    ? 'Short position — รายการซื้อ/ขายจะกลับทิศ (ขายเปิด/ซื้อปิด) และกำไรเมื่อราคาลดลง'
                    : 'Short position — transactions are reversed (Sell to Open / Buy to Cover) and profit when price drops'}
                </p>
              )}
            </div>
          )}
          {isEdit && editing && (editing.direction || 'long') === 'short' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-negative-bg rounded-[12px]">
              <span className="text-[12px] font-bold text-[#C73B22]">▼ SHORT</span>
              <span className="text-[11.5px] text-[#A8341C] font-medium">
                {language === 'th' ? 'ไม่สามารถเปลี่ยนทิศทางหลังสร้างแล้ว' : 'Direction cannot be changed after creation'}
              </span>
            </div>
          )}

          {/* Symbol */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{t('modals.asset.symbolLabel')}</label>
            <input
              type="text"
              placeholder={symbolPlaceholder()}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={isEdit}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              id="input-asset-symbol"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">{language === 'th' ? 'ชื่อ (ไม่บังคับ)' : 'Name (Optional)'}</label>
            <input
              type="text"
              placeholder={language === 'th' ? 'เช่น Bitcoin, ปตท.' : 'e.g. Bitcoin, PTT'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
              id="input-asset-name"
            />
          </div>

          {/* Crypto CoinGecko ID */}
          {type === 'crypto' && (
            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                {language === 'th' ? 'CoinGecko ID (เว้นว่างได้ถ้าเป็นเหรียญดัง)' : 'CoinGecko ID (Optional for popular coins)'}
              </label>
              <input
                type="text"
                placeholder="เช่น bitcoin, ethereum"
                value={cgId}
                onChange={(e) => setCgId(e.target.value)}
                disabled={isEdit}
                className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                id="input-asset-cgid"
              />
            </div>
          )}

          {/* Fund NAV */}
          {type === 'fund' && (
            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-[6px]">
                {language === 'th' ? `NAV เริ่มต้น (${assetCcy === 'USD' ? '$' : '฿'}/หน่วย)` : `Initial NAV (${assetCcy === 'USD' ? '$' : '฿'}/Unit)`}
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={focusedField === 'nav' ? nav : formatInputWithCommas(nav, 2, 8)}
                onChange={(e) => setNav(e.target.value.replace(/,/g, ''))}
                onFocus={() => setFocusedField('nav')}
                onBlur={() => setFocusedField(null)}
                className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark placeholder-muted/50 focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                id="input-asset-nav"
              />
            </div>
          )}

          {/* Optional Initial Transaction (create only) */}
          {!isEdit && (
          <div className="border-t border-dashed border-inputBorder pt-4 mt-0.5 mb-3.5">
            <div className="text-[13px] font-bold text-chipBg-text mb-2.5">
              {language === 'th' ? (
                <>{direction === 'short' ? 'รายการ Short เริ่มต้น' : 'รายการซื้อเริ่มต้น'} <span className="font-medium text-faint">(ไม่บังคับ — บันทึกยอดที่ถืออยู่ตอนนี้)</span></>
              ) : (
                <>{direction === 'short' ? 'Opening Short' : 'Opening Buy'} <span className="font-medium text-faint">(Optional — record current holdings)</span></>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-muted mb-[5px]">
                  {isDep ? (language === 'th' ? `จำนวนเงินเริ่มต้น (${assetCcy === 'USD' ? '$' : '฿'})` : `Initial Balance (${assetCcy === 'USD' ? '$' : '฿'})`) : (language === 'th' ? 'จำนวน' : 'Quantity')}
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={oQty}
                  onChange={(e) => setOQty(e.target.value)}
                  className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                  id="input-opening-qty"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-muted mb-[5px]">{t('transactions.colDate')}</label>
                <input
                  type="date"
                  value={oDate}
                  onChange={(e) => setODate(e.target.value)}
                  className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors cursor-pointer shadow-sm"
                  id="input-opening-date"
                />
              </div>
            </div>

            {!isDep && oQty.trim() !== '' && (
              <div className="grid grid-cols-2 gap-3.5 mt-3">
                <div>
                  <label className="block text-[12px] font-semibold text-muted mb-[5px]">
                    {language === 'th' ? `ราคาต่อหน่วย (${assetCcy === 'USD' ? '$' : '฿'})` : `Price per Unit (${assetCcy === 'USD' ? '$' : '฿'})`}
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={focusedField === 'oPrice' ? oPrice : formatInputWithCommas(oPrice, 2, 8)}
                    onChange={(e) => setOPrice(e.target.value.replace(/,/g, ''))}
                    onFocus={() => setFocusedField('oPrice')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                    id="input-opening-price"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-muted mb-[5px]">{language === 'th' ? 'ค่าธรรมเนียม' : 'Fee'}</label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={focusedField === 'oFee' ? oFee : formatInputWithCommas(oFee, 2, 8)}
                    onChange={(e) => setOFee(e.target.value.replace(/,/g, ''))}
                    onFocus={() => setFocusedField('oFee')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full py-[10px] px-[14px] rounded-[12px] border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors shadow-sm"
                    id="input-opening-fee"
                  />
                </div>
              </div>
            )}

            {/* Live calculated spent */}
            {oQty.trim() !== '' && (
              <div className="flex items-center mt-3 p-[11px_16px] bg-chipBg rounded-[12px]">
                <span className="text-[12.5px] font-semibold text-chipBg-text">{language === 'th' ? 'มูลค่ารวม (Total spent)' : 'Total spent'}</span>
                <span className="ml-auto text-[16px] font-bold text-dark tabular-nums">{totalSpentFmt}</span>
              </div>
            )}
          </div>
          )}

          {error && (
            <div className="bg-negative-bg text-[#A8341C] text-xs px-4 py-2.5 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={() => closeModal('asset')}
              className="py-[9px] px-[18px] rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[13.5px] font-bold border-none cursor-pointer transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-[9px] px-[22px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13.5px] font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-asset"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

