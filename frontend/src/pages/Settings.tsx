import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import { THEMES, themeMeta, themeOrder } from '../utils/themes';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useStore();
  const { t } = useTranslation();

  return (
    <div data-screen-label="Settings">
      <div className="flex items-center gap-3 pt-[28px] pb-[6px] flex-wrap">
        <h1 className="text-[22px] font-bold text-dark">{t('settings.title')}</h1>
      </div>
      <p className="text-[13.5px] text-muted mb-[18px]">{t('settings.subtitle')}</p>

      <div className="bg-white rounded-[22px] py-[22px] px-[24px]">
        <div className="text-[14px] font-bold text-dark mb-[4px]">{t('settings.themeLabel')}</div>
        <div className="text-[12.5px] text-faint mb-[16px]">{t('settings.themeCount')}</div>

        <div className="grid gap-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {themeOrder.map((id) => {
            const meta = themeMeta[id];
            const palette = THEMES[id].palette;
            const active = id === theme;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                id={`theme-${id}`}
                className={`flex flex-col text-left rounded-[18px] p-[16px] cursor-pointer border-2 transition-transform duration-150 hover:-translate-y-0.5 ${
                  active ? 'border-terracotta shadow-[0_8px_22px_rgba(0,0,0,0.07)]' : 'border-inputBorder'
                }`}
                style={{ background: 'var(--surface)' }}
              >
                <div
                  className="rounded-[12px] p-[14px] flex flex-col gap-[10px]"
                  style={{ background: THEMES[id].swatchBg, border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <div className="h-[12px] rounded-full" style={{ width: '62%', background: palette[0] }}></div>
                  <div className="flex gap-[6px]">
                    {palette.map((c, i) => (
                      <div key={i} className="w-[16px] h-[16px] rounded-full" style={{ background: c }}></div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-[12px]">
                  <div className="text-[15px] font-bold text-dark">{meta.name}</div>
                  {active && (
                    <span className="text-[11px] font-bold text-white bg-terracotta rounded-full px-[9px] py-[2px]">
                      {t('settings.active')}
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-muted mt-[2px]">{meta.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
