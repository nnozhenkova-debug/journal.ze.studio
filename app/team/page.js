import Header from '../../components/Header';
import TeamBoard from '../../components/TeamBoard';
import { getCurrentProfile, listProfiles } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [profile, team] = await Promise.all([getCurrentProfile(), listProfiles()]);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал студии', href: '/' }, { label: 'Команда' }]} />
      <div className="shell">
        <div className="section">
          <TeamBoard team={team} isAdmin={!!profile?.is_admin} />
        </div>
      </div>
    </div>
  );
}
