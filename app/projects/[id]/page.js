import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../../../components/Header';
import Pill from '../../../components/Pill';
import EmptyState from '../../../components/EmptyState';
import {
  getCurrentProfile,
  getProject,
  listStages,
  listIssues,
  listRetros,
} from '../../../lib/data';
import { PROJECT_COLOR_HEX, STAGE_STATE_LABEL, SEVERITY_PILL_CLASS, SEVERITY_LABEL } from '../../../lib/retro-constants';
import { minutesToHours, percent, dayMonth } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [profile, stages, issues, retros] = await Promise.all([
    getCurrentProfile(),
    listStages(project.id),
    listIssues({ projectId: project.id }),
    listRetros({ projectId: project.id }),
  ]);

  const totalPlanned = stages.reduce((sum, s) => sum + (s.planned_minutes || 0), 0);
  const totalActual = stages.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
  const currentStage = stages.find((s) => s.state === 'current');

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Проекты', href: '/projects' }, { label: project.name }]} />
      <div className="shell">
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PROJECT_COLOR_HEX[project.color_key] || '#999' }} />
            <span className="micro-label">{project.shortcode}</span>
          </div>
          <h1 className="h1" style={{ fontSize: 32, marginBottom: 6 }}>{project.name}</h1>
          {project.client && <p className="h1-sub" style={{ marginBottom: 24 }}>{project.client}</p>}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href={`/retro/prepare?project=${project.id}`} className="btn btn-primary">Начать ретро →</Link>
            <span className="card" style={{ padding: '10px 16px', fontSize: 13, color: 'var(--gray-2)' }}>
              Бюджет часов: {minutesToHours(totalActual)} / {minutesToHours(totalPlanned)} ч
              {totalPlanned > 0 && ` (${percent(totalActual, totalPlanned)}%)`}
            </span>
          </div>

          <div className="micro-label" style={{ marginBottom: 14 }}>Этапы</div>
          {stages.length === 0 ? (
            <EmptyState>Этапы ещё не добавлены.</EmptyState>
          ) : (
            <div className="card" style={{ marginBottom: 28 }}>
              {stages.map((s) => (
                <div key={s.id} className="list-row card-row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div className="row-title">{s.name}</div>
                    <div className="row-sub">
                      {dayMonth(s.start_date)} — {dayMonth(s.end_date)}
                      {'  ·  '}{minutesToHours(s.actual_minutes)} / {minutesToHours(s.planned_minutes)} ч
                    </div>
                  </div>
                  <Pill variant={s.state === 'current' ? 'important' : s.state === 'past' ? 'ok' : 'neutral'}>
                    {STAGE_STATE_LABEL[s.state]}
                  </Pill>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="micro-label" style={{ marginBottom: 14 }}>Проблемы</div>
              {issues.length === 0 ? (
                <EmptyState>Открытых проблем нет.</EmptyState>
              ) : (
                <div className="card">
                  {issues.map((issue) => (
                    <div key={issue.id} className="list-row card-row" style={{ justifyContent: 'space-between' }}>
                      <div className="row-title">{issue.title}</div>
                      <Pill variant={SEVERITY_PILL_CLASS[issue.severity]?.replace('pill-', '') || 'neutral'}>
                        {SEVERITY_LABEL[issue.severity]}
                      </Pill>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="micro-label" style={{ marginBottom: 14 }}>История ретро</div>
              {retros.length === 0 ? (
                <EmptyState>Ретро по проекту ещё не проводились.</EmptyState>
              ) : (
                <div className="card">
                  {retros.map((r) => (
                    <Link key={r.id} href={r.status === 'completed' ? `/retro/${r.id}` : `/retro/${r.id}`} className="list-row card-row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <div className="row-title">{r.title}</div>
                        <div className="row-sub">{dayMonth(r.scheduled_date)}</div>
                      </div>
                      <Pill variant={r.status === 'completed' ? 'ok' : r.status === 'in_progress' ? 'important' : 'neutral'}>
                        {r.status === 'completed' ? 'Завершено' : r.status === 'in_progress' ? 'Идёт' : 'Запланировано'}
                      </Pill>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
