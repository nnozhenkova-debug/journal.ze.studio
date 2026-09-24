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
          <div className="page-header">
            <div>
              <h1 className="h1">Лента<span style={{ color: 'var(--gold)' }}>.</span></h1>
              <p className="h1-sub">за последние 30 дней</p>
            </div>
          </div>

          <EventsBoard events={events} projects={projects} />
        </div>
      </div>
    </div>
  );
}
