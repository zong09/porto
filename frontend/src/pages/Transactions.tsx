import React from 'react';
import { useStore } from '../store/useStore';
import { useTransactions, useNetWorth, useLiabilityTransactions } from '../hooks/useApi';
import type { LiabilityTransaction } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const Transactions: React.FC = () => {
  const { openModal, currency } = useStore();
  const { data: transactions = [], deleteTransaction, isLoading } = useTransactions();
  const { data: liabilityTxns = [] } = useLiabilityTransactions();
  const { summary } = useNetWorth();
  const { t, language } = useTranslation();

  const fx = summary.data?.fx || 35.84;
  const isThb = currency === 'THB';

  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatNativePrimary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    if (isThb) {
      const decimalLimit = 2;
      return '฿' + thb.toLocaleString('en-US', {
        minimumFractionDigits: decimalLimit,
        maximumFractionDigits: decimalLimit,
      });
    } else {
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  };

  const formatNativeSecondary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    if (isThb) {
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      const decimalLimit = 2;
      return '฿' + thb.toLocaleString('en-US', {
        minimumFractionDigits: decimalLimit,
        maximumFractionDigits: decimalLimit,
      });
    }
  };

  const formatQty = (qty: number, type: string) => {
    if (type === 'deposit') return `฿${qty.toLocaleString('en-US')}`;
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('transactions.confirmDeleteTx'))) {
      try {
        await deleteTransaction.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  type MergedRow =
    | { kind: 'asset'; date: string; txn: (typeof transactions)[number] }
    | { kind: 'liability'; date: string; ltx: LiabilityTransaction };

  const mergedRows = React.useMemo<MergedRow[]>(() => {
    const rows: MergedRow[] = [];
    transactions.forEach((txn) => rows.push({ kind: 'asset', date: txn.date, txn }));
    liabilityTxns.forEach((ltx) => rows.push({ kind: 'liability', date: ltx.date, ltx }));
    rows.sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      // Same date: sort by createdAt descending
      const aTime = (a.kind === 'asset' ? a.txn.createdAt : a.ltx.createdAt) || '';
      const bTime = (b.kind === 'asset' ? b.txn.createdAt : b.ltx.createdAt) || '';
      if (aTime < bTime) return 1;
      if (aTime > bTime) return -1;
      return 0;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, liabilityTxns]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">{t('transactions.loadingTx')}</span>
      </div>
    );
  }

  const hasTxs = mergedRows.length > 0;

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Transactions">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pt-[28px] pb-[18px] border-b border-inputBorder/20 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-bold text-dark">{t('transactions.title')}</h2>
          <span className="text-xs.5 text-faint-darker font-bold bg-chipBg px-2 py-0.5 rounded-md mt-0.5">
            {mergedRows.length} {t('overview.itemsCount')}
          </span>
        </div>
        <button
          onClick={() => openModal('tx')}
          className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm ml-auto"
          id="btn-add-txn-tx-page"
        >
          {t('transactions.recordBtn')}
        </button>
      </div>

      {/* Empty State */}
      {!hasTxs && (
        <div className="bg-white border border-inputBorder/25 rounded-[22px] p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-sm.5 text-muted">{t('transactions.noTx')}</span>
        </div>
      )}

      {/* Table List */}
      {hasTxs && (
        <div className="bg-white rounded-[22px] p-[14px_18px] border border-inputBorder/20 shadow-sm overflow-x-auto mt-6 [&::-webkit-scrollbar]:hidden">
          <table className={`${isMobile ? 'w-full' : 'min-w-[820px] w-full'} border-collapse`}>
            <thead>
              <tr className={`grid ${isMobile ? 'grid-cols-[70px_1fr_1fr_60px] gap-2' : 'grid-cols-[110px_90px_1.5fr_1.2fr_1fr_1.1fr_1.2fr_68px] gap-2.5'} px-3 py-2 text-[11.5px] font-bold text-faint-darker border-b border-inputBorder/20 text-left`}>
                <th>{t('transactions.colDate')}</th>
                {!isMobile && <th>{t('transactions.colType')}</th>}
                <th>{t('transactions.colAsset')}</th>
                {!isMobile && <th>{t('transactions.colPort')}</th>}
                {!isMobile && <th className="text-right">{t('transactions.colQty')}</th>}
                {!isMobile && <th className="text-right">{t('transactions.colPrice')}</th>}
                <th className={isMobile ? 'text-right' : 'text-right'}>{isMobile ? t('transactions.colType') + ' / ' + t('transactions.colNetAmt') : t('transactions.colNetAmt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="flex flex-col gap-1 mt-1">
              {mergedRows.map((row) => {
                if (row.kind === 'liability') {
                  const ltx = row.ltx;
                  const ccy = (ltx.liability?.currency || 'THB') as 'THB' | 'USD';
                  const isPay = ltx.type === 'pay';
                  const lLabel = isPay
                    ? (language === 'th' ? 'จ่ายหนี้' : 'Pay')
                    : (language === 'th' ? 'เพิ่มหนี้' : 'Add debt');
                  return (
                    <tr
                      key={`l-${ltx.id}`}
                      className={`grid ${isMobile ? 'grid-cols-[70px_1fr_1fr_60px] gap-2' : 'grid-cols-[110px_90px_1.5fr_1.2fr_1fr_1.1fr_1.2fr_68px] gap-2.5'} px-3 py-3 items-center rounded-xl hover:bg-surface transition-colors duration-150 border-b border-inputBorder/40 last:border-none`}
                    >
                      <td className={`text-muted ${isMobile ? 'text-[11px]' : 'text-xs.5'} font-medium select-none`}>
                        {isMobile ? new Date(ltx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : formatDate(ltx.date)}
                      </td>
                      {!isMobile && (
                        <td className="select-none">
                          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full select-none ${isPay ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'}`}>
                            {lLabel}
                          </span>
                        </td>
                      )}
                      <td className="flex flex-col">
                        <span className="font-bold text-dark truncate">{ltx.liability?.name || (language === 'th' ? 'หนี้สิน' : 'Liability')}</span>
                        {isMobile && <span className="text-[10px] text-muted truncate">{language === 'th' ? 'หนี้สิน' : 'Liabilities'}</span>}
                      </td>
                      {!isMobile && <td className="text-muted text-xs.5 font-medium">{language === 'th' ? 'หนี้สิน' : 'Liabilities'}</td>}
                      {!isMobile && <td className="text-right font-semibold tabular-nums text-muted text-xs.5">—</td>}
                      {!isMobile && <td className="text-right font-semibold text-muted text-xs.5">—</td>}
                      <td className="text-right tabular-nums flex flex-col items-end justify-center">
                        <span className="font-bold text-dark text-sm leading-none">{formatNativePrimary(Number(ltx.amount), ccy)}</span>
                        {isMobile && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 mt-1 rounded-full select-none ${isPay ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'}`}>
                            {lLabel}
                          </span>
                        )}
                        {!isMobile && <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(Number(ltx.amount), ccy)}</span>}
                      </td>
                      <td></td>
                    </tr>
                  );
                }
                const txn = row.txn;
                const asset = txn.asset || { symbol: '?', type: 'crypto', currency: 'THB', portfolio: { name: '—' } };
                const isDep = asset.type === 'deposit';
                const isBuy = txn.side === 'buy';
                const typeLabel = isDep
                  ? (isBuy ? (language === 'th' ? 'ฝาก' : 'Deposit') : (language === 'th' ? 'ถอน' : 'Withdraw'))
                  : (isBuy ? (language === 'th' ? 'ซื้อ' : 'BUY') : (language === 'th' ? 'ขาย' : 'SELL'));

                const totalValue = Number(txn.quantity) * Number(txn.price) + (isBuy ? Number(txn.fee || 0) : -Number(txn.fee || 0));

                return (
                  <tr
                    key={txn.id}
                    className={`grid ${isMobile ? 'grid-cols-[70px_1fr_1fr_60px] gap-2' : 'grid-cols-[110px_90px_1.5fr_1.2fr_1fr_1.1fr_1.2fr_68px] gap-2.5'} px-3 py-3 items-center rounded-xl hover:bg-surface transition-colors duration-150 border-b border-inputBorder/40 last:border-none`}
                  >
                    <td className={`text-muted ${isMobile ? 'text-[11px]' : 'text-xs.5'} font-medium select-none`}>
                      {isMobile ? new Date(txn.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : formatDate(txn.date)}
                    </td>
                    {!isMobile && (
                      <td className="select-none">
                        <span
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-full select-none ${
                            isBuy ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                    )}
                    <td className="flex flex-col">
                      <span className="font-bold text-dark">{asset.symbol}</span>
                      {isMobile && <span className="text-[10px] text-muted truncate">{asset.portfolio?.name || '—'}</span>}
                    </td>
                    {!isMobile && <td className="text-muted text-xs.5 font-medium">{asset.portfolio?.name || '—'}</td>}
                    {!isMobile && (
                      <td className="text-right font-semibold tabular-nums text-dark/90 text-sm">
                        {formatQty(Number(txn.quantity), asset.type)}
                      </td>
                    )}
                    {!isMobile && (
                      <td className="text-right tabular-nums flex flex-col items-end">
                        {isDep ? (
                          <span className="font-semibold text-muted text-xs.5">—</span>
                        ) : (
                          <>
                            <span className="font-semibold text-muted text-xs.5">{formatNativePrimary(Number(txn.price), asset.currency as any)}</span>
                            <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(Number(txn.price), asset.currency as any)}</span>
                          </>
                        )}
                      </td>
                    )}
                    <td className="text-right tabular-nums flex flex-col items-end justify-center">
                      <span className="font-bold text-dark text-sm leading-none">{formatNativePrimary(totalValue, asset.currency as any)}</span>
                      {isMobile && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 mt-1 rounded-full select-none ${
                            isBuy ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
                          }`}
                        >
                          {typeLabel}
                        </span>
                      )}
                      {!isMobile && <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(totalValue, asset.currency as any)}</span>}
                    </td>
                    <td className={`flex ${isMobile ? 'flex-col gap-1 items-end' : 'gap-2 justify-center items-center'}`}>
                      <button
                        onClick={() => openModal('tx', { transactionId: txn.id })}
                        className="bg-transparent border-none text-faint hover:text-terracotta cursor-pointer transition-colors p-1"
                        title={t('common.edit') as string}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(txn.id)}
                        className="bg-transparent border-none text-faint hover:text-negative-text cursor-pointer transition-colors p-1"
                        title={t('common.delete') as string}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
