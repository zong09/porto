import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios } from '../hooks/useApi';
import { X } from 'lucide-react';

export const PortfolioModal: React.FC = () => {
  const { modals, closeModal } = useStore();
  const { createPortfolio } = usePortfolios();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!modals.portfolio) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimName = name.trim();
    if (!trimName) {
      setError('กรุณากรอกชื่อพอร์ต');
      return;
    }

    setLoading(true);
    try {
      await createPortfolio.mutateAsync({ name: trimName });
      setName('');
      closeModal('portfolio');
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างพอร์ต');
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
        className="bg-surface rounded-[24px] p-6.5 w-full max-w-[440px] max-h-[88vh] overflow-y-auto shadow-2xl relative"
      >
        <button
          onClick={() => closeModal('portfolio')}
          className="absolute top-5 right-5 text-muted hover:text-dark bg-transparent border-none cursor-pointer transition-colors p-1"
        >
          <X size={18} />
        </button>

        <h3 className="text-md.5 font-bold text-dark mb-4.5">สร้างพอร์ตใหม่</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted mb-1.5">ชื่อพอร์ต</label>
            <input
              type="text"
              placeholder="เช่น ออมระยะยาว, เทรดสั้น"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-inputBorder bg-white text-[14px] text-dark focus:outline-none focus:border-terracotta transition-colors"
              autoFocus
              id="input-port-name"
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
              onClick={() => closeModal('portfolio')}
              className="px-4.5 py-2.5 rounded-full bg-[#f0e7d8] hover:bg-[#e8dcc8] text-[#6b5d49] text-xs font-bold border-none cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-xs font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              id="btn-submit-port"
            >
              {loading ? 'กำลังบันทึก…' : 'สร้างพอร์ต'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
