import Link from 'next/link';
import Avatar from './Avatar';
import SignOutButton from './SignOutButton';

export default function Header({ profile, breadcrumb }) {
  return (
    <>
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="name">Журнал студии</span>
          <span className="studio">ze.studio</span>
        </Link>
        <div className="user">
          {profile && (
            <>
              <span className="user-name">{profile.display_name || profile.email}</span>
              <Link href="/profile">
                <Avatar id={profile.id} name={profile.display_name || profile.email} url={profile.avatar_url} size={30} />
              </Link>
            </>
          )}
          <SignOutButton
            className="btn btn-secondary btn-sm"

          />
        </div>
      </header>
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="breadcrumb">
          {breadcrumb.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span className="crumb-sep">→</span>}
              {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
