import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, fmtDate, Person, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';
import { SUCCESSION_STATUS, SUCCESSION_VIA, SUCCESSION_ORDER } from '../ui/labels.js';
import { fmtPct, isNum } from '../core/calc.js';

/** Lavozim kodi bo'yicha faol model va profil. */
function findPosition(s, code) {
  for (const m of s.models.filter((x) => x.status === 'active')) {
    const p = m.profiles.find((x) => x.code === code);
    if (p) return { model: m, profile: p };
  }
  return null;
}

function Near({ v }) {
  return (
    <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
      <div className="near-bar" style={{ minWidth: 80 }}><i style={{ width: `${v}%`, background: v >= 100 ? 'var(--good)' : undefined }} /></div>
      <b className="small" style={{ minWidth: 36, textAlign: 'right' }}>{fmtPct(v, 0)}</b>
    </div>
  );
}

const STAGE_HINT = {
  interested: 'Xodim o‘zi qiziqish bildirgan, hali reja yo‘q',
  developing: 'Kurs va rivojlanish rejasi bo‘yicha o‘qiyapti',
  trial: 'Keyingi lavozim ko‘lamida stretch vazifa bajaryapti',
  assessed: 'Baholash kartasi yopilgan',
  reserve: 'Tayyor — o‘rin bo‘shasa tayinlanadi (faqat «tayyor» baholash bilan)',
};

/** 5 bosqichli chiziq: nomzod qaysi bosqichda ekani bir qarashda. */
function Stage({ status }) {
  const idx = status === 'appointed' ? SUCCESSION_ORDER.length : SUCCESSION_ORDER.indexOf(status);
  return (
    <div>
      <div className="stage-track" title={SUCCESSION_ORDER.map((k) => SUCCESSION_STATUS[k][0]).join(' → ')}>
        {SUCCESSION_ORDER.map((k, i) => <i key={k} className={i < idx ? 'done' : i === idx ? 'cur' : ''} />)}
      </div>
      <div className="small" style={{ fontWeight: 650, marginTop: 4 }}>{SUCCESSION_STATUS[status][0]}</div>
    </div>
  );
}

function Row({ r, s }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ status: r.status, reason: '' });
  const e = D.getEmployee(s, r.employeeId);
  const pos = findPosition(s, r.target);
  const ready = pos ? D.positionReadiness(s, e, pos.model, pos.profile) : null;
  const card = s.cards.filter((c) => c.employeeId === r.employeeId && c.profileTo === r.target)[0];
  const d = card ? D.cardDecision(s, card) : null;
  const interest = s.interests.find((x) => x.employeeId === r.employeeId && x.target === r.target);
  const via = SUCCESSION_VIA[r.via || (interest ? 'interest' : 'hr')];
  return (
    <>
      <tr>
        <td><Person name={e.name} sub={`${e.currentLevel} ${positionName(s.models, e.currentLevel)} · ${D.getBranch(s, e.branchId)?.name}`} /></td>
        <td>
          <b>{r.target}</b> <span className="muted small">{pos?.profile.name}</span>
          <div className="small muted" style={{ marginTop: 3 }} title={interest?.note}>{via[0]} · {fmtDate(r.addedAt || interest?.at)}</div>
        </td>
        <td>
          {ready ? <><Near v={ready.near} /><div className="muted small">{ready.met} / {ready.total} talab bajarilgan</div></> : '—'}
          {d && <a className="small" href={`#/cards/${card.id}`} style={{ display: 'block', marginTop: 3 }}>Baholash: {d.label.toLowerCase()}{card.stage !== 'published' ? ' (jarayonda)' : ''} →</a>}
        </td>
        <td><Stage status={r.status} />{r.decision && <div className="muted small" title={r.decision.reason}>{r.decision.by}: {r.decision.reason.length > 40 ? `${r.decision.reason.slice(0, 40)}…` : r.decision.reason}</div>}</td>
        <td className="small">
          <div>{r.next || '—'}</div>
          <div className="muted">Mas’ul: {r.owner}</div>
          {!edit && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setEdit(true)}>Bosqichni o‘zgartirish</button>}
        </td>
      </tr>
      {edit && (
        <tr className="edit-row"><td colSpan={5}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="small ink2">Ko‘p bosqich o‘zi almashadi (stretch biriktirilsa, baholash yopilsa). Bu yerda HR o‘z qarori bilan bosqichni qo‘lda o‘zgartiradi — sabab jurnalga yoziladi.</div>
            <div className="row">
              <select className="i compact" value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value })}>
                {SUCCESSION_ORDER.map((k) => <option key={k} value={k}>{SUCCESSION_STATUS[k][0]}</option>)}
              </select>
              <span className="small muted">{STAGE_HINT[f.status]}</span>
            </div>
            <div className="row">
              <input className="i" style={{ flex: 1 }} placeholder="Sabab (majburiy), masalan: mentor bilan ishlay boshladi" value={f.reason} onChange={(ev) => setF({ ...f, reason: ev.target.value })} />
              <button className="btn primary sm" disabled={!f.reason.trim()} onClick={() => run(D.setSuccessionStatus, { id: r.id, ...f }, 'Bosqich yangilandi') && setEdit(false)}>Saqlash</button>
              <button className="btn sm" onClick={() => setEdit(false)}>Bekor qilish</button>
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}

function BestFit({ s, pos, region }) {
  const all = D.candidatesFor(s, pos.model.modelId, pos.profile.code).filter((c) => c.eligible && (!region || D.getBranch(s, c.emp.branchId)?.region === region));
  const top = all.slice(0, 5);
  const link = `#/candidates/${encodeURIComponent(`${pos.model.modelId}|${pos.profile.code}`)}`;
  return (
    <Panel tight title={<div><h2>{pos.profile.code} — {pos.profile.name}: eng mos xodimlar</h2><div className="muted small">Barcha xodimlar orasidan, vorislik ro‘yxatida bormi-yo‘qligidan qat’i nazar — o‘tish sharti mos va tasdiqlangan tayyorligi eng yuqori.</div></div>}
      actions={<a className="btn sm" href={link}>Barcha nomzodlar — Nomzod tanlash →</a>}>
      {top.length ? (
        <table>
          <thead><tr><th className="num">#</th><th>Xodim</th><th>Joriy lavozim</th><th style={{ minWidth: 180 }}>Tayyorlik</th><th className="num">Talablar</th><th>Vorislik ro‘yxatida</th><th /></tr></thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={c.emp.id}>
                <td className="num"><b>{i + 1}</b></td>
                <td><Person name={c.emp.name} sub={D.getBranch(s, c.emp.branchId)?.name} /></td>
                <td>{c.emp.currentLevel}<div className="muted small">{positionName(s.models, c.emp.currentLevel)}</div></td>
                <td><Near v={c.near} /></td>
                <td className="num"><b>{c.met}</b> / {c.total}</td>
                <td>{c.succession ? <Pill tone={SUCCESSION_STATUS[c.succession.status][1]}>{SUCCESSION_STATUS[c.succession.status][0]}</Pill> : <span className="muted small">yo‘q{c.interest ? ' · qiziqish bor' : ''}</span>}</td>
                <td className="num">
                  {c.complete ? <a className="btn sm primary" href={link}>100% tayyor →</a>
                    : c.succession?.status === 'developing' ? <span className="muted small">tayyorlanmoqda</span>
                    : <button className="btn sm" onClick={() => run(D.startPreparation, { employeeId: c.emp.id, modelId: pos.model.modelId, profileCode: pos.profile.code }, `${c.emp.name}: tayyorlash rejasi yaratildi va vorislik ro‘yxatiga qo‘shildi`)}>Tayyorlashni boshlash</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>Bu lavozimga o‘tish shartiga mos xodim yo‘q{region ? ' (tanlangan mintaqada)' : ''}.</Empty>}
    </Panel>
  );
}

export default function Succession() {
  const s = useAppState();
  const [flt, setFlt] = useState({ target: '', status: '', region: '' });
  const rows = s.succession.filter((r) => {
    const e = D.getEmployee(s, r.employeeId);
    return (!flt.target || r.target === flt.target) && (!flt.status || r.status === flt.status) && (!flt.region || D.getBranch(s, e.branchId)?.region === flt.region);
  });
  const pos = flt.target ? findPosition(s, flt.target) : null;
  const actives = s.models.filter((m) => m.status === 'active');
    return (
    <>
      <div className="page-head">
        <div>
          <h1>Vorislik va kadrlar zaxirasi</h1>
          <p>Biror lavozimga nomzod bo‘lgan xodimlar va ular qaysi bosqichda ekani.</p>
        </div>
        <div className="row">
          <select className="i compact" value={flt.region} onChange={(e) => setFlt({ ...flt, region: e.target.value })}><option value="">Barcha mintaqalar</option>{[...new Set(s.branches.map((b) => b.region))].map((r) => <option key={r}>{r}</option>)}</select>
          <select className="i compact" value={flt.target} onChange={(e) => setFlt({ ...flt, target: e.target.value })}>
            <option value="">Barcha lavozimlar</option>
            {actives.map((m) => <optgroup key={m.modelId} label={m.name}>{m.profiles.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}</optgroup>)}
          </select>
          <select className="i compact" value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">Barcha bosqichlar</option>{Object.entries(SUCCESSION_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
      </div>

      <div className="callout small">
        Ro‘yxatga xodim uch yo‘l bilan tushadi: <b>o‘zi qiziqish bildirsa</b>, <b>HR tayyorlashni boshlasa</b> yoki <b>baholash «tayyor» chiqsa</b>. Barcha xodimlarni lavozimga solishtirish — <a href="#/candidates">Nomzod tanlash</a>.
      </div>

      {pos ? <BestFit s={s} pos={pos} region={flt.region} /> : (
        <div className="muted small">Yuqorida lavozimni tanlang — unga barcha xodimlar orasidan eng mos nomzodlar shu yerda chiqadi.</div>
      )}

      <Panel tight title={<div className="row"><h2>Vorislik ro‘yxati</h2><span className="muted small">{rows.length} ta yozuv</span></div>}>
        {rows.length ? (
          <table>
            <thead><tr><th>Xodim</th><th>Maqsadli lavozim</th><th style={{ minWidth: 170 }}>Tayyorlik</th><th style={{ minWidth: 150 }}>Bosqich</th><th>Keyingi qadam</th></tr></thead>
            <tbody>{rows.map((r) => <Row key={r.id} r={r} s={s} />)}</tbody>
          </table>
        ) : <Empty>Bu filtr bo‘yicha vorislik ro‘yxatida hech kim yo‘q{pos ? ' — yuqoridagi eng mos xodimlardan tayyorlashni boshlashingiz mumkin' : ''}.</Empty>}
        <div className="panel-body small ink2"><b>Tayyorlik</b> — tasdiqlangan dalillar bo‘yicha maqsadli lavozim talablariga moslik. <b>Bosqich</b>: qiziqish → rivojlanmoqda → amaliy sinov → baholangan → kadrlar zaxirasi.</div>
      </Panel>
    </>
  );
}
