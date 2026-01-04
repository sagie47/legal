import React from 'react';

export const Chip = ({ children, active = false }: { children: React.ReactNode, active?: boolean }) => (
    <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase tracking-wider rounded shadow-sm border ${active ? 'bg-white border-gray-200 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
        {active && <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>}
        {children}
    </div>
);
