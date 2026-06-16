import { useStore } from './store/useStore';
import { TopNav } from './components/TopNav';
import { LiveTicker } from './components/LiveTicker';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Portfolios } from './pages/Portfolios';
import { Transactions } from './pages/Transactions';
import { Liabilities } from './pages/Liabilities';

// Modals
import { TransactionModal } from './components/TransactionModal';
import { AssetModal } from './components/AssetModal';
import { PortfolioModal } from './components/PortfolioModal';
import { LiabilityModal } from './components/LiabilityModal';
import { PriceModal } from './components/PriceModal';
import { ChartModal } from './components/ChartModal';

import { apiClient } from './api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthConfig } from './hooks/useApi';

function App() {
  const { user, page } = useStore();
  const queryClient = useQueryClient();
  const { data: config } = useAuthConfig();

  const handleLoadDemo = async () => {
    if (confirm('ระบบจะล็อกเอาท์ออกจากบัญชีนี้และเปิดบัญชีตัวอย่าง (Demo) แทน ยืนยันหรือไม่?')) {
      try {
        const res = await apiClient.post('/auth/demo');
        useStore.getState().login(res.data.user, res.data.token);
      } catch (err: any) {
        alert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการโหลดเดโม');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('คุณต้องการลบข้อมูลการลงทุนและหนี้สินทั้งหมดของคุณใช่หรือไม่? (การดำเนินการนี้จะไม่สามารถย้อนกลับได้)')) {
      try {
        await apiClient.post('/auth/clear');
        queryClient.invalidateQueries();
        alert('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
      } catch (err: any) {
        alert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการล้างข้อมูล');
      }
    }
  };


  // Auth gate
  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (page) {
      case 'ports':
        return <Portfolios />;
      case 'tx':
        return <Transactions />;
      case 'debt':
        return <Liabilities />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="font-sans min-h-screen bg-surface flex flex-col">
      {/* Persistant Top Header Chrome */}
      <TopNav />
      
      {/* Live Ticker price feed */}
      <LiveTicker />

      {/* Main Container */}
      <main className="max-w-[1200px] w-full mx-auto px-6 pb-16 flex-1 flex flex-col justify-start">
        {renderPage()}

        {/* Footer */}
        <footer className="flex gap-4 items-center pt-9 mt-auto text-[12px] text-faint-darker flex-wrap select-none border-t border-inputBorder/15">
          <span>ข้อมูลทั้งหมดเก็บอย่างปลอดภัยในระบบฐานข้อมูลคลาวด์ส่วนตัวของคุณ · ราคาดึงผ่าน CoinGecko + Yahoo Finance</span>
          <div className="ml-auto flex gap-3.5">
            {config?.enableDemo && (
              <span
                onClick={handleLoadDemo}
                className="cursor-pointer underline hover:text-dark font-semibold"
              >
                โหลดข้อมูลตัวอย่าง
              </span>
            )}

            <span
              onClick={handleClearAll}
              className="cursor-pointer underline hover:text-dark font-semibold"
            >
              ล้างข้อมูลทั้งหมด
            </span>
          </div>
        </footer>
      </main>

      {/* Modals Mounting Points */}
      <TransactionModal />
      <AssetModal />
      <PortfolioModal />
      <LiabilityModal />
      <PriceModal />
      <ChartModal />
    </div>
  );
}

export default App;
