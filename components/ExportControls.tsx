import React, { useState } from 'react';
import type { ScheduleResult, Subject, StudentAssignment } from '../types';
import { ExportToSheetModal } from './ExportToSheetModal';
import { exportToGoogleScript } from '../services/googleApi';

const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

interface ExportControlsProps {
    result: ScheduleResult;
    subjects: Subject[];
    scriptUrl: string;
    sourceSheetName: string;
}

export const ExportControls: React.FC<ExportControlsProps> = ({ result, subjects, scriptUrl, sourceSheetName }) => {
    const { studentAssignments, sections, unassignedStudents, studentCodeToName } = result;
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    const canExportToSheet = scriptUrl && sourceSheetName;

    const exportAllAssignments = () => {
        const headers = ['Código', 'Nombre', 'Curso', ...subjects.map(s => s.name)];
        const subjectIdToName = new Map(subjects.map(s => [s.id, s.name]));
        
        const rows = Array.from(studentAssignments.values()).map((assignment: StudentAssignment) => {
            const studentRow: Record<string, string> = { 'Código': assignment.code, 'Nombre': assignment.name, 'Curso': assignment.course };
            assignment.sections.forEach(secId => {
                const section = sections.get(secId);
                if (section) {
                    const subjectName = subjectIdToName.get(section.subjectId);
                    if (typeof subjectName === 'string') studentRow[subjectName] = secId;
                }
            });
            return headers.map(h => studentRow[h] || '').join(',');
        });
        downloadCSV([headers.join(','), ...rows].join('\n'), 'todas_las_asignaciones.csv');
    };
    
    const exportUnassigned = () => {
        if(unassignedStudents.length === 0) { alert('No hay alumnos no asignados para exportar.'); return; }
        const headers = ['Código', 'Nombre', 'Razón', 'Asignaturas Inscritas'];
        const rows = unassignedStudents.map(ua => [ua.studentCode, `"${studentCodeToName.get(ua.studentCode) || ''}"`, `"${ua.reason}"`, `"${ua.subjects.join('; ')}"`].join(','));
        downloadCSV([headers.join(','), ...rows].join('\n'), 'alumnos_no_asignados.csv');
    };

    const exportAllSectionLists = () => {
        const headers = ['Sección', 'Código', 'Nombre', 'Curso'];
        const rows: string[] = [];

        // Sort sections by ID for consistent output
        const sortedSections = Array.from(sections.keys()).sort((a, b) => {
            const [aSub, aSec] = a.split('.').map(Number);
            const [bSub, bSec] = b.split('.').map(Number);
            if (aSub !== bSub) return aSub - bSub;
            return aSec - bSec;
        });

        sortedSections.forEach(sectionId => {
            const section = sections.get(sectionId);
            if (section && section.students.length > 0) {
                // Sort students within each section by name
                const sortedStudents = section.students
                    .map(studentCode => studentAssignments.get(studentCode))
                    .filter((assignment): assignment is StudentAssignment => !!assignment)
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                sortedStudents.forEach(assignment => {
                    rows.push([
                        sectionId,
                        assignment.code,
                        `"${assignment.name}"`, // Quote name in case it has commas
                        assignment.course
                    ].join(','));
                });
            }
        });

        if (rows.length === 0) {
            alert('No hay alumnos asignados en ninguna sección para exportar.');
            return;
        }

        const csvContent = [headers.join(','), ...rows].join('\n');
        downloadCSV(csvContent, 'listas_por_seccion.csv');
    };
    
    const handleExportToSheet = async (): Promise<{url: string}> => {
        if (!canExportToSheet) {
            throw new Error("La URL del script o la hoja de destino no están configuradas.");
        }
        
        const response = await exportToGoogleScript(scriptUrl, sourceSheetName, studentAssignments);
        return response;
    };

    return (
        <>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-cyan-400">Exportar y Respaldar Datos</h3>
            <div className="flex flex-wrap gap-4 items-center">
                <button
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={!canExportToSheet}
                    title={!canExportToSheet ? "Para activar, ve a 'Sincronizar con Google Sheets' y selecciona una hoja de destino." : "Actualizar Google Sheet"}
                    className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM11.5 19H8.5V17.5H11.5V19ZM11.5 16H8.5V14.5H11.5V16ZM11.5 13H8.5V11.5H11.5V13ZM15.5 19H12.5V11.5H15.5V19ZM13 9V3.5L18.5 9H13Z" /></svg>
                    Actualizar Google Sheet
                </button>
                 <button onClick={exportAllSectionLists} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Descargar Listas por Sección (CSV)</button>
                 <button onClick={exportAllAssignments} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Descargar Asignaciones (CSV)</button>
                <button onClick={exportUnassigned} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Descargar no Asignados (CSV)</button>
            </div>
             <p className="text-sm text-gray-400 mt-3">Guarda las asignaciones de vuelta en tu hoja de cálculo original, en una nueva columna llamada "Secciones Asignadas".</p>
        </div>
        {isExportModalOpen && (
            <ExportToSheetModal 
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleExportToSheet}
            />
        )}
        </>
    );
};