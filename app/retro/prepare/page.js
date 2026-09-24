import Header from '../../../components/Header';
import PrepareForm from '../../../components/PrepareForm';
import { getCurrentProfile, listProjects } from '../../../lib/data';
import { RETRO_TEMPLATES } from '../../../lib/retro-constants';

export const dynamic = 'force-dynamic';

export default async function PrepareRetroPage({ searchParams }) {
  const [profile, projects] = await Promise.all([getCurrentProfile(), listProjects()]);

  const initialTemplateId = searchParams?.template && RETRO_TEMPLATES.some((t) => t.id === searchParams.template)
    ? searchParams.template
    : RETRO_TEMPLATES[0].id;
  const initialProjectId = searchParams?.project || (projects[0]?.id ?? null);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Перед началом ретро' }]} />
      <div className="shell">
        <div className="section">
          <div className="micro-label" style={{ marginBottom: 10 }}>Перед началом</div>
          <h1 className="h1" style={{ fontSize: 28, marginBottom: 6 }}>Подготовка к ретро</h1>
          <p className="h1-sub" style={{ marginBottom: 28 }}>
            Выберите метод и этап — увидите, как он прошёл, прежде чем начать обсуждение.
          </p>
          <PrepareForm
            templates={RETRO_TEMPLATES}
            projects={projects}
            initialTemplateId={initialTemplateId}
            initialProjectId={initialProjectId}
            profileId={profile?.id || null}
          />
        </div>
      </div>
    </div>
  );
}
