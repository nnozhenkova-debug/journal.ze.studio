import { notFound } from 'next/navigation';
import Header from '../../../components/Header';
import RetroSession from '../../../components/RetroSession';
import { getCurrentProfile, getRetro, listRetroNotes, listRetroParticipants } from '../../../lib/data';
import { getTemplate } from '../../../lib/retro-constants';

export const dynamic = 'force-dynamic';

export default async function RetroSessionPage({ params }) {
  const retro = await getRetro(params.id);
  if (!retro) notFound();

  const template = getTemplate(retro.template);
  const [profile, notes, participants] = await Promise.all([
    getCurrentProfile(),
    listRetroNotes(retro.id),
    listRetroParticipants(retro.id),
  ]);

  return (
    <div>
      <Header
        profile={profile}
        breadcrumb={[
          { label: 'Журнал', href: '/' },
          { label: retro.projects?.name || 'Проект', href: retro.project_id ? `/projects/${retro.project_id}` : '/' },
          { label: retro.title },
        ]}
      />
      <div className="shell">
        <div className="section">
          <RetroSession
            retro={retro}
            template={template}
            initialNotes={notes}
            participants={participants}
            profile={profile}
          />
        </div>
      </div>
    </div>
  );
}
