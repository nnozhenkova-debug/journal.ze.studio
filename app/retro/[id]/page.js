import { notFound } from 'next/navigation';
import RetroSession from '../../../components/RetroSession';
import {
  getCurrentProfile,
  getRetro,
  listRetroNotes,
  listActionItems,
  listRetroEnergy,
  listRetroParticipants,
} from '../../../lib/data';
import { getTemplate } from '../../../lib/retro-constants';

export const dynamic = 'force-dynamic';

export default async function RetroSessionPage({ params }) {
  const retro = await getRetro(params.id);
  if (!retro) notFound();

  const template = getTemplate(retro.template);
  const [profile, notes, actionItems, energy, participants] = await Promise.all([
    getCurrentProfile(),
    listRetroNotes(retro.id),
    listActionItems(retro.id),
    listRetroEnergy(retro.id),
    listRetroParticipants(retro.id),
  ]);

  return (
    <div className="shell">
      <div className={`section${retro.status === 'in_progress' ? ' has-action-footer' : ''}`}>
        <RetroSession
          retro={retro}
          template={template}
          initialNotes={notes}
          initialActionItems={actionItems}
          initialEnergy={energy}
          participants={participants}
          profile={profile}
        />
      </div>
    </div>
  );
}
