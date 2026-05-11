import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex h-screen bg-[#080808] border-0 text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-[#1A1A1A] flex items-center justify-between px-10 shrink-0">
           <div className="flex items-center gap-4">
             <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/60">ADMIN VIEW</span>
             <h2 className="text-xl font-bold tracking-tight">Nexus Workspace</h2>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
