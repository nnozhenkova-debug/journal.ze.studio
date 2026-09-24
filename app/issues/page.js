import Header from '../../components/Header';
import IssuesBoard from '../../components/IssuesBoard';
import { getCurrentProfile, listIssues, listProjects } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function IssuesPage() {
  const [profile, issues, projects] = await Promise.all([
    getCurrentProfile(),
    listIssues({ status: 'open' }),
    listProjects(),
  ]);

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал студии', href: '/' }, { label: 'Открытые проблемы' }]} />
      <div className="shell">
        <div className="section">
          <div className="page-header">
            <div>
              <h1 className="h1">Проблемы<span style={{ color: 'var(--gold)' }}>.</span></h1>
              <p className="h1-sub">
                {issues.length} открытых
                {criticalCount > 0 && <> · <span style={{ color: 'var(--crit-fg)' }}>{criticalCount} критичных</span></>}
              </p>
            </div>
          </div>

          <IssuesBoard issues={issues} projects={projects} />
        </div>
      </div>
    </div>
  );
}
