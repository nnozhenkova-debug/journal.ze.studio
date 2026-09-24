import Header from '../../components/Header';
import ProfileForm from '../../components/ProfileForm';
import { getCurrentProfile } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал студии', href: '/' }, { label: 'Профиль' }]} />
      <div className="shell">
        <div className="section" style={{ maxWidth: 620 }}>
          <h1 className="h1">Профиль<span style={{ color: 'var(--gold)' }}>.</span></h1>
          <p className="h1-sub" style={{ marginBottom: 24 }}>Личные настройки аккаунта</p>
          {profile ? <ProfileForm profile={profile} /> : <p>Не удалось загрузить профиль.</p>}
        </div>
      </div>
    </div>
  );
}
