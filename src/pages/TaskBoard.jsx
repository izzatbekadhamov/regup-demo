import { useAppState, run } from '../state/store.js';
import { Pill, Empty, ask, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

/** Topshiriqlar doskasi: SOP standartlari (so'rovnomalardagi «Yo'q») va offboarding vazifalari (TZ 11-bo'lim). */
export default function TaskBoard({ user }) {
  const s = useAppState();
  const list = (s.boardTasks || []).filter((t) => D.canSeeTask(s, user, t));
  const cols = [['new', 'Yangi', list.filter((t) => t.status === 'new')], ['confirm', 'Xodim tasdig‘i kutilmoqda', list.filter((t) => t.status === 'confirm')], ['done', 'Bajarildi', list.filter((t) => t.status === 'done')]];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Topshiriqlar doskasi</h1>
          <p>Ismli so‘rovnomada standartga «Yo‘q» javobi — mas’ulga xodim nomi bilan vazifa; anonim so‘rovnomada — filial bo‘yicha nomsiz vazifa (filialda kamida {D.ANON_MIN} ta javob bo‘lsa). Offboarding vazifalari (EduTizim’da arxivlash, xayrlashish va exit-intervyu) ham shu yerda. Ismli vazifa xodim tasdiqlagach yopiladi.</p>
        </div>
      </div>
      {list.length ? (
        <div className="kanban">
          {cols.map(([k, l, items]) => (
            <div key={k} className="kcol" style={{ flexBasis: 330 }}>
              <div className="kcol-head"><b className="small">{l}</b><Pill tone="muted">{items.length}</Pill></div>
              {items.map((t) => (
                <div key={t.id} className="kcard">
                  <b>{t.title}</b>
                  <div className="kmeta">{D.TASK_SOURCE[t.source]} · {D.getBranch(s, t.branchId)?.name} · mas’ul: {t.assignee}</div>
                  <div className="kmeta">yaratildi {fmtDate(t.createdAt)}{t.doneAt ? ` · bajarildi ${fmtDate(t.doneAt)} (${t.doneBy})` : ''}</div>
                  {t.note && <div className="small">Izoh: {t.note}</div>}
                  {t.status === 'new' && <div className="kact"><button className="btn sm primary" onClick={() => ask('Nima qilindi? (izoh)', (note) => run(D.completeBoardTask, { id: t.id, note, userId: user.id }, t.employeeId ? 'Belgilandi — xodim tasdig‘i kutilmoqda' : 'Bajarildi'), { input: true, ok: 'Bajarildi' })}>Bajarildi</button></div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : <Empty icon="check">Doirangizda vazifa yo‘q.</Empty>}
    </>
  );
}
