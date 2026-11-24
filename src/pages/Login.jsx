import { useState } from 'react';
import { useAppState, setSession } from '../state/store.js';
import { BrandMark, go } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const METHODS = [['telegram', 'Telegram'], ['sms', 'SMS kod'], ['password', 'Login va parol']];

/** Kirish (TZ 14-bo'lim): Telegram, SMS kod yoki login va parol. Prototipda demo — haqiqiy autentifikatsiya yo'q. */
export default function Login() {
  const s = useAppState();
  const [m, setM] = useState('telegram');
  const [f, setF] = useState({ value: '', password: '', code: '' });
  const [pending, setPending] = useState(null); // Telegram yoki SMS: topilgan foydalanuvchi, tasdiq kutilmoqda
  const [err, setErr] = useState('');
  const sample = D.activeEmployees(s).find((e) => e.profile?.telegram);

  const enter = (r) => {
    setSession({ loggedOut: false, mode: r.mode, ...(r.userId ? { userId: r.userId } : {}), ...(r.employeeId ? { employeeId: r.employeeId } : {}) });
    go('/');
  };
  const find = () => {
    setErr('');
    try {
      const r = D.findLogin(s, { method: m, value: f.value, password: f.password });
      if (m === 'password') enter(r);
      else setPending(r);
    } catch (e) { setErr(e.message); }
  };
  const confirm = () => {
    if (m === 'sms' && f.code !== D.DEMO_SMS_CODE) { setErr('Kod noto‘g‘ri'); return; }
    enter(pending);
  };
  const pick = (k) => { setM(k); setF({ value: '', password: '', code: '' }); setPending(null); setErr(''); };

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}><BrandMark /><div><b>RegUP LMS</b><div className="small muted">Registon o‘quv markazlari akademiyasi</div></div></div>
        <h2 style={{ margin: '10px 0 4px' }}>Tizimga kirish</h2>
        <div className="tabs" style={{ marginBottom: 12 }}>{METHODS.map(([k, l]) => <button key={k} className={m === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}</div>
        {!pending && (
          <div className="stack">
            {m === 'telegram' && <label className="f">Telegram username<input className="i" value={f.value} placeholder={sample?.profile.telegram || '@username'} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>}
            {m === 'sms' && <label className="f">Telefon raqami<input className="i" value={f.value} placeholder="+998 90 123 45 67" onChange={(e) => setF({ ...f, value: e.target.value })} /></label>}
            {m === 'password' && (
              <>
                <label className="f">Login (Gmail yoki admin logini)<input className="i" value={f.value} placeholder="ism.familiya@gmail.com" onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
                <label className="f">Parol<input className="i" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
              </>
            )}
            <button className="btn primary" onClick={find}>{m === 'telegram' ? 'Telegram orqali kirish' : m === 'sms' ? 'Kod yuborish' : 'Kirish'}</button>
          </div>
        )}
        {pending && m === 'telegram' && (
          <div className="stack">
            <div className="callout small">RegUP botiga tasdiq so‘rovi yuborildi: <b>{pending.name}</b>. Telegram’da «Tasdiqlash» tugmasini bosing.</div>
            <button className="btn primary" onClick={confirm}>Botda tasdiqladim (demo)</button>
            <button className="btn" onClick={() => setPending(null)}>Orqaga</button>
          </div>
        )}
        {pending && m === 'sms' && (
          <div className="stack">
            <div className="callout small">Kod EduTizim’dagi raqamga yuborildi: <b>{pending.name}</b>. Parolni tiklash ham SMS yoki Telegram orqali.</div>
            <label className="f">SMS kod<input className="i" value={f.code} inputMode="numeric" onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
            <button className="btn primary" onClick={confirm}>Kirish</button>
            <button className="btn" onClick={() => setPending(null)}>Orqaga</button>
          </div>
        )}
        {err && <div className="callout warn small" style={{ marginTop: 10 }}>{err}</div>}
        <div className="small muted" style={{ marginTop: 14 }}>Demo: haqiqiy autentifikatsiya yo‘q. Telegram username va telefon EduTizim profilidan tekshiriladi; SMS kod {D.DEMO_SMS_CODE}, parol «{D.DEMO_PASSWORD}», admin logini — masalan «hr», «lda», «super».</div>
      </div>
    </div>
  );
}
