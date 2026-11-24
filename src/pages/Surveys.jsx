import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const N1 = (v) => (v === null || v === undefined ? '—' : String(Math.round(v * 10) / 10).replace('.', ','));
const P = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const blankQ = () => ({ text: '', type: 'yesno', options: [], standard: null, negative: false });

function Editor({ init, user, onDone }) {
  const [f, setF] = useState(() => structuredClone(init || { name: '', trigger: 'manual', hrVisible: false, questions: [blankQ()] }));
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  return (
    <Panel title={init ? `Tahrirlash: ${init.name}` : 'Yangi so‘rovnoma'} actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g3">
        <label className="f" style={{ gridColumn: 'span 2' }}>Nomi<input className="i" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: D8 — ilk hafta taassurotlari" /></label>
        <label className="f">Qachon yuboriladi<select className="i" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>{Object.entries(D.SURVEY_TRIGGERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <label className="right-row on" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={f.hrVisible} onChange={(e) => setF({ ...f, hrVisible: e.target.checked })} />
        <span><b>Javoblar HR bo‘limiga ko‘rinsin</b><span className="small muted" style={{ display: 'block' }}>O‘chiq (standart) — anonim: javob xodimga bog‘lanmaydi, natija faqat filial va lavozim kesimida, kamida {D.ANON_MIN} ta javob bo‘lsa. Yoqilgan — HR ism bilan ko‘radi; xodim savollardan oldin buni ko‘radi.</span></span>
      </label>
      <div className="stack" style={{ marginTop: 10 }}>
        {f.questions.map((q, i) => (
          <div key={i} className="qrow">
            <div className="row" style={{ gap: 6 }}>
              <b className="small">{i + 1}.</b>
              <input className="i" style={{ flex: 1 }} value={q.text} placeholder="Savol matni" onChange={(e) => setQ(i, { text: e.target.value })} />
              <select className="i compact" value={q.type} onChange={(e) => setQ(i, { type: e.target.value })}>{Object.entries(D.QUESTION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <button className="link-btn small" onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })}>o‘chirish</button>
            </div>
            {['single', 'multi'].includes(q.type) && <input className="i" placeholder="Variantlar, vergul bilan" value={(q.options || []).join(', ')} onChange={(e) => setQ(i, { options: e.target.value.split(',').map((x) => x.trim()) })} />}
            <div className="row small" style={{ gap: 14, flexWrap: 'wrap' }}>
              {q.type === 'yesno' && <label>Onboarding standarti: <select className="i compact" value={q.standard ?? ''} onChange={(e) => setQ(i, { standard: e.target.value === '' ? null : Number(e.target.value) })}><option value="">— bog‘lanmagan</option>{D.CHECKLIST_ITEMS.map(([st, t], k) => <option key={k} value={k}>{st}: {t}</option>)}</select></label>}
              {q.type !== 'text' && <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={!!q.negative} onChange={(e) => setQ(i, { negative: e.target.checked })} /> «Salbiy javob» belgisi {q.type === 'yesno' ? '(«Yo‘q»)' : q.type === 'scale5' ? '(1–2)' : q.type === 'nps' ? '(0–6)' : ''} — ismli so‘rovnomada xavf guruhiga</label>}
            </div>
          </div>
        ))}
        <div className="row"><button className="btn sm" onClick={() => setF({ ...f, questions: [...f.questions, blankQ()] })}>+ Savol</button></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={() => run(D.saveSurvey, { survey: f, userId: user.id }, 'So‘rovnoma saqlandi') && onDone()}>Saqlash</button>
        <span className="small muted">Standartga bog‘langan «Yo‘q» javoblari topshiriqlar doskasiga vazifa bo‘lib tushadi.</span>
      </div>
    </Panel>
  );
}

function Results({ s, sv, user }) {
  const [f, setF] = useState({ branch: '', position: '' });
  const r = D.surveyResults(s, sv.id, user, { branchId: f.branch, position: f.position });
  const [send, setSend] = useState({ branch: '', position: '' });
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="filter-row">
        <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{['GE', 'FIN', 'FR'].map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <span className="small muted">Yuborilgan: {r.sent} · javoblar: {r.n} · javob ulushi {r.sent >= r.n && r.sent ? P((100 * r.n) / r.sent) : '— (demo: tarixiy javoblar)'}</span>
      </div>
      {r.few ? <div className="callout small">Javoblar kam ({r.n} / {D.ANON_MIN}) — anonimlik uchun natija ko‘rsatilmaydi. U faqat yuqoriroq darajada (barcha filiallar yoki barcha lavozimlar) hisobga kiradi.</div> : (
        <table className="small"><tbody>{r.questions.map(({ q, n, summary }) => (
          <tr key={q.id}><td style={{ width: '55%' }}>{q.text}{q.standard !== null && q.standard !== undefined && <div className="muted">standart: {D.CHECKLIST_ITEMS[q.standard][1]}</div>}</td><td className="muted">{D.QUESTION_TYPES[q.type]} · {n}</td>
            <td>{q.type === 'yesno' ? <>Ha: <b>{P(summary.yes)}</b></> : q.type === 'scale5' ? <>o‘rtacha <b>{N1(summary.avg)}</b> / 5</> : q.type === 'nps' ? <>NPS <b>{summary.nps === null ? '—' : Math.round(summary.nps)}</b></> : q.type === 'text' ? summary.texts.slice(0, 3).map((t, i) => <div key={i}>«{t}»</div>) : summary.counts.filter(([, c]) => c).map(([o, c]) => <div key={o}>{o} — {c}</div>)}</td></tr>
        ))}</tbody></table>
      )}
      {sv.hrVisible && r.named.length > 0 && <div className="small"><b>Ismli javoblar:</b> {r.named.map((x) => `${D.getEmployee(s, x.employeeId || x.about)?.name || '—'} (${fmtDate(x.at)})`).join(', ')}</div>}
      {sv.trigger === 'manual' && (
        <div className="add-box panel row">
          <b className="small">Qo‘lda yuborish:</b>
          <select className="i compact" value={send.branch} onChange={(e) => setSend({ ...send, branch: e.target.value })}><option value="">Doiradagi barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="i compact" value={send.position} onChange={(e) => setSend({ ...send, position: e.target.value })}><option value="">Barcha lavozimlar</option>{['GE', 'FIN', 'FR'].map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <button className="btn sm primary" onClick={() => run(D.sendManualSurvey, { surveyId: sv.id, branchId: send.branch, position: send.position, userId: user.id }, 'Havola Telegram va platformada yuborildi')}>Yuborish</button>
        </div>
      )}
    </div>
  );
}

/** So'rovnoma konstruktori va natijalari (TZ 11-bo'lim). Google Forms ishlatilmaydi. */
export default function Surveys({ user }) {
  const s = useAppState();
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const manage = D.can(user, 'onb.surveys');
  const mine = (s.surveySends || []).filter((x) => x.to === user.name && !x.answeredAt);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>So‘rovnomalar</h1>
          <p>So‘rovnomalar RegUP’da yaratiladi. D8 va D30 — xodim onboarding doskasida shu ustunga o‘tganda, D60 — 60-kunda; Fail Case va exit-intervyu — ketish qayd etilganda (havola orqali, tizimga kirmasdan); rahbar so‘rovnomasi — filial rahbariga. Havola Telegram bot va platformada boradi.</p>
        </div>
        {manage && !edit && <button className="btn primary" onClick={() => setEdit('new')}>+ So‘rovnoma</button>}
      </div>
      {mine.length > 0 && <div className="callout small"><b>Siz uchun:</b> {mine.map((x) => <a key={x.id} href={`#/s/${x.id}`} style={{ marginRight: 10 }}>{(s.surveys.find((v) => v.id === x.surveyId) || {}).name}{x.about ? ` — ${D.getEmployee(s, x.about)?.name}` : ''}</a>)}</div>}
      {edit && <Editor key={edit} init={edit === 'new' ? null : s.surveys.find((x) => x.id === edit)} user={user} onDone={() => setEdit(null)} />}
      {(s.surveys || []).length ? (s.surveys || []).map((sv) => {
        const sent = (s.surveySends || []).filter((x) => x.surveyId === sv.id).length;
        const got = (s.surveyResponses || []).filter((x) => x.surveyId === sv.id).length;
        return (
          <Panel key={sv.id} title={<div><div className="row"><h2>{sv.name}</h2><Pill tone={sv.hrVisible ? 'warn' : 'teal'}>{sv.hrVisible ? 'ismli — HR ko‘radi' : 'anonim'}</Pill><Pill tone="muted">{D.SURVEY_TRIGGERS[sv.trigger]}</Pill></div><div className="muted small">{sv.questions.length} ta savol · yuborilgan {sent} · javob {got}</div></div>}
            actions={<div className="row" style={{ gap: 6 }}>{manage && <button className="btn sm" onClick={() => setEdit(sv.id)}>Tahrirlash</button>}<button className="btn sm" onClick={() => setOpen(open === sv.id ? null : sv.id)}>{open === sv.id ? 'Yopish' : 'Natijalar'}</button></div>}>
            {open === sv.id && <Results s={s} sv={sv} user={user} />}
          </Panel>
        );
      }) : <Empty>So‘rovnoma yo‘q.</Empty>}
    </>
  );
}
