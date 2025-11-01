import React, { useState, useEffect, useMemo } from 'react';
import type { PreassignmentConflictInfo, Subject, ScheduleConfig } from '../types';

interface PreassignmentConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflictInfo: PreassignmentConflictInfo;
    subjects: Subject[];
    scheduleConfig: ScheduleConfig;
    onApply: (studentCode: string, newSections: string[]) => void;
}

export const PreassignmentConflictModal: React.FC<PreassignmentConflictModalProps> = (props) => {
    const { isOpen, onClose, conflictInfo, subjects, scheduleConfig, onApply } = props;
    const [currentSelections, setCurrentSelections] = useState<Record<number, string>>({});
    const [validation, setValidation] = useState({ isValid: false, message: '' });

    const studentEnrolledSubjects = useMemo(() => {
        return subjects
            .filter(s => conflictInfo.enrollments.has(s.name))
            .sort((a, b) => a.id - b.id);
    }, [conflictInfo.enrollments, subjects]);

    useEffect(() => {
        if (conflictInfo) {
            const initial: Record<number, string> = {};
            conflictInfo.allPreassignedSections.forEach(sId => {
                const [subjectIdStr] = sId.split('.');
                const subjectId = parseInt(subjectIdStr, 10);
                initial[subjectId] = sId;
            });
            setCurrentSelections(initial);
        }
    }, [conflictInfo]);

    useEffect(() => {
        const validate = () => {
            const selectedSectionIds = Object.values(currentSelections);
            if (selectedSectionIds.length !== studentEnrolledSubjects.length) {
                setValidation({ isValid: false, message: 'Falta seleccionar secciones para todas las asignaturas.' });
                return;
            };

            const usedBlocks = new Map<number, string>();
            for (const sectionId of selectedSectionIds) {
                const [subjectIdStr] = sectionId.split('.');
                const subjectId = parseInt(subjectIdStr, 10);
                const config = scheduleConfig[subjectId];
                if (!config) continue;

                const block = sectionId.endsWith('.1') ? config.s1_block : config.s2_block;
                
                if (usedBlocks.has(block)) {
                    const existingSubjectId = parseInt(usedBlocks.get(block)!.split('.')[0]);
                    const existingSubjectName = subjects.find(s => s.id === existingSubjectId)?.name || 'Desconocida';
                    const currentSubjectName = subjects.find(s => s.id === subjectId)?.name || 'Desconocida';

                    setValidation({ isValid: false, message: `Conflicto de horario: El bloque ${block} es usado por "${currentSubjectName}" y "${existingSubjectName}".` });
                    return;
                }
                usedBlocks.set(block, sectionId);
            }
            
            setValidation({ isValid: true, message: 'La nueva asignación es válida.' });
        };
        validate();
    }, [currentSelections, studentEnrolledSubjects, scheduleConfig, subjects]);

    if (!isOpen) return null;
    
    const handleSectionChange = (subjectId: number, newSectionId: string) => {
        setCurrentSelections(prev => ({ ...prev, [subjectId]: newSectionId }));
    };
    
    const handleSave = () => {
        onApply(conflictInfo.studentCode, Object.values(currentSelections));
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-red-700">
                <div className="p-4 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-red-400 flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Resolver Conflicto de Pre-asignación
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-gray-300">Se detectó un conflicto para el alumno <strong>{conflictInfo.studentName} ({conflictInfo.studentCode})</strong>.</p>
                    <div className="bg-gray-900/50 p-3 rounded-md border border-gray-600 text-sm">
                        <p className="text-red-300"><strong>Problema:</strong> El bloque <strong>{conflictInfo.conflictingBlock}</strong> se usa más de una vez.</p>
                        <p className="text-gray-400 mt-1">Por favor, ajusta las secciones para resolver el conflicto de horario.</p>
                    </div>

                    {studentEnrolledSubjects.map(subject => (
                        <div key={subject.id}>
                            <label className="font-semibold text-gray-300">{subject.name}</label>
                            <select 
                                value={currentSelections[subject.id] || ''} 
                                onChange={(e) => handleSectionChange(subject.id, e.target.value)}
                                className="w-full bg-gray-700 mt-1 p-2 rounded-md border border-gray-600 text-gray-200 focus:ring-cyan-500 focus:outline-none">
                                <option value="" disabled>-- Selecciona una sección --</option>
                                <option value={`${subject.id}.1`}>Sección {subject.id}.1 (Bloque {scheduleConfig[subject.id].s1_block})</option>
                                <option value={`${subject.id}.2`}>Sección {subject.id}.2 (Bloque {scheduleConfig[subject.id].s2_block})</option>
                            </select>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                    <div className={`p-3 rounded-md text-sm text-center font-semibold ${validation.isValid ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        {validation.message}
                    </div>
                </div>
                <div className="p-4 bg-gray-900/50 flex justify-end gap-4 rounded-b-lg">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} disabled={!validation.isValid} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60">
                        Guardar y Continuar Planificación
                    </button>
                </div>
            </div>
        </div>
    );
};
