import { useState } from 'react';
import { run, useAppState } from '../state/store.js';
import { Panel, Pill } from '../ui/common.jsx';
import { validateImport, IMPORT_SHEETS } from '../core/importValidate.js';
import { importDraft } from '../core/domain.js';
import { SAMPLE_IMPORT_OK, SAMPLE_IMPORT_BAD } from '../core/uat.js';

export default function ImportPage() {
  const s = useAppState();
  const [sample, setSample] = useState('bad');
  const [text, setText] = useState(JSON.stringify(SAMPLE_IMPORT_BAD, null, 1));
  const [res, setRes] = useState(null);
  const load = (k) => {
    setSample(k);
    setText(JSON.stringify(k === 'ok' ? SAMPLE_IMPORT_OK : SAMPLE_IMPORT_BAD, null, 1));
    setRes(null);
  };
  const check = () => {
    try {
      setRes(validateImport(JSON.parse(text)));
    } catch (e) {
      setRes({ ok: false, errors: [{ sheet: '—', row: null, msg: `Fayl o‘qilmadi: ${e.message}` }] });
    }
  };
  const exists = s.models.some((m) => m.id === 'SERVIS@0.1');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Excel import</h1>
          <p>Varaqlar: {Object.keys(IMPORT_SHEETS).join(', ')}. Bog‘lash kalitlari: competency_code, level_no, indicator_code, profile_code. Sinov importi xatolarni varaq va qator kesimida ko‘rsatadi; bitta xato bo‘lsa butun import bekor qilinadi.</p>
        </div>
      </div>
      <div className="split">
        <Panel title="Fayl mazmuni (demo: varaqlar JSON ko‘rinishida)" actions={<>
          <button className={`btn sm ${sample === 'bad' ? 'primary' : ''}`} onClick={() => load('bad')}>Xatoli namuna</button>
          <button className={`btn sm ${sample === 'ok' ? 'primary' : ''}`} onClick={() => load('ok')}>To‘g‘ri namuna</button>
        </>}>
          <textarea className="i code" style={{ minHeight: 420 }} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} />
          <p className="muted small" style={{ marginTop: 8 }}>Ishchi tizimda .xlsx fayl yuklanadi; prototipda varaqlar tarkibi to‘g‘ridan-to‘g‘ri tahrirlanadi. Qator raqami Excel qatoriga mos (1-qator — sarlavha).</p>
        </Panel>
        <div className="grid sticky">
          <Panel title="Sinov importi">
            <div className="stack">
              <button className="btn primary" onClick={check}>Tekshirish</button>
              {res && (res.ok ? (
                <>
                  <div className="callout good">Xato topilmadi: {res.data.competencies.length} kompetensiya, {res.data.profiles.length} profil.</div>
                  <button className="btn" disabled={exists} onClick={() => run(importDraft, { data: res.data, name: 'Servis menejeri', modelId: 'SERVIS' }, 'Import: SERVIS@0.1 qoralama versiya ochildi')}>Qoralama versiya sifatida import qilish</button>
                  {exists && <a href="#/models/SERVIS%400.1" className="small">SERVIS@0.1 qoralamasini ochish →</a>}
                </>
              ) : (
                <>
                  <div className="callout bad">Import bekor qilindi — {res.errors.length} ta xato. Hech bir yozuv saqlanmadi.</div>
                  <table>
                    <thead><tr><th>Varaq</th><th className="num">Qator</th><th>Xato</th></tr></thead>
                    <tbody>{res.errors.map((e, i) => <tr key={i}><td><Pill tone="bad">{e.sheet}</Pill></td><td className="num">{e.row ?? '—'}</td><td className="small">{e.msg}</td></tr>)}</tbody>
                  </table>
                </>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
