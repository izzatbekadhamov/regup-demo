import { useEffect, useState } from 'react';
import { useToasts } from '../state/store.js';
import { STAGE_LABELS } from '../data/models.js';
import { fmtNum } from '../core/calc.js';

export function useHashRoute() {
  const get = () => (window.location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
  const [parts, setParts] = useState(get);
  useEffect(() => {
    const on = () => {
      setParts(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path) => {
  window.location.hash = path;
};

export function Pill({ tone = 'muted', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Panel({ title, actions, children, tight, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`panel-body ${tight ? 'tight' : ''}`}>{children}</div>
    </section>
  );
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.5 3H16a2 2 0 0 0-1.4 3.4A1.6 1.6 0 0 1 12 21zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01M17.5 11h.01',
  cards: 'M9 3h6v3H9zM7 4.5H5V21h14V4.5h-2M9 13.5l2 2 4-4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  inbox: 'M3 13h5l2 3h4l2-3h5M5.5 5h13L21 13v6H3v-6z',
  route: 'M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  upload: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  check: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  back: 'M15 18l-6-6 6-6',
};
export function Icon({ name, size = 18 }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  );
}

export function BrandMark({ src }) {
  if (src) return <div className="brand-mark has-img"><img src={src} alt="" /></div>;
  return (
    <div className="brand-mark">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 21V11a8 8 0 0 1 16 0v10M9 21v-7a3 3 0 0 1 6 0v7M2 21h20" />
      </svg>
    </div>
  );
}

const AV_COLORS = ['#2443c4', '#0f9f95', '#7c4dcc', '#c2620f', '#b0306b', '#1f7a4d', '#3c6ea8'];
export function Avatar({ name = '', size = '' }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span className={`avatar ${size}`} style={{ background: AV_COLORS[h % AV_COLORS.length] }}>{ini}</span>;
}

export function Person({ name, sub }) {
  return (
    <div className="person">
      <Avatar name={name} />
      <div style={{ minWidth: 0 }}>
        <div className="nm">{name}</div>
        {sub && <div className="muted small">{sub}</div>}
      </div>
    </div>
  );
}

export function Stat({ k, v, s, icon, tone = '' }) {
  return (
    <div className={`panel stat ${tone}`}>
      <div className="top">
        <div className="k">{k}</div>
        {icon && <span className="ico-box"><Icon name={icon} size={16} /></span>}
      </div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Stepper({ stages, current }) {
  const idx = stages.indexOf(current);
  const all = current === 'published';
  return (
    <ol className="stepper">
      {stages.map((st, i) => {
        const done = all || i < idx;
        return (
          <li key={st} className={`step ${done ? 'done' : i === idx ? 'cur' : ''}`}>
            <span className="dot">{done ? '✓' : i + 1}</span>
            <span>{STAGE_LABELS[st]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreText({ v }) {
  if (v === 'DE') return <Pill tone="warn">DE</Pill>;
  if (v === 'NA') return <Pill tone="muted">Qo‘llanmaydi</Pill>;
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return <b>{fmtNum(v)}</b>;
}

export function ScoreChip({ v, target }) {
  if (v === 'DE' || v === 'NA' || v === null || v === undefined) return <ScoreText v={v} />;
  const gap = target - v;
  return <span className={`score ${gap <= 0 ? 'ok' : gap === 1 ? 'gap1' : 'gap2'}`}>{fmtNum(v)}</span>;
}

export function CondIcon({ passed }) {
  if (passed === true) return <span className="ic ok">✓</span>;
  if (passed === false) return <span className="ic no">✕</span>;
  return <span className="ic na">○</span>;
}

export function Conditions({ list }) {
  return (
    <div>
      {list.map((c, i) => (
        <div key={i} className="cond">
          <CondIcon passed={c.passed} />
          <div>
            <div>{c.label}</div>
            {c.detail && <div className="detail">{c.detail}</div>}
            {c.reason && <div className="reason">{c.reason}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Meter({ value, threshold, thin }) {
  const w = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={`meter ${thin ? 'thin' : ''}`} title={`Chegara ${threshold}%`}>
      <i style={{ width: `${w}%`, background: value >= threshold ? 'var(--good)' : 'var(--brand)' }} />
      {threshold && <b style={{ left: `${threshold}%` }} />}
    </div>
  );
}

export function Empty({ children, icon = 'inbox' }) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} size={18} /></span>
      <div>{children}</div>
    </div>
  );
}

// Doiraviy ko'rsatkich: value — foiz (null bo'lsa partial kulrangda ko'rsatiladi), threshold — chegara belgisi
export function Gauge({ value, partial, threshold, label, sub, size = 128, tone }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const has = value !== null && value !== undefined;
  const w = Math.max(0, Math.min(100, has ? value : partial ?? 0));
  const color = tone ? `var(--${tone})` : !has ? '#b9c1d3' : threshold != null && value >= threshold ? 'var(--good)' : 'var(--brand)';
  const a = threshold != null ? ((threshold / 100) * 360 - 90) * (Math.PI / 180) : null;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line-2)" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(c * w) / 100} ${c}`} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.4s ease' }} />
        {a !== null && <line x1={60 + 42 * Math.cos(a)} y1={60 + 42 * Math.sin(a)} x2={60 + 58 * Math.cos(a)} y2={60 + 58 * Math.sin(a)} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />}
      </svg>
      <div className="gauge-c">
        <b style={{ fontSize: size < 110 ? 18 : 24 }}>{label}</b>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}.${m}.${y}${d.length > 10 ? ` ${d.slice(11, 16)}` : ''}`;
};

// Sahifa ichidagi tasdiqlash oynasi: brauzer confirm/prompt sandbox (artifact) ichida ishlamaydi.
let dialog = null;
const dialogListeners = new Set();
const setDialog = (d) => { dialog = d; dialogListeners.forEach((f) => f(d)); };
/** ask(matn, onYes) — tasdiqlash; ask(matn, onYes, { input: true }) — matn kiritish (onYes(qiymat)). */
export function ask(text, onYes, opts = {}) { setDialog({ text, onYes, input: !!opts.input, ok: opts.ok }); }
export function DialogHost() {
  const [d, setD] = useState(dialog);
  const [val, setVal] = useState('');
  useEffect(() => { const f = (x) => { setD(x); setVal(''); }; dialogListeners.add(f); return () => dialogListeners.delete(f); }, []);
  if (!d) return null;
  const yes = () => { if (d.input && !val.trim()) return; setDialog(null); d.onYes(d.input ? val.trim() : true); };
  return (
    <div className="dlg-back" onClick={() => setDialog(null)}>
      <div className="dlg panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="panel-body stack">
          <b>{d.text}</b>
          {d.input && <input className="i" autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && yes()} />}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setDialog(null)}>Bekor qilish</button>
            <button className="btn primary" disabled={d.input && !val.trim()} onClick={yes}>{d.ok || 'Ha, davom etish'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
