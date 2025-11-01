import React from 'react';
import type { ScheduleConfig, Subject } from '../types';

interface HelpSectionProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleConfig: ScheduleConfig;
    subjects: Subject[];
}

export const HelpSection: React.FC<HelpSectionProps> = ({ isOpen, onClose, scheduleConfig, subjects}) => {
    if (!isOpen) return null;

    const blocks: Record<number, string[]> = { 1: [], 2: [], 3: [] };
    subjects.forEach(sub => {
        const config = scheduleConfig[sub.id];
        if (config) {
            blocks[config.s1_block].push(`${sub.id}.1`);
            blocks[config.s2_block].push(`${sub.id}.2`);
        }
    });

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl border border-gray-700 max-h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 id="help-modal-title" className="text-xl font-semibold text-cyan-400 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ayuda e Información
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold leading-none p-1" aria-label="Cerrar">&times;</button>
                </div>
                <div className="p-6 text-gray-300 space-y-6 overflow-y-auto">
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-2">¿Cómo Funciona el Programa?</h3>
                        <p className="text-sm">El algoritmo prioriza (1) evitar conflictos de horario, convivencia o capacidad, y (2) equilibrar las secciones asignando alumnos a los grupos menos concurridos. Considera las preferencias de horario ('mañana'/'tarde') como un factor secundario de optimización.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Configuración Actual de Asignaturas y Bloques</h3>
                        <div className="overflow-x-auto my-4 flex justify-center">
                            <table className="w-full md:w-auto text-center border-collapse text-sm">
                                <thead><tr className="bg-gray-700/50"><th className="border border-gray-600 p-2 font-semibold">Bloque</th><th className="border border-gray-600 p-2 font-semibold" colSpan={2}>Secciones por Bloque</th></tr></thead>
                                <tbody>
                                    {[1, 2, 3].map(blockNum => (
                                        <tr key={blockNum} className="hover:bg-gray-700/30">
                                            <td className="border border-gray-600 p-2 font-semibold">Bloque {blockNum}</td>
                                            <td className="border border-gray-600 p-3 font-mono" colSpan={2}>{blocks[blockNum].join(', ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {subjects.sort((a,b)=> a.id - b.id).map(subject => (
                                <div key={subject.id} className="bg-gray-700/50 p-3 rounded-lg">
                                    <strong>{subject.id}. {subject.name}:</strong> Secciones {subject.id}.1 (B{scheduleConfig[subject.id].s1_block}) y {subject.id}.2 (B{scheduleConfig[subject.id].s2_block})
                                </div>
                            ))}
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Herramientas Profesionales</h3>
                         <ul className="list-disc list-inside text-sm mt-2 space-y-2 pl-4">
                             <li><strong>Panel de Configuración:</strong> Permite definir las asignaturas, sus bloques y la capacidad máxima de alumnos por sección.</li>
                             <li><strong>Editor de Horario:</strong> Haz clic en el ícono de edición (lápiz) junto a un alumno para modificar manualmente su horario con validación en tiempo real.</li>
                             <li><strong>Deshacer Último Cambio:</strong> Revierte el último cambio manual aplicado a un horario.</li>
                             <li><strong>Exportar Datos:</strong> Descarga los resultados en formato CSV para su análisis o distribución.</li>
                             <li><strong>PDF Individual:</strong> Genera un PDF del horario de un alumno específico haciendo clic en el ícono de documento.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};