import PrepareForm from '../../../components/PrepareForm';
import { getCurrentProfile, listProjects } from '../../../lib/data';
import { RETRO_TEMPLATES } from '../../../lib/retro-constants';

export const dynamic = 'force-dynamic';

export default async function PrepareRetroPage({ searchParams }) {
  const [profile, projects] = await Promise.all([getCurrentProfile(), listProjects()]);

  const initialTemplateId = searchParams?.template && RETRO_TEMPLATES.some((t) => t.id === searchParams.template)
    ? searchParams.template
    : RETRO_TEMPLATES[0].id;
  const initialProjectId = searchParams?.project || null;

  return (
    <div className="shell">
      <div className="section">
        <PrepareForm
          templates={RETRO_TEMPLATES}
          projects={projects}
          initialTemplateId={initialTemplateId}
          initialProjectId={initialProjectId}
          profileId={profile?.id || null}
        />
      </div>
    </div>
  );
}
