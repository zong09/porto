import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/apiClient';
import { useAuthConfig } from '../hooks/useApi';

export const Login: React.FC = () => {
  const login = useStore((state) => state.login);
  const { data: config } = useAuthConfig();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (isSignup && !name.trim()) {
      setError('กรุณากรอกชื่อของคุณ');
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      setError('อีเมลไม่ถูกต้อง');
      return;
    }
    if (password.length < 4) {
      setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
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
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-stretch flex-wrap" data-screen-label="Login">
      <div className="flex-1 min-w-[380px] bg-gradient-to-br from-[#b45a3c] via-[#8f4630] to-[#5e3322] text-[#faf5ec] p-14 flex flex-col justify-between min-h-[350px]">
        <div className="flex items-center gap-[11px]">
          <div className="w-[30px] h-[30px] rounded-full bg-[#faf5ec] flex-shrink-0"></div>
          <div className="text-[19px] font-bold tracking-tight">Porto</div>
        </div>

        <div className="flex flex-col gap-6 mt-16 md:mt-auto">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
            ติดตามความมั่งคั่ง<br />ของคุณในที่เดียว
          </h1>
          <p className="text-[14.5px] leading-relaxed text-[#faf5ec]/80 max-w-[420px]">
            Crypto · หุ้นไทย · หุ้น US · กองทุน · เงินฝาก — รวมทุกพอร์ต คำนวณ Net Worth และกำไร-ขาดทุนแบบเรียลไทม์ ราคาสดจาก CoinGecko + Yahoo Finance
          </p>

          <div className="flex gap-8 mt-4">
            <div>
              <div className="text-2xl font-bold">5</div>
              <div className="text-[12px] text-[#faf5ec]/70">ประเภทสินทรัพย์</div>
            </div>
            <div>
              <div className="text-2xl font-bold">∞</div>
              <div className="text-[12px] text-[#faf5ec]/70">พอร์ตไม่จำกัด</div>
            </div>
            <div>
              <div className="text-2xl font-bold">100%</div>
              <div className="text-[12px] text-[#faf5ec]/70">เก็บข้อมูลปลอดภัย</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 min-w-[420px] flex items-center justify-center py-[48px] px-[32px] bg-surface">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px]">
          <div>
            <h2 className="text-2xl font-bold text-dark">{isSignup ? 'สร้างบัญชีใหม่' : 'ยินดีต้อนรับกลับ'}</h2>
            <p className="text-[14px] text-muted mt-1">
              {isSignup ? 'ตั้งค่าบัญชีเพื่อเริ่มติดตามพอร์ตของคุณ' : 'เข้าสู่ระบบเพื่อดูพอร์ตการลงทุนของคุณ'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
            {isSignup && (
              <div>
                <label className="block text-[12.5px] font-semibold text-muted mb-1.5">ชื่อ</label>
                <input
                  type="text"
                  placeholder="ชื่อของคุณ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-[14px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                  id="input-auth-name"
                />
              </div>
            )}

            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-1.5">อีเมล</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-[14px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-auth-email"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-muted mb-1.5">รหัสผ่าน</label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-[14px] border border-inputBorder bg-white text-[14.5px] text-dark focus:outline-none focus:border-terracotta transition-colors"
                id="input-auth-password"
              />
            </div>

            {error && (
              <div className="bg-[#f3ded6] text-[#84422e] text-[13px] px-[14px] py-[9px] rounded-xl border border-negative-text/10">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-terracotta hover:bg-terracotta-hover text-white text-[14.5px] font-bold border-none cursor-pointer disabled:opacity-50 transition-colors"
              id="btn-auth-submit"
            >
              {loading ? 'กำลังเข้าสู่ระบบ…' : isSignup ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {config?.enableDemo && (
            <>
              <div className="flex items-center gap-3 text-[#c9bca5] text-[12px]">
                <div className="flex-1 h-[1px] bg-[#e8dccb]"></div>
                <span>หรือ</span>
                <div className="flex-1 h-[1px] bg-[#e8dccb]"></div>
              </div>

              <button
                onClick={handleDemo}
                disabled={loading}
                className="w-full py-3 rounded-full bg-chipBg hover:bg-[#e8dcc8] text-chipBg-text text-sm font-bold border-none cursor-pointer disabled:opacity-50 transition-colors"
                id="btn-auth-demo"
              >
                เข้าใช้งานแบบเดโม
              </button>
            </>
          )}



          <div className="text-center text-[13px] text-muted select-none">
            <span>{isSignup ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}</span>{' '}
            <span
              onClick={() => {
                setIsSignup(!isSignup);
                setError(null);
              }}
              className="text-terracotta font-bold cursor-pointer underline hover:text-terracotta-hover"
              id="link-toggle-auth-mode"
            >
              {isSignup ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
            </span>
          </div>

          <div className="text-center text-[11px] text-[#b3a692] leading-[1.6] max-w-[280px] mx-auto">
            ข้อมูลบัญชีและรายการทั้งหมดจะถูกเก็บอย่างปลอดภัยบนระบบฐานข้อมูลคลาวด์แยกสำหรับพอร์ตส่วนตัวของคุณ
          </div>
        </div>
      </div>
    </div>
  );
};
