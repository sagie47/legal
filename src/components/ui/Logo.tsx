import React from 'react';

export const Logo = ({ className = "" }: { className?: string }) => (
    <div className={`flex items-center gap-2 font-bold text-lg tracking-tight ${className}`}>
        <div className="w-6 h-6 bg-black text-white flex items-center justify-center rounded-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" />
            </svg>
        </div>
        LMIAFlow
    </div>
);
