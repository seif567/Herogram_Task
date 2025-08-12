import React from 'react';
import clsx from 'clsx';

export default function Sidebar({
  titles,
  activeId,
  onSelect,
  onNew,
  onLogout,
  userEmail
}: {
  titles: { id: string | number; title: string }[];
  activeId?: string | number | null;
  onSelect: (id: string | number) => void;
  onNew: () => void;
  onLogout: () => void;
  userEmail?: string | null;
}) {
  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-6">
        <div className="text-lg font-bold">AI Image Generator</div>
        {userEmail && <div className="text-xs text-slate-400 mt-1">{userEmail}</div>}
      </div>

      <div className="mb-4">
        <button onClick={onNew} className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-medium py-2 rounded">
          + New
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <ul className="space-y-2">
          {titles && titles.length ? (
            titles.map((t) => (
              <li key={t.id}>
                <button
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded',
                    activeId === t.id ? 'bg-blue-500' : 'hover:bg-slate-700'
                  )}
                  onClick={() => onSelect(t.id)}
                >
                  {t.title}
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-400 px-2">No titles yet</li>
          )}
        </ul>
      </div>

      <div className="mt-4">
        <button onClick={onLogout} className="w-full text-sm bg-slate-700 hover:bg-slate-600 py-2 rounded">
          Logout
        </button>
      </div>
    </aside>
  );
}
