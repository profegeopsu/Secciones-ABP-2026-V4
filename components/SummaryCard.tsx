
import React from 'react';

interface SummaryCardProps {
    title: string;
    value: number;
    color?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, color = 'text-cyan-400' }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
    );
};
   