import { useStore } from '../store/useStore';

export type ThemeId = 'sunset' | 'ocean' | 'berry';

export interface ThemePalette {
  swatchBg: string;
  /** Portfolio / series colors (cycle by index % 6) */
  palette: string[];
  /** Portfolio card background tints */
  tints: string[];
  /** P&L bar greens (gains) */
  greens: string[];
  /** P&L bar reds (losses) */
  reds: string[];
  /** Liability donut / sankey palette */
  debtPalette: string[];
  /** Per asset-type accent color */
  typeColor: Record<'crypto' | 'us' | 'th' | 'fund' | 'deposit', string>;
}

// Verbatim from the design prototype (Portfolio Tracker.dc.html — THEMES object)
export const THEMES: Record<ThemeId, ThemePalette> = {
  sunset: {
    swatchBg: '#FAF5EC',
    palette: ['#EC6530', '#FFAE6E', '#3AA9AC', '#E6A23C', '#C76B8E', '#5FBEC0'],
    tints: ['#FDE7DC', '#FFEEDD', '#DFF1F1', '#FBEBD3', '#F8E1E9', '#E4F6F6'],
    greens: ['#1E9396', '#3AA9AC', '#5FBEC0', '#8FDDDF', '#C4ECEC'],
    reds: ['#D8482A', '#F5A98F', '#F8CFC2'],
    debtPalette: ['#FFAE6E', '#E2542B', '#C73B22', '#FFC79A', '#C76B8E', '#A8341C'],
    typeColor: { crypto: '#E6A23C', us: '#3AA9AC', th: '#FFAE6E', fund: '#C76B8E', deposit: '#C9B7A8' },
  },
  ocean: {
    swatchBg: '#F1F6F7',
    palette: ['#0E8C8F', '#46C2C4', '#2E9E6B', '#3E8FD0', '#8A6FC0', '#D08A3C'],
    tints: ['#DCEFF0', '#E0F2F2', '#DFF1E8', '#E1EDF8', '#ECE6F6', '#FAEEDD'],
    greens: ['#2E9E6B', '#46B383', '#6FD3A2', '#A7E6C7', '#D2F2E2'],
    reds: ['#D8533C', '#EFA191', '#F6CCC1'],
    debtPalette: ['#46C2C4', '#3E8FD0', '#0E8C8F', '#97DEDF', '#8A6FC0', '#B5402C'],
    typeColor: { crypto: '#D08A3C', us: '#3E8FD0', th: '#46C2C4', fund: '#8A6FC0', deposit: '#A9B8BA' },
  },
  berry: {
    swatchBg: '#FAF4F7',
    palette: ['#C2316B', '#F072A0', '#7E5AA8', '#E0A23C', '#3FA6A0', '#E07A4E'],
    tints: ['#FBE3EC', '#FCE6F0', '#EEE6F4', '#FBEFD9', '#DFF1EF', '#FBEADF'],
    greens: ['#2E9E6B', '#46B383', '#7BD0A6', '#A9E4C6', '#D5F1E2'],
    reds: ['#D23B3B', '#E89393', '#F3C3C3'],
    debtPalette: ['#F072A0', '#E07A4E', '#C2316B', '#F7AEC8', '#7E5AA8', '#A82A2A'],
    typeColor: { crypto: '#E0A23C', us: '#3FA6A0', th: '#F072A0', fund: '#7E5AA8', deposit: '#BCAAB4' },
  },
};

export const themeOrder: ThemeId[] = ['sunset', 'ocean', 'berry'];

export const themeMeta: Record<ThemeId, { name: string; desc: string }> = {
  sunset: { name: 'Sunset', desc: 'อบอุ่น · ส้ม–พีช–เทอร์ควอยซ์' },
  ocean: { name: 'Ocean', desc: 'เย็นสบาย · ฟ้า–เขียวน้ำทะเล' },
  berry: { name: 'Berry', desc: 'สดใส · ม่วงแดง–ชมพู' },
};

/** Returns the active theme's color arrays (reactive to the store's `theme`). */
export const useThemePalette = (): ThemePalette => {
  const theme = useStore((s) => s.theme);
  return THEMES[theme] || THEMES.sunset;
};
