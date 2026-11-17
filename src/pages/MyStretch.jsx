import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { STRETCH_STATUS } from '../ui/labels.js';
import { StretchHistory, StretchInfo } from './Stretch.jsx';

function One({ st, s }) {
  const [f, setF] = useState({ text: '', link: '' });
  const canSubmit = st.status === 'assigned' || st.status === 'returned';
  return (
    <Panel title={<div><h2>{st.title}</h2><div className="muted small">{st.kind}</div></div>} actions={<Pill tone={STRETCH_STATUS[st.status][1]}>{STRETCH_STATUS[st.status][0]}</Pill>}>
      <div className="grid g2">
        <StretchInfo st={st} s={s} />
        <div className="stack">
          <h3>Topshiriqlar tarixi</h3>
          {st.submissions.length ? <StretchHistory st={st} /> : <Empty>Hali yuborilmagan.</Empty>}
          {canSubmit && (
            <div className="stack">
              <h3>{st.status === 'returned' ? 'Qayta yuborish' : 'Dalil topshirish'}</h3>
              <textarea className="i" style={{ minHeight: 100 }} placeholder="Shaxsan bajargan ishingiz, qaroringiz, o‘lchangan natija va filiallar kesimidagi ta’sir" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
              <input className="i" placeholder="Hisobot yoki havola" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
              <button className="btn primary" onClick={() => run(D.submitStretch, { id: st.id, ...f }, 'Dalil yuborildi') && setF({ text: '', link: '' })}>Yuborish</button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function MyStretch({ emp }) {
  const s = useAppState();
  const list = s.stretches.filter((x) => x.employeeId === emp.id);
  return (
    <>
      <div className="page-head"><div><h1>Stretch vazifam</h1><p>Keyingi rol ko‘lamidagi amaliy vazifa. Tasdiqlangan dalil tayyorlik paneliga bog‘lanadi.</p></div></div>
      {list.length ? list.map((st) => <One key={st.id} st={st} s={s} />) : <Panel><Empty>Sizga stretch vazifa biriktirilmagan. Namuna uchun Nodira Rahimova yoki Dilshod Karimovni tanlang.</Empty></Panel>}
    </>
  );
}
