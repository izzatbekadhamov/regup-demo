import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { competencyLibrary, positionName } from '../core/modelKit.js';

/** Daraja nuqtalari: ●●○. Tasdiqlangan — to'liq rang, o'zi belgilagan — och. */
export function SkillDots({ level, status, title }) {
  return (
    <span className={`skill-dots ${status === 'confirmed' ? 'ok' : 'self'}`} title={title || `${D.SKILL_LEVELS[level]?.[0] || ''} · ${status === 'confirmed' ? 'tasdiqlangan' : 'o‘zi belgilagan'}`}>
      {[1, 2, 3].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
    </span>
  );
}

export function SkillStatus({ r }) {
  if (!r) return null;
  return (
    <>
      {r.status === 'confirmed' ? <Pill tone="good">tasdiqlangan</Pill> : <Pill tone="muted">o‘zi belgilagan</Pill>}
      {r.claim && <> <Pill tone="warn">{r.claim.level}-daraja tasdiqlashda</Pill></>}
    </>
  );
}

export function Supports({ s, skill }) {
  const lib = competencyLibrary(s.models);
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      {skill.supports.map((c) => <span key={c} className="pos-chip" title={lib.find((k) => k.code === c)?.name}><b>{c}</b> {lib.find((k) => k.code === c)?.name}</span>)}
    </span>
  );
}

function Matrix({ s }) {
  const [group, setGroup] = useState('ai');
  const [who, setWho] = useState('');
  const skills = s.skillCatalog.filter((k) => k.group === group);
  const emps = D.activeEmployees(s);
  const whoSkill = who ? D.getSkill(s, who) : null;
  const holders = who ? s.empSkills.filter((x) => x.skillId === who).sort((a, b) => (b.status === 'confirmed') - (a.status === 'confirmed') || b.level - a.level) : [];
  return (
    <div className="stack">
      <Panel title="Kim biladi?" actions={
        <select className="i compact" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Ko‘nikmani tanlang</option>
          {Object.entries(D.SKILL_GROUPS).map(([g, l]) => <optgroup key={g} label={l}>{s.skillCatalog.filter((k) => k.group === g).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</optgroup>)}
        </select>
      }>
        {!who ? <p className="small muted">Masalan, «Miro» yoki «AI yordamchilar»ni tanlang — kim qaysi darajada bilishi, tasdiqlanganmi yoki o‘zi belgilaganmi, ko‘rinadi. Loyiha jamoasi yoki ichki trener topishda qulay.</p> : (
          holders.length ? (
            <div className="stack" style={{ gap: 6 }}>
              <div className="small ink2">{whoSkill.description}</div>
              {holders.map((r) => {
                const e = D.getEmployee(s, r.employeeId);
                return (
                  <div key={r.id} className="row between idp-row" style={{ padding: '8px 10px' }}>
                    <Person name={e.name} sub={`${positionName(s.models, e.currentLevel)} · ${D.getBranch(s, e.branchId)?.name}`} />
                    <div className="row"><SkillDots level={r.level} status={r.status} /><b className="small">{D.SKILL_LEVELS[r.level][0]}</b><SkillStatus r={r} /></div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>Hech kim bu ko‘nikmani belgilamagan.</Empty>
        )}
      </Panel>
      <Panel tight title={<div className="row"><h2>Ko‘nikmalar matritsasi</h2><span className="skill-dots ok"><i className="on" /><i className="on" /><i /></span><span className="muted small">tasdiqlangan</span><span className="skill-dots self"><i className="on" /><i className="on" /><i /></span><span className="muted small">o‘zi belgilagan</span></div>} actions={
        <div className="tabs" style={{ margin: 0 }}>{Object.entries(D.SKILL_GROUPS).map(([g, l]) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{l}</button>)}</div>
      }>
        <table>
          <thead><tr><th>Xodim</th>{skills.map((k) => <th key={k.id} className="small" style={{ maxWidth: 130, whiteSpace: 'normal' }}>{k.name}</th>)}</tr></thead>
          <tbody>{emps.map((e) => (
            <tr key={e.id}>
              <td><Person name={e.name} sub={positionName(s.models, e.currentLevel)} /></td>
              {skills.map((k) => {
                const r = D.empSkill(s, e.id, k.id);
                return <td key={k.id}>{r ? <><SkillDots level={r.level} status={r.status} /> <span className="small ink2">{D.SKILL_LEVELS[r.level][0]}</span>{r.claim && <span className="small" style={{ color: 'var(--warn)', marginLeft: 4 }} title="Tasdiqlashda">●</span>}</> : <span className="muted small">—</span>}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </Panel>
    </div>
  );
}

function Catalog({ s }) {
  const [f, setF] = useState(null);
  const lib = competencyLibrary(s.models);
  return (
    <div className="stack">
      {f ? (
        <Panel title="Yangi ko‘nikma" actions={<button className="btn sm" onClick={() => setF(null)}>Yopish</button>}>
          <div className="stack">
            <div className="row">
              <label className="f" style={{ flex: 2 }}>Nomi<input className="i" placeholder="Masalan: Notion, Figma, Telegram bot" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label className="f" style={{ flex: 1 }}>Guruh<select className="i" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>{Object.entries(D.SKILL_GROUPS).map(([g, l]) => <option key={g} value={g}>{l}</option>)}</select></label>
            </div>
            <label className="f">Qisqa tavsif<input className="i" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
            <label className="f">Qaysi kompetensiyani to‘ldiradi (ixtiyoriy)
              <select className="i" multiple style={{ height: 120 }} value={f.supports} onChange={(e) => setF({ ...f, supports: [...e.target.selectedOptions].map((o) => o.value) })}>
                {lib.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </label>
            <div className="row"><button className="btn primary" disabled={!f.name.trim()} onClick={() => run(D.createSkill, f, 'Ko‘nikma katalogga qo‘shildi') && setF(null)}>Qo‘shish</button><span className="small muted">Cmd/Ctrl bilan bir nechtasini tanlash mumkin.</span></div>
          </div>
        </Panel>
      ) : <div><button className="btn primary" onClick={() => setF({ name: '', group: 'ai', description: '', supports: [] })}>+ Yangi ko‘nikma</button></div>}
      {Object.entries(D.SKILL_GROUPS).map(([g, l]) => (
        <Panel key={g} tight title={<h2>{l}</h2>}>
          <table><tbody>{s.skillCatalog.filter((k) => k.group === g).map((k) => {
            const n = s.empSkills.filter((x) => x.skillId === k.id);
            const courses = s.courses.filter((c) => (c.skills || []).some((x) => x.skillId === k.id));
            return (
              <tr key={k.id}>
                <td style={{ width: '34%' }}><b>{k.name}</b><div className="muted small">{k.description}</div></td>
                <td><div className="small muted">To‘ldiradi:</div><Supports s={s} skill={k} /></td>
                <td className="small">{courses.length ? courses.map((c) => <div key={c.id}>Kurs: <a href={`#/courses/${c.id}`}>{c.title}</a></div>) : <span className="muted">kurs yo‘q</span>}</td>
                <td className="num small"><b>{n.filter((x) => x.status === 'confirmed').length}</b> tasdiqlangan<div className="muted">{n.filter((x) => x.status !== 'confirmed').length} o‘zi belgilagan</div></td>
              </tr>
            );
          })}</tbody></table>
        </Panel>
      ))}
    </div>
  );
}

function Profiles({ s }) {
  const [add, setAdd] = useState({});
  const actives = s.models.filter((m) => m.status === 'active');
  return (
    <div className="stack">
      <div className="callout small">Lavozim uchun <b>tavsiya etilgan</b> ko‘nikmalar. Ular majburiy talab emas va lavozimga moslik foiziga kirmaydi — xodim «Ko‘nikmalarim»da nima o‘rganish foydali ekanini ko‘radi.</div>
      {actives.map((m) => (
        <Panel key={m.modelId} tight title={<h2>{m.name}</h2>}>
          <table><tbody>{m.profiles.map((p) => {
            const list = D.skillProfile(s, p.code);
            const a = add[p.code] || { skillId: '', level: '2' };
            return (
              <tr key={p.code}>
                <td style={{ width: 210 }}><b>{p.code}</b><div className="muted small">{p.name}</div></td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {list.map((x) => (
                      <span key={x.skillId} className="pos-chip">{D.getSkill(s, x.skillId)?.name} · {D.SKILL_LEVELS[x.level][0]}
                        <button className="chip-x" title="Olib tashlash" onClick={() => run(D.setSkillProfile, { profileCode: p.code, skillId: x.skillId, level: null }, 'Olib tashlandi')}>×</button>
                      </span>
                    ))}
                    {!list.length && <span className="muted small">tavsiya yo‘q</span>}
                  </div>
                </td>
                <td className="num">
                  <div className="row" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                    <select className="i compact" value={a.skillId} onChange={(e) => setAdd({ ...add, [p.code]: { ...a, skillId: e.target.value } })}>
                      <option value="">+ ko‘nikma</option>
                      {s.skillCatalog.filter((k) => !list.some((x) => x.skillId === k.id)).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                    <select className="i compact" value={a.level} onChange={(e) => setAdd({ ...add, [p.code]: { ...a, level: e.target.value } })}>{[1, 2, 3].map((l) => <option key={l} value={l}>{D.SKILL_LEVELS[l][0]}</option>)}</select>
                    <button className="btn sm" disabled={!a.skillId} onClick={() => run(D.setSkillProfile, { profileCode: p.code, ...a }, 'Tavsiya qo‘shildi') && setAdd({ ...add, [p.code]: null })}>Qo‘shish</button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody></table>
        </Panel>
      ))}
    </div>
  );
}

function ReviewRow({ s, r }) {
  const [f, setF] = useState({ level: String(r.claim.level), note: '', by: 'Mentor' });
  const e = D.getEmployee(s, r.employeeId);
  const k = D.getSkill(s, r.skillId);
  return (
    <div className="idp-row">
      <div className="row between">
        <Person name={e.name} sub={`${positionName(s.models, e.currentLevel)} · yuborilgan ${fmtDate(r.claim.at)}`} />
        <div className="row"><b>{k.name}</b>{r.status === 'confirmed' || r.level ? <span className="small muted">hozir: {D.SKILL_LEVELS[r.level][0]} ({r.status === 'confirmed' ? 'tasdiqlangan' : 'o‘zi belgilagan'}) →</span> : null}<Pill tone="warn">{D.SKILL_LEVELS[r.claim.level][0]}</Pill></div>
      </div>
      <div className="callout small"><b>Dalil:</b> {r.claim.evidence}{r.claim.link && <div className="code" style={{ marginTop: 4 }}>{r.claim.link}</div>}</div>
      <div className="small muted">{D.SKILL_LEVELS[r.claim.level][0]} daraja: {D.SKILL_LEVELS[r.claim.level][1]}</div>
      <div className="row">
        <label className="f">Kim tasdiqlaydi<input className="i compact" style={{ width: 160 }} value={f.by} onChange={(ev) => setF({ ...f, by: ev.target.value })} /></label>
        <label className="f">Daraja<select className="i compact" value={f.level} onChange={(ev) => setF({ ...f, level: ev.target.value })}>{Array.from({ length: r.claim.level }, (_, i) => r.claim.level - i).map((l) => <option key={l} value={l}>{D.SKILL_LEVELS[l][0]}</option>)}</select></label>
        <label className="f" style={{ flex: 1, minWidth: 220 }}>Izoh<input className="i" placeholder="Nimani ko‘rdingiz" value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></label>
      </div>
      <div className="row">
        <button className="btn primary sm" disabled={!f.note.trim()} onClick={() => run(D.reviewSkill, { id: r.id, decision: 'confirmed', ...f }, 'Ko‘nikma tasdiqlandi')}>Tasdiqlash</button>
        <button className="btn danger sm" disabled={!f.note.trim()} onClick={() => run(D.reviewSkill, { id: r.id, decision: 'rejected', ...f }, 'Qaytarildi')}>Tasdiqlamaslik</button>
      </div>
    </div>
  );
}

export default function Skills() {
  const s = useAppState();
  const pending = s.empSkills.filter((x) => x.claim);
  const [tab, setTab] = useState(pending.length ? 'review' : 'matrix');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ko‘nikmalar</h1>
          <p>Aniq vosita va texnologiyalarni bilish: AI, Miro, Excel, CRM, LMS. Bu kompetensiya modelidan alohida — kompetensiyani to‘ldiradi (masalan, «AI yordamchilar» → FUN-07 Raqamli savodxonlik), lekin lavozimga moslik foiziga kirmaydi.</p>
        </div>
      </div>
      <div className="tabs">
        {[['matrix', 'Kim nimani biladi'], ['review', 'Tasdiqlash'], ['catalog', `Katalog (${s.skillCatalog.length})`], ['profiles', 'Lavozim bo‘yicha tavsiya']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'review' && pending.length > 0 && <span className="tab-n bad">{pending.length}</span>}</button>
        ))}
      </div>
      {tab === 'matrix' && <Matrix s={s} />}
      {tab === 'review' && <Panel title="Dalil bilan yuborilgan ko‘nikmalar">{pending.length ? <div className="stack" style={{ gap: 12 }}>{pending.map((r) => <ReviewRow key={r.id} s={s} r={r} />)}</div> : <Empty icon="check">Tasdiqlanadigan ko‘nikma yo‘q.</Empty>}</Panel>}
      {tab === 'catalog' && <Catalog s={s} />}
      {tab === 'profiles' && <Profiles s={s} />}
    </>
  );
}
