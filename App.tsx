import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ResultsDashboard } from './components/ResultsDashboard';
import { scheduleStudents } from './services/scheduler';
import type { StudentEnrollments, ScheduleResult, Section, StudentAssignment, ScheduleConfig, Subject, StudentPreferences, BalancingStrategy, PreassignmentConflictInfo } from './types';
import { ConflictEditor } from './components/ConflictEditor';
import { HelpSection } from './components/HelpSection';
import { AdminPanel } from './components/AdminPanel';
import { initialSubjects, initialScheduleConfig } from './initialConfig';
import { DataSource } from './components/DataSource';
import { ExportControls } from './components/ExportControls';
import { PreassignmentConflictModal } from './components/PreassignmentConflictModal';

export interface ProcessedFileData {
    enrollments: StudentEnrollments;
    studentCourses: Map<string, string>;
    studentCodeToName: Map<string, string>;
    studentPreferences: StudentPreferences;
    preassignedSections: Map<string, string[]>;
}

export type DataSourceInfo = {type: 'paste'} | {type: 'sheet', url: string, name: string};

const findPreassignmentConflict = (
    processedData: ProcessedFileData,
    scheduleConfig: ScheduleConfig
): PreassignmentConflictInfo | null => {
    const { preassignedSections, studentCodeToName, enrollments } = processedData;

    for (const [studentCode, sectionIds] of preassignedSections.entries()) {
        const usedBlocks = new Map<number, string[]>(); 
        for (const sectionId of sectionIds) {
            const [subjectIdStr] = sectionId.split('.');
            const subjectId = parseInt(subjectIdStr, 10);
            const config = scheduleConfig[subjectId];
            if (!config) continue;

            const sectionNumber = sectionId.endsWith('.1') ? 1 : 2;
            const block = sectionNumber === 1 ? config.s1_block : config.s2_block;
            
            if (!usedBlocks.has(block)) {
                usedBlocks.set(block, []);
            }
            usedBlocks.get(block)!.push(sectionId);
        }

        for (const [block, conflictingSections] of usedBlocks.entries()) {
            if (conflictingSections.length > 1) {
                return {
                    studentCode,
                    studentName: studentCodeToName.get(studentCode) || 'Desconocido',
                    conflictingBlock: block,
                    conflictingSections,
                    allPreassignedSections: sectionIds,
                    enrollments: enrollments.get(studentCode) || new Set(),
                };
            }
        }
    }
    return null;
};


const App: React.FC = () => {
    const [result, setResult] = useState<ScheduleResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [conflictPairs, setConflictPairs] = useState<string[][]>([]);
    const [lastProcessedData, setLastProcessedData] = useState<ProcessedFileData | null>(null);
    const [lastPastedData, setLastPastedData] = useState<string[][] | null>(null);
    const [dataSourceInfo, setDataSourceInfo] = useState<DataSourceInfo | null>(null);
    
    const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
    const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(initialScheduleConfig);
    const [balancingStrategy, setBalancingStrategy] = useState<BalancingStrategy>('speed');

    const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem('googleScriptUrl') || 'https://script.google.com/macros/s/AKfycbxzdn3NxpdOhcZbQJ9SI83JtJpdtbye968_mNQ65pTwVQ-IJkgGEmHXvN5gnWOc-DMq/exec');
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');

    const [history, setHistory] = useState<ScheduleResult[]>([]);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isConflictEditorOpen, setIsConflictEditorOpen] = useState(true);
    const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
    const [preassignmentConflict, setPreassignmentConflict] = useState<PreassignmentConflictInfo | null>(null);
    
    const adminPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem('googleScriptUrl', scriptUrl);
    }, [scriptUrl]);

    const subjectMap = useMemo(() => {
        const map = new Map<string, Subject>();
        subjects.forEach(s => map.set(s.name, s));
        return map;
    }, [subjects]);

    const handleRequestSubjectEdit = useCallback((subjectName: string) => {
        const subject = subjects.find(s => s.name === subjectName);
        if (subject) {
            setSubjectToEdit(subject);
            setIsAdminPanelOpen(true);
            setTimeout(() => adminPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [subjects]);

    const handleRequestConflictEdit = useCallback(() => {
         setIsConflictEditorOpen(true);
    }, []);

    const runScheduler = useCallback((data: ProcessedFileData) => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        setHistory([]);

        setTimeout(() => {
            try {
                const scheduleResult = scheduleStudents(data.enrollments, data.studentCourses, data.studentCodeToName, data.studentPreferences, data.preassignedSections, conflictPairs, subjects, scheduleConfig, balancingStrategy);
                setResult(scheduleResult);
                setLastProcessedData(data);
            } catch (e) {
                if (e instanceof Error) {
                    setError(`Error al procesar el horario: ${e.message}`);
                } else {
                    setError('Ocurrió un error desconocido durante la planificación.');
                }
            } finally {
                setIsLoading(false);
            }
        }, 500);
    }, [conflictPairs, subjects, scheduleConfig, balancingStrategy]);

    const parseData = useCallback((data: string[][], subjects: Subject[]): ProcessedFileData => {
        const enrollments: StudentEnrollments = new Map();
        const studentCourses = new Map<string, string>();
        const studentCodeToName = new Map<string, string>();
        const studentPreferences: StudentPreferences = new Map();
        const preassignedSections = new Map<string, string[]>();

        const cleanString = (str: string | null | undefined): string => {
            if (typeof str !== 'string') return '';
            return str
                .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ') 
                .normalize('NFC')
                .trim();
        };

        if (data.length < 2) throw new Error("Los datos de entrada están vacíos o no son válidos.");

        const headers = data[0].map(h => cleanString(h).toLowerCase());
        const requiredCols = ['código', 'curso', 'nombre', 'asignatura'];
        const missingCols = requiredCols.filter(c => !headers.includes(c));
        if (missingCols.length > 0) {
            throw new Error(`Faltan las siguientes columnas obligatorias: ${missingCols.join(', ')}.`);
        }

        const codeIndex = headers.indexOf('código');
        const courseIndex = headers.indexOf('curso');
        const nameIndex = headers.indexOf('nombre');
        const activityIndex = headers.indexOf('asignatura');
        const preferenceIndex = headers.indexOf('preferencia');
        const sectionsIndex = headers.indexOf('secciones asignadas');


        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row.length < Math.max(codeIndex, courseIndex, nameIndex, activityIndex) + 1) continue;

            const studentCode = cleanString(row[codeIndex]).toUpperCase();
            const course = cleanString(row[courseIndex]);
            const studentName = cleanString(row[nameIndex]);
            const rawActivityName = row[activityIndex]; 
            const cleanedActivityName = cleanString(rawActivityName);
            
            if (!studentCode || !studentName || !cleanedActivityName || !course) continue;
            
            const subjectMatch = subjects.find(s => cleanString(s.name).toUpperCase() === cleanedActivityName.toUpperCase());

            if (!subjectMatch) {
                const validNames = subjects.map(s => `"${s.name}"`).join(', ');
                throw new Error(`La asignatura '${rawActivityName}' en la fila ${i + 1} no es válida. Las asignaturas configuradas son: ${validNames}.`);
            }
            
            const activityName = subjectMatch.name;
            
            if (!enrollments.has(studentCode)) enrollments.set(studentCode, new Set());
            enrollments.get(studentCode)?.add(activityName);
            if (!studentCourses.has(studentCode)) studentCourses.set(studentCode, course);
            if (!studentCodeToName.has(studentCode)) studentCodeToName.set(studentCode, studentName);

            if (preferenceIndex !== -1 && row[preferenceIndex]) {
                const pref = cleanString(row[preferenceIndex]).toLowerCase();
                if (pref === 'mañana' || pref === 'tarde') {
                    studentPreferences.set(studentCode, pref);
                }
            }

            if (sectionsIndex !== -1 && row[sectionsIndex]) {
                 const assignedSectionsStr = cleanString(row[sectionsIndex]);
                 if (assignedSectionsStr) {
                     const sectionIds = assignedSectionsStr.split(',').map(s => s.trim()).filter(Boolean);
                     if (sectionIds.length > 0) {
                        preassignedSections.set(studentCode, sectionIds);
                     }
                 }
            }
        }

        return { enrollments, studentCourses, studentCodeToName, studentPreferences, preassignedSections };
    }, []);

    const processAndRunScheduler = useCallback((data: string[][], sourceInfo: DataSourceInfo) => {
         setIsLoading(true);
         setError(null);
         try {
            const processedData = parseData(data, subjects);
            
            const conflict = findPreassignmentConflict(processedData, scheduleConfig);
            if (conflict) {
                setPreassignmentConflict(conflict);
                setLastPastedData(data);
                setLastProcessedData(processedData);
                setIsLoading(false);
                return;
            }

            setLastProcessedData(processedData);
            runScheduler(processedData);
            setLastPastedData(data);
            setDataSourceInfo(sourceInfo);
         } catch(err) {
            if (err instanceof Error) setError(`Error al procesar los datos: ${err.message}`);
            else setError('Ocurrió un error desconocido al procesar los datos.');
            setIsLoading(false);
         }
    }, [parseData, subjects, scheduleConfig, runScheduler]);

    const handleApplyPreassignmentFix = useCallback((studentCode: string, newSections: string[]) => {
        if (!lastProcessedData) return;

        const updatedData = { ...lastProcessedData };
        updatedData.preassignedSections.set(studentCode, newSections);

        setPreassignmentConflict(null);
        runScheduler(updatedData);
    }, [lastProcessedData, runScheduler]);

    const handleRegenerate = useCallback(() => {
        if (!lastPastedData || !dataSourceInfo) {
            setError("No hay datos para regenerar. Por favor, importa o pega los datos primero.");
            return;
        }
        processAndRunScheduler(lastPastedData, dataSourceInfo);
    }, [lastPastedData, dataSourceInfo, processAndRunScheduler]);

    const handleApplyChange = useCallback((studentCode: string, newSections: string[]) => {
        setResult(prevResult => {
            if (!prevResult) return null;
            
            setHistory(prevHistory => [...prevHistory, prevResult]);

            const newSectionsMap = new Map<string, Section>();
            prevResult.sections.forEach((section, key) => {
                newSectionsMap.set(key, { ...section, students: [...section.students] });
            });

            const newStudentAssignmentsMap = new Map<string, StudentAssignment>();
            prevResult.studentAssignments.forEach((assignment, key) => {
                newStudentAssignmentsMap.set(key, { ...assignment });
            });

            const studentAssignment = newStudentAssignmentsMap.get(studentCode);
            if (!studentAssignment) return prevResult;

            const oldSections = studentAssignment.sections;
            oldSections.forEach(sectionId => {
                const section = newSectionsMap.get(sectionId);
                if (section) {
                    section.students = section.students.filter(s => s !== studentCode);
                }
            });
            newSections.forEach(sectionId => {
                const section = newSectionsMap.get(sectionId);
                if (section) {
                    section.students.push(studentCode);
                }
            });

            const updatedAssignment = { ...studentAssignment, sections: newSections.sort() };
            newStudentAssignmentsMap.set(studentCode, updatedAssignment);

            return {
                ...prevResult,
                sections: newSectionsMap,
                studentAssignments: newStudentAssignmentsMap,
            };
        });
    }, []);

    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        const lastState = history[history.length - 1];
        setResult(lastState);
        setHistory(prev => prev.slice(0, -1));
    }, [history]);
    
    const validStudentCodes = useMemo(() => 
        lastProcessedData ? Array.from(lastProcessedData.studentCodeToName.keys()) : [],
    [lastProcessedData]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
            <header className="bg-gray-800 shadow-lg border-b border-gray-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-cyan-400">Planificador de Secciones IA</h1>
                        <p className="mt-1 text-sm text-gray-400">Optimización de horarios escolares flexible e inteligente.</p>
                    </div>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-gray-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-gray-700" aria-label="Mostrar ayuda e información">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="space-y-8">
                    {/* --- Paneles de Control --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div ref={adminPanelRef}>
                            <AdminPanel 
                                subjects={subjects} 
                                setSubjects={setSubjects} 
                                scheduleConfig={scheduleConfig}
                                setScheduleConfig={setScheduleConfig}
                                balancingStrategy={balancingStrategy}
                                setBalancingStrategy={setBalancingStrategy}
                                isSchedulingActive={!!result || isLoading}
                                isOpen={isAdminPanelOpen}
                                setIsOpen={setIsAdminPanelOpen}
                                editingSubject={subjectToEdit}
                                setEditingSubject={setSubjectToEdit}
                            />
                        </div>
                        <div>
                            <ConflictEditor 
                                onConflictsChange={setConflictPairs} 
                                validStudentCodes={validStudentCodes} 
                                studentCodeToName={lastProcessedData?.studentCodeToName ?? new Map()}
                                isOpen={isConflictEditorOpen}
                                setIsOpen={setIsConflictEditorOpen}
                            />
                        </div>
                    </div>

                    {/* --- Contenido Principal --- */}
                    <DataSource
                        onDataProcessed={processAndRunScheduler}
                        setIsLoading={setIsLoading}
                        setError={setError}
                        scriptUrl={scriptUrl}
                        setScriptUrl={setScriptUrl}
                        sheetNames={sheetNames}
                        setSheetNames={setSheetNames}
                        selectedSheet={selectedSheet}
                        setSelectedSheet={setSelectedSheet}
                    />

                    {result && !isLoading && (
                        <div className="mt-6 flex justify-center items-center gap-4">
                            <button
                                onClick={handleRegenerate}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 inline-flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm10.899 12.101a7.002 7.002 0 01-11.601-2.566 1 1 0 011.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101z" clipRule="evenodd" />
                                </svg>
                                Regenerar Horarios
                            </button>
                            <button
                                onClick={handleUndo}
                                disabled={history.length === 0}
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none inline-flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                                Deshacer Último Cambio
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="mt-8 flex justify-center items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
                            <p className="ml-4 text-lg">Analizando y asignando alumnos...</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-8 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert" style={{ whiteSpace: 'pre-wrap' }}>
                            <strong className="font-bold">Error:</strong>
                            <span className="block sm:inline ml-2">{error}</span>
                        </div>
                    )}

                    {result && !isLoading && (
                        <div className="mt-8 space-y-8">
                           {result && scriptUrl && (
                                <ExportControls
                                    result={result}
                                    subjects={subjects}
                                    scriptUrl={scriptUrl}
                                    sourceSheetName={selectedSheet}
                                />
                            )}
                            <ResultsDashboard 
                                result={result} 
                                conflictPairs={conflictPairs} 
                                onApplyChange={handleApplyChange} 
                                subjects={subjects}
                                scheduleConfig={scheduleConfig}
                                enrollments={lastProcessedData?.enrollments ?? new Map()}
                                preassignedStudentsMap={lastProcessedData?.preassignedSections ?? new Map()}
                                onEditSubject={handleRequestSubjectEdit}
                                onEditConflicts={handleRequestConflictEdit}
                            />
                        </div>
                    )}
                </div>
            </main>
            
            <HelpSection 
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                scheduleConfig={scheduleConfig} 
                subjects={subjects} 
            />
            {preassignmentConflict && (
                <PreassignmentConflictModal
                    isOpen={!!preassignmentConflict}
                    onClose={() => setPreassignmentConflict(null)}
                    conflictInfo={preassignmentConflict}
                    subjects={subjects}
                    scheduleConfig={scheduleConfig}
                    onApply={handleApplyPreassignmentFix}
                />
            )}
        </div>
    );
};

export default App;