import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/apiClient';
import { useAuthConfig } from '../hooks/useApi';
import { useTranslation } from '../hooks/useTranslation';

export const Login: React.FC = () => {
  const login = useStore((state) => state.login);
  const { data: config } = useAuthConfig();
  const { t, language, setLanguage } = useTranslation();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (config?.enableRegister === false) {
      setIsSignup(false);
    }
  }, [config]);

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/demo');
      login(res.data.user, res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่โหมดเดโม');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (isSignup && config?.enableRegister === false) {
      setError(t('login.signupDisabled'));
      return;
    }
    if (isSignup && !name.trim()) {
      setError(t('login.nameRequired'));
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      setError(t('login.emailInvalid'));
      return;
    }
    if (password.length < 4) {
      setError(t('login.passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const res = await apiClient.post('/auth/register', { email, name, pass: password });
        login(res.data.user, res.data.token);
      } else {
        const res = await apiClient.post('/auth/login', { email, pass: password });
        login(res.data.user, res.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch flex-wrap relative" data-screen-label="Login">
      {/* Absolute Language Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <div className="flex bg-chipBg backdrop-blur-sm rounded-full p-[3px] text-[12.5px] font-bold select-none shadow-sm">
          <div onClick={() => setLanguage('th')} className={`px-[12px] py-[4px] rounded-full cursor-pointer transition-all duration-150 ${language === 'th' ? 'text-surface bg-dark' : 'text-muted bg-transparent hover:text-dark'}`}>TH</div>
          <div onClick={() => setLanguage('en')} className={`px-[12px] py-[4px] rounded-full cursor-pointer transition-all duration-150 ${language === 'en' ? 'text-surface bg-dark' : 'text-muted bg-transparent hover:text-dark'}`}>EN</div>
        </div>
      </div>

      <div className="flex-1 min-w-[380px] bg-gradient-to-br from-terracotta via-terracotta-hover to-brandDd text-white p-14 flex flex-col justify-between min-h-[350px]">
        <div className="flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-white/95 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="/porto-64.png" alt="Porto" className="w-[26px] h-[26px]" />
          </div>
          <div className="text-[19px] font-bold tracking-tight">Porto</div>
        </div>

        <div className="flex flex-col gap-6 mt-16 md:mt-auto">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
            {t('login.title').split('<br />').map((text, idx) => (
              <React.Fragment key={idx}>
                {text}
                {idx < t('login.title').split('<br />').length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-white/80 max-w-[420px]">
            {t('login.desc')}
          </p>

          <div className="flex gap-8 mt-4">
            <div>
              <div className="text-2xl font-bold">5</div>
              <div className="text-[12px] text-white/70">{t('login.featuresAssets')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">∞</div>
              <div className="text-[12px] text-white/70">{t('login.featuresPorts')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">100%</div>
              <div className="text-[12px] text-white/70">{t('login.featuresSecure')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 min-w-[420px] flex items-center justify-center py-[48px] px-[32px] bg-surface">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px]">
          <div>
            <h2 className="text-2xl font-bold text-dark">{isSignup ? t('login.signupTitle') : t('login.loginTitle')}</h2>
            <p className="text-[14px] text-muted mt-1">
              {isSignup ? t('login.signupDesc') : t('login.loginDesc')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            {isSignup && (
              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-1.5">{t('login.nameLabel')}</label>
                <input
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-[14px] py-[10px] rounded-[12px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                  id="input-auth-name"
                />
              </div>
            )}

            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-1.5">{t('login.emailLabel')}</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-[14px] py-[10px] rounded-[12px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-auth-email"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-1.5">{t('login.passwordLabel')}</label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-[14px] py-[10px] rounded-[12px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-auth-password"
              />
            </div>

            {error && (
              <div className="bg-negative-bg text-lossD text-[13px] px-[14px] py-[9px] rounded-xl border border-negative-text/10">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14.5px] font-bold border-none cursor-pointer disabled:opacity-50 transition-colors"
              id="btn-auth-submit"
            >
              {loading ? t('login.loadingLogin') : isSignup ? t('login.signupBtn') : t('login.loginBtn')}
            </button>
          </form>

          {config?.enableDemo && (
            <>
              <div className="flex items-center gap-3 text-faint text-[12px]">
                <div className="flex-1 h-[1px] bg-inputBorder"></div>
                <span>{t('login.orText')}</span>
                <div className="flex-1 h-[1px] bg-inputBorder"></div>
              </div>

              <button
                onClick={handleDemo}
                disabled={loading}
                className="w-full py-3 rounded-full bg-chipBg hover:bg-softH text-chipBg-text text-sm font-bold border-none cursor-pointer disabled:opacity-50 transition-colors"
                id="btn-auth-demo"
              >
                {t('login.demoBtn')}
              </button>
            </>
          )}

          {config?.enableRegister !== false && (
            <div className="text-center text-[13px] text-muted select-none">
              <span>{isSignup ? t('login.hasAccount') : t('login.noAccount')}</span>{' '}
              <span
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError(null);
                }}
                className="text-terracotta font-bold cursor-pointer underline hover:text-terracotta-hover"
                id="link-toggle-auth-mode"
              >
                {isSignup ? t('login.loginBtn') : t('login.signupBtn')}
              </span>
            </div>
          )}

          <div className="text-center text-[11.5px] text-faint-darker leading-[1.6] max-w-[280px] mx-auto">
            {t('login.secureNote')}
          </div>
        </div>
      </div>
    </div>
  );
};

