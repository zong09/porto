import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useTransactions } from '../hooks/useApi';
import { X } from 'lucide-react';

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

export const AssetModal: React.FC = () => {
  const { modals, closeModal, activePortfolioId, openModal } = useStore();
  const { data: portfolios = [] } = usePortfolios();
  const { createAsset } = useAssets();
  const { createTransaction } = useTransactions();

  // Basic Fields
  const [portfolioId, setPortfolioId] = useState('');
  const [type, setType] = useState<'crypto' | 'th' | 'us' | 'fund' | 'deposit'>('crypto');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [cgId, setCgId] = useState('');
  const [nav, setNav] = useState('');

  // Opening Transaction Fields
  const [oQty, setOQty] = useState('');
  const [oPrice, setOPrice] = useState('');
  const [oFee, setOFee] = useState('');
  const [oDate, setODate] = useState(new Date().toISOString().slice(0, 10));

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modals.asset) {
      if (activePortfolioId) {
        setPortfolioId(activePortfolioId);
      } else if (portfolios.length > 0) {
        setPortfolioId(portfolios[0].id);
      }
      setType('crypto');
      setSymbol('');
      setName('');
      setCgId('');
      setNav('');
      setOQty('');
      setOPrice('');
      setOFee('');
      setODate(new Date().toISOString().slice(0, 10));
    }
  }, [modals.asset, activePortfolioId, portfolios]);

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

    const trimSymbol = symbol.trim();
    if (!portfolioId) {
      setError('กรุณาเลือกพอร์ตการลงทุนก่อน — หากยังไม่มีให้สร้างพอร์ตก่อน');
      return;
    }
    if (!trimSymbol) {
      setError('กรุณากรอก Symbol');
      return;
    }

    if (type === 'crypto' && !cgId.trim()) {
      setError('ไม่รู้จักเหรียญนี้ — กรุณากรอก CoinGecko ID (สามารถดูได้จาก url ของเหรียญใน coingecko.com)');
      return;
    }

    // Prepare variables
    const currency = type === 'us' ? 'USD' : 'THB';
    const yahooSymbol = type === 'th' ? `${trimSymbol}.BK` : type === 'us' ? trimSymbol : undefined;
    const manualPrice = type === 'fund' && nav ? parseFloat(nav) : undefined;

    // Validate opening buy details if filled
    const qty = parseFloat(oQty);
    const pr = type === 'deposit' ? 1 : parseFloat(oPrice);
    const fe = type === 'deposit' ? 0 : parseFloat(oFee || '0');

    const hasOpeningTransaction = oQty.trim() !== '';
    if (hasOpeningTransaction) {
      if (isNaN(qty) || qty <= 0) {
        setError('กรุณากรอกจำนวนเริ่มต้นให้ถูกต้อง (> 0)');
        return;
      }
      if (type !== 'deposit' && (isNaN(pr) || pr <= 0)) {
        setError('กรุณากรอกราคาเริ่มต้นให้ถูกต้อง (> 0)');
        return;
      }
      if (type !== 'deposit' && (isNaN(fe) || fe < 0)) {
        setError('กรุณากรอกค่าธรรมเนียมให้ถูกต้อง (>= 0)');
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
        currency,
        cgId: type === 'crypto' ? cgId.trim().toLowerCase() : undefined,
        yahooSymbol,
        manualPrice,
      });

      // 2. Handle opening transaction
      if (hasOpeningTransaction) {
        await createTransaction.mutateAsync({
          assetId: createdAsset.id,
          side: type === 'deposit' ? 'deposit' : 'buy',
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
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างสินทรัพย์');
    } finally {
      setLoading(false);
    }
  };

  const symbolPlaceholder = () => {
    switch (type) {
      case 'th':
        return 'เช่น PTT, AOT, CPALL';
      case 'us':
        return 'เช่น AAPL, NVDA, VOO';
      case 'fund':
        return 'เช่น K-CHANGE-A(A)';
      case 'deposit':
        return 'เช่น บัญชีออมทรัพย์ SCB';
      default:
        return 'เช่น BTC, ETH, SOL';
    }
  };

  const isDep = type === 'deposit';
  const oTotal = (parseFloat(oQty) || 0) * (isDep ? 1 : (parseFloat(oPrice) || 0)) + (isDep ? 0 : (parseFloat(oFee) || 0));
  const totalSpentFmt = (type === 'us' ? '$' : '฿') + oTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      onClick={() => closeModal('asset')}
      className="fixed inset-0 bg-dark/45 z-[100] flex items-center justify-center p-5 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-[24px] p-6.5 w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <button
          onClick={() => closeModal('asset')}
          className="absolute top-5 right-5 text-muted hover:text-dark bg-transparent border-none cursor-pointer transition-colors p-1"
        >
          <X size={18} />
        </button>

        <h3 className="text-md.5 font-bold text-dark mb-4.5">เพิ่มสินทรัพย์ใหม่</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Portfolio Select */}
          <div>
            <label className="block text-[12px] font-semibold text-muted mb-1.5">พอร์ต</label>
            <select
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer"
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
            <label className="block text-[12px] font-semibold text-muted mb-1.5">ประเภทสินทรัพย์</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors outline-none cursor-pointer"
              id="select-asset-type"
            >
              <option value="crypto">Crypto (ราคาจาก CoinGecko)</option>
              <option value="th">หุ้นไทย (ราคาจาก Yahoo — .BK)</option>
              <option value="us">หุ้น / ETF สหรัฐ (ราคาจาก Yahoo)</option>
              <option value="fund">กองทุนรวม (กรอก NAV เอง)</option>
              <option value="deposit">เงินฝาก / เงินสด</option>
            </select>
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-[12px] font-semibold text-muted mb-1.5">สัญลักษณ์ (Symbol)</label>
            <input
              type="text"
              placeholder={symbolPlaceholder()}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
              id="input-asset-symbol"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold text-muted mb-1.5">ชื่อ (ไม่บังคับ)</label>
            <input
              type="text"
              placeholder="เช่น Bitcoin, ปตท."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
              id="input-asset-name"
            />
          </div>

          {/* Crypto CoinGecko ID */}
          {type === 'crypto' && (
            <div>
              <label className="block text-[12px] font-semibold text-muted mb-1.5">CoinGecko ID (เว้นว่างได้ถ้าเป็นเหรียญดัง)</label>
              <input
                type="text"
                placeholder="เช่น bitcoin, ethereum"
                value={cgId}
                onChange={(e) => setCgId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-asset-cgid"
              />
            </div>
          )}

          {/* Fund NAV */}
          {type === 'fund' && (
            <div>
              <label className="block text-[12px] font-semibold text-muted mb-1.5">NAV เริ่มต้น (฿/หน่วย)</label>
              <input
                type="number"
                placeholder="0.00"
                step="any"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-asset-nav"
              />
            </div>
          )}

          {/* Optional Initial Transaction */}
          <div className="border-t border-dashed border-[#e0d5c2] pt-4 mt-2">
            <h4 className="text-xs.5 font-bold text-chipBg-text mb-3">
              รายการซื้อเริ่มต้น <span className="font-medium text-[#a89a86]">(ไม่บังคับ — บันทึกยอดที่ถืออยู่ตอนนี้)</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  {isDep ? 'จำนวนเงินเริ่มต้น (฿)' : 'จำนวน'}
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="any"
                  value={oQty}
                  onChange={(e) => setOQty(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-inputBorder bg-white text-[13.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                  id="input-opening-qty"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">วันที่</label>
                <input
                  type="date"
                  value={oDate}
                  onChange={(e) => setODate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-inputBorder bg-white text-[13.5px] text-dark focus:outline-none focus:border-terracotta transition-colors cursor-pointer"
                  id="input-opening-date"
                />
              </div>
            </div>

            {!isDep && oQty.trim() !== '' && (
              <div className="grid grid-cols-2 gap-3.5 mt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">ราคาต่อหน่วย ({type === 'us' ? '$' : '฿'})</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="any"
                    value={oPrice}
                    onChange={(e) => setOPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-inputBorder bg-white text-[13.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                    id="input-opening-price"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">ค่าธรรมเนียม</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="any"
                    value={oFee}
                    onChange={(e) => setOFee(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-inputBorder bg-white text-[13.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                    id="input-opening-fee"
                  />
                </div>
              </div>
            )}

            {/* Live calculated spent */}
            {oQty.trim() !== '' && (
              <div className="flex justify-between items-center text-xs.5 font-bold text-muted bg-chipBg/30 border border-inputBorder/10 px-4.5 py-2.5 rounded-xl mt-4.5">
                <span>มูลค่ารวม (Total spent):</span>
                <span className="text-dark tabular-nums">{totalSpentFmt}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-[#f3ded6] text-[#84422e] text-xs px-3.5 py-2 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end mt-3">
            <button
              type="button"
              onClick={() => closeModal('asset')}
              className="px-4.5 py-2.5 rounded-full bg-[#f0e7d8] hover:bg-[#e8dcc8] text-[#6b5d49] text-xs font-bold border-none cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-asset"
            >
              {loading ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
