import { useAppState, run } from '../state/store.js';
import { BrandMark, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import SurveyForm from './SurveyForm.jsx';

/** So'rovnoma havolasi (regup.uz/s/…): ketgan xodim va rahbar tizimga kirmasdan to'ldiradi. */
export default function SurveyLink({ id }) {
  const s = useAppState();
  const send = (s.surveySends || []).find((x) => x.id === id);
  const sv = send && (s.surveys || []).find((x) => x.id === send.surveyId);
  const about = send?.about ? D.getEmployee(s, send.about) : null;
  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}><BrandMark /><div><b>RegUP</b><div className="small muted">So‘rovnoma havolasi · ro‘yxatdan o‘tmasdan</div></div></div>
      {!send ? <Empty>Havola noto‘g‘ri yoki eskirgan.</Empty> : send.answeredAt ? <div className="panel panel-body"><b>Rahmat!</b> Javobingiz {fmtDate(send.answeredAt)} da qabul qilingan.</div> : (
        <div className="panel panel-body stack">
          <h1 style={{ margin: 0 }}>{sv.name}</h1>
          <div className="small muted">{send.to}{about ? ` · xodim: ${about.name} (${D.getBranch(s, about.branchId)?.name})` : ''}</div>
          <SurveyForm sv={sv} onSubmit={(answers) => run(D.answerSurvey, { sendId: send.id, answers }, 'Rahmat! Javobingiz qabul qilindi')} />
        </div>
      )}
      <div className="small muted" style={{ marginTop: 12 }}><a href="#/">Demo bosh sahifasiga</a></div>
    </div>
  );
}
