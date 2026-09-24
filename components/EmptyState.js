import Link from 'next/link';

export default function EmptyState({ children, cta, icon }) {
  return (
    <div className="empty-card">
      {icon && <span className="empty-card-icon">{icon}</span>}
      <p className="empty-card-text">{children}</p>
      {cta && (
        <Link href={cta.href} className="btn btn-primary btn-sm">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
