'use client';

import { signOut } from 'next-auth/react';

export default function DashboardHeader({
  userName,
  role,
}: {
  userName: string;
  role: 'Admin' | 'Agent';
}) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <h1 className="text-lg font-semibold text-black">Property CRM</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-black">{userName}</p>
            <p className="text-xs text-black">{role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-black hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
