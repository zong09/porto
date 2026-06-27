import React from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from '../hooks/useTranslation';
import { THEMES, themeMeta, themeOrder } from '../utils/themes';
import { Download, Upload, X } from 'lucide-react';
import { apiClient } from '../api/apiClient';

export const Settings: React.FC = () => {
  const { theme, setTheme } = useStore();
  const { t } = useTranslation();

  const [modalType, setModalType] = React.useState<'export' | 'import' | null>(null);
  const [password, setPassword] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setModalType(null);
    setPassword('');
    setFile(null);
    setError('');
    setLoading(false);
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('settings.exportDesc'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/backup/export', { password });
      const base64Data = res.data.data;
      
      // Convert base64 to Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `porto-backup-${new Date().toISOString().split('T')[0]}.porto`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      resetModal();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('settings.exportDesc'));
      return;
    }
    if (!file) {
      setError('Please select a backup file');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64String = (event.target?.result as string).split(',')[1];
          await apiClient.post('/backup/import', { password, data: base64String });
          window.location.reload(); // Refresh the app to load new data
        } catch (err: any) {
          setError(err.response?.data?.message || 'Import failed');
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError('Failed to read file');
      setLoading(false);
    }
  };

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

      <div className="bg-white rounded-[22px] py-[22px] px-[24px] mt-[16px]">
        <div className="text-[14px] font-bold text-dark mb-[4px]">{t('settings.backupLabel')}</div>
        <div className="text-[12.5px] text-faint mb-[16px]">{t('settings.backupDesc')}</div>
        
        <div className="flex gap-[12px] flex-wrap">
          <button
            onClick={() => setModalType('export')}
            className="flex items-center gap-[8px] px-[20px] py-[12px] bg-dark text-white rounded-[14px] text-[13.5px] font-bold transition-transform hover:-translate-y-0.5 shadow-sm"
          >
            <Download size={16} />
            {t('settings.exportBtn')}
          </button>
          
          <button
            onClick={() => setModalType('import')}
            className="flex items-center gap-[8px] px-[20px] py-[12px] border-2 border-inputBorder text-dark rounded-[14px] text-[13.5px] font-bold transition-transform hover:-translate-y-0.5 hover:bg-surface"
          >
            <Upload size={16} />
            {t('settings.importBtn')}
          </button>
        </div>
      </div>

      {/* Export / Import Modal */}
      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-[440px] p-[28px] shadow-xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={resetModal}
              className="absolute top-[20px] right-[20px] p-[8px] rounded-full hover:bg-surface text-muted transition-colors"
              disabled={loading}
            >
              <X size={20} />
            </button>
            
            <h2 className="text-[18px] font-bold text-dark mb-[6px]">
              {modalType === 'export' ? t('settings.exportTitle') : t('settings.importTitle')}
            </h2>
            <p className="text-[13px] text-muted mb-[24px]">
              {modalType === 'export' ? t('settings.exportDesc') : t('settings.importDesc')}
            </p>

            {modalType === 'import' && (
              <div className="mb-[20px] p-[14px] bg-red-50 text-red-600 text-[12px] rounded-[12px] font-medium border border-red-100">
                {t('settings.importWarn')}
              </div>
            )}

            <form onSubmit={modalType === 'export' ? handleExport : handleImport} className="flex flex-col gap-[14px]">
              {modalType === 'import' && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[12.5px] font-semibold text-muted">
                    {t('settings.fileLabel')}
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".porto"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-[14px] text-dark
                      file:mr-4 file:py-[8px] file:px-[16px]
                      file:rounded-full file:border-0
                      file:text-[13px] file:font-semibold
                      file:bg-surface file:text-dark
                      hover:file:bg-gray-100 cursor-pointer"
                    disabled={loading}
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-[6px]">
                <label className="text-[12.5px] font-semibold text-muted">
                  {t('settings.passwordLabel')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface border-2 border-transparent focus:border-dark px-[14px] py-[10px] rounded-[12px] text-[14px] text-dark outline-none transition-all placeholder:text-muted/50"
                  placeholder="••••••••"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="text-red-500 text-[13px] font-medium px-[4px]">{error}</div>}

              <div className="flex gap-[10px] mt-[10px]">
                <button
                  type="button"
                  onClick={resetModal}
                  className="flex-1 py-[10px] text-[14px] font-bold text-muted bg-surface rounded-[14px] hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  {t('settings.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-[10px] text-[14px] font-bold text-white bg-dark rounded-[14px] hover:bg-black transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? t('settings.processing') : (modalType === 'export' ? t('settings.exportBtn') : t('settings.importBtn'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
