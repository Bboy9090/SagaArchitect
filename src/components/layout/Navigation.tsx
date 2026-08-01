'use client';

import { Sidebar } from './Sidebar';

export function Navigation({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-transparent studio-grid">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
