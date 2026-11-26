// RegUP dizayn tizimi komponentlari (claude.ai «RegUP — dizayn tizimi» bundle.js ning JSX nusxasi).
import { useEffect, useRef, useState } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'],
  book: ['M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z', 'M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  award: ['M12 3a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', 'M8.5 14 7 22l5-3 5 3-1.5-8'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  users: ['M9 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M2 21a7 7 0 0 1 14 0', 'M17 4a4 4 0 0 1 0 8', 'M22 21a7 7 0 0 0-4-6.3'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'm20 20-3.5-3.5'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  layers: ['M12 3 2 8l10 5 10-5z', 'M2 13l10 5 10-5'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
};
const FILLED = {
  play: 'M8 5v14l11-7z',
  flame: 'M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z',
  star: 'm12 2 3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.6 5.7 21l1.5-6.9L2 9.3l7-.8z',
};

export function DsIcon({ name, size = 20, strokeWidth = 1.8, label, className }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
  if (FILLED[name]) return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={cx('ru-icon', className)} {...a11y}><path d={FILLED[name]} /></svg>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cx('ru-icon', className)} {...a11y}>
      {(PATHS[name] || PATHS.home).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function DsButton({ variant = 'primary', size = 'md', icon, href, onClick, children, className }) {
  const cls = cx('ru-btn', `ru-btn--${variant}`, `ru-btn--${size}`, className);
  const inner = <>{children}{icon && <DsIcon name={icon} size={size === 'sm' ? 16 : 18} strokeWidth={2} />}</>;
  if (href) return <a href={href} className={cls} onClick={onClick}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

export function DsBadge({ tone = 'neutral', dot, children }) {
  return <span className={`ru-badge ru-badge--${tone}`}>{dot && <span className="ru-badge__dot" aria-hidden="true" />}{children}</span>;
}

const REWARD = { streak: ['flame', 'hafta ketma-ket'], points: ['star', 'ball'], badge: ['award', 'badge'] };
export function RewardChip({ kind, value, onBrand }) {
  const [icon, word] = REWARD[kind];
  return (
    <span className={cx('ru-reward', `ru-reward--${kind}`, onBrand && 'ru-reward--on-brand')} aria-label={`${value} ${word}`} title={`${value} ${word}`}>
      <DsIcon name={icon} size={16} strokeWidth={2} /><span>{value}</span>
    </span>
  );
}

export function ProgressRing({ value, max, size = 80, stroke = 8, center, sublabel, onBrand, ariaLabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, (value || 0) / (max || 1)));
  return (
    <div className={cx('ru-ring', onBrand && 'ru-ring--on-brand')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel || `${value} / ${max}`}>
        <circle className="ru-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ru-ring__fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ru-ring__center" aria-hidden="true"><b className="ru-ring__value">{center ?? value}</b>{sublabel && <span className="ru-ring__sub">{sublabel}</span>}</div>
    </div>
  );
}

export function JourneyStep({ state = 'upcoming', index, title, meta, last, children }) {
  let node;
  if (state === 'current') node = <span className="ru-step__node ru-step__node--current"><DsIcon name="play" size={22} /></span>;
  else if (state === 'done') node = <span className="ru-step__node ru-step__node--done"><DsIcon name="check" size={20} strokeWidth={2.4} /></span>;
  else if (state === 'reward') node = <span className="ru-step__node ru-step__node--reward"><DsIcon name="award" size={20} strokeWidth={2} /></span>;
  else node = <span className="ru-step__node">{index}</span>;
  return (
    <div className={cx('ru-step', `ru-step--${state}`, last && 'ru-step--last')}>
      <div className="ru-step__rail">{node}{!last && <span className="ru-step__line" aria-hidden="true" />}</div>
      <div className="ru-step__body">{meta && <span className="ru-step__meta">{meta}</span>}<span className="ru-step__title">{title}</span>{children}</div>
    </div>
  );
}

export function TabBar({ items, active, className }) {
  return (
    <nav className={cx('ru-tabbar', className)} aria-label="Asosiy menyu">
      {items.map((it, i) => (
        <a key={it.href} href={it.href} className={cx('ru-tabbar__item', i === active && 'is-active')} aria-current={i === active ? 'page' : undefined}>
          <DsIcon name={it.icon} size={22} strokeWidth={i === active ? 2 : 1.8} /><span>{it.label}</span>
        </a>
      ))}
    </nav>
  );
}

/** ⌘K qidiruv oynasi. items: [{group, label, hint, icon, go}] */
export function CommandPalette({ items, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const needle = q.trim().toLowerCase();
  const list = items.filter((it) => !needle || `${it.label} ${it.hint || ''}`.toLowerCase().includes(needle));
  const groups = [];
  for (const it of list) {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
    if (g.items.length < (needle ? 8 : 5)) g.items.push(it);
  }
  const flat = groups.flatMap((g) => g.items);
  const cur = Math.min(active, Math.max(flat.length - 1, 0));
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(cur + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(cur - 1, 0)); }
    else if (e.key === 'Enter' && flat[cur]) { e.preventDefault(); onSelect(flat[cur]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  let n = -1;
  return (
    <div className="ru-cmd" role="dialog" aria-modal="true" aria-label="Qidiruv" onClick={(e) => e.stopPropagation()}>
      <div className="ru-cmd__search">
        <DsIcon name="search" size={18} />
        <input ref={ref} className="ru-cmd__input" value={q} placeholder="Xodim, kurs yoki bo‘limni qidiring" onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
          role="combobox" aria-expanded="true" aria-controls="ru-cmd-list" aria-activedescendant={flat[cur] ? `ru-cmd-opt-${cur}` : undefined} />
        <kbd className="ru-cmd__kbd">Esc</kbd>
      </div>
      <div className="ru-cmd__list" id="ru-cmd-list" role="listbox">
        {flat.length === 0 && <div className="ru-cmd__empty">Hech narsa topilmadi</div>}
        {groups.map((g) => (
          <div key={g.name} role="group" aria-label={g.name}>
            <div className="ru-cmd__group">{g.name}</div>
            {g.items.map((it) => {
              n += 1; const idx = n;
              return (
                <div key={`${g.name}-${it.label}-${idx}`} id={`ru-cmd-opt-${idx}`} role="option" aria-selected={idx === cur} className={cx('ru-cmd__item', idx === cur && 'is-active')}
                  onMouseEnter={() => setActive(idx)} onClick={() => onSelect(it)}>
                  <DsIcon name={it.icon || 'arrow'} size={18} />
                  <span className="ru-cmd__label">{it.label}</span>
                  {it.hint && <span className="ru-cmd__hint">{it.hint}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="ru-cmd__foot">↑↓ tanlash · Enter ochish · Esc yopish</div>
    </div>
  );
}
