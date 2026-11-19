import { useAppState } from '../state/store.js';
import { Panel, Pill, Empty, Stat, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { Rating } from './Gamification.jsx';

/** Xodim: to'plagan ballari, badge'lari, sertifikatlari va reyting. */
export default function MyRating({ emp }) {
  const s = useAppState();
  const pts = D.employeePoints(s, emp.id);
  const mine = D.employeeBadges(s, emp.id);
  const certs = D.certificates(s, emp.id);
  const rank = D.ratingList(s, { position: emp.position }).find((r) => r.emp.id === emp.id)?.rank;
  const all = (s.gamification?.badges || []).filter((b) => b.active !== false);
  return (
    <>
      <div className="page-head"><div><h1>Reyting va yutuqlar</h1><p>Kurslardagi harakatlaringiz uchun ball to‘playsiz; reyting shu ballar asosida. Badge — noodatiy natija uchun. Kompetensiya darajasi reytingga kirmaydi.</p></div></div>
      <div className="grid g3">
        <Stat k="Ballarim" v={pts.total} s={`${pts.items.length} ta harakat`} icon="target" />
        <Stat k="Lavozim reytingida" v={rank && pts.total > 0 ? `${rank}-o‘rin` : '—'} s="o‘z lavozimingiz bo‘yicha, barcha filiallar" icon="trend" />
        <Stat k="Sertifikatlar" v={certs.length} s="yakunlangan kurslar" icon="check" />
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Panel title="Badge’lar">
          <div className="stack">
            {all.map((b) => { const got = mine.some((x) => x.id === b.id); return (
              <div key={b.id} className="row" style={{ gap: 10, opacity: got ? 1 : 0.45 }}>
                <span style={{ fontSize: 26 }}>{b.icon}</span>
                <div style={{ flex: 1 }}><b>{b.name}</b> {got ? <Pill tone="good">olingan</Pill> : <Pill tone="muted">hali yo‘q</Pill>}<div className="small muted">{b.desc}</div></div>
              </div>
            ); })}
            {!all.length && <Empty>Badge katalogi bo‘sh.</Empty>}
          </div>
        </Panel>
        <Panel title="Oxirgi ballar">
          {pts.items.length ? <table className="small"><tbody>{pts.items.slice(0, 10).map((x, i) => <tr key={i}><td>{D.POINT_ACTIONS[x.kind][0]}<div className="muted">{x.course}</div></td><td className="small muted">{fmtDate(x.at)}</td><td className="num"><b>+{x.points}</b></td></tr>)}</tbody></table> : <Empty>Hali ball yo‘q — kursdan boshlang.</Empty>}
          {certs.length > 0 && <><h3 className="small">Sertifikatlar</h3><table className="small"><tbody>{certs.map((c) => <tr key={c.no}><td>{c.course.title}</td><td className="muted">{c.no}</td><td>{fmtDate(c.at)}</td></tr>)}</tbody></table></>}
        </Panel>
      </div>
      <Rating s={s} me={emp.id} />
    </>
  );
}
