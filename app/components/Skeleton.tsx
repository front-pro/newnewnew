export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3 p-5" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-16 rounded-xl bg-slate-100" />)}</div>;
}
