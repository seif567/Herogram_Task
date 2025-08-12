import React, { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur sticky top-0 z-40 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">H</div>
            <div className="font-semibold">Herogram</div>
          </div>
          <nav className="text-sm text-neutral-600"> {/* add links if needed */} </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="text-sm text-neutral-500 py-6 text-center">
        © {new Date().getFullYear()} Herogram - Interview
      </footer>
    </div>
  );
}
