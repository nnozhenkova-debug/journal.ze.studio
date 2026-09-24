import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import Pill from '../../components/Pill';
import { getCurrentProfile, listProfiles } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [profile, team] = await Promise.all([getCurrentProfile(), listProfiles()]);

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Команда студии' }]} />
      <div className="shell">
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <div>
              <div className="micro-label" style={{ marginBottom: 10 }}>Команда</div>
              <h1 className="h1" style={{ fontSize: 28 }}>Команда студии</h1>
            </div>
            <span className="pill pill-neutral">{team.length} {teamWord(team.length)}</span>
          </div>

          <div className="card">
            {team.map((member) => (
              <div key={member.id} className="list-row card-row" style={{ alignItems: 'center' }}>
                <Avatar id={member.id} name={member.display_name || member.email} size={34} />
                <div style={{ flex: 1 }}>
                  <div className="row-title">{member.display_name || member.email}</div>
                  <div className="row-sub">{member.role || 'Участник команды'} · {member.email}</div>
                </div>
                <Pill variant={member.status === 'active' ? 'ok' : 'neutral'}>
                  {member.status === 'active' ? 'Активен' : 'Приглашён'}
                </Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function teamWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'человека';
  return 'человек';
}
