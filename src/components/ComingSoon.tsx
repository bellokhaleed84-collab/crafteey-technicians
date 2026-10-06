export default function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-5 pt-8">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-surface-border bg-surface p-8 text-center">
        <p className="font-semibold text-ink">Coming soon</p>
        <p className="mt-1 text-sm text-ink-muted">{text}</p>
      </div>
    </div>
  );
}