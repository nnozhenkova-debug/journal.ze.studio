import Link from 'next/link';
import Header from '../../components/Header';
import IssueRow from '../../components/IssueRow';
import EmptyState from '../../components/EmptyState';
import { getCurrentProfile, listIssues } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function IssuesPage({ searchParams }) {
  const filter = searchParams?.status === 'resolved' ? 'resolved' : searchParams?.status === 'all' ? undefined : 'open';
  const [profile, issues] = await Promise.all([
    getCurrentProfile(),
    listIssues(filter ? { status: filter } : {}),
  ]);

  const tabs = [
    { key: 'open', label: 'Открытые' },
    { key: 'resolved', label: 'Решённые' },
    { key: 'all', label: 'Все' },
  ];
  const active = searchParams?.status || 'open';

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Проблемы' }]} />
      <div className="shell">
        <div className="section">
          <div className="micro-label" style={{ marginBottom: 10 }}>Проблемы</div>
          <h1 className="h1" style={{ fontSize: 28, marginBottom: 20 }}>Все проблемы</h1>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/issues?status=${t.key}`}
                className="btn btn-sm"
                style={{
                  background: active === t.key ? 'var(--near)' : 'var(--white)',
                  color: active === t.key ? 'var(--white)' : 'var(--near)',
                  border: '1px solid var(--border)',
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {issues.length === 0 ? (
            <EmptyState>Ничего не найдено.</EmptyState>
          ) : (
            <div className="card">
              {issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
