import Link from 'next/link';
import Header from '../../components/Header';
import EmptyState from '../../components/EmptyState';
import { getCurrentProfile, listProjects } from '../../lib/data';
import { PROJECT_COLOR_HEX } from '../../lib/retro-constants';
import { pluralRu } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const [profile, projects] = await Promise.all([getCurrentProfile(), listProjects()]);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Проекты' }]} />
      <div className="shell">
        <div className="section">
          <div className="page-header" style={{ marginBottom: 24 }}>
            <div>
              <h1 className="h1">Проекты<span style={{ color: 'var(--gold)' }}>.</span></h1>
              <p className="h1-sub">{projects.length} {pluralRu(projects.length, 'активный проект', 'активных проекта', 'активных проектов')}</p>
            </div>
          </div>

          {projects.length === 0 ? (
            <EmptyState>Активных проектов пока нет.</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card" style={{ padding: 18, display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: PROJECT_COLOR_HEX[p.color_key] || '#999' }} />
                    <span style={{ fontSize: 11, color: 'var(--gray-1)', fontWeight: 600, letterSpacing: '0.04em' }}>{p.shortcode}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                  {p.client && <div style={{ fontSize: 12, color: 'var(--gray-2)', marginTop: 4 }}>{p.client}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
