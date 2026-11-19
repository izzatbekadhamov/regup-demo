import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Stepper, ScoreText, ScoreChip, Conditions, Empty, Avatar, Icon, fmtDate, Gauge } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { fmtPct, fmtNum, isNum, minIntegerForThreshold, weightedLevel } from '../core/calc.js';
import { CATALOG, STAGE_LABELS } from '../data/models.js';
import { scaleLevels, scaleMax, levelName, methodLabel, compMethods, compositeParts, observationMethods, scoringMode, profileConditions } from '../core/modelKit.js';
import { IDP_STATUS } from '../ui/labels.js';

const parseLevel = (v) => (v === 'DE' || v === 'NA' ? v : v === '' ? null : Number(v));

function Rubric({ model, comp, target, selected, onSelect }) {
  return (
    <div className="rubric">
      {scaleLevels(model).map((l) => (
        <button type="button" key={l} disabled={!onSelect} onClick={() => onSelect?.(l)}
          className={`lvl ${onSelect ? 'pickable' : ''} ${selected === l ? 'sel' : l === target ? 'target' : ''}`}>
          <b>{l}</b>
          <div>
            <div className="lvl-name">{levelName(model, l)}{l === target && <Pill tone="brand">maqsad</Pill>}{selected === l && <Pill tone="good">tanlangan</Pill>}</div>
            {comp.levels?.[l] || <span className="muted">Indikator kiritilmagan</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function PartsBlock({ card, model, comp, editable }) {
  const parts = compositeParts(model, comp.code);
  const def = model.composites[comp.code];
  return (
    <div className="stack">
      <h3>{comp.code} tarkibi: {parts.length} ta yo‘nalish ({def.label})</h3>
      <table>
        <thead><tr><th>ID</th><th>Yo‘nalish</th><th>Baho</th></tr></thead>
        <tbody>
          {parts.map((h) => (
            <tr key={h.code}>
              <td className="code">{h.code}</td>
              <td>{h.name}{h.definition && <div className="muted small">{h.definition.slice(0, 140)}…</div>}</td>
              <td>
                {editable ? (
                  <select className="i compact" value={card.hrScores[h.code] ?? ''} onChange={(e) => run(D.setHrScore, { cardId: card.id, hrCode: h.code, value: e.target.value === '' ? null : e.target.value === 'DE' ? 'DE' : Number(e.target.value) })}>
                    <option value="">—</option>
                    {scaleLevels(model).map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="DE">DE</option>
                  </select>
                ) : (
                  <ScoreText v={card.hrScores[h.code]} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompetencyEditor({ card, model, comp, target, editable }) {
  const entry = card.scores[comp.code] || { evidences: [] };
  const [final, setFinal] = useState(entry.final === null || entry.final === undefined ? '' : String(entry.final));
  const [basis, setBasis] = useState(entry.basis || '');
  const methods = compMethods(model, comp);
  const [ev, setEv] = useState({ method: methods[0], value: '', note: '', sourceId: '' });
  const [showEv, setShowEv] = useState(false);
  // Savollar va audit bandlari: kompetensiyaning o'zida bo'lsa — o'sha, aks holda FR pilot katalogidan (faqat FR modeli uchun).
  const isFr = model.modelId === 'FR';
  const questions = comp.questions || (isFr ? CATALOG.questions[comp.code] : null) || [];
  const audits = isFr ? CATALOG.audit.filter((a) => a.competency === comp.code) : [];
  const evs = entry.evidences || [];
  const weighted = scoringMode(model) === 'weighted' ? weightedLevel(evs, model.scoring.weights || {}, scaleMax(model)) : null;
  const picked = parseLevel(final);

  if (comp.composite) return <div className="expand"><PartsBlock card={card} model={model} comp={comp} editable={editable} /></div>;

  const save = () => run(D.setScore, { cardId: card.id, code: comp.code, final: picked, basis, expectedRevision: card.revision }, `${comp.code}: daraja saqlandi`);
  return (
    <div className="expand">
      {comp.definition && <p className="small ink2">{comp.definition}</p>}
      <div className="editor-grid">
        <div className="stack">
          <h3>{editable ? '1. Dalilga mos darajani tanlang' : 'Rubrika'}</h3>
          <Rubric model={model} comp={comp} target={target} selected={isNum(picked) ? picked : null} onSelect={editable ? (l) => setFinal(String(l)) : null} />
        </div>
        <div className="stack">
          {editable ? (
            <div className="decide">
              <h3>2. Asosni yozing va saqlang</h3>
              <div className="row">
                <span className="small ink2">Tanlangan:</span>
                {isNum(picked) ? <span className="score ok">{picked}</span> : picked ? <ScoreText v={picked} /> : <span className="muted small">daraja tanlanmagan</span>}
                <span style={{ flex: 1 }} />
                <button type="button" className={`btn sm ${final === 'DE' ? 'on' : ''}`} onClick={() => setFinal('DE')} title="Daraja aniqlash uchun dalil yetarli emas">Dalil yetarli emas</button>
                <button type="button" className={`btn sm ${final === 'NA' ? 'on' : ''}`} onClick={() => setFinal('NA')}>Qo‘llanmaydi</button>
              </div>
              {weighted?.value && <div className="callout small">Tizim taklifi (usul vaznlari bo‘yicha): <b>{weighted.value}</b>{weighted.missing.length > 0 && ` · dalili yo‘q: ${weighted.missing.map((m) => methodLabel(model, m)).join(', ')}`} <button className="link-btn" onClick={() => setFinal(String(weighted.value))}>qo‘llash</button></div>}
              <textarea className="i" placeholder={final === 'DE' ? 'Nega dalil yetarli emas va qanday qo‘shimcha dalil kerak?' : 'Qaysi xatti-harakat qaysi dalilda ko‘rindi?'} value={basis} onChange={(e) => setBasis(e.target.value)} />
              <div className="row">
                <button className="btn primary" disabled={!final || !basis.trim()} onClick={save}>Saqlash</button>
                {(!final || !basis.trim()) && <span className="muted small">{!final ? 'Avval darajani tanlang' : 'Asos yozing'}</span>}
                {entry.by && final && basis.trim() && <span className="muted small">Oxirgi saqlash: {entry.by}, {fmtDate(entry.at)}</span>}
              </div>
            </div>
          ) : (
            <div className="decide">
              <h3>Yakuniy daraja</h3>
              <p className="small"><ScoreText v={entry.final} /> — {entry.basis || <span className="muted">asos yo‘q</span>}</p>
            </div>
          )}
          <div className="row between">
            <h3>Dalillar ({evs.length})</h3>
            {editable && <button className="btn sm" onClick={() => setShowEv(!showEv)}>{showEv ? 'Yopish' : '+ Dalil qo‘shish'}</button>}
          </div>
          {editable && showEv && (
            <div className="panel add-box">
              <div className="grid g2" style={{ gap: 8 }}>
                <label className="f">Usul
                  <select className="i" value={ev.method} onChange={(e) => setEv({ ...ev, method: e.target.value })}>
                    {methods.map((m) => <option key={m} value={m}>{methodLabel(model, m)}</option>)}
                  </select>
                </label>
                <label className="f">Ko‘rsatgan darajasi (1–{scaleMax(model)})
                  <input className="i" inputMode="decimal" placeholder="masalan 3" value={ev.value} onChange={(e) => setEv({ ...ev, value: e.target.value })} />
                </label>
              </div>
              <label className="f" style={{ marginTop: 8 }}>Nima kuzatildi
                <input className="i" placeholder="Masalan: BEI misoli — muammoni o‘zi hal qilgan" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} />
              </label>
              <label className="f" style={{ marginTop: 8 }}>Hujjat yoki manba (ixtiyoriy)
                <input className="i" placeholder="Intervyu bayonnomasi №, fayl nomi" value={ev.sourceId} onChange={(e) => setEv({ ...ev, sourceId: e.target.value })} />
              </label>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary sm" onClick={() => run(D.addEvidence, { cardId: card.id, code: comp.code, ...ev, value: ev.value === '' ? null : Number(String(ev.value).replace(',', '.')) }, 'Dalil qo‘shildi') && (setEv({ ...ev, value: '', note: '', sourceId: '' }), setShowEv(false))}>Dalilni saqlash</button>
              </div>
            </div>
          )}
          {evs.length ? (
            <div className="ev-list">
              {evs.map((e, i) => (
                <div key={i} className="ev">
                  <span className="score">{fmtNum(e.value)}</span>
                  <div style={{ minWidth: 0 }}>
                    <b className="small">{methodLabel(model, e.method)}</b>
                    <div className="small ink2">{e.note || <span className="muted">izohsiz</span>}{e.sourceId && <span className="muted"> · {e.sourceId}</span>}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty>Hali dalil yo‘q. Bu kompetensiya uchun usullar: {methods.map((m) => methodLabel(model, m)).join(', ')}.</Empty>}
          {(questions.length > 0 || audits.length > 0 || comp.negative || comp.evidenceHint) && (
            <details className="helpers">
              <summary>Yordamchi materiallar{questions.length ? ` · ${questions.length} savol` : ''}{audits.length ? ` · ${audits.length} audit bandi` : ''}</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                {questions.length > 0 && <div><b className="small">Intervyu savollari</b><ul className="small ink2">{questions.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}</ul></div>}
                {audits.length > 0 && <div><b className="small">Audit bandlari</b><ul className="small ink2">{audits.map((a) => <li key={a.id} style={{ marginBottom: 4 }}>{a.title}: <span className="pre">{a.criterion}</span></li>)}</ul></div>}
                {comp.negative && <div><b className="small">Salbiy indikatorlar</b><p className="small ink2 pre">{comp.negative}</p></div>}
                {comp.evidenceHint && <div><b className="small">Tavsiya etilgan dalil manbalari</b><p className="small ink2">{comp.evidenceHint}</p></div>}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function Observations({ card, model, editable }) {
  const s = useAppState();
  const obsMethod = observationMethods(model)[0];
  const profile = model.profiles.find((p) => p.code === card.profileTo);
  const observable = model.competencies.filter((c) => profile.targets[c.code] !== undefined && compMethods(model, c).includes(obsMethod));
  const blank = { methodist: card.assessors?.evaluator?.split(' (')[0] || '', date: s.today, lesson: '', group: '', behavior: '' };
  const [o, setO] = useState(blank);
  const [ratings, setRatings] = useState({});
  const set = (k) => (e) => setO({ ...o, [k]: e.target.value });
  const conds = profileConditions(model, profile);
  const min = conds.find((c) => c.type === 'observation_count')?.params.min;
  const avgMin = conds.find((c) => c.type === 'observation_avg')?.params.min;
  const avg = D.observationAverage(card.observations);
  const rated = Object.values(ratings).filter((v) => v !== '').length;
  return (
    <Panel title={`${methodLabel(model, obsMethod)} (${card.observations.length}${min ? ` / kamida ${min}` : ''})`} actions={avg !== null && <Pill tone={avgMin && avg < avgMin ? 'warn' : 'good'}>o‘rtacha {fmtNum(avg, 2)}{avgMin ? ` / min ${String(avgMin).replace('.', ',')}` : ''}</Pill>}>
      <div className="stack">
        {card.observations.map((x) => {
          const r = x.ratings || { [x.indicator]: x.level };
          return (
            <div key={x.id} className="obs-card">
              <div className="row between"><b>{x.lesson}</b><span className="muted small">{fmtDate(x.date)} · {x.methodist} · {x.group}</span></div>
              <p className="small" style={{ marginTop: 6 }}>{x.behavior}</p>
              <div className="row small" style={{ marginTop: 8 }}>
                {Object.entries(r).map(([code, v]) => <span key={code} className="obs-chip"><span className="code">{code}</span><ScoreChip v={v} target={profile.targets[code]} /></span>)}
                <span className="code muted">{x.id}</span>
              </div>
            </div>
          );
        })}
        {editable && (
          <div className="panel add-box">
            <h3>Yangi dars kuzatuvi bayonnomasi</h3>
            <div className="grid g3" style={{ marginTop: 10 }}>
              <label className="f">Kuzatuvchi<input className="i" value={o.methodist} onChange={set('methodist')} /></label>
              <label className="f">Sana<input className="i" type="date" value={o.date} onChange={set('date')} /></label>
              <label className="f">Guruh konteksti<input className="i" placeholder="PI-14 (12 o‘quvchi)" value={o.group} onChange={set('group')} /></label>
            </div>
            <label className="f" style={{ marginTop: 8 }}>Dars<input className="i" placeholder="Daraja, unit, mavzu" value={o.lesson} onChange={set('lesson')} /></label>
            <label className="f" style={{ marginTop: 8 }}>Kuzatilgan xatti-harakat (dalil)
              <textarea className="i" placeholder="Masalan: ko‘rsatmalar qisqa, CCQ/ICQ bilan tekshirildi; juftlik ishida barcha o‘quvchilar gapirdi…" value={o.behavior} onChange={set('behavior')} />
            </label>
            <div className="f" style={{ marginTop: 10 }}>Shu darsda kuzatilgan kompetensiyalar ({rated} / {observable.length}) — kuzatilmaganini bo‘sh qoldiring
              <div className="obs-grid">
                {observable.map((c) => (
                  <label key={c.code} className={`obs-rate ${ratings[c.code] ? 'on' : ''}`}>
                    <span><span className="code">{c.code}</span> {c.name}</span>
                    <select className="i compact" value={ratings[c.code] ?? ''} onChange={(e) => setRatings({ ...ratings, [c.code]: e.target.value })}>
                      <option value="">—</option>{scaleLevels(model).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => run(D.addObservation, { cardId: card.id, obs: { ...o, method: obsMethod, ratings } }, 'Dars kuzatuvi qayd etildi') && (setO({ ...blank, methodist: o.methodist }), setRatings({}))}>Kuzatuvni saqlash</button>
              <span className="muted small">Har bir belgilangan daraja tegishli kompetensiyaga alohida dalil sifatida bog‘lanadi.</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Gates({ card, items, editable }) {
  const [ev, setEv] = useState({});
  const g = card.gates || {};
  return (
    <Panel title="Majburiy talablar (gate)" actions={<Pill tone={items.every((it) => g[it.code]?.met) ? 'good' : 'bad'}>{items.filter((it) => g[it.code]?.met).length} / {items.length}</Pill>}>
      <div className="stack">
        <p className="small ink2">Bittasi bajarilmasa, boshqa natijalar qanchalik yuqori bo‘lmasin, daraja berilishi bloklanadi.</p>
        {items.map((it) => (
          <div key={it.code} className={`gate ${g[it.code]?.met ? 'ok' : ''}`}>
            <span className={`ic ${g[it.code]?.met ? 'ok' : 'na'}`}>{g[it.code]?.met ? '✓' : ''}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{it.label}</div>
              {g[it.code]?.met ? <div className="muted small">{g[it.code].evidence} · {g[it.code].by}, {fmtDate(g[it.code].at)}</div>
                : editable && (
                  <div className="row" style={{ marginTop: 6 }}>
                    <input className="i compact" style={{ flex: 1 }} placeholder="Dalil: sertifikat, hujjat raqami" value={ev[it.code] || ''} onChange={(e) => setEv({ ...ev, [it.code]: e.target.value })} />
                    <button className="btn sm primary" onClick={() => run(D.setGate, { cardId: card.id, code: it.code, met: true, evidence: ev[it.code] }, 'Talab bajarildi deb belgilandi')}>Tasdiqlash</button>
                  </div>
                )}
            </div>
            {editable && g[it.code]?.met && <button className="btn sm" onClick={() => run(D.setGate, { cardId: card.id, code: it.code, met: false, evidence: '' }, 'Belgi olib tashlandi')}>Bekor qilish</button>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SmartConditions({ list }) {
  const open = list.filter((c) => c.passed !== true);
  const done = list.filter((c) => c.passed === true);
  return (
    <div>
      <div className="small" style={{ fontWeight: 650, marginBottom: 2 }}>Shartlar: {done.length} / {list.length} bajarilgan</div>
      <Conditions list={open} />
      {done.length > 0 && (
        <details className="helpers">
          <summary>{done.length} ta bajarilgan shartni ko‘rsatish</summary>
          <Conditions list={done} />
        </details>
      )}
    </div>
  );
}

/** Kartadagi bitta asosiy harakat: nima qilish kerak, nega to'xtagan va tugma. */
function NextStep({ card, model, d, onOpen }) {
  const [showRet, setShowRet] = useState(false);
  const [ret, setRet] = useState({ to: model.stages[0], reason: '' });
  const idx = model.stages.indexOf(card.stage);
  const next = model.stages[idx + 1];
  const unrated = d.match.items.filter((i) => i.state === 'unrated');
  const de = d.match.items.filter((i) => i.state === 'de');
  let title; let text; let btn = null; let blocked = null; let tone = 'info';

  if (card.stage === 'published') {
    tone = 'good';
    title = 'Natija e’lon qilingan';
    if (model.transition && card.panel?.decision === 'appoint' && !card.appointment) { tone = 'warn'; text = 'Joriy daraja rasmiy tayinlash hujjati kiritilgandan keyin o‘zgaradi — o‘ngdagi «Rasmiy tayinlash» blokini to‘ldiring.'; }
    else text = card.appointment ? `Rasmiy tayinlash qayd etilgan: ${card.appointment.docNo}.` : 'Xodim natijani o‘z kabinetida ko‘radi. Rivojlanish rejasi va qayta baholash quyida.';
  } else {
    const actor = next === 'published' ? model.approverLabel || 'HRD' : next === 'approval' ? 'Kalibratsiya mas’uli' : 'HR/L&D';
    const label = next === 'published' ? 'Tasdiqlash va e’lon qilish' : `«${STAGE_LABELS[next]}» bosqichiga o‘tish`;
    if ((next === 'panel' || next === 'approval') && unrated.length) {
      blocked = `${unrated.length} ta kompetensiya baholanmagan`;
      title = unrated.length === 1 ? `${unrated[0].code} ni baholang` : `${unrated.length} ta kompetensiyani baholang`;
      text = `Keyingi bosqichga barcha kompetensiyalar baholangach o‘tiladi: ${unrated.slice(0, 6).map((i) => i.code).join(', ')}${unrated.length > 6 ? '…' : ''}.`;
      btn = <button className="btn primary" onClick={() => onOpen(unrated[0].code)}>{unrated[0].code} ni ochish</button>;
    } else if (next === 'approval' && model.panelRequired && !card.panel) {
      blocked = `${model.panelLabel || 'Panel'} protokoli kiritilmagan`;
      title = `${model.panelLabel || 'Panel'} protokolini kiriting`;
      text = 'Qaror va asos o‘ngdagi blokda kiritiladi, so‘ng tasdiqlashga o‘tiladi.';
    } else {
      title = next === 'published' ? 'Natijani tasdiqlang va e’lon qiling' : `Karta «${STAGE_LABELS[next]}» bosqichiga tayyor`;
      const hint = { evidence: 'Dalillarni yig‘ishda davom eting; baholash bosqichida yakuniy darajalar kiritiladi.', assessment: 'Har kompetensiya uchun dalilga mos darajani tanlang va asosini yozing.', panel: 'Keyingi bosqichda qaror va protokol kiritiladi.', approval: 'Tasdiqlovchi natijani ko‘rib chiqadi.', published: 'E’londan keyin natija xodim kabinetiga tushadi va o‘zgartirilmaydi (tuzatish faqat qayta baholash orqali).' }[next];
      text = de.length ? `Diqqat: ${de.length} ta kompetensiyada dalil yetarli emas (${de.map((i) => i.code).join(', ')}).` : hint;
      tone = de.length ? 'warn' : 'info';
    }
    if (!btn) btn = <button className="btn primary" disabled={!!blocked} title={blocked || ''} onClick={() => run(D.advanceStage, { cardId: card.id, actor }, `Bosqich: ${STAGE_LABELS[next]}`)}>{label}</button>;
  }
  return (
    <section className={`panel next-step ${tone}`}>
      <div className="ns-main">
        <span className="ns-ic"><Icon name={card.stage === 'published' ? 'check' : blocked ? 'alert' : 'trend'} size={18} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ns-k">Keyingi qadam</div>
          <b>{title}</b>
          {text && <div className="small ink2" style={{ marginTop: 2 }}>{text}</div>}
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {btn}
          {idx > 0 && card.stage !== 'published' && <button className="link-btn" onClick={() => setShowRet(!showRet)}>Qaytarish</button>}
        </div>
      </div>
      {showRet && (
        <div className="row" style={{ marginTop: 12 }}>
          <select className="i compact" value={ret.to} onChange={(e) => setRet({ ...ret, to: e.target.value })}>
            {model.stages.slice(0, idx).map((st) => <option key={st} value={st}>{STAGE_LABELS[st]}</option>)}
          </select>
          <input className="i" style={{ flex: 1, minWidth: 220 }} placeholder="Qaytarish sababi (majburiy)" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })} />
          <button className="btn danger" disabled={!ret.reason.trim()} onClick={() => run(D.returnStage, { cardId: card.id, toStage: ret.to, reason: ret.reason }, 'Karta qaytarildi') && setShowRet(false)}>Qaytarish</button>
        </div>
      )}
    </section>
  );
}

function PanelProtocol({ card, d, model }) {
  const [f, setF] = useState({ decision: d.status === 'recommend_appoint' ? 'appoint' : d.ready ? 'reserve' : d.status === 'conditional' ? 'conditional' : 'not_ready', protocol: '', members: model.panelMembers || 'HRD, CEO, L&D rahbari' });
  if (card.panel) {
    const lbl = { appoint: 'Tayinlashga', reserve: 'Kadrlar zaxirasiga', conditional: 'Rivojlanish sharti bilan', not_ready: 'Tayyor emas' }[card.panel.decision];
    return (
      <div className="stack">
        <div className="row between"><b>Panel qarori</b><Pill tone={card.panel.decision === 'not_ready' ? 'bad' : card.panel.decision === 'conditional' ? 'warn' : 'good'}>{lbl}</Pill></div>
        <p className="small">{card.panel.protocol}</p>
        <p className="muted small">{card.panel.members} · {fmtDate(card.panel.date)}</p>
      </div>
    );
  }
  if (card.stage !== 'panel') return <p className="muted small">Protokol «Kalibratsiya / panel» bosqichida kiritiladi. Bu modelda panel majburiy.</p>;
  return (
    <div className="stack">
      <select className="i" value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })}>
        <option value="appoint">Tayinlashga (mos vakant rol bor)</option>
        <option value="reserve">Tayyor — kadrlar zaxirasiga</option>
        <option value="conditional">Rivojlanish sharti bilan</option>
        <option value="not_ready">Tayyor emas</option>
      </select>
      <input className="i" placeholder="Panel a’zolari" value={f.members} onChange={(e) => setF({ ...f, members: e.target.value })} />
      <textarea className="i" placeholder="Panel xulosasi va asosi (protokol)" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })} />
      <button className="btn primary" onClick={() => run(D.recordPanel, { cardId: card.id, ...f }, 'Panel protokoli saqlandi')}>Protokolni saqlash</button>
    </div>
  );
}

function Appointment({ card, emp }) {
  const [f, setF] = useState({ docNo: '', effectiveDate: '2026-12-01' });
  if (card.appointment) {
    return (
      <div className="callout good">
        <b>Rasmiy tayinlash qayd etilgan</b>
        <div className="small">{card.appointment.docNo} · kuchga kirish: {fmtDate(card.appointment.effectiveDate)} · {card.appointment.by}</div>
      </div>
    );
  }
  if (card.stage !== 'published' || card.panel?.decision !== 'appoint') return <p className="muted small">Rasmiy tayinlash natija e’lon qilingach va panel tayinlash qarorini bergach alohida yozuv sifatida kiritiladi.</p>;
  return (
    <div className="stack">
      <div className="callout warn small">Joriy daraja hali <b>{emp.currentLevel}</b>. U faqat rasmiy tayinlash hujjatidan keyin yangilanadi.</div>
      <input className="i" placeholder="Tayinlash hujjati (masalan, Buyruq №233-K)" value={f.docNo} onChange={(e) => setF({ ...f, docNo: e.target.value })} />
      <label className="f">Kuchga kirish sanasi<input className="i" type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} /></label>
      <button className="btn primary" onClick={() => run(D.recordAppointment, { cardId: card.id, ...f }, 'Rasmiy tayinlash qayd etildi')}>Tayinlashni qayd etish</button>
    </div>
  );
}

export default function CardDetail({ id }) {
  const s = useAppState();
  const [open, setOpen] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const card = D.getCard(s, id);
  if (!card) return <Panel>Karta topilmadi. <a href="#/cards">Ro‘yxatga qaytish</a></Panel>;
  const { model, emp, profileTo, context } = D.cardContext(s, card);
  const d = D.cardDecision(s, card);
  const editable = ['draft', 'evidence', 'assessment', 'panel'].includes(card.stage);
  const conds = profileConditions(model, profileTo);
  const threshold = conds.find((c) => c.type === 'match_threshold')?.params.threshold;
  const gateItems = conds.find((c) => c.type === 'gates')?.params.items || [];
  const role = card.targetRoleId ? D.roleInfo(s, card.targetRoleId) : null;
  const layers = [...new Set(model.competencies.map((c) => c.layer))];
  const history = s.audit.filter((a) => String(a.object).startsWith(card.id));
  const idp = s.idp.filter((x) => x.cardId === card.id);
  const nextCard = s.cards.find((c) => c.prevCardId === card.id);
  const attention = d.match.items.filter((i) => i.state === 'unrated' || i.state === 'de' || i.gap > 0).map((i) => i.code);

  return (
    <>
      <section className="panel hero">
        <div className="hero-top">
          <div className="hero-id">
            <Avatar name={emp.name} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div className="crumbs">
                <a href="#/cards"><Icon name="back" size={13} /> Kartalar</a>
                {card.prevCardId && <a href={`#/cards/${card.prevCardId}`}>avvalgi karta: {card.prevCardId}</a>}
                {nextCard && <a href={`#/cards/${nextCard.id}`}>qayta baholash: {nextCard.id}</a>}
              </div>
              <h1 style={{ marginTop: 4 }}>{emp.name} <span className="muted" style={{ fontWeight: 500 }}>·</span> {card.profileFrom ? `${card.profileFrom} → ${card.profileTo}` : profileTo.name}</h1>
              <div className="meta">
                <span>{D.getBranch(s, card.branchId)?.name}</span>
                <span><a href={`#/models/${encodeURIComponent(model.id)}`}>{model.name}</a></span>
                <span>Muddat: {fmtDate(card.deadline)}{card.stage !== 'published' && card.deadline && card.deadline < s.today && <> <Pill tone="bad">kechikkan</Pill></>}</span>
                <span>Baholovchi: {card.assessors?.evaluator}</span>
                <span className="muted" title={`Model versiyasi ${model.id}, formula ${model.formulaVersion}, reviziya r${card.revision}`}>Karta {card.id}</span>
              </div>
              {card.stage !== 'published' && (
                <div className="callout small" style={{ marginTop: 8 }}>
                  <Pill tone="warn">Shartli</Pill>{' '}
                  {card.origin === 'onboarding'
                    ? <>Onboarding kartasi: rekrutingdan boshlangan, baholar hali e’lon qilinmagan. Birinchi lavozim darajasi adaptatsiya oxirida — <b>{fmtDate(card.deadline)}</b> gacha to‘liq tasdiqlanadi va e’lon qilinadi.</>
                    : <>Baholar yil davomida kompetensiya bo‘yicha birma-bir yangilanadi. Lavozim va maoshga faqat rasmiy e’londan keyin ta’sir qiladi — keyingi e’lon <b>{fmtDate(D.nextAnnounce(s))}</b>.</>}
                </div>
              )}
            </div>
          </div>
          <Pill tone={d.tone}>{d.label}</Pill>
        </div>
        <Stepper stages={model.stages} current={card.stage} />
      </section>
      <NextStep card={card} model={model} d={d} onOpen={(code) => { setOpen(code); setTimeout(() => document.getElementById(`row-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} />

      <div className="split">
        <div className="grid">
          <Panel title={`Kompetensiyalar — ${profileTo.code} maqsadlari`} tight actions={
            <label className="chk"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Faqat e’tibor talab qiladiganlar ({attention.length})</label>
          }>
            <table>
              <thead>
                <tr><th>Kompetensiya</th><th className="num">Maqsad</th><th className="num">Baho</th><th className="num" title="Maqsaddan necha ball kam">Tafovut</th><th className="num">Dalillar</th></tr>
              </thead>
              <tbody>
                {layers.map((layer) => [
                  <tr key={layer} className="group-row"><td colSpan={5}>{layer}</td></tr>,
                  ...model.competencies.filter((c) => c.layer === layer && profileTo.targets[c.code] !== undefined && (!onlyOpen || attention.includes(c.code) || open === c.code)).map((c) => {
                    const it = d.match.items.find((x) => x.code === c.code);
                    const isOpen = open === c.code;
                    const evCount = c.composite ? Object.keys(card.hrScores).length : card.scores[c.code]?.evidences?.length || 0;
                    const evM = context.evidenceMethods?.[c.code]?.length || 0;
                    return [
                      <tr key={c.code} id={`row-${c.code}`} className={`clickable ${isOpen ? 'open' : ''} ${it.state === 'unrated' ? 'todo' : ''}`} onClick={() => setOpen(isOpen ? null : c.code)}>
                        <td><span className="chev">{isOpen ? '−' : '+'}</span> <span className="code">{c.code}</span> {c.name}{c.composite && <div className="muted small" style={{ marginLeft: 18 }}>{compositeParts(model, c.code).length} qism · {Object.keys(card.hrScores).length} baho</div>}</td>
                        <td className="num">{it.target}</td>
                        <td className="num">{it.state === 'unrated' ? <span className="pill muted">baholanmagan</span> : <ScoreChip v={it.score} target={it.target} />}</td>
                        <td className="num">{it.gap === null ? <span className="muted">—</span> : it.gap > 0 ? <span style={{ color: it.gap > 1 ? 'var(--bad)' : 'var(--warn)', fontWeight: 700 }}>−{it.gap}</span> : <span className="muted">0</span>}</td>
                        <td className="num">{evCount || <span className="muted">—</span>}{evCount > 0 && !c.composite && <div className="muted small">{evM} usul</div>}</td>
                      </tr>,
                      isOpen && (
                        <tr key={`${c.code}-x`}><td colSpan={5} style={{ padding: 0 }}><CompetencyEditor key={`${c.code}-${card.revision}`} card={card} model={model} comp={c} target={it.target} editable={editable} /></td></tr>
                      ),
                    ];
                  }),
                ])}
                <tr className="group-row">
                  <td>Jami: {d.match.counts.scored} baholangan{d.match.counts.unrated ? ` · ${d.match.counts.unrated} baholanmagan` : ''}{d.match.counts.de ? ` · ${d.match.counts.de} dalil yetarli emas` : ''}{d.match.counts.na ? ` · ${d.match.counts.na} qo‘llanmaydi` : ''}</td>
                  <td className="num">{d.match.targetSum}</td>
                  <td className="num">{d.match.creditedSum}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </Panel>

          {observationMethods(model).length > 0 && <Observations card={card} model={model} editable={editable} />}
          {gateItems.length > 0 && <Gates card={card} items={gateItems} editable={editable} />}

          {card.stage === 'published' && (
            <Panel title="Individual rivojlanish rejasi (taklif)" tight>
              {idp.length ? (
                <table>
                  <thead><tr><th>Kompetensiya</th><th className="num">Maqsad</th><th>Vazifa</th><th>Mas’ul</th><th>Holat</th></tr></thead>
                  <tbody>{idp.map((x) => <tr key={x.id}><td className="code">{x.competency}{x.priority && <Pill tone="bad">ustuvor</Pill>}</td><td className="num">{x.targetLevel}</td><td>{x.task}</td><td>{x.owner}</td><td><Pill tone={IDP_STATUS[x.status][1]}>{IDP_STATUS[x.status][0]}</Pill></td></tr>)}</tbody>
                </table>
              ) : <Empty>Tafovut yoki DE yo‘q — IDP bandi taklif qilinmadi.</Empty>}
            </Panel>
          )}
          {card.stage === 'published' && <ReassessPanel card={card} model={model} d={d} />}

          {history.length > 0 && (
            <details className="panel history">
              <summary>Karta tarixi · {history.length} ta o‘zgarish</summary>
              <table>
                <tbody>{history.map((a) => <tr key={a.id}><td className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.at)}</td><td className="small"><b>{a.action}</b> · {a.actor}{a.before !== undefined && <span className="muted"> · {a.before} → {a.after}</span>}{a.reason && <div className="muted">{a.reason}</div>}</td></tr>)}</tbody>
              </table>
            </details>
          )}
        </div>

        <div className="grid sticky">
          <Panel title="Natija">
            <div className="stack">
              <div className="gauge-row">
                <Gauge value={isNum(d.match.match) ? d.match.match : null} partial={(100 * d.match.creditedSum) / d.match.targetSum} threshold={threshold}
                  label={isNum(d.match.match) ? fmtPct(d.match.match) : '—'} sub={isNum(d.match.match) ? 'moslik' : 'hali yo‘q'} />
                <div className="stack" style={{ gap: 0 }}>
                  <div className="kv"><span>To‘plangan ball</span><b>{d.match.creditedSum} / {d.match.targetSum}</b></div>
                  <div className="kv"><span>Kerakli</span><b>{threshold}% ({minIntegerForThreshold(d.match.targetSum, threshold)} ball)</b></div>
                  <div className="kv"><span>Baholangan</span><b>{d.match.counts.scored} / {d.match.counts.total - d.match.counts.na}</b></div>
                </div>
              </div>
              <div className={`callout ${d.tone === 'good' ? 'good' : d.tone === 'bad' ? 'bad' : d.tone === 'muted' ? '' : 'warn'}`}>
                <b>{d.label}</b>
                {!isNum(d.match.match) && <div className="small">Foiz hamma kompetensiya baholangach chiqadi.</div>}
                {d.explain && <div className="small" style={{ marginTop: 4 }}>{d.explain}</div>}
              </div>
              <SmartConditions list={d.conditions} />
              <details className="helpers">
                <summary>Qanday hisoblanadi?</summary>
                <p className="small ink2" style={{ marginTop: 6 }}>Har kompetensiya bo‘yicha maqsaddan oshgan ball hisobga olinmaydi: kuchli tomon boshqa kompetensiyadagi kamchilikni yopmaydi. Moslik = to‘plangan ball ÷ maqsadli ball × 100 = {d.match.creditedSum} ÷ {d.match.targetSum}. Bu tizim tavsiyasi; vakolatli qaror va rasmiy tayinlash alohida qayd etiladi.</p>
              </details>
            </div>
          </Panel>
          {model.panelRequired && (card.stage === 'panel' || card.panel) && <Panel title={model.panelLabel || 'Panel protokoli'}><PanelProtocol key={`${card.stage}-${d.status}`} card={card} d={d} model={model} /></Panel>}
          {model.transition && card.stage === 'published' && (
            <Panel title="Rasmiy tayinlash">
              <div className="stack">
                <div className="small ink2">Maqsadli rol: {role ? `${role.name} · ${role.rScope}${role.vacant ? ' · vakant' : ' · band'}` : 'biriktirilmagan — kadrlar zaxirasi ko‘rib chiqiladi'}</div>
                <div className="small ink2">Joriy daraja: <b>{emp.currentLevel}</b>{card.appointment ? ` (${fmtDate(card.appointment.effectiveDate)} dan)` : ` (shu darajada ${context.tenureMonths} oy)`}</div>
                <Appointment card={card} emp={emp} />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function ReassessPanel({ card, model, d }) {
  const s = useAppState();
  const profile = model.profiles.find((p) => p.code === card.profileTo);
  const [sel, setSel] = useState(() => d.match.items.filter((i) => i.state !== 'scored' || i.gap > 0).map((i) => i.code));
  const existing = s.cards.find((c) => c.prevCardId === card.id);
  return (
    <Panel title="Qayta baholash">
      {existing ? (
        <p className="small">Qayta baholash kartasi ochilgan: <a href={`#/cards/${existing.id}`}>{existing.id}</a> ({existing.reopened?.join(', ')})</p>
      ) : (
        <>
          <p className="small ink2">Faqat kerakli bandlarni qayta oching. Yangi karta shu kartaga bog‘lanadi, ikki natija ham tarixda qoladi.</p>
          <div className="row" style={{ margin: '10px 0' }}>
            {Object.keys(profile.targets).map((c) => (
              <label key={c} className="row small" style={{ gap: 4 }}>
                <input type="checkbox" checked={sel.includes(c)} onChange={(e) => setSel(e.target.checked ? [...sel, c] : sel.filter((x) => x !== c))} />
                {c}
              </label>
            ))}
          </div>
          <button className="btn" onClick={() => run(D.openReassessment, { cardId: card.id, codes: sel }, 'Qayta baholash kartasi ochildi')}>Qayta baholash kartasini ochish</button>
        </>
      )}
    </Panel>
  );
}
