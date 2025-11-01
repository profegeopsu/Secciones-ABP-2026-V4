import React, { useState, useEffect, useMemo } from 'react';
import type { ScheduleResult, StudentAssignment, Subject, ScheduleConfig, Section } from '../types';

interface ScheduleEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentAssignment: StudentAssignment;
    onApplyChange: (studentCode: string, newSections: string[]) => void;
    result: ScheduleResult;
    conflictPairs: string[][];
    subjects: Subject[];
    scheduleConfig: ScheduleConfig;
}

export const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = (props) => {
    const { isOpen, onClose, studentAssignment, onApplyChange, result, conflictPairs, subjects, scheduleConfig } = props;
    const { sections } = result;
    const [currentSections, setCurrentSections] = useState<Record<number, string>>({});
    const [validation, setValidation] = useState({ isValid: true, message: '' });

    const studentSubjects = useMemo(() => {
        const subjectIds = new Set(studentAssignment.sections.map(sId => sections.get(sId)!.subjectId));
        return subjects.filter(s => subjectIds.has(s.id)).sort((a,b) => a.id - b.id);
    }, [studentAssignment, sections, subjects]);

    useEffect(() => {
        if (studentAssignment) {
            const initial: Record<number, string> = {};
            studentAssignment.sections.forEach(sId => {
                const subjectId = sections.get(sId)!.subjectId;
                initial[subjectId] = sId;
            });
            setCurrentSections(initial);
            setValidation({isValid: true, message: ''});
        }
    }, [studentAssignment, sections]);

    useEffect(() => {
        const validate = () => {
            const selectedSectionIds = Object.values(currentSections);
            if (selectedSectionIds.length !== studentSubjects.length) return;

            const usedBlocks = new Set<number>();
            for(const sectionId of selectedSectionIds) {
                const block = sections.get(sectionId)!.block;
                if (usedBlocks.has(block)) {
                    setValidation({ isValid: false, message: 'Conflicto de horario: dos asignaturas en el mismo bloque.' });
                    return;
                }
                usedBlocks.add(block);
            }
            
            const conflictMap = new Map<string, Set<string>>();
            conflictPairs.forEach(([a, b]) => {
                if (!conflictMap.has(a)) conflictMap.set(a, new Set());
                if (!conflictMap.has(b)) conflictMap.set(b, new Set());
                conflictMap.get(a)!.add(b);
                conflictMap.get(b)!.add(a);
            });
            const studentConflicts = conflictMap.get(studentAssignment.code) || new Set();

            for(const sectionId of selectedSectionIds) {
                const section = sections.get(sectionId)!;
                if(section.students.filter(s => s !== studentAssignment.code).length >= section.capacity) {
                     setValidation({ isValid: false, message: `La sección ${sectionId} está llena (capacidad: ${section.capacity}).` });
                     return;
                }
                for(const otherStudent of section.students){
                    if(studentConflicts.has(otherStudent)){
                        setValidation({ isValid: false, message: `Conflicto de convivencia en la sección ${sectionId}.` });
                        return;
                    }
                }
            }
            setValidation({ isValid: true, message: 'La nueva asignación es válida.' });
        };
        validate();
    }, [currentSections, studentAssignment, sections, studentSubjects, conflictPairs]);

    if (!isOpen) return null;
    
    const handleSectionChange = (subjectId: number, newSectionId: string) => {
        setCurrentSections(prev => ({ ...prev, [subjectId]: newSectionId }));
    };
    
    const handleSave = () => {
        onApplyChange(studentAssignment.code, Object.values(currentSections));
        onClose();
    };
    
    const isChanged = JSON.stringify(Object.values(currentSections).sort()) !== JSON.stringify(studentAssignment.sections.sort());

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-cyan-400">Editando Horario para {studentAssignment.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    {studentSubjects.map(subject => (
                        <div key={subject.id}>
                            <label className="font-semibold text-gray-300">{subject.name}</label>
                            <select 
                                value={currentSections[subject.id] || ''} 
                                onChange={(e) => handleSectionChange(subject.id, e.target.value)}
                                className="w-full bg-gray-700 mt-1 p-2 rounded-md border border-gray-600">
                                <option value={`${subject.id}.1`}>Sección {subject.id}.1 (Bloque {scheduleConfig[subject.id].s1_block})</option>
                                <option value={`${subject.id}.2`}>Sección {subject.id}.2 (Bloque {scheduleConfig[subject.id].s2_block})</option>
                            </select>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                    <div className={`p-3 rounded-md text-sm text-center ${validation.isValid ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        {validation.message}
                    </div>
                </div>
                <div className="p-4 bg-gray-800/50 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} disabled={!validation.isValid || !isChanged} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">Guardar Cambios</button>
                </div>
            </div>
        </div>
    );
};