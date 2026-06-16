import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAssets } from '../hooks/useApi';
import { X } from 'lucide-react';

export const PriceModal: React.FC = () => {
  const { modals, closeModal, activeAssetId } = useStore();
  const { data: assets = [], updateAsset } = useAssets();
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
      setError('กรุณากรอกราคา NAV ให้ถูกต้อง (> 0)');
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
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกราคา');
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
        className="bg-surface rounded-[24px] p-6.5 w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <button
          onClick={() => closeModal('price')}
          className="absolute top-5 right-5 text-muted hover:text-dark bg-transparent border-none cursor-pointer transition-colors p-1"
        >
          <X size={18} />
        </button>

        <h3 className="text-md.5 font-bold text-dark mb-1">อัปเดตราคา NAV</h3>
        <p className="text-xs text-muted mb-4.5">{activeAsset.symbol} — {activeAsset.name}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted mb-1.5">NAV ปัจจุบัน (฿/หน่วย)</label>
            <input
              type="number"
              placeholder="0.00"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
              autoFocus
              id="input-nav-price"
            />
          </div>

          {error && (
            <div className="bg-[#f3ded6] text-[#84422e] text-xs px-3.5 py-2 rounded-xl border border-negative-text/10">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={() => closeModal('price')}
              className="px-4.5 py-2.5 rounded-full bg-[#f0e7d8] hover:bg-[#e8dcc8] text-[#6b5d49] text-xs font-bold border-none cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-nav"
            >
              {loading ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
