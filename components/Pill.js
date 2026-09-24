export default function Pill({ variant = 'neutral', children }) {
  return <span className={`pill pill-${variant}`}>{children}</span>;
}
