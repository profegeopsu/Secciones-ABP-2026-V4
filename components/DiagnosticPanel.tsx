import React, { useMemo } from 'react';
import type { ScheduleResult, Subject } from '../types';

interface DiagnosticPanelProps {
    result: ScheduleResult;
    subjects: Subject[];
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ result }) => {
    const analysis = useMemo(() => {
        const { unassignedStudents } = result;
        if (unassignedStudents.length === 0) return null;

        const subjectConflictCounts = new Map<string, number>();
        const pairConflictCounts = new Map<string, number>();

        unassignedStudents.forEach(ua => {
            // Only count pure schedule conflicts for this analysis
            if (ua.reason.startsWith("Conflicto de Horario")) {
                ua.conflictingSubjects.forEach(subjectName => {
                    subjectConflictCounts.set(subjectName, (subjectConflictCounts.get(subjectName) || 0) + 1);
                });
                if (ua.conflictingSubjects.length >= 2) {
                    // Generate all pairs
                    for (let i = 0; i < ua.conflictingSubjects.length; i++) {
                        for (let j = i + 1; j < ua.conflictingSubjects.length; j++) {
                            const pair = [ua.conflictingSubjects[i], ua.conflictingSubjects[j]].sort().join(' y ');
                            pairConflictCounts.set(pair, (pairConflictCounts.get(pair) || 0) + 1);
                        }
                    }
                }
            }
        });

        const sortedSubjects = Array.from(subjectConflictCounts.entries()).sort((a, b) => b[1] - a[1]);
        const sortedPairs = Array.from(pairConflictCounts.entries()).sort((a, b) => b[1] - a[1]);

        return {
            topConflictingSubject: sortedSubjects.length > 0 ? sortedSubjects[0] : null,
            topConflictingPair: sortedPairs.length > 0 ? sortedPairs[0] : null,
        };
    }, [result]);

    if (!analysis || (!analysis.topConflictingSubject && !analysis.topConflictingPair)) {
        return null;
    }

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-700/50">
            <h3 className="text-xl font-bold mb-4 text-yellow-300 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Panel de Diagnóstico y Consejos
            </h3>
            <div className="text-yellow-200 space-y-3 text-sm">
                {analysis.topConflictingSubject && (
                    <p>
                        <strong>Asignatura más conflictiva:</strong> La asignatura '<strong>{analysis.topConflictingSubject[0]}</strong>' está involucrada en la mayoría de los conflictos de horario ({analysis.topConflictingSubject[1]} casos).
                        <span className="block text-yellow-400/80 mt-1"><strong>Consejo:</strong> Considera cambiar uno de los bloques horarios para esta asignatura en el Panel de Configuración para reducir la superposición con otras.</span>
                    </p>
                )}
                {analysis.topConflictingPair && (
                    <p>
                        <strong>Combinación más problemática:</strong> La combinación de '<strong>{analysis.topConflictingPair[0]}</strong>' genera la mayor cantidad de conflictos de horario ({analysis.topConflictingPair[1]} casos).
                         <span className="block text-yellow-400/80 mt-1"><strong>Consejo:</strong> Si muchos alumnos eligen este par de asignaturas, asegúrate de que sus bloques horarios sean lo más diferentes posible.</span>
                    </p>
                )}
            </div>
        </div>
    );
};