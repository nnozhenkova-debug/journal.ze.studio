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
                <Avatar id={profile.id} name={profile.display_name || profile.email} size={30} />
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
            <span key={i}>
              {i > 0 && ' / '}
              {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
