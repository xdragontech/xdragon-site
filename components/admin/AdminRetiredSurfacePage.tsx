type AdminRetiredSurfacePageProps = {
  title: string;
  description: string;
  targetUrl: string | null;
  actionLabel: string;
};

export default function AdminRetiredSurfacePage({
  title,
  description,
  targetUrl,
  actionLabel,
}: AdminRetiredSurfacePageProps) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16 text-neutral-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-neutral-600">{description}</p>
        {targetUrl ? (
          <a
            href={targetUrl}
            className="mt-6 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {actionLabel}
          </a>
        ) : (
          <p className="mt-6 text-sm text-neutral-700">
            The command admin host could not be resolved from runtime config on this request. Use the Command admin
            installation directly.
          </p>
        )}
      </div>
    </main>
  );
}
