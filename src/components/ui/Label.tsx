import React from 'react';

export const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <label className={`block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide ${className}`}>
        {children}
    </label>
);
