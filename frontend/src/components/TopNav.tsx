import React from 'react';
import { useStore } from '../store/useStore';
import { useAssets } from '../hooks/useApi';

export const TopNav: React.FC = () => {
  const { page, setPage, currency, setCurrency, user, logout, openModal } = useStore();
  const { data: assets } = useAssets();

  const handleAddClick = () => {
    if (assets && assets.length > 0) {
      openModal('tx');
    } else {
      openModal('asset');
    }
  };

  const navLinkClass = (active: boolean) =>
    `cursor-pointer text-[14.5px] font-medium pb-[2px] transition-all border-b-2 hover:text-dark ${
      active ? 'text-dark border-terracotta font-bold' : 'text-muted border-transparent'
    }`;

  const pillClass = (active: boolean) =>
    `px-[14px] py-[5px] rounded-full cursor-pointer transition-all duration-150 ${
      active ? 'text-surface bg-dark' : 'text-muted bg-transparent hover:text-dark'
    }`;

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-[20px] px-[28px] py-[14px] border-b border-[#eee3d2] bg-surface flex-wrap">
      <div className="flex items-center gap-[9px] cursor-pointer select-none" onClick={() => setPage('overview')}>
        <div className="w-[26px] h-[26px] rounded-full bg-terracotta flex-shrink-0"></div>
        <span className="text-[17px] font-bold text-dark tracking-tight">Porto</span>
      </div>

      <div className="flex items-center gap-5 ml-2.5 flex-wrap">
        <span onClick={() => setPage('overview')} className={navLinkClass(page === 'overview')} id="nav-overview">ภาพรวม</span>
        <span onClick={() => setPage('ports')} className={navLinkClass(page === 'ports')} id="nav-ports">พอร์ต</span>
        <span onClick={() => setPage('tx')} className={navLinkClass(page === 'tx')} id="nav-tx">Transactions</span>
        <span onClick={() => setPage('debt')} className={navLinkClass(page === 'debt')} id="nav-debt">หนี้สิน</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Currency Switcher */}
        <div className="flex bg-[#f0e7d8] rounded-full p-[3px] text-[12.5px] font-bold select-none">
          <div onClick={() => setCurrency('THB')} className={pillClass(currency === 'THB')} id="btn-thb">฿ THB</div>
          <div onClick={() => setCurrency('USD')} className={pillClass(currency === 'USD')} id="btn-usd">$ USD</div>
        </div>

        {/* Add Transaction Button */}
        <button
          onClick={handleAddClick}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:opacity-88 text-white text-[13px] font-bold border-none cursor-pointer transition-all duration-150 active:scale-98 shadow-sm"
          id="btn-add-txn"
        >
          + เพิ่มรายการ
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="px-[13px] py-[8px] rounded-full bg-transparent hover:bg-chipBg text-muted hover:text-dark text-[12.5px] font-bold border border-inputBorder cursor-pointer transition-all duration-150"
          id="btn-logout"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
};
