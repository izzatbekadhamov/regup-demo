import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import SurveyForm from './SurveyForm.jsx';

/** Xodim: kutayotgan so'rovnomalar va topshiriqlar doskasidagi o'ziga tegishli vazifani tasdiqlash. */
export default function MySurveys({ emp }) {
  const s = useAppState();
  const [open, setOpen] = useState(null);
  const sends = (s.surveySends || []).filter((x) => x.employeeId === emp.id);
  const pending = sends.filter((x) => !x.answeredAt);
  const tasks = (s.boardTasks || []).filter((t) => t.employeeId === emp.id && t.status === 'confirm');
  return (
    <>
      <div className="page-head"><div><h1>So‘rovnomalarim</h1><p>Moslashuv bosqichlaridagi (D8, D30, D60) va boshqa so‘rovnomalar. Har birida javobingiz anonimmi yoki HR’ga ismingiz bilan ko‘rinishi oldindan yozilgan.</p></div></div>
      {tasks.map((t) => (
        <div key={t.id} className="callout row between"><span className="small"><b>{t.doneBy}</b> «{t.title.split(': ').slice(1).join(': ')}» bajarildi deb belgiladi{t.note ? ` — ${t.note}` : ''}. Rostdanmi?</span>
          <span className="row" style={{ gap: 6 }}><button className="btn sm primary" onClick={() => run(D.confirmBoardTask, { id: t.id, employeeId: emp.id, ok: true }, 'Tasdiqlandi')}>Ha, bajarildi</button><button className="btn sm" onClick={() => run(D.confirmBoardTask, { id: t.id, employeeId: emp.id, ok: false }, 'Vazifa qayta ochildi')}>Yo‘q</button></span></div>
      ))}
      {pending.length ? pending.map((x) => {
        const sv = s.surveys.find((v) => v.id === x.surveyId);
        return (
          <Panel key={x.id} title={<div><div className="row"><h2>{sv.name}</h2><Pill tone={sv.hrVisible ? 'warn' : 'teal'}>{sv.hrVisible ? 'ismli' : 'anonim'}</Pill></div><div className="muted small">yuborildi {fmtDate(x.at)} · Telegram va platforma</div></div>}
            actions={<button className="btn sm primary" onClick={() => setOpen(open === x.id ? null : x.id)}>{open === x.id ? 'Yopish' : 'To‘ldirish'}</button>}>
            {open === x.id && <SurveyForm sv={sv} onSubmit={(answers) => run(D.answerSurvey, { sendId: x.id, answers }, 'Rahmat! Javobingiz qabul qilindi') && setOpen(null)} />}
          </Panel>
        );
      }) : <Empty icon="check">Kutayotgan so‘rovnoma yo‘q.</Empty>}
      {sends.some((x) => x.answeredAt) && <div className="small muted">Javob berilgan: {sends.filter((x) => x.answeredAt).map((x) => `${s.surveys.find((v) => v.id === x.surveyId)?.name} (${fmtDate(x.answeredAt)})`).join(', ')}</div>}
    </>
  );
}
