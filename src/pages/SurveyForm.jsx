import { useState } from 'react';
import * as D from '../core/domain.js';

/** So'rovnoma javob formasi: Ha/Yo'q, shkala, NPS, tanlov, matn. */
export default function SurveyForm({ sv, onSubmit, submitLabel = 'Javobni yuborish' }) {
  const [a, setA] = useState({});
  const set = (id, v) => setA({ ...a, [id]: v });
  return (
    <div className="stack">
      <div className={`callout small ${sv.hrVisible ? 'warn' : ''}`}>{sv.hrVisible ? 'Bu so‘rovnoma ismli: javoblaringiz HR bo‘limiga ismingiz bilan ko‘rinadi.' : `Bu so‘rovnoma anonim: javoblaringiz ismingizga bog‘lanmaydi, natija faqat filial va lavozim kesimida, kamida ${D.ANON_MIN} ta javob bo‘lsa ko‘rinadi.`}</div>
      {sv.questions.map((q, i) => (
        <div key={q.id} className="qrow">
          <b className="small">{i + 1}. {q.text}{q.type === 'text' && <span className="muted"> (ixtiyoriy)</span>}</b>
          {q.type === 'yesno' && <div className="opt-row">{[['yes', 'Ha'], ['no', 'Yo‘q']].map(([v, l]) => <label key={v} className={a[q.id] === v ? 'on' : ''}><input type="radio" hidden checked={a[q.id] === v} onChange={() => set(q.id, v)} />{l}</label>)}</div>}
          {q.type === 'scale5' && <div className="opt-row">{[1, 2, 3, 4, 5].map((v) => <label key={v} className={a[q.id] === String(v) ? 'on' : ''}><input type="radio" hidden onChange={() => set(q.id, String(v))} />{v}</label>)}</div>}
          {q.type === 'nps' && <div className="opt-row">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <label key={v} className={a[q.id] === String(v) ? 'on' : ''}><input type="radio" hidden onChange={() => set(q.id, String(v))} />{v}</label>)}</div>}
          {q.type === 'single' && <div className="opt-row">{q.options.map((o) => <label key={o} className={a[q.id] === o ? 'on' : ''}><input type="radio" hidden onChange={() => set(q.id, o)} />{o}</label>)}</div>}
          {q.type === 'multi' && <div className="opt-row">{q.options.map((o) => { const cur = a[q.id] || []; const on = cur.includes(o); return <label key={o} className={on ? 'on' : ''}><input type="checkbox" hidden onChange={() => set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])} />{o}</label>; })}</div>}
          {q.type === 'text' && <textarea className="i" rows={2} value={a[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />}
        </div>
      ))}
      <div><button className="btn primary" onClick={() => onSubmit(a)}>{submitLabel}</button></div>
    </div>
  );
}
