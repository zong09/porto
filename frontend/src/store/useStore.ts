import { create } from 'zustand';
import type { ThemeId } from '../utils/themes';

export type PageType = 'overview' | 'ports' | 'tx' | 'debt' | 'settings';
export type CurrencyType = 'THB' | 'USD';
export type LanguageType = 'th' | 'en';

export interface User {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
}

interface ModalsState {
  tx: boolean;
  asset: boolean;
  portfolio: boolean;
  liability: boolean;
  price: boolean;
  chart: boolean;
}

interface StoreState {
  page: PageType;
  currency: CurrencyType;
  language: LanguageType;
  theme: ThemeId;
  user: User | null;
  token: string | null;
  modals: ModalsState;
  activeAssetId: string | null;
  activePortfolioId: string | null;
  activeTransactionId: string | null;
  activeLiabilityId: string | null;
  activeLiabilityMode: 'set' | 'pay' | 'add';

  // Actions
  setPage: (page: PageType) => void;
  setCurrency: (currency: CurrencyType) => void;
  setLanguage: (language: LanguageType) => void;
  setTheme: (theme: ThemeId) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  openModal: (
    modalName: keyof ModalsState,
    options?: { assetId?: string; portfolioId?: string; transactionId?: string; liabilityId?: string; liabilityMode?: 'set' | 'pay' | 'add' }
  ) => void;
  closeModal: (modalName: keyof ModalsState) => void;
  closeAllModals: () => void;
}

export const useStore = create<StoreState>((set) => {
  // Try to load initial auth from localStorage
  const savedToken = localStorage.getItem('porto-token-v1');
  const savedUser = localStorage.getItem('porto-user-v1');
  let initialUser: User | null = null;
  try {
    if (savedUser) {
      initialUser = JSON.parse(savedUser);
    }
  } catch (e) {
    console.error('Failed to parse saved user', e);
  }

  const savedCurrency = localStorage.getItem('porto-currency-v1') as CurrencyType;
  const savedLanguage = localStorage.getItem('porto-language-v1') as LanguageType;
  const savedTheme = localStorage.getItem('porto-theme-v1') as ThemeId;

  return {
    page: 'overview',
    currency: savedCurrency || 'USD',
    language: savedLanguage || 'th',
    theme: savedTheme || 'sunset',
    user: initialUser,
    token: savedToken,
    modals: {
      tx: false,
      asset: false,
      portfolio: false,
      liability: false,
      price: false,
      chart: false,
    },
    activeAssetId: null,
    activePortfolioId: null,
    activeTransactionId: null,
    activeLiabilityId: null,
    activeLiabilityMode: 'set',

    setPage: (page) => set({ page }),
    setCurrency: (currency) => {
      localStorage.setItem('porto-currency-v1', currency);
      set({ currency });
    },
    setLanguage: (language) => {
      localStorage.setItem('porto-language-v1', language);
      set({ language });
    },
    setTheme: (theme) => {
      localStorage.setItem('porto-theme-v1', theme);
      set({ theme });
    },
    login: (user, token) => {
      localStorage.setItem('porto-token-v1', token);
      localStorage.setItem('porto-user-v1', JSON.stringify(user));
      set({ user, token, page: 'overview' });
    },
    logout: () => {
      localStorage.removeItem('porto-token-v1');
      localStorage.removeItem('porto-user-v1');
      set({
        user: null,
        token: null,
        page: 'overview',
        modals: {
          tx: false,
          asset: false,
          portfolio: false,
          liability: false,
          price: false,
          chart: false,
        },
        activeAssetId: null,
        activePortfolioId: null,
        activeTransactionId: null,
        activeLiabilityId: null,
      });
    },
    openModal: (modalName, options) =>
      set((state) => ({
        modals: { ...state.modals, [modalName]: true },
        activeAssetId: options?.assetId || null,
        activePortfolioId: options?.portfolioId || null,
        activeTransactionId: options?.transactionId || null,
        activeLiabilityId: options?.liabilityId || null,
        activeLiabilityMode: options?.liabilityMode || 'set',
      })),
    closeModal: (modalName) =>
      set((state) => ({
        modals: { ...state.modals, [modalName]: false },
        activeAssetId:
          modalName === 'price' || modalName === 'chart' || modalName === 'asset'
            ? null
            : state.activeAssetId,
        activePortfolioId: modalName === 'asset' ? null : state.activePortfolioId,
        activeTransactionId: modalName === 'tx' ? null : state.activeTransactionId,
        activeLiabilityId: modalName === 'liability' ? null : state.activeLiabilityId,
      })),
    closeAllModals: () =>
      set({
        modals: {
          tx: false,
          asset: false,
          portfolio: false,
          liability: false,
          price: false,
          chart: false,
        },
        activeAssetId: null,
        activePortfolioId: null,
        activeTransactionId: null,
        activeLiabilityId: null,
      }),
  };
});
