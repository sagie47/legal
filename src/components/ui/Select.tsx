import React from 'react';
import { ChevronRight } from 'lucide-react';

export const Select = ({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <div className="relative">
        <select
            className={`w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all pr-8 ${className}`}
            {...props}
        >
            {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <ChevronRight className="rotate-90 w-4 h-4" />
        </div>
    </div>
);
