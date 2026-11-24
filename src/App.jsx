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
import { kpiValue, kpiResult, kpiMonths } from './core/domain.js';
import * as D from './core/domain.js';
import { OTHER_POSITIONS } from './core/modelKit.js';

const ADMIN_NAV = [
  ['Ish jarayoni', [
    ['', 'Bosh panel', null, 'home'],
    ['cards', 'Baholash kartalari', (s) => s.cards.filter((c) => c.stage !== 'published').length, 'cards'],
    ['stretch', 'Stretch vazifalar', (s) => s.stretches.filter((x) => x.status === 'submitted').length, 'target'],
    ['evidence', 'Qo‘shimcha dalillar', (s) => s.evidenceQueue.filter((x) => x.status === 'pending').length, 'inbox'],
    ['idp', 'Rivojlanish rejalari', (s) => s.idp.filter((x) => x.status === 'proposed' || x.status === 'review').length, 'route'],
    ['candidates', 'Nomzod tanlash', null, 'trend'],
    ['succession', 'Vorislik', null, 'users'],
    ['teachers', 'Ustozlar KPI', (s, sess) => { const m = kpiMonths(s).at(-1); const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return D.activeEmployees(s).filter((e) => (!sc || sc.has(e.id)) && s.kpiRules.some((r) => r.position === e.position && kpiValue(kpiResult(s, e.id, m), r)?.below)).length; }, 'chart'],
  ]],
  ['Moslashuv (onboarding)', [
    ['onb-dashboard', 'Onboarding dashboard', null, 'chart'],
    ['board', 'Onboarding doskasi', (s, sess) => { const u = D.getStaff(s, sess.userId); return D.boardItems(s, u).filter((o) => D.checkLate(s, o) > 0).length; }, 'layers'],
    ['onboarding', 'Moslashuv — 60 kun', (s, sess) => { const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return s.onboardings.filter((o) => o.status === 'active' && (!sc || sc.has(o.employeeId)) && (D.onboardingScore(s, o).ready || D.onbDay(s, o) >= D.obDays(s, o))).length; }, 'user'],
    ['integration', 'Integratsiya navbati', (s) => s.hrInbox.length, 'upload'],
    ['tasks', 'Topshiriqlarni tekshirish', (s, sess) => { const u = D.getStaff(s, sess.userId); return s.enrollments.reduce((a, e) => a + (D.canReviewTask(s, u, e) && e.status !== 'archived' ? Object.values(e.progress).filter((p) => p.status === 'pending').length : 0), 0); }, 'check'],
    ['observations', 'Dars kuzatuvi', (s, sess) => { const sc = D.scopeEmployees(s, D.getStaff(s, sess.userId)); return s.onboardings.filter((o) => o.status === 'active' && (!sc || sc.has(o.employeeId)) && D.onbObservations(s, o).length < (D.onbProgram(s, D.getEmployee(s, o.employeeId))?.observations || 0)).length; }, 'target'],
    ['surveys', 'So‘rovnomalar', (s, sess) => D.dueSurveySends(s).length + (s.surveySends || []).filter((x) => x.to === D.getStaff(s, sess.userId)?.name && !x.answeredAt).length, 'list'],
    ['taskboard', 'Topshiriqlar doskasi', (s, sess) => { const u = D.getStaff(s, sess.userId); return (s.boardTasks || []).filter((t) => t.status === 'new' && D.canSeeTask(s, u, t)).length; }, 'inbox'],
    ['meetings', 'Uchrashuvlar', (s) => s.meetings.filter((m) => m.status === 'proposed').length, 'users'],
    ['reminders', 'Eslatmalar', (s) => D.dueReminders(s).filter((r) => !s.notifications.some((n) => n.key.startsWith(r.key))).length, 'bell'],
  ]],
  ['O‘qitish', [
    ['skills', 'Ko‘nikmalar', (s) => (s.empSkills || []).filter((x) => x.claim).length, 'check'],
    ['courses', 'Kurslar va Learning Path', (s) => (s.enrollments || []).filter((e) => !D.getCourse(s, e.courseId)?.onboarding).reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0), 'layers'],
  ]],
  ['Sozlamalar', [
    ['models', 'Kompetensiya modellari', null, 'layers'],
    ['kpi', 'Yangi filial KPI', null, 'chart'],
    ['people', 'Umumiy jamoa a’zolari', null, 'users'],
    ['messages', 'Xabar yuborish', null, 'bell'],
    ['gamification', 'Gamifikatsiya', null, 'target'],
    ['team', 'Adminlar', null, 'user'],
  ]],
  ['Tizim', [
    ['audit', 'O‘zgarishlar jurnali', null, 'list'],
    ['import', 'Exceldan import', null, 'upload'],
    ['uat', 'Qabul sinovlari', null, 'check'],
  ]],
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
const firstRoute = (user) => ADMIN_NAV.flatMap(([, items]) => items.map((it) => it[0])).find((p) => allowed(user, p)) ?? '';

const EMP_NAV = [
  ['Mening kabinetim', [
    ['', 'Mening natijam', null, 'user'],
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
    if (!p0) page = <MyResults key={emp.id} emp={emp} />;
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

  return (
    <div className="app">
      <aside className="side">
        <div className="side-brand">
          <BrandMark />
          <div>
            <b>RegUP</b>
            <small>LMS · kompetensiyalar</small>
          </div>
        </div>
        <Nav groups={admin ? ADMIN_NAV : EMP_NAV} current={p0 || ''} state={state} session={session} user={admin ? user : null} />
        <div className="side-foot">
          <div>Demo prototip. Ma’lumotlar brauzerda saqlanadi.</div>
          <button onClick={() => ask('Barcha demo o‘zgarishlar o‘chadi. Davom etasizmi?', () => resetDemo())}><Icon name="reset" size={14} /> Demoni qayta boshlash</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="mode-switch">
            <button className={admin ? 'on' : ''} title="HR, baholovchi va rahbar uchun" onClick={() => { setSession({ mode: 'admin' }); go(`/${firstRoute(user)}`); }}>Admin</button>
            <button className={!admin ? 'on' : ''} title="Xodim o‘z kabinetini qanday ko‘radi" onClick={() => { setSession({ mode: 'employee' }); go('/'); }}>Xodim</button>
          </div>
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
      <Toasts />
      <DialogHost />
    </div>
  );
}
