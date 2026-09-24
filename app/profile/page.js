import Header from '../../components/Header';
import ProfileForm from '../../components/ProfileForm';
import { getCurrentProfile } from '../../lib/data';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <Header profile={profile} breadcrumb={[{ label: 'Журнал', href: '/' }, { label: 'Профиль и настройки' }]} />
      <div className="shell">
        <div className="section" style={{ maxWidth: 520 }}>
          <div className="micro-label" style={{ marginBottom: 10 }}>Профиль</div>
          <h1 className="h1" style={{ fontSize: 28, marginBottom: 24 }}>Профиль и настройки</h1>
          {profile ? <ProfileForm profile={profile} /> : <p>Не удалось загрузить профиль.</p>}
        </div>
      </div>
    </div>
  );
}
