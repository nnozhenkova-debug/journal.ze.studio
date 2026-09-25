import { notFound } from 'next/navigation';
import RetroSession from '../../../components/RetroSession';
import {
  getCurrentProfile,
  getRetro,
  listRetroNotes,
  listActionItems,
  listRetroHighlights,
  listRetroEnergy,
  listRetroParticipants,
  listProfiles,
} from '../../../lib/data';
import { getTemplate } from '../../../lib/retro-constants';

export const dynamic = 'force-dynamic';

export default async function RetroSessionPage({ params }) {
  const retro = await getRetro(params.id);
  if (!retro) notFound();

  const template = getTemplate(retro.template);
  const [profile, notes, actionItems, highlights, energy, participants, teamProfiles] = await Promise.all([
    getCurrentProfile(),
    listRetroNotes(retro.id),
    listActionItems(retro.id),
    listRetroHighlights(retro.id),
    listRetroEnergy(retro.id),
    listRetroParticipants(retro.id),
    listProfiles(),
  ]);

  return (
    <div className="shell">
      <div className={`section${retro.status === 'in_progress' || retro.status === 'scheduled' ? ' has-action-footer' : ''}`}>
        <RetroSession
          retro={retro}
          template={template}
          initialNotes={notes}
          initialActionItems={actionItems}
          initialHighlights={highlights}
          initialEnergy={energy}
          participants={participants}
          teamProfiles={teamProfiles}
          profile={profile}
        />
      </div>
    </div>
  );
}
