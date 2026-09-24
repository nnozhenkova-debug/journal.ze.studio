import Header from '../../components/Header';
import EventsBoard from '../../components/EventsBoard';
import { getCurrentProfile, listEvents, listProjects } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [profile, events, projects] = await Promise.all([
    getCurrentProfile(),
    listEvents({ since }),
    listProjects(),
  ]);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал студии', href: '/' }, { label: 'Лента событий' }]} />
      <div className="shell">
        <div className="section">
          <div className="micro-label" style={{ marginBottom: 6 }}>Журнал студии</div>
          <h1 className="page-heading">Лента<span style={{ color: 'var(--gold)' }}>.</span></h1>
          <p className="page-sub">за последние 30 дней</p>

          <EventsBoard events={events} projects={projects} />
        </div>
      </div>
    </div>
  );
}
