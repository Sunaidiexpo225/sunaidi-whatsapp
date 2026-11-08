import { AppHeader } from "./app-header";

export function PageShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
