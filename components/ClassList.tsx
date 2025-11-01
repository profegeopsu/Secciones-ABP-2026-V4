
import React from 'react';
import type { Section } from '../types';

interface ClassListProps {
    section: Section | undefined;
}

export const ClassList: React.FC<ClassListProps> = ({ section }) => {
    if (!section) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-500">Section data not available.</h3>
            </div>
        );
    }
    
    const { id, students, block } = section;

    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-full flex flex-col">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-200">
                    Section {id} <span className="text-xs font-mono py-0.5 px-1.5 bg-gray-700 rounded-md">Block {block}</span>
                </h3>
                <span className="font-bold text-cyan-400 bg-cyan-900/50 px-3 py-1 rounded-full text-sm">
                    {students.length} Students
                </span>
            </div>
            {students.length > 0 ? (
                 <ul className="space-y-2 overflow-y-auto flex-grow max-h-80">
                    {students.sort().map((student, index) => (
                        <li key={index} className="text-gray-300 bg-gray-700/50 p-2 rounded-md text-sm">
                            {student}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex-grow flex items-center justify-center text-gray-500">
                    <p>No students assigned to this section.</p>
                </div>
            )}
        </div>
    );
};
   