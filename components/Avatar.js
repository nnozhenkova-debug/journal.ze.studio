import { initials, colorForId } from '../lib/format';

export default function Avatar({ id, name, size = 32, style, url }) {
  const dim = size;

  if (url) {
    return (
      <img
        src={url}
        alt={name || ''}
        className="avatar"
        style={{
          width: dim,
          height: dim,
          objectFit: 'cover',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className="avatar"
      style={{
        width: dim,
        height: dim,
        fontSize: Math.max(10, Math.round(dim * 0.38)),
        background: colorForId(id || name),
        ...style,
      }}
    >
      {initials(name)}
    </div>
  );
}
