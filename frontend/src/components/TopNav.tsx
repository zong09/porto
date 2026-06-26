import React from 'react';
import { useStore } from '../store/useStore';
import { useAssets } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const TopNav: React.FC = () => {
  const { page, setPage, currency, setCurrency, user, logout, openModal } = useStore();
  const { data: assets } = useAssets();
  const { t } = useTranslation();

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
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-[16px] sm:gap-[20px] px-[16px] sm:px-[28px] py-[12px] sm:py-[14px] border-b border-[#eee3d2] bg-surface overflow-x-auto [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-[9px] cursor-pointer select-none" onClick={() => setPage('overview')}>
        <div className="w-[26px] h-[26px] rounded-full bg-terracotta flex-shrink-0"></div>
        <span className="text-[17px] font-bold text-dark tracking-tight">Porto</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-5 ml-1 sm:ml-2.5 flex-1 min-w-max">
        <span onClick={() => setPage('overview')} className={navLinkClass(page === 'overview')} id="nav-overview">{t('common.overview')}</span>
        <span onClick={() => setPage('ports')} className={navLinkClass(page === 'ports')} id="nav-ports">{t('common.ports')}</span>
        <span onClick={() => setPage('tx')} className={navLinkClass(page === 'tx')} id="nav-tx">{t('common.tx')}</span>
        <span onClick={() => setPage('debt')} className={navLinkClass(page === 'debt')} id="nav-debt">{t('common.debt')}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">


        {/* Currency Switcher */}
        <div className="flex bg-chipBg rounded-full p-[3px] text-[12.5px] font-bold select-none">
          <div onClick={() => setCurrency('THB')} className={pillClass(currency === 'THB')} id="btn-thb">฿ THB</div>
          <div onClick={() => setCurrency('USD')} className={pillClass(currency === 'USD')} id="btn-usd">$ USD</div>
        </div>

        {/* Add Transaction Button */}
        <button
          onClick={handleAddClick}
          className="px-[14px] sm:px-[18px] py-[8px] rounded-full bg-terracotta hover:opacity-88 text-white text-[13px] font-bold border-none cursor-pointer transition-all duration-150 active:scale-98 shadow-sm flex items-center justify-center gap-1.5"
          id="btn-add-txn"
        >
          <span className="sm:hidden text-base leading-none">+</span>
          <span className="hidden sm:inline">{t('common.addTx')}</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="px-[13px] py-[8px] rounded-full bg-transparent hover:bg-chipBg text-muted hover:text-dark text-[12.5px] font-bold border border-inputBorder cursor-pointer transition-all duration-150"
          id="btn-logout"
        >
          {t('common.logout')}
        </button>
      </div>
    </nav>
  );
};

