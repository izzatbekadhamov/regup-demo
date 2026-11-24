import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Pill, Empty, ask, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const POS = { GE: 'Ustoz (GE)', FIN: 'Moliya menejeri', FR: 'Filial rahbari', ADM: 'Markaz admini' };

function BoardCard({ s, ob, user }) {
  const emp = D.getEmployee(s, ob.employeeId);
  const col = D.boardColumn(s, ob);
  const day = D.onbDay(s, ob);
  const late = D.checkLate(s, ob);
  const mentor = emp.supervisorId ? D.getEmployee(s, emp.supervisorId)?.name : null;
  const since = (ob.boardLog || []).at(-1)?.at;
  const canMove = D.can(user, 'onb.board');
  const canCheck = D.can(user, 'onb.checkin') && !D.isSelf(user, emp.id);
  const which = col === 'check8' ? 'd8' : col === 'check30' ? 'd30' : null;
  return (
    <div className={`kcard ${late > D.CHECK_LATE_DAYS ? 'late' : ''} ${ob.leaving ? 'leaving' : ''}`}>
      <a href={`#/onboarding/${ob.id}`}><b>{emp.name}</b></a>
      <div className="kmeta">{POS[emp.position] || emp.position} · {emp.currentLevel}</div>
      <div className="kmeta">{D.getBranch(s, emp.branchId)?.name}{emp.departmentId ? ` · ${D.getDepartment(s, emp.departmentId)?.name || ''}` : ''}</div>
      <div className="kmeta">{emp.phone || '—'} · ish boshladi {fmtDate(ob.startedAt)}</div>
      <div className="kmeta">mentor: {mentor || <span style={{ color: 'var(--bad)' }}>biriktirilmagan</span>} · Telegram bot: {emp.profile?.telegram ? 'ulangan' : 'yo‘q'}</div>
      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <Pill tone="muted">{day}-kun</Pill>
        {since && <Pill tone="muted">ustunda {D.daysBetween(since, s.today)} kun</Pill>}
        {late > D.CHECK_LATE_DAYS && <Pill tone="bad">tasdiq {late} kun kechikdi</Pill>}
        {ob.boardMove && ob.boardMove.autoAt === D.boardAuto(s, ob) && <Pill tone="brand">qo‘lda</Pill>}
        {ob.imported && <Pill tone="teal">Jobster</Pill>}
        {ob.leaving && <Pill tone="bad">ketish kutilmoqda</Pill>}
      </div>
      {(ob.notes || []).slice(-1).map((n) => <div key={n.at + n.text} className="small" style={{ background: 'var(--warn-soft)', borderRadius: 6, padding: '3px 6px' }}>{n.text} <span className="muted">— {n.by}</span></div>)}
      {!ob.leaving && (
        <div className="kact">
          {which && canCheck && <>
            <button className="btn sm primary" onClick={() => run(D.confirmCheck, { id: ob.id, which, result: 'working', userId: user.id }, `${which.toUpperCase()}: ishlayapti`)}>Ishlayapti</button>
            <button className="btn sm danger" onClick={() => ask(`${emp.name} ketdimi? Sababi yoki izoh:`, (note) => run(D.confirmCheck, { id: ob.id, which, result: 'left', note, userId: user.id }, 'Ketdi deb belgilandi — HR’ga arxivlash vazifasi'), { input: true, ok: 'Ketdi' })}>Ketdi</button>
          </>}
          {canMove && <select className="i compact" value="" onChange={(e) => e.target.value && run(D.moveBoardCard, { id: ob.id, column: e.target.value, userId: user.id }, 'Karta ko‘chirildi')}>
            <option value="">Ko‘chirish…</option>{D.ONB_BOARD.filter(([k]) => k !== col).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>}
          {canMove && <button className="btn sm" onClick={() => ask('Izoh:', (t) => run(D.addBoardNote, { id: ob.id, text: t, userId: user.id }, 'Izoh qo‘shildi'), { input: true, ok: 'Saqlash' })}>Izoh</button>}
          {canMove && !which && <button className="btn sm" onClick={() => ask(`${emp.name} ishdan ketdimi? Izoh:`, (note) => run(D.markLeft, { id: ob.id, note, userId: user.id }, 'Ketdi deb belgilandi — HR’ga arxivlash vazifasi'), { input: true, ok: 'Ketdi' })}>Ketdi</button>}
        </div>
      )}
    </div>
  );
}

/** Onboarding doskasi — Jobster'dagi «Мониторинг Адаптации» o'rnini bosadi (TZ 5-bo'lim). */
export default function OnbBoard({ user }) {
  const s = useAppState();
  const [f, setF] = useState({ branch: '', position: '', mentor: '', q: '' });
  const items = D.boardItems(s, user).filter((ob) => {
    const e = D.getEmployee(s, ob.employeeId);
    return (!f.branch || e.branchId === f.branch) && (!f.position || e.position === f.position) && (!f.mentor || e.supervisorId === f.mentor)
      && (!f.q || `${e.name} ${e.phone || ''}`.toLowerCase().includes(f.q.toLowerCase()));
  });
  const due = D.dueSurveySends(s).filter((x) => D.inScope(s, user, x.emp));
  const left = (s.jobsterBoard || []).filter((r) => !r.imported);
  const mentors = [...new Set(s.employees.map((e) => e.supervisorId).filter(Boolean))].map((id) => D.getEmployee(s, id)).filter(Boolean);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Onboarding doskasi</h1>
          <p>Qabul qilingan xodim (Jobster’da «Принят») 60-kungacha shu doskada kuzatiladi. Karta ish boshlash sanasidan kunlar bo‘yicha avtomatik o‘tadi; «Tekshirish» ustunida filial rahbari «Ishlayapti» yoki «Ketdi» deb tasdiqlamaguncha keyingi ustunga o‘tmaydi. «Onboarding doskasini yuritish» huquqi bor admin kartani qo‘lda ko‘chiradi va izoh qo‘shadi — har ko‘chirish jurnalga yoziladi.</p>
        </div>
      </div>
      {(left.length > 0 && D.can(user, 'onb.integration')) && <div className="callout row between"><span className="small"><b>Jobster’dan o‘tish:</b> «Мониторинг Адаптации» doskasida {left.length} ta jarayondagi xodim (demo namunasi; haqiqiy ~204) — ustuni, sanalari va izohlari bilan import qilinadi, «Department» ustunidagilar «Начальный»ga tushadi.</span><button className="btn primary sm" onClick={() => run(D.importJobsterBoard, { userId: user.id }, `${left.length} ta xodim import qilindi`)}>Import qilish</button></div>}
      {due.length > 0 && <div className="callout row between"><span className="small"><b>So‘rovnomalar:</b> {due.length} ta xodim bosqichga yetdi — {due.map((x) => `${x.emp.name} (${x.sv.name.split(' —')[0]})`).join(', ')}.</span><button className="btn sm" onClick={() => run(D.sendDueSurveys, {}, 'So‘rovnomalar Telegram va platformada yuborildi')}>Yuborish</button></div>}
      <div className="filter-row">
        <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{Object.entries(POS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="i compact" value={f.mentor} onChange={(e) => setF({ ...f, mentor: e.target.value })}><option value="">Barcha mentorlar</option>{mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input className="i compact" placeholder="Ism yoki telefon" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <span className="small muted">{items.length} ta xodim · {D.scopeText(s, user.scope)}</span>
      </div>
      {items.length ? (
        <div className="kanban">
          {D.ONB_BOARD.map(([k, l, hint]) => {
            const list = items.filter((ob) => D.boardColumn(s, ob) === k);
            return (
              <div key={k} className="kcol">
                <div className={`kcol-head ${k.startsWith('check') ? 'check' : ''}`}><div><b className="small">{l}</b><br /><small>{hint}</small></div><Pill tone="muted">{list.length}</Pill></div>
                {list.map((ob) => <BoardCard key={ob.id} s={s} ob={ob} user={user} />)}
              </div>
            );
          })}
        </div>
      ) : <Empty>Doskada xodim yo‘q.</Empty>}
    </>
  );
}
