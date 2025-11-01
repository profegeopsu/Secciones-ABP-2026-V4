import React from 'react';
import type { StudentAssignment, Section } from '../types';

interface StudentScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: StudentAssignment;
    sections: Map<string, Section>;
}

export const StudentScheduleModal: React.FC<StudentScheduleModalProps> = ({ isOpen, onClose, student, sections }) => {
    if (!isOpen) return null;

    const handlePrint = () => {
        const scheduleHtml = student.sections.sort((a, b) => {
            const sectionA = sections.get(a);
            const sectionB = sections.get(b);
            if (!sectionA || !sectionB) return 0;
            return sectionA.block - sectionB.block;
        }).map(secId => {
            const section = sections.get(secId);
            if (!section) return '';
            return `<tr><td>${section.subjectName}</td><td>${section.id}</td><td>${section.block}</td></tr>`
        }).join('');

        const content = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Horario para ${student.name}</title>
                    <style>
                        /* Screen styles */
                        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: #1A202C; color: #E2E8F0; padding: 20px; }
                        h1, h2, h3 { color:#63B3ED; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color:#2D3748; text-align:left; }
                        td, th { border: 1px solid #4A5568; padding: 8px; }
                        
                        /* Print styles */
                        @media print {
                            body { background-color: #ffffff; color: #000000; padding: 0; }
                            h1, h2, h3 { color: #000000; }
                            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
                            td, th { border: 1px solid #cccccc; }
                            @page { margin: 0.5in; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Horario Escolar</h1>
                    <h2>${student.name} (${student.code})</h2>
                    <h3>Curso: ${student.course}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Asignatura</th>
                                <th>Sección</th>
                                <th>Bloque</th>
                            </tr>
                        </thead>
                        <tbody>${scheduleHtml}</tbody>
                    </table>
                    <script>
                        window.onload = function() {
                            window.print();
                        };
                    </script>
                </body>
            </html>`;
        
        const features = "popup,width=800,height=600,scrollbars=yes,resizable=yes";
        const newWindow = window.open('', '_blank', features);
        if (newWindow) {
            newWindow.document.write(content);
            newWindow.document.close();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-cyan-400">Horario para {student.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
                </div>
                <div className="p-6 text-gray-300">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <p><strong>Código:</strong> <span className="font-mono bg-gray-700 px-2 py-1 rounded">{student.code}</span></p>
                        <p><strong>Curso:</strong> {student.course}</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto">
                            <thead>
                                <tr className="border-b border-gray-600">
                                    <th className="py-2 px-3 font-semibold text-gray-300">Asignatura</th>
                                    <th className="py-2 px-3 font-semibold text-gray-300">Sección</th>
                                    <th className="py-2 px-3 font-semibold text-gray-300 text-center">Bloque</th>
                                </tr>
                            </thead>
                            <tbody>
                                {student.sections.sort((a, b) => {
                                    const sectionA = sections.get(a);
                                    const sectionB = sections.get(b);
                                    if (!sectionA || !sectionB) return 0;
                                    return sectionA.block - sectionB.block;
                                }).map(secId => {
                                    const section = sections.get(secId);
                                    if (!section) return null;
                                    return (
                                        <tr key={secId} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                                            <td className="py-3 px-3">{section.subjectName}</td>
                                            <td className="py-3 px-3 font-mono">{section.id}</td>
                                            <td className="py-3 px-3 font-mono text-center">{section.block}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-4 bg-gray-900/50 flex justify-end gap-4 rounded-b-lg">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Cerrar</button>
                    <button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                        </svg>
                        Imprimir Horario
                    </button>
                </div>
            </div>
        </div>
    );
};