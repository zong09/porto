import React from 'react';
import { useStore } from '../store/useStore';
import { usePortfolios, useAssets, useNetWorth } from '../hooks/useApi';
import { GripVertical } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Sortable Portfolio Card ───────────────────────────────────────────────────
interface SortablePortfolioProps {
  portfolio: any;
  children: React.ReactNode;
}
const SortablePortfolioCard: React.FC<SortablePortfolioProps> = ({ portfolio, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: portfolio.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { dragListeners: listeners })
          : child,
      )}
    </div>
  );
};

// ─── Sortable Asset Row ────────────────────────────────────────────────────────
interface SortableAssetRowProps {
  asset: any;
  isMobile: boolean;
  children: React.ReactNode;
}
const SortableAssetRow: React.FC<SortableAssetRowProps> = ({ asset, isMobile, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: asset.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`grid ${isMobile ? 'grid-cols-[20px_1.5fr_1fr_90px] gap-2 px-2' : 'grid-cols-[30px_1.5fr_0.8fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_215px] gap-2.5 px-3'} py-3 items-center rounded-xl hover:bg-surface transition-colors duration-150 border-b border-[#f7f0e3] last:border-none`}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { dragListeners: listeners })
          : child,
      )}
    </tr>
  );
};

// ─── Main Portfolios Component ─────────────────────────────────────────────────
export const Portfolios: React.FC = () => {
  const { currency, openModal } = useStore();
  const { data: portfolios = [], deletePortfolio, isLoading: loadingPorts, reorderPortfolios } = usePortfolios();
  const { data: assets = [], deleteAsset, isLoading: loadingAssets, reorderAssets } = useAssets();
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

  // DnD sensors: require 5px movement before drag starts (prevents accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Drag overlay state
  const [activePortfolioId, setActivePortfolioId] = React.useState<string | null>(null);
  const [_activeAssetId, setActiveAssetId] = React.useState<string | null>(null);

  const formatMoneyPrimary = (val: number, nativeCcy?: 'THB' | 'USD') => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);
    const useThb = nativeCcy ? nativeCcy === 'THB' : isThb;

    if (useThb) {
      const formatted = absThb.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}฿${formatted}`;
    } else {
      const formatted = absUsd.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}$${formatted}`;
    }
  };

  const formatMoneySecondary = (val: number, nativeCcy?: 'THB' | 'USD') => {
    const usd = val / fx;
    const thb = val;
    const isNeg = val < 0;
    const absUsd = Math.abs(usd);
    const absThb = Math.abs(thb);
    const useThb = nativeCcy ? nativeCcy === 'THB' : isThb;

    if (useThb) {
      const formatted = absUsd.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}$${formatted}`;
    } else {
      const formatted = absThb.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      return `${isNeg ? '-' : ''}฿${formatted}`;
    }
  };

  const formatMoney = (val: number) => {
    const primary = formatMoneyPrimary(val);
    const secondary = formatMoneySecondary(val);
    return (
      <span className="tabular-nums">
        {primary}
        <span className="text-[0.72em] text-faint ml-1.5 font-semibold">
          ({secondary})
        </span>
      </span>
    );
  };

  const formatNativePrimary = (val: number, ccy: 'THB' | 'USD') => {
    const isUSD = ccy === 'USD';
    const usd = isUSD ? val : val / fx;
    const thb = isUSD ? val * fx : val;

    if (ccy === 'THB') {
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

    if (ccy === 'THB') {
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


  const formatQty = (qty: number, type: string, ccy?: string) => {
    if (type === 'deposit') {
      const sign = ccy === 'USD' ? '$' : '฿';
      return `${sign}${qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  };

  const handleDeletePortfolio = async (id: string, name: string) => {
    const portfolioAssets = assets.filter((a) => a.portfolioId === id);
    if (portfolioAssets.length > 0) {
      alert(
        language === 'th'
          ? 'ไม่สามารถลบพอร์ตได้เนื่องจากยังมีสินทรัพย์เหลืออยู่ภายในพอร์ต กรุณาลบสินทรัพย์ทั้งหมดก่อน'
          : 'Cannot delete portfolio because it still contains assets. Please delete all assets first.'
      );
      return;
    }
    if (
      confirm(
        language === 'th'
          ? `คุณต้องการลบพอร์ต "${name}" ใช่หรือไม่?`
          : `Are you sure you want to delete portfolio "${name}"?`
      )
    ) {
      try {
        await deletePortfolio.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  const handleDeleteAsset = async (id: string, symbol: string) => {
    if (
      confirm(
        language === 'th'
          ? `คุณต้องการลบสินทรัพย์ "${symbol}" และรายการธุรกรรมทั้งหมดที่เกี่ยวข้องใช่หรือไม่?`
          : `Are you sure you want to delete asset "${symbol}" and all related transactions?`
      )
    ) {
      try {
        await deleteAsset.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || t('common.error'));
      }
    }
  };

  // ─── Portfolio DnD Handlers ──────────────────────────────────────────────────
  const handlePortfolioDragStart = (event: DragStartEvent) => {
    setActivePortfolioId(event.active.id as string);
  };

  const handlePortfolioDragEnd = (event: DragEndEvent) => {
    setActivePortfolioId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = portfolios.findIndex((p) => p.id === active.id);
    const newIndex = portfolios.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(portfolios, oldIndex, newIndex);
    reorderPortfolios.mutate(newOrder.map((p) => p.id));
  };

  // ─── Asset DnD Handlers (scoped per portfolio) ───────────────────────────────
  const handleAssetDragStart = (event: DragStartEvent) => {
    setActiveAssetId(event.active.id as string);
  };

  const handleAssetDragEnd = (portfolioId: string) => (event: DragEndEvent) => {
    setActiveAssetId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const pAssets = assets.filter((a) => a.portfolioId === portfolioId);
    const oldIndex = pAssets.findIndex((a) => a.id === active.id);
    const newIndex = pAssets.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(pAssets, oldIndex, newIndex);
    reorderAssets.mutate(newOrder.map((a) => a.id));
  };

  if (loadingPorts || loadingAssets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-inputBorder border-t-terracotta animate-spin"></div>
        <span className="text-sm font-semibold text-muted mt-4">
          {language === 'th' ? 'กำลังโหลดข้อมูลพอร์ต…' : 'Loading portfolios...'}
        </span>
      </div>
    );
  }

  const portfolioSections = portfolios.map((p) => {
    const palette = ['#7a8f55', '#c08b4f', '#b45a3c', '#5b8a8f', '#8a6f9e', '#a85d77'];
    const pAssets = assets.filter((a) => a.portfolioId === p.id);

    // Compute portfolio value and cost
    let pValueThb = 0;
    let pCostThb = 0;
    let pPlThb = 0;
    const holdings = pAssets.map((a) => {
      const multiplier = a.currency === 'USD' ? fx : 1;
      const quantity = a.position?.quantity || 0;
      const currentPrice = a.currentPrice || 0;
      const avgCost = a.position?.avgCost || 0;
      const isShort = (a.direction || 'long') === 'short';

      const assetValueThb = quantity * currentPrice * multiplier;
      const assetCostThb = quantity * avgCost * multiplier;
      
      // Short positions: subtract from portfolio value (they are obligations)
      if (isShort) {
        pValueThb -= assetValueThb;
      } else {
        pValueThb += assetValueThb;
      }
      pCostThb += assetCostThb;

      // P&L: short profits when price drops (avgCost - currentPrice), long profits when price rises
      const plThb = isShort
        ? (avgCost - currentPrice) * quantity * multiplier
        : assetValueThb - assetCostThb;
      pPlThb += plThb;
      const returnPct = assetCostThb > 0 ? (plThb / assetCostThb) * 100 : 0;

      return {
        ...a,
        quantity,
        avgCost,
        currentPrice,
        valueThb: isShort ? -assetValueThb : assetValueThb,
        plThb,
        returnPct,
        isShort,
      };
    });

    const pReturnPct = pCostThb > 0 ? (pPlThb / pCostThb) * 100 : 0;
    const activeHoldings = holdings.filter((h) => h.quantity > 0).sort((a, b) => b.valueThb - a.valueThb);

    // Stacked allocation bar config
    const allocationSegments = activeHoldings.map((h, idx) => ({
      width: pValueThb > 0 ? `${(h.valueThb / pValueThb) * 100}%` : '0%',
      color: palette[idx % 6],
    }));

    const allocationLegend = activeHoldings.map((h, idx) => ({
      symbol: h.symbol,
      pct: pValueThb > 0 ? (h.valueThb / pValueThb) * 100 : 0,
      color: palette[idx % 6],
    }));

    const hasAllocation = activeHoldings.length >= 2;

    return {
      ...p,
      holdings,
      valueThb: pValueThb,
      returnPct: pReturnPct,
      hasHoldings: holdings.length > 0,
      hasAllocation,
      allocationSegments,
      allocationLegend,
      colorHex: palette[p.color % 6],
    };
  });

  const portfolioIds = portfolioSections.map((p) => p.id);

  return (
    <div className="flex flex-col py-6 select-none" data-screen-label="Portfolios">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pt-[28px] pb-[18px] border-b border-inputBorder/20 flex-wrap">
        <h2 className="text-[22px] font-bold text-dark">{t('portfolios.title')}</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => openModal('asset')}
            className="px-[18px] py-[8px] rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm"
            id="btn-add-asset-top"
          >
            {t('portfolios.addAssetBtn')}
          </button>
          <button
            onClick={() => openModal('portfolio')}
            className="px-[18px] py-[8px] rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[13px] font-bold border-none cursor-pointer transition-colors shadow-sm"
            id="btn-create-port-top"
          >
            {t('portfolios.createBtn')}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {portfolios.length === 0 && (
        <div className="bg-white border border-inputBorder/25 rounded-[22px] p-10 text-center flex flex-col items-center gap-3 mt-6">
          <span className="text-sm.5 text-muted">
            {language === 'th'
              ? 'ยังไม่มีพอร์ตการลงทุนในระบบ กด "+ สร้างพอร์ต" เพื่อเริ่มต้น'
              : 'No portfolios found. Click "+ Create Portfolio" to start.'}
          </span>
        </div>
      )}

      {/* Portfolios List (Drag & Drop) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handlePortfolioDragStart}
        onDragEnd={handlePortfolioDragEnd}
      >
        <SortableContext items={portfolioIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-5 mt-6">
            {portfolioSections.map((p) => (
              <SortablePortfolioCard key={p.id} portfolio={p}>
                <PortfolioCardContent
                  p={p}
                  isMobile={isMobile}
                  assets={assets}
                  sensors={sensors}
                  language={language}
                  t={t}
                  formatMoney={formatMoney}
                  formatMoneyPrimary={formatMoneyPrimary}
                  formatMoneySecondary={formatMoneySecondary}
                  formatNativePrimary={formatNativePrimary}
                  formatNativeSecondary={formatNativeSecondary}
                  formatQty={formatQty}
                  openModal={openModal}
                  handleDeletePortfolio={handleDeletePortfolio}
                  handleDeleteAsset={handleDeleteAsset}
                  onAssetDragStart={handleAssetDragStart}
                  onAssetDragEnd={handleAssetDragEnd(p.id)}
                />
              </SortablePortfolioCard>
            ))}
          </div>
        </SortableContext>

        {/* Portfolio Drag Overlay */}
        <DragOverlay>
          {activePortfolioId ? (
            <div className="bg-white rounded-2.5xl p-5 border-2 border-terracotta/40 shadow-xl opacity-90">
              <div className="flex items-center gap-3">
                <GripVertical size={16} className="text-terracotta" />
                <span className="text-md.5 font-bold text-dark">
                  {portfolioSections.find((p) => p.id === activePortfolioId)?.name}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

// ─── Portfolio Card Content (extracted for SortablePortfolioCard) ───────────────
interface PortfolioCardContentProps {
  p: any;
  isMobile: boolean;
  assets: any[];
  sensors: any;
  language: string;
  t: (key: string) => string;
  formatMoney: (val: number) => React.ReactNode;
  formatMoneyPrimary: (val: number, nativeCcy?: 'THB' | 'USD') => string;
  formatMoneySecondary: (val: number, nativeCcy?: 'THB' | 'USD') => string;
  formatNativePrimary: (val: number, ccy: 'THB' | 'USD') => string;
  formatNativeSecondary: (val: number, ccy: 'THB' | 'USD') => string;
  formatQty: (qty: number, type: string) => string;
  openModal: (...args: any[]) => void;
  handleDeletePortfolio: (id: string, name: string) => void;
  handleDeleteAsset: (id: string, symbol: string) => void;
  onAssetDragStart: (event: DragStartEvent) => void;
  onAssetDragEnd: (event: DragEndEvent) => void;
  dragListeners?: any;
}

const PortfolioCardContent: React.FC<PortfolioCardContentProps> = ({
  p,
  isMobile,
  assets: _assets,
  sensors,
  language,
  t,
  formatMoney,
  formatMoneyPrimary,
  formatMoneySecondary,
  formatNativePrimary,
  formatNativeSecondary,
  formatQty,
  openModal,
  handleDeletePortfolio,
  handleDeleteAsset,
  onAssetDragStart,
  onAssetDragEnd,
  dragListeners,
}) => {
  const assetIds = p.holdings.map((h: any) => h.id);

  return (
    <div className="bg-white rounded-[22px] p-5 border border-inputBorder/20 shadow-sm flex flex-col gap-[18px]">
      {/* Portfolio header info */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Drag handle */}
        <button
          {...dragListeners}
          className="bg-transparent border-none text-faint-darker hover:text-terracotta cursor-grab active:cursor-grabbing transition-colors p-0.5 -ml-1 touch-none"
          title={language === 'th' ? 'ลากเพื่อจัดลำดับ' : 'Drag to reorder'}
        >
          <GripVertical size={18} />
        </button>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.colorHex }}></div>
        <span className="text-md.5 font-bold text-dark">{p.name}</span>
        <span className="text-base font-bold text-dark tabular-nums ml-1">
          {formatMoney(p.valueThb)}
        </span>
        {p.valueThb > 0 && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full select-none ${
              p.returnPct >= 0 ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'
            }`}
          >
            {p.returnPct >= 0 ? '+' : ''}
            {p.returnPct.toFixed(1)}%
          </span>
        )}
        
        {/* Actions */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => openModal('asset', { portfolioId: p.id })}
            className="px-[14px] py-[6px] rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[12.5px] font-bold border-none cursor-pointer transition-colors"
          >
            + {language === 'th' ? 'สินทรัพย์' : 'Asset'}
          </button>
          <button
            onClick={() => handleDeletePortfolio(p.id, p.name)}
            className="bg-transparent border-none text-faint-darker hover:text-negative-text cursor-pointer text-[12.5px] font-bold transition-colors"
          >
            {language === 'th' ? 'ลบพอร์ต' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Allocation stacked bar */}
      {p.hasAllocation && (
        <div className="flex flex-col gap-2 border-t border-inputBorder/10 pt-4">
          <div className="flex h-3 rounded-full overflow-hidden bg-[#f7f0e3]">
            {p.allocationSegments.map((s: any, idx: number) => (
              <div key={idx} className="h-full" style={{ width: s.width, backgroundColor: s.color }}></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1.5">
            {p.allocationLegend.map((legend: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold select-none">
                <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: legend.color }}></div>
                <span className="text-dark/95">{legend.symbol}</span>
                <span className="text-faint-darker">{legend.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Holdings list (with asset-level DnD) */}
      {!p.hasHoldings ? (
        <span className="text-xs.5 text-faint-darker font-medium py-2">{t('portfolios.noAssetsInPort')}</span>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onAssetDragStart}
          onDragEnd={onAssetDragEnd}
        >
          <SortableContext items={assetIds} strategy={verticalListSortingStrategy}>
            <div className="overflow-x-auto border-t border-inputBorder/10 pt-4 mt-2 [&::-webkit-scrollbar]:hidden">
              <table className={`${isMobile ? 'w-full' : 'min-w-[860px] w-full'} border-collapse`}>
                <thead>
                  <tr className={`grid ${isMobile ? 'grid-cols-[20px_1.5fr_1fr_90px] gap-2 px-2' : 'grid-cols-[30px_1.5fr_0.8fr_1fr_1.1fr_1.1fr_1.2fr_1.2fr_215px] gap-2.5 px-3'} py-2 text-[11.5px] font-bold text-faint-darker border-b border-inputBorder/20 text-left`}>
                    <th></th>
                    <th>{language === 'th' ? 'สินทรัพย์' : 'Asset'}</th>
                    {!isMobile && <th>{language === 'th' ? 'ชนิด' : 'Type'}</th>}
                    {!isMobile && <th className="text-right">{t('portfolios.tableQty')}</th>}
                    {!isMobile && <th className="text-right">{t('portfolios.tableAvgCost')}</th>}
                    {!isMobile && <th className="text-right">{t('portfolios.tablePrice')}</th>}
                    <th className="text-right">{isMobile ? t('portfolios.tableValue') + ' / P/L' : t('portfolios.tableValue')}</th>
                    {!isMobile && <th className="text-right">{t('portfolios.tablePl')}</th>}
                    <th className={isMobile ? 'text-right pr-2' : ''}>{isMobile ? '' : ''}</th>
                  </tr>
                </thead>
                <tbody className="flex flex-col gap-1 mt-1">
                  {p.holdings.map((h: any) => (
                    <SortableAssetRow key={h.id} asset={h} isMobile={isMobile}>
                      <AssetRowContent
                        h={h}
                        isMobile={isMobile}
                        language={language}
                        t={t}
                        formatMoneyPrimary={formatMoneyPrimary}
                        formatMoneySecondary={formatMoneySecondary}
                        formatNativePrimary={formatNativePrimary}
                        formatNativeSecondary={formatNativeSecondary}
                        formatQty={formatQty}
                        openModal={openModal}
                        handleDeleteAsset={handleDeleteAsset}
                      />
                    </SortableAssetRow>
                  ))}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

// ─── Asset Row Content (extracted for SortableAssetRow) ─────────────────────────
interface AssetRowContentProps {
  h: any;
  isMobile?: boolean;
  language: string;
  t: (key: string) => string;
  formatMoneyPrimary: (val: number, nativeCcy?: 'THB' | 'USD') => string;
  formatMoneySecondary: (val: number, nativeCcy?: 'THB' | 'USD') => string;
  formatNativePrimary: (val: number, ccy: 'THB' | 'USD') => string;
  formatNativeSecondary: (val: number, ccy: 'THB' | 'USD') => string;
  formatQty: (qty: number, type: string, ccy?: string) => string;
  openModal: (...args: any[]) => void;
  handleDeleteAsset: (id: string, symbol: string) => void;
  dragListeners?: any;
}

const AssetRowContent: React.FC<AssetRowContentProps> = ({
  h,
  isMobile,
  language,
  t: _t,
  formatMoneyPrimary,
  formatMoneySecondary,
  formatNativePrimary,
  formatNativeSecondary,
  formatQty,
  openModal,
  handleDeleteAsset,
  dragListeners,
}) => {
  const isDep = h.type === 'deposit';
  const isUp = h.plThb >= 0;

  return (
    <>
      {/* Drag handle cell */}
      <td className="flex items-center justify-center">
        <button
          {...dragListeners}
          className="bg-transparent border-none text-faint-darker/60 hover:text-terracotta cursor-grab active:cursor-grabbing transition-colors p-0 touch-none"
          title={language === 'th' ? 'ลากเพื่อจัดลำดับ' : 'Drag to reorder'}
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="flex flex-col select-none">
        <span className="font-bold text-dark leading-none">
          {h.symbol}
          {h.isShort && (
            <span className="ml-1.5 text-[10px] font-bold text-[#C73B22] bg-negative-bg px-1.5 py-0.5 rounded-md align-middle">
              SHORT
            </span>
          )}
        </span>
        {h.name && h.name !== h.symbol && (
          <span className="text-[11px] text-faint font-semibold mt-1">
            {h.name}
          </span>
        )}
      </td>
      {!isMobile && (
        <td className="flex items-center select-none">
          <span
            className="px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: h.type === 'crypto' ? '#fdf6ed' : h.type === 'us' ? '#f2f7f7' : h.type === 'th' ? '#f5f7f0' : h.type === 'fund' ? '#f7f4f9' : '#faf9f5',
              color: h.type === 'crypto' ? '#d9a35f' : h.type === 'us' ? '#7aa9ae' : h.type === 'th' ? '#9bb06f' : h.type === 'fund' ? '#a98cbb' : '#b3a692',
            }}
          >
            {h.type}
          </span>
        </td>
      )}
      {!isMobile && (
        <td className="text-right font-bold tabular-nums text-dark/90 text-sm">
          {formatQty(h.quantity, h.type, h.currency)}
        </td>
      )}
      {!isMobile && (
        <td className="text-right tabular-nums flex flex-col items-end">
          {isDep ? (
            <span className="font-semibold text-muted text-xs.5">—</span>
          ) : (
            <>
              <span className="font-semibold text-muted text-xs.5">{formatNativePrimary(h.avgCost, h.currency)}</span>
              <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(h.avgCost, h.currency)}</span>
            </>
          )}
        </td>
      )}
      {!isMobile && (
        <td className="text-right tabular-nums flex flex-col items-end">
          {isDep ? (
            <span className="font-semibold text-dark/95 text-xs.5">—</span>
          ) : (
            <>
              <span className="font-semibold text-dark/95 text-xs.5">{formatNativePrimary(h.currentPrice, h.currency)}</span>
              <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatNativeSecondary(h.currentPrice, h.currency)}</span>
            </>
          )}
        </td>
      )}
      <td className="text-right tabular-nums flex flex-col items-end justify-center">
        <span className="font-bold text-dark text-sm">{formatMoneyPrimary(h.valueThb, h.currency)}</span>
        <span className="text-[10.5px] text-faint font-bold mt-0.5">{formatMoneySecondary(h.valueThb, h.currency)}</span>
        {isMobile && (
          <div className="mt-1">
            {isDep ? (
              <span className="font-bold text-faint text-[10px]">—</span>
            ) : (
              <span className={`font-bold text-[10.5px] ${isUp ? 'text-positive-text' : 'text-negative-text'}`}>
                {isUp ? '+' : ''}{formatMoneyPrimary(h.plThb, h.currency)}
              </span>
            )}
          </div>
        )}
      </td>
      {!isMobile && (
        <td className="text-right tabular-nums flex flex-col items-end">
          {isDep ? (
            <span className="font-bold text-faint text-xs.5">—</span>
          ) : (
            <>
              <span className={`font-bold text-xs.5 ${isUp ? 'text-positive-text' : 'text-negative-text'}`}>
                {isUp ? '+' : ''}{formatMoneyPrimary(h.plThb, h.currency)}
              </span>
              <span className="text-[10.5px] text-faint font-bold mt-0.5">
                {isUp ? '+' : ''}{formatMoneySecondary(h.plThb, h.currency)}
              </span>
            </>
          )}
        </td>
      )}
      <td className={`flex justify-end gap-1.5 ${isMobile ? 'flex-col items-end' : ''}`}>
        <button
          onClick={() => openModal('tx', { assetId: h.id })}
          className={`rounded-full bg-terracotta hover:bg-terracotta-hover text-white font-bold border-none cursor-pointer transition-colors shadow-sm ${isMobile ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'}`}
        >
          {language === 'th' ? (h.isShort ? 'ขาย/ปิด' : 'ซื้อ/ขาย') : (h.isShort ? 'Sell/Cover' : 'Buy/Sell')}
        </button>
        {h.type !== 'fund' && h.type !== 'deposit' && !isMobile && (
          <button
            onClick={() => openModal('chart', { assetId: h.id })}
            className="px-3 py-1.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[11px] font-bold border-none cursor-pointer transition-colors"
          >
            {language === 'th' ? 'กราฟ' : 'Chart'}
          </button>
        )}
        {h.type === 'fund' && !isMobile && (
          <button
            onClick={() => openModal('price', { assetId: h.id })}
            className="px-3 py-1.5 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-[11px] font-bold border-none cursor-pointer transition-colors"
          >
            NAV
          </button>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={() => openModal('asset', { assetId: h.id })}
            className="bg-transparent border-none text-[#c9bca5] hover:text-terracotta cursor-pointer transition-colors p-1"
            title={language === 'th' ? 'แก้ไข' : 'Edit'}
          >
            ✎
          </button>
          <button
            onClick={() => handleDeleteAsset(h.id, h.symbol)}
            className="bg-transparent border-none text-[#c9bca5] hover:text-negative-text cursor-pointer transition-colors p-1"
          >
            ✕
          </button>
        </div>
      </td>
    </>
  );
};
