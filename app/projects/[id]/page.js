import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '../../../components/Header';
import Avatar from '../../../components/Avatar';
import EmptyState from '../../../components/EmptyState';
import {
  getCurrentProfile,
  getProject,
  getProfileById,
  getProjectMembers,
  listStages,
  listIssues,
  listProjectRetros,
  listProjects,
} from '../../../lib/data';
import {
  PROJECT_PALETTE,
  PROJECT_STATUS_LABEL,
  SEVERITY_PILL_CLASS,
  SEVERITY_LABEL,
} from '../../../lib/retro-constants';
import { minutesToHours, percent, dayMonthShort, daysAgoLabel, shortName, pluralRu } from '../../../lib/format';

export const dynamic = 'force-dynamic';

const RETRO_STATUS_LABEL = {
  scheduled: 'Запланировано',
  in_progress: 'Идёт',
  completed: 'Завершено',
};

export default async function ProjectPage({ params }) {
  const project = await getProject(params.id);
  if (!project) notFound();

  const [profile, stages, issues, retros, members, allProjects] = await Promise.all([
    getCurrentProfile(),
    listStages(project.id),
    listIssues({ status: 'open', projectId: project.id }),
    listProjectRetros(project.id),
    getProjectMembers(project.id),
    listProjects(),
  ]);

  const responsible = await getProfileById(project.responsible_id);

  const totalPlanned = stages.reduce((sum, s) => sum + (s.planned_minutes || 0), 0);
  const totalActual = stages.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);

  const nearestDeadline = stages
    .filter((s) => s.state !== 'past' && s.end_date)
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))[0]?.end_date || null;

  const pal = PROJECT_PALETTE[project.color_key] || PROJECT_PALETTE.slate;
  const otherProjects = allProjects.filter((p) => p.id !== project.id);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал студии', href: '/' }, { label: project.name }]} />
      <div className="shell">
        <div className="section">
          <div className="project-head">
            <span className="project-swatch" style={{ background: pal.bg, borderColor: pal.border }} />
            <h1 className="h1">
              {project.name}
              <span style={{ color: 'var(--gold)' }}>.</span>
            </h1>
          </div>
          <p className="h1-sub">
            {project.client && <>Клиент: {project.client} · </>}
            Статус: {PROJECT_STATUS_LABEL[project.status] || project.status}
            {' · '}Ответственный: {responsible?.display_name || 'Не назначен'}
          </p>

          <div className="stat-grid">
            <div className="stat-cell">
              <div className="micro-label">Часы</div>
              <div className="stat-value-row">
                <span className="stat-value">{minutesToHours(totalActual)} / {minutesToHours(totalPlanned)}</span>
                <span className="stat-unit">план</span>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${percent(totalActual, totalPlanned)}%` }} />
              </div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Бюджет</div>
              <div className="stat-value-row">
                <span className="stat-value">{project.budget_used_percent != null ? `${project.budget_used_percent}%` : '—'}</span>
                {project.budget_used_percent != null && <span className="stat-unit">использовано</span>}
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${project.budget_used_percent || 0}%` }} />
              </div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Ближайший дедлайн</div>
              <div className="stat-value-row">
                <span className="stat-value">{nearestDeadline ? dayMonthShort(nearestDeadline) : '—'}</span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="micro-label">Открытых проблем</div>
              <div className="stat-value-row">
                <span className="stat-value">{issues.length}</span>
                <span className="stat-unit">{pluralRu(issues.length, 'проблема', 'проблемы', 'проблем')}</span>
              </div>
            </div>
          </div>

          <div className="detail-columns">
            <div className="detail-col">
              <div className="side-card">
                <div className="side-card-head">
                  <span className="micro-label">Ретро по проекту</span>
                  <span className="record-see-all" style={{ fontSize: 11 }}>
                    {retros.length} {pluralRu(retros.length, 'сессия', 'сессии', 'сессий')}
                  </span>
                </div>
                {retros.length === 0 ? (
                  <div style={{ padding: '14px 22px' }}>
                    <EmptyState cta={{ label: 'Начать первое ретро →', href: `/retro/prepare?project=${project.id}` }}>
                      Ретро по этому проекту ещё не проводились
                    </EmptyState>
                  </div>
                ) : (
                  retros.map((r) => {
                    const done = r.status === 'completed';
                    const shortTitle = r.title.replace(/^Ретро:\s*/, '');
                    const names = r.participantNames.map(shortName).join(', ');
                    return (
                      <Link key={r.id} href={`/retro/${r.id}`} className="table-row card-row">
                        <span className="event-dot" style={{ background: done ? '#22a547' : '#aaaaaa' }} />
                        <div>
                          <div className="row-title">{RETRO_STATUS_LABEL[r.status] || r.status} · {shortTitle}</div>
                          <div className="row-sub">
                            {dayMonthShort(r.scheduled_date)}
                            {names && ` · ${names}`}
                          </div>
                        </div>
                        <span className="row-meta">→</span>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="side-card">
                <div className="side-card-head">
                  <span className="micro-label">Открытые проблемы</span>
                  {issues.length > 0 && <span className="record-count">{issues.length}</span>}
                </div>
                {issues.length === 0 ? (
                  <div style={{ padding: '14px 22px' }}>
                    <EmptyState>Открытых проблем нет — всё под контролем</EmptyState>
                  </div>
                ) : (
                  issues.map((issue) => (
                    <Link key={issue.id} href="/issues" className="table-row card-row">
                      <span className={`pill ${SEVERITY_PILL_CLASS[issue.severity] || 'pill-neutral'}`}>
                        {SEVERITY_LABEL[issue.severity]}
                      </span>
                      <div>
                        <div className="row-title">{issue.title}</div>
                        <div className="row-sub">
                          {'Ответственный: '}
                          {issue.responsible_id ? 'Назначен' : 'Не назначен'}
                        </div>
                      </div>
                      <span className="row-meta">{daysAgoLabel(issue.created_at)} →</span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="side-col">
              <div className="side-card">
                <div className="side-card-head">
                  <span className="micro-label">Команда проекта</span>
                </div>
                {members.length === 0 ? (
                  <div style={{ padding: '14px 22px' }}>
                    <EmptyState>Участники ещё не добавлены.</EmptyState>
                  </div>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="member-row">
                      <Avatar id={m.id} name={m.display_name} url={m.avatar_url} size={36} />
                      <div>
                        <div className="member-name">{m.display_name}</div>
                        {m.role && <div className="member-role">{m.role}</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="side-card">
                <div className="side-card-head">
                  <span className="micro-label">Другие проекты</span>
                </div>
                {otherProjects.length === 0 ? (
                  <div style={{ padding: '14px 22px' }}>
                    <EmptyState>Других проектов нет.</EmptyState>
                  </div>
                ) : (
                  otherProjects.map((p) => {
                    const ppal = PROJECT_PALETTE[p.color_key] || PROJECT_PALETTE.slate;
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`} className="mini-project-row">
                        <span className="mini-project-swatch" style={{ background: ppal.bg, borderColor: ppal.border }} />
                        <span className="mini-project-name">{p.name}</span>
                        <span className="row-meta">→</span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
