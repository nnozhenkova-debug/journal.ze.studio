import { initials, colorForId } from '../lib/format';

export default function Avatar({ id, name, size = 32, style }) {
  const dim = size;
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
