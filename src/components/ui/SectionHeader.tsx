import React from 'react';

export const SectionHeader = ({ title, subtitle, center = false }: { title: string, subtitle?: string, center?: boolean }) => (
    <div className={`mb-12 ${center ? 'text-center' : ''}`}>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-gray-900">{title}</h2>
        {subtitle && <p className="text-gray-500 text-lg">{subtitle}</p>}
    </div>
);
