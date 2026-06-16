import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/apiClient';

// --- Portfolios Hooks ---
export interface Portfolio {
  id: string;
  name: string;
  color: number;
}

export function usePortfolios() {
  const queryClient = useQueryClient();

  const query = useQuery<Portfolio[]>({
    queryKey: ['portfolios'],
    queryFn: async () => {
      const res = await apiClient.get('/portfolios');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; color?: number }) => {
      const res = await apiClient.post('/portfolios', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/portfolios/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  return { ...query, createPortfolio: createMutation, deletePortfolio: deleteMutation };
}

// --- Assets Hooks ---
export interface PositionSummary {
  quantity: number;
  avgCost: number;
  totalCost: number;
  realizedPnl: number;
}

export interface Asset {
  id: string;
  portfolioId: string;
  type: 'crypto' | 'th' | 'us' | 'fund' | 'deposit';
  symbol: string;
  name: string;
  currency: 'THB' | 'USD';
  cgId: string | null;
  yahooSymbol: string | null;
  manualPrice: number | null;
  portfolio?: Portfolio;
  currentPrice?: number;
  change24h?: number;
  position?: PositionSummary;
}

export function useAssets() {
  const queryClient = useQueryClient();

  const query = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const res = await apiClient.get('/assets');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      portfolioId: string;
      type: 'crypto' | 'th' | 'us' | 'fund' | 'deposit';
      symbol: string;
      name?: string;
      currency: 'THB' | 'USD';
      cgId?: string;
      yahooSymbol?: string;
      manualPrice?: number;
    }) => {
      const res = await apiClient.post('/assets', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; manualPrice?: number }) => {
      const res = await apiClient.patch(`/assets/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/assets/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return {
    ...query,
    createAsset: createMutation,
    updateAsset: updateMutation,
    deleteAsset: deleteMutation,
  };
}

// --- Transactions Hooks ---
export interface Transaction {
  id: string;
  assetId: string;
  side: 'buy' | 'sell' | 'deposit' | 'withdraw';
  quantity: number;
  price: number;
  fee: number;
  date: string;
  asset?: Asset;
}

export function useTransactions() {
  const queryClient = useQueryClient();

  const query = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await apiClient.get('/transactions');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      assetId: string;
      side: 'buy' | 'sell' | 'deposit' | 'withdraw';
      quantity: number;
      price?: number;
      fee?: number;
      date?: string;
    }) => {
      const res = await apiClient.post('/transactions', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/transactions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    },
  });

  return { ...query, createTransaction: createMutation, deleteTransaction: deleteMutation };
}

// --- Liabilities Hooks ---
export interface Liability {
  id: string;
  name: string;
  amount: number;
}

export function useLiabilities() {
  const queryClient = useQueryClient();

  const query = useQuery<Liability[]>({
    queryKey: ['liabilities'],
    queryFn: async () => {
      const res = await apiClient.get('/liabilities');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; amount: number }) => {
      const res = await apiClient.post('/liabilities', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/liabilities/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liabilities'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth-summary'] });
    },
  });

  return { ...query, createLiability: createMutation, deleteLiability: deleteMutation };
}

// --- Net Worth Summary & History Hooks ---
export interface NetWorthSummary {
  totalAssetsThb: number;
  totalLiabilitiesThb: number;
  netWorthThb: number;
  todayPlThb: number;
  totalCostThb: number;
  fx: number;
}

export interface NetWorthHistoryItem {
  id: string;
  date: string;
  totalAssetsThb: number;
  totalLiabilitiesThb: number;
  netWorthThb: number;
}

export function useNetWorth(days?: number) {
  const queryClient = useQueryClient();

  const summaryQuery = useQuery<NetWorthSummary>({
    queryKey: ['net-worth-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/net-worth/summary');
      return res.data;
    },
  });

  const historyQuery = useQuery<NetWorthHistoryItem[]>({
    queryKey: ['net-worth-history', days],
    queryFn: async () => {
      const res = await apiClient.get('/net-worth/history', {
        params: days ? { days } : {},
      });
      return res.data;
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/net-worth/snapshot');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['net-worth-history'] });
    },
  });

  return {
    summary: summaryQuery,
    history: historyQuery,
    takeSnapshot: snapshotMutation,
  };
}

// --- Historical Prices Hook for Chart Modal ---
export interface ChartDatapoint {
  t: number; // timestamp
  p: number; // price
}

export function usePriceHistory(asset: Asset | null, range: string) {
  return useQuery<ChartDatapoint[]>({
    queryKey: ['price-history', asset?.id, range],
    enabled: !!asset && (asset.type === 'crypto' || asset.type === 'th' || asset.type === 'us'),
    queryFn: async () => {
      if (!asset) return [];
      if (asset.type === 'crypto' && asset.cgId) {
        const days = range === '7D' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
        const res = await apiClient.get(`/prices/crypto/${asset.cgId}/history`, {
          params: { days },
        });
        return (res.data.prices || []).map((p: [number, number]) => ({ t: p[0], p: p[1] }));
      } else {
        const sym = asset.yahooSymbol || asset.symbol;
        const res = await apiClient.get(`/prices/stock/${sym}/history`, {
          params: { range },
        });
        return res.data;
      }
    },
  });
}

export function useAuthConfig() {
  return useQuery<{ enableDemo: boolean }>({
    queryKey: ['auth-config'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/config');
      return res.data;
    },
  });
}
