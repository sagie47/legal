import React from 'react';

export const Input = ({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all ${className}`}
        {...props}
    />
);
