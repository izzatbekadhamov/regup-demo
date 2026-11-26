import { useAppState, useSession, setSession, resetDemo } from './state/store.js';
import { useHashRoute, Toasts, go, Icon, BrandMark, Avatar, ask, DialogHost } from './ui/common.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cards from './pages/Cards.jsx';
import CardDetail from './pages/CardDetail.jsx';
import Stretch from './pages/Stretch.jsx';
import Models from './pages/Models.jsx';
import ModelDetail from './pages/ModelDetail.jsx';
import ImportPage from './pages/ImportPage.jsx';
import Succession from './pages/Succession.jsx';
import Kpi from './pages/Kpi.jsx';
import EvidenceQueue from './pages/EvidenceQueue.jsx';
import Idp from './pages/Idp.jsx';
import Audit from './pages/Audit.jsx';
import Uat from './pages/Uat.jsx';
import MyResults from './pages/MyResults.jsx';
import Career from './pages/Career.jsx';
import MyStretch from './pages/MyStretch.jsx';
import Notifications from './pages/Notifications.jsx';
import MyIdp from './pages/MyIdp.jsx';
import Candidates from './pages/Candidates.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import PathDetail from './pages/PathDetail.jsx';
import MyLearning from './pages/MyLearning.jsx';
import Learn from './pages/Learn.jsx';
import TeacherKpi, { MyKpi } from './pages/TeacherKpi.jsx';
import Skills from './pages/Skills.jsx';
import MySkills from './pages/MySkills.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Integration from './pages/Integration.jsx';
import Meetings from './pages/Meetings.jsx';
import Reminders from './pages/Reminders.jsx';
import TaskQueue from './pages/TaskQueue.jsx';
import ObservationPage from './pages/ObservationPage.jsx';
import MyOnboarding from './pages/MyOnboarding.jsx';
import OnbDashboard from './pages/OnbDashboard.jsx';
import Team from './pages/Team.jsx';
import People from './pages/People.jsx';
import Gamification from './pages/Gamification.jsx';
import Login from './pages/Login.jsx';
import Colleagues from './pages/Colleagues.jsx';
import MyRating from './pages/MyRating.jsx';
import OnbBoard from './pages/OnbBoard.jsx';
import Surveys from './pages/Surveys.jsx';
import TaskBoard from './pages/TaskBoard.jsx';
import Messages from './pages/Messages.jsx';
import MySurveys from './pages/MySurveys.jsx';
import MyMeetings from './pages/MyMeetings.jsx';
import SurveyLink from './pages/SurveyLink.jsx';
import Today from './pages/Today.jsx';
import { TabBar, CommandPalette, DsIcon } from './ui/ds.jsx';
import { useEffect, useState } from 'react';
import { currentTheme, setTheme } from './ui/theme.js';
import { kpiValue, kpiResult, kpiMonths } from './core/domain.js';
import * as D from './core/domain.js';
import { OTHER_POSITIONS } from './core/modelKit.js';

// Har bir sahifa: [yorliq, son (harakat kutayotgan ishlar), ikonka]
const ROUTES = {
  '': ['Bosh panel', null, 'home'],
  cards: ['Baholash kartalari', (s) => s.cards.filter((c) => c.stage !== 'published').length, 'cards'],
  stretch: ['Stretch vazifalar', (s) => s.stretches.filter((x) => x.status === 'submitted').length, 'target'],
  evidence: ['Qo‘shimcha dalillar', (s) => s.evidenceQueue.filter((x) => x.status === 'pending').length, 'inbox'],
  idp: ['Rivojlanish rejalari', (s) => s.idp.filter((x) => x.status === 'proposed' || x.status === 'review').length, 'route'],
  candidates: ['Nomzod tanlash', null, 'trend'],
  succession: ['Vorislik', null, 'users'],
  teachers: ['Ustozlar KPI', (s, sess) => { const m = kpiMonths(s).at(-1); const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return D.activeEmployees(s).filter((e) => (!sc || sc.has(e.id)) && s.kpiRules.some((r) => r.position === e.position && kpiValue(kpiResult(s, e.id, m), r)?.below)).length; }, 'chart'],
  'onb-dashboard': ['Onboarding dashboard', null, 'chart'],
  board: ['Onboarding doskasi', (s, sess) => { const u = D.getStaff(s, sess.userId); return D.boardItems(s, u).filter((o) => D.checkLate(s, o) > 0).length; }, 'layers'],
  onboarding: ['Moslashuv — 60 kun', (s, sess) => { const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return s.onboardings.filter((o) => o.status === 'active' && (!sc || sc.has(o.employeeId)) && (D.onboardingScore(s, o).ready || D.onbDay(s, o) >= D.obDays(s, o))).length; }, 'user'],
  integration: ['Integratsiya', (s) => s.hrInbox.length, 'upload'],
  tasks: ['Topshiriqlar', (s, sess) => { const u = D.getStaff(s, sess.userId); return s.enrollments.reduce((a, e) => a + (D.canReviewTask(s, u, e) && e.status !== 'archived' ? Object.values(e.progress).filter((p) => p.status === 'pending').length : 0), 0); }, 'check'],
  observations: ['Dars kuzatuvi', (s, sess) => { const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return s.onboardings.filter((o) => o.status === 'active' && (!sc || sc.has(o.employeeId)) && D.onbObservations(s, o).length < (D.onbProgram(s, D.getEmployee(s, o.employeeId))?.observations || 0)).length; }, 'target'],
  surveys: ['So‘rovnomalar', (s, sess) => D.dueSurveySends(s).length + (s.surveySends || []).filter((x) => x.to === D.getStaff(s, sess.userId)?.name && !x.answeredAt).length, 'list'],
  taskboard: ['Topshiriqlar doskasi', (s, sess) => { const u = D.getStaff(s, sess.userId); return (s.boardTasks || []).filter((t) => t.status === 'new' && D.canSeeTask(s, u, t)).length; }, 'inbox'],
  meetings: ['Uchrashuvlar', (s) => s.meetings.filter((m) => m.status === 'proposed').length, 'users'],
  reminders: ['Eslatmalar', (s) => D.dueReminders(s).filter((r) => !s.notifications.some((n) => n.key.startsWith(r.key))).length, 'bell'],
  skills: ['Ko‘nikmalar', (s) => (s.empSkills || []).filter((x) => x.claim).length, 'check'],
  courses: ['Kurslar va yo‘llar', (s) => (s.enrollments || []).filter((e) => !D.getCourse(s, e.courseId)?.onboarding).reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0), 'layers'],
  models: ['Kompetensiya modellari', null, 'layers'],
  kpi: ['Yangi filial KPI', null, 'chart'],
  people: ['Jamoa a’zolari', null, 'users'],
  messages: ['Xabar yuborish', null, 'bell'],
  gamification: ['Gamifikatsiya', null, 'target'],
  team: ['Adminlar', null, 'user'],
  audit: ['O‘zgarishlar jurnali', null, 'list'],
  import: ['Exceldan import', null, 'upload'],
  uat: ['Qabul sinovlari', null, 'check'],
};

// Bir jarayonning ichki sahifalari menyuda emas, bitta band ostida tab bo'ladi (UX audit, 4-topilma).
const HUBS = {
  queues: { label: 'Navbatlar', icon: 'inbox', routes: ['integration', 'tasks', 'observations', 'surveys', 'taskboard', 'meetings', 'reminders'] },
  reviews: { label: 'Tasdiqlash', icon: 'check', routes: ['stretch', 'evidence', 'skills'] },
  talent: { label: 'Iste’dodlar', icon: 'trend', routes: ['candidates', 'succession'] },
  settings: { label: 'Sozlamalar', icon: 'list', routes: ['models', 'kpi', 'people', 'messages', 'gamification', 'team', 'audit', 'import', 'uat'] },
};
const hubOf = (path) => Object.entries(HUBS).find(([, h]) => h.routes.includes(path))?.[0] || null;

const ADMIN_NAV = [
  ['', ['']],
  ['Onboarding', ['onb-dashboard', 'board', 'onboarding', 'hub:queues']],
  ['Baholash', ['cards', 'hub:reviews', 'idp', 'hub:talent']],
  ['O‘qitish', ['courses', 'teachers']],
  ['Tizim', ['hub:settings']],
];

// Bo'limga kirish — shaxsga berilgan huquq bo'yicha (TZ'dagi qat'iy rollar o'rniga). Xodimlar ro'yxati huquq doirasiga qarab torayadi.
const ROUTE_RIGHTS = {
  '': ['cards.publish'], cards: ['cards.assign', 'cards.assess', 'cards.publish'], stretch: ['cards.publish'], evidence: ['cards.publish'],
  idp: ['talent.view'], candidates: ['talent.view'], succession: ['talent.view'], skills: ['talent.view'], teachers: ['kpi.view'], kpi: ['kpi.view'],
  'onb-dashboard': ['onb.view'], onboarding: ['onb.view'], integration: ['onb.integration'], tasks: ['courses.review', 'courses.manage'],
  observations: ['onb.observe'], meetings: ['onb.meetings', 'onb.meetApprove'], reminders: ['onb.reminders'],
  board: ['onb.view', 'onb.board', 'onb.checkin'], surveys: ['onb.surveys'], taskboard: ['onb.tasks'], messages: ['people.message'],
  courses: ['courses.view', 'courses.manage'], paths: ['courses.view', 'courses.manage'], models: ['models.manage'], team: ['team.manage'], people: ['people.view', 'org.manage'], gamification: ['gami.manage'],
  audit: ['audit.view'], import: ['system.import'], uat: ['system.import'],
};
const allowed = (user, path) => user.role === 'super' || D.canAny(user, ROUTE_RIGHTS[path] || []);
const firstRoute = (user) => Object.keys(ROUTES).find((p) => allowed(user, p)) ?? '';

const EMP_NAV = [
  ['', [
    ['', 'Bugun', null, 'home'],
    ['results', 'Darajalarim', null, 'user'],
    ['onboarding', 'Moslashuv dasturim', null, 'route', (s, sess) => !!D.onboardingOf(s, sess.employeeId)],
    ['learning', 'Kurslarim', null, 'cards'],
    ['idp', 'Rivojlanish rejam', (s, sess) => s.idp.filter((x) => x.employeeId === sess.employeeId && ['open', 'returned'].includes(x.status)).length, 'route'],
    ['skills', 'Ko‘nikmalarim', null, 'layers'],
    ['career', 'Karyera yo‘lim', null, 'trend'],
    ['kpi', 'KPI ko‘rsatkichlari', null, 'chart', (s, sess) => { const e = s.employees.find((x) => x.id === sess.employeeId); return e && (s.kpiRules.some((r) => r.position === e.position) || s.employees.some((x) => x.supervisorId === e.id)); }],
    ['stretch', 'Stretch vazifam', null, 'target'],
    ['surveys', 'So‘rovnomalarim', (s, sess) => (s.surveySends || []).filter((x) => x.employeeId === sess.employeeId && !x.answeredAt).length + (s.boardTasks || []).filter((t) => t.employeeId === sess.employeeId && t.status === 'confirm').length, 'list'],
    ['meetings', 'Uchrashuvlar', null, 'users'],
    ['colleagues', 'Jamoadoshlar', null, 'users'],
    ['rating', 'Reyting va yutuqlar', null, 'trend'],
    ['inbox', 'Bildirishnomalar', (s, sess) => s.notifications.filter((n) => n.to === s.employees.find((e) => e.id === sess.employeeId)?.name && !n.read).length, 'bell'],
  ]],
];
// Telefondagi pastki tab-panel: 5 band, qolgan bo'limlar «Yana» sahifasida.
const EMP_TABS = [
  { href: '#/', label: 'Bugun', icon: 'home', match: [''] },
  { href: '#/learning', label: 'Oʻqish', icon: 'book', match: ['learning', 'learn', 'onboarding'] },
  { href: '#/idp', label: 'Rivojlanish', icon: 'trend', match: ['idp', 'career', 'skills', 'results', 'stretch', 'kpi'] },
  { href: '#/rating', label: 'Yutuqlar', icon: 'award', match: ['rating'] },
  { href: '#/more', label: 'Yana', icon: 'grid', match: ['more', 'surveys', 'meetings', 'colleagues', 'inbox'] },
];

function AdminNav({ current, state, session, user }) {
  const curHub = hubOf(current);
  const cnt = (p) => (ROUTES[p]?.[1] ? ROUTES[p][1](state, session) : 0);
  return (
    <nav className="nav">
      {ADMIN_NAV.map(([g, items]) => {
        const shown = items.map((it) => {
          if (it.startsWith('hub:')) {
            const key = it.slice(4); const hub = HUBS[key];
            const ok = hub.routes.filter((p) => allowed(user, p));
            if (!ok.length) return null;
            return { path: ok[0], label: hub.label, icon: hub.icon, n: ok.reduce((a, p) => a + cnt(p), 0), active: curHub === key, key: it };
          }
          if (!allowed(user, it)) return null;
          return { path: it, label: ROUTES[it][0], icon: ROUTES[it][2], n: cnt(it), active: current === it, key: it || 'home' };
        }).filter(Boolean);
        if (!shown.length) return null;
        return (
          <div key={g || 'top'}>
            {g && <div className="nav-group">{g}</div>}
            {shown.map((it) => (
              <a key={it.key} href={`#/${it.path}`} className={it.active ? 'active' : ''} aria-current={it.active ? 'page' : undefined}>
                <Icon name={it.icon} />
                <span className="lbl">{it.label}</span>
                {it.n > 0 && <span className="count">{it.n}</span>}
              </a>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function HubTabs({ current, state, session, user }) {
  const key = hubOf(current);
  if (!key) return null;
  const tabs = HUBS[key].routes.filter((p) => allowed(user, p));
  if (tabs.length < 2) return null;
  return (
    <nav className="hub-tabs" aria-label={HUBS[key].label}>
      {tabs.map((p) => { const n = ROUTES[p][1] ? ROUTES[p][1](state, session) : 0; return (
        <a key={p} href={`#/${p}`} className={current === p ? 'on' : ''} aria-current={current === p ? 'page' : undefined}>{ROUTES[p][0]}{n > 0 && <span className="n">{n}</span>}</a>
      ); })}
    </nav>
  );
}

function MoreMenu({ state, session }) {
  const items = EMP_NAV[0][1].filter((it) => !it[4] || it[4](state, session));
  return (
    <>
      <div className="page-head"><div><h1>Barcha bo‘limlar</h1></div></div>
      <nav className="today-links" aria-label="Barcha bo‘limlar">
        {items.map(([path, label, count, icon]) => { const n = count ? count(state, session) : 0; return (
          <a key={path} href={`#/${path}`}><Icon name={icon} /><span style={{ flex: 1 }}>{label}</span>{n > 0 && <span className="count-pill">{n}</span>}</a>
        ); })}
      </nav>
    </>
  );
}

function Nav({ groups, current, state, session, user }) {
  return (
    <nav className="nav">
      {groups.map(([g, items]) => [g, items.filter((it) => (!user || allowed(user, it[0])) && (!it[4] || it[4](state, session)))]).filter(([, items]) => items.length).map(([g, items]) => (
        <div key={g}>
          <div className="nav-group">{g}</div>
          {items.map(([path, label, count, icon]) => {
            const n = count ? count(state, session) : 0;
            return (
              <a key={path} href={`#/${path}`} className={current === path ? 'active' : ''}>
                <Icon name={icon} />
                <span className="lbl">{label}</span>
                {n > 0 && <span className="count">{n}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function App() {
  const state = useAppState();
  const session = useSession();
  const parts = useHashRoute();
  const [p0, p1] = parts;
  const admin = session.mode === 'admin';
  const [cmd, setCmd] = useState(false);
  const [theme, setThemeState] = useState(currentTheme);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [p0, p1]);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v); } if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const user = D.getStaff(state, session.userId) || D.getStaff(state, 'u-super');
  const actives = D.activeEmployees(state);
  const emp = actives.find((e) => e.id === session.employeeId) || actives[0];
  if (p0 === 's' && p1) return <><SurveyLink id={p1} /><Toasts /><DialogHost /></>;
  if (session.loggedOut) return <><Login /><Toasts /></>;

  let page;
  if (admin && !allowed(user, p0 || '')) {
    page = <div className="panel panel-body"><b>{user.name}</b>da bu bo‘lim uchun huquq yo‘q. Huquqni «Adminlar» bo‘limida «Adminlik berish» huquqi bor admin beradi. <a href={`#/${firstRoute(user)}`}>Mening bo‘limlarim</a></div>;
  } else if (admin) {
    if (!p0) page = <Dashboard />;
    else if (p0 === 'team') page = <Team user={user} focus={p1} />;
    else if (p0 === 'people') page = <People key={user.id} user={user} focus={p1} />;
    else if (p0 === 'gamification') page = <Gamification key={user.id} user={user} />;
    else if (p0 === 'onb-dashboard') page = <OnbDashboard key={user.id} user={user} />;
    else if (p0 === 'onboarding') page = <Onboarding key={user.id} user={user} focus={p1} />;
    else if (p0 === 'integration') page = <Integration user={user} />;
    else if (p0 === 'meetings') page = <Meetings key={user.id} user={user} />;
    else if (p0 === 'board') page = <OnbBoard key={user.id} user={user} />;
    else if (p0 === 'surveys') page = <Surveys key={user.id} user={user} />;
    else if (p0 === 'taskboard') page = <TaskBoard key={user.id} user={user} />;
    else if (p0 === 'messages') page = <Messages key={user.id} user={user} />;
    else if (p0 === 'reminders') page = <Reminders user={user} />;
    else if (p0 === 'tasks') page = <TaskQueue key={user.id} user={user} />;
    else if (p0 === 'observations') page = <ObservationPage key={user.id} user={user} focus={p1} />;
    else if (p0 === 'cards' && p1) page = <CardDetail id={p1} user={user} />;
    else if (p0 === 'cards') page = <Cards />;
    else if (p0 === 'stretch') page = <Stretch id={p1} />;
    else if (p0 === 'models' && p1) page = <ModelDetail id={decodeURIComponent(p1)} />;
    else if (p0 === 'models') page = <Models />;
    else if (p0 === 'import') page = <ImportPage />;
    else if (p0 === 'succession') page = <Succession />;
    else if (p0 === 'courses' && p1) page = <CourseDetail id={p1} user={user} />;
    else if (p0 === 'courses') page = <Courses />;
    else if (p0 === 'paths' && p1) page = <PathDetail id={p1} />;
    else if (p0 === 'candidates') page = <Candidates key={p1 || 'x'} initial={p1 ? decodeURIComponent(p1) : null} />;
    else if (p0 === 'kpi') page = <Kpi />;
    else if (p0 === 'teachers') page = <TeacherKpi key={user.id} user={user} />;
    else if (p0 === 'skills') page = <Skills />;
    else if (p0 === 'evidence') page = <EvidenceQueue />;
    else if (p0 === 'idp') page = <Idp />;
    else if (p0 === 'audit') page = <Audit />;
    else if (p0 === 'uat') page = <Uat />;
  } else {
    if (!p0) page = <Today key={emp.id} emp={emp} />;
    else if (p0 === 'results') page = <MyResults key={emp.id} emp={emp} />;
    else if (p0 === 'more') page = <MoreMenu state={state} session={session} />;
    else if (p0 === 'onboarding') page = <MyOnboarding key={emp.id} emp={emp} />;
    else if (p0 === 'idp') page = <MyIdp key={emp.id} emp={emp} />;
    else if (p0 === 'learning') page = <MyLearning key={emp.id} emp={emp} />;
    else if (p0 === 'learn' && p1) page = <Learn key={emp.id + p1} id={p1} emp={emp} />;
    else if (p0 === 'career') page = <Career key={emp.id} emp={emp} />;
    else if (p0 === 'kpi') page = <MyKpi key={emp.id} emp={emp} />;
    else if (p0 === 'skills') page = <MySkills key={emp.id} emp={emp} />;
    else if (p0 === 'stretch') page = <MyStretch key={emp.id} emp={emp} />;
    else if (p0 === 'inbox') page = <Notifications key={emp.id} emp={emp} />;
    else if (p0 === 'colleagues') page = <Colleagues key={emp.id} emp={emp} focus={p1} />;
    else if (p0 === 'rating') page = <MyRating key={emp.id} emp={emp} />;
    else if (p0 === 'surveys') page = <MySurveys key={emp.id} emp={emp} />;
    else if (p0 === 'meetings') page = <MyMeetings key={emp.id} emp={emp} />;
  }
  if (!page) page = <div className="panel panel-body">Sahifa topilmadi. <a href="#/">Bosh sahifa</a></div>;
  if (admin) page = <><HubTabs current={p0 || ''} state={state} session={session} user={user} />{page}</>;

  // ⌘K qidiruv: bo'limlar, xodimlar, kurslar — huquq doirasida
  let cmdItems = [];
  if (cmd) {
    if (admin) {
      cmdItems = Object.keys(ROUTES).filter((p) => allowed(user, p)).map((p) => ({ group: 'Bo‘limlar', label: ROUTES[p][0], hint: HUBS[hubOf(p)]?.label, icon: 'layers', to: `/${p}` }));
      if (allowed(user, 'people')) {
        const sc = D.scopeEmployees(state, user);
        cmdItems = [...actives.filter((e) => !sc || sc.has(e.id)).map((e) => ({ group: 'Xodimlar', label: e.name, hint: `${D.getBranch(state, e.branchId)?.name || ''} · ${OTHER_POSITIONS[e.currentLevel] || e.currentLevel}`, icon: 'user', to: `/people/${e.id}` })), ...cmdItems];
      }
      if (allowed(user, 'courses')) cmdItems = [...cmdItems, ...(state.courses || []).map((c) => ({ group: 'Kurslar', label: c.title, icon: 'book', to: `/courses/${c.id}` }))];
    } else {
      cmdItems = EMP_NAV[0][1].filter((it) => !it[4] || it[4](state, session)).map(([p, label]) => ({ group: 'Bo‘limlar', label, icon: 'layers', to: `/${p}` }));
      cmdItems = [...cmdItems, ...(state.enrollments || []).filter((e) => e.employeeId === emp.id && e.status !== 'archived').map((e) => ({ group: 'Kurslarim', label: D.getCourse(state, e.courseId)?.title || e.courseId, icon: 'book', to: `/learn/${e.id}` }))];
    }
  }
  const tabIdx = EMP_TABS.findIndex((t) => t.match.includes(p0 || ''));

  return (
    <div className={`app ${admin ? 'adm' : 'emp'}${menu ? ' menu-open' : ''}`}>
      {admin && menu && <div className="menu-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}
      <aside className="side" id="admin-menu" aria-label="Admin menyusi">
        <div className="side-brand">
          <BrandMark />
          <div>
            <b>RegUP</b>
            <small>LMS · kompetensiyalar</small>
          </div>
        </div>
        {admin ? <AdminNav current={p0 || ''} state={state} session={session} user={user} /> : <Nav groups={EMP_NAV} current={p0 || ''} state={state} session={session} user={null} />}
        <div className="side-foot">
          <div>Demo prototip. Ma’lumotlar brauzerda saqlanadi.</div>
          <button onClick={() => ask('Barcha demo o‘zgarishlar o‘chadi. Davom etasizmi?', () => resetDemo())}><Icon name="reset" size={14} /> Demoni qayta boshlash</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          {admin && (
            <button className="menu-btn" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Menyuni yopish' : 'Menyuni ochish'} aria-expanded={menu} aria-controls="admin-menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
            </button>
          )}
          <div className="mode-switch">
            <button className={admin ? 'on' : ''} title="HR, baholovchi va rahbar uchun" onClick={() => { setSession({ mode: 'admin' }); go(`/${firstRoute(user)}`); }}>Admin</button>
            <button className={!admin ? 'on' : ''} title="Xodim o‘z kabinetini qanday ko‘radi" onClick={() => { setSession({ mode: 'employee' }); go('/'); }}>Xodim</button>
          </div>
          <button className="cmd-open" onClick={() => setCmd(true)} aria-label="Qidirish (⌘K)"><DsIcon name="search" size={16} /><span className="cmd-txt">Qidirish</span><kbd>⌘K</kbd></button>
          <button className="theme-btn" onClick={() => setThemeState(setTheme(theme === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? 'Yorug‘ temaga o‘tish' : 'Qorong‘i temaga o‘tish'} title={theme === 'dark' ? 'Yorug‘ tema' : 'Qorong‘i tema'}>
            {theme === 'dark'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
          </button>
          <button className="btn sm" style={{ marginLeft: 'auto', order: 9 }} title="Kirish ekrani: Telegram, SMS kod yoki login va parol" onClick={() => setSession({ loggedOut: true })}>Chiqish</button>
          {admin ? (
            <label className="who" title="Har bir admin o‘ziga berilgan huquqlar va doira bo‘yicha ishlaydi">
              <Avatar name={user.role === 'super' ? 'HR LD' : user.name} />
              <select className="i compact" value={user.id} onChange={(e) => { const u = D.getStaff(state, e.target.value); setSession({ userId: u.id }); go(`/${firstRoute(u)}`); }}>
                {state.staff.filter((u) => u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.role === 'super' ? 'Super Admin' : `${u.name} · ${u.title}`}</option>)}
              </select>
            </label>
          ) : (
            <label className="who">
              {emp && <Avatar name={emp.name} />}
              <select className="i compact" value={session.employeeId} onChange={(e) => setSession({ employeeId: e.target.value })}>
                {actives.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} · {OTHER_POSITIONS[e.currentLevel] || e.currentLevel}</option>
                ))}
              </select>
            </label>
          )}
        </header>
        <main className="content">{page}</main>
      </div>
      {!admin && <TabBar className="ru-tabbar-fixed" items={EMP_TABS} active={tabIdx} />}
      {cmd && (
        <div className="cmd-overlay" onClick={() => setCmd(false)}>
          <CommandPalette items={cmdItems} onClose={() => setCmd(false)} onSelect={(it) => { setCmd(false); go(it.to); }} />
        </div>
      )}
      <Toasts />
      <DialogHost />
    </div>
  );
}
