import React from 'react';

export const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, string> = {
        'Draft': 'bg-gray-100 text-gray-600 border-gray-200',
        'Ready': 'bg-blue-50 text-blue-700 border-blue-200',
        'Submitted': 'bg-purple-50 text-purple-700 border-purple-200',
        'Approved': 'bg-green-50 text-green-700 border-green-200',
        'Action Required': 'bg-red-50 text-red-700 border-red-200',
        'In Review': 'bg-amber-50 text-amber-700 border-amber-200'
    };

    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wide ${config[status] || config['Draft']}`}>
            {status}
        </span>
    );
};
