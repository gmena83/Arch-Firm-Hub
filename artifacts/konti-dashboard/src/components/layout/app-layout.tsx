import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 md:overflow-auto pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
