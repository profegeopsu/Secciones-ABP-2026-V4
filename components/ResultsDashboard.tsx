import React, { useState, useMemo, useCallback } from 'react';
import type { ScheduleResult, StudentAssignment, Subject, ScheduleConfig, StudentEnrollments } from '../types';
import { SummaryCard } from './SummaryCard';
import { ScheduleEditorModal } from './ScheduleEditorModal';
import { DiagnosticPanel } from './DiagnosticPanel';
import { StudentScheduleModal } from './ChangeSimulator';

interface ResultsDashboardProps {
    result: ScheduleResult;
    conflictPairs: string[][];
    onApplyChange: (studentCode: string, newSections: string[]) => void;
    subjects: Subject[];
    scheduleConfig: ScheduleConfig;
    enrollments: StudentEnrollments;
    preassignedStudentsMap: Map<string, string[]>;
    onEditSubject: (subjectName: string) => void;
    onEditConflicts: () => void;
}

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

export const ResultsDashboard: React.FC<ResultsDashboardProps> = (props) => {
    const { result, conflictPairs, onApplyChange, subjects, scheduleConfig, enrollments, preassignedStudentsMap, onEditSubject, onEditConflicts } = props;
    const { stats, sections, unassignedStudents, studentAssignments, studentCodeToName } = result;
    const [editingStudent, setEditingStudent] = useState<StudentAssignment | null>(null);
    const [viewingStudentSchedule, setViewingStudentSchedule] = useState<StudentAssignment | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCourse, setCopiedCourse] = useState<string | null>(null);
    const [isNewlyAssignedOpen, setIsNewlyAssignedOpen] = useState(true);

    const subjectNameToIdMap = useMemo(() => new Map(subjects.map(s => [s.name, s.id])), [subjects]);

    const newlyAssignedStudents = useMemo(() => {
        return Array.from(studentAssignments.values())
            .filter(assignment => !preassignedStudentsMap.has(assignment.code))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [studentAssignments, preassignedStudentsMap]);

    const totalApplicantsBySubject = useMemo(() => {
        const counts = new Map<string, number>();
        subjects.forEach(subject => {
            counts.set(subject.name, 0);
        });
        for (const studentSubjects of enrollments.values()) {
            for (const subjectName of studentSubjects) {
                if (counts.has(subjectName)) {
                    counts.set(subjectName, counts.get(subjectName)! + 1);
                }
            }
        }
        return counts;
    }, [enrollments, subjects]);

    const filteredAssignments = useMemo(() => {
        const assignmentsArray = Array.from(studentAssignments.values());
        if (!searchTerm) return assignmentsArray;
        const lowercasedFilter = searchTerm.toLowerCase();
        return assignmentsArray.filter(
            (assignment: StudentAssignment) =>
                assignment.name.toLowerCase().includes(lowercasedFilter) ||
                assignment.code.toLowerCase().includes(lowercasedFilter)
        );
    }, [studentAssignments, searchTerm]);

    const studentsByCourse = useMemo(() => {
        const map = new Map<string, StudentAssignment[]>();
        filteredAssignments.forEach((assignment) => {
            const course = assignment.course;
            if (!map.has(course)) map.set(course, []);
            map.get(course)!.push(assignment);
        });
        map.forEach((students) => students.sort((a, b) => a.name.localeCompare(b.name)));
        return map;
    }, [filteredAssignments]);

    const sortedCourses = useMemo(() => Array.from(studentsByCourse.keys()).sort(), [studentsByCourse]);
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
    
    const handleToggleCourse = (courseName: string) => {
        setExpandedCourses(prev => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(courseName)) newExpanded.delete(courseName);
            else newExpanded.add(courseName);
            return newExpanded;
        });
    };

    const handleCopyCourse = useCallback((courseName: string) => {
        const students = studentsByCourse.get(courseName);
        if (!students) return;

        const headers = "Código\tNombre\tSecciones";
        const rows = students.map(s => `${s.code}\t${s.name}\t${s.sections.join(', ')}`);
        const tsvContent = [headers, ...rows].join('\n');

        navigator.clipboard.writeText(tsvContent).then(() => {
            setCopiedCourse(courseName);
            setTimeout(() => setCopiedCourse(null), 2500);
        }).catch(err => {
            console.error("Fallo al copiar: ", err);
            alert("Error al copiar la lista.");
        });
    }, [studentsByCourse]);

     const handleDownloadSectionList = useCallback((sectionId: string) => {
        const section = sections.get(sectionId);
        if (!section || section.students.length === 0) {
            alert(`La sección ${sectionId} no tiene alumnos asignados.`);
            return;
        }

        const headers = ['Código', 'Nombre', 'Curso'];
        const rows = section.students
            .map(studentCode => studentAssignments.get(studentCode))
            .filter((assignment): assignment is StudentAssignment => !!assignment)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(assignment => [
                assignment.code,
                `"${assignment.name}"`, 
                assignment.course
            ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const filename = `Lista_Seccion_${section.subjectName.replace(/[\s.]+/g, '_')}_${section.id}.csv`;
        downloadCSV(csvContent, filename);
    }, [sections, studentAssignments]);

    const getValidationStatus = (assignment: StudentAssignment) => {
        const enrolledSubjects = enrollments.get(assignment.code) || new Set<string>();
        const assignedSubjectNames = new Set(
            assignment.sections.map(secId => sections.get(secId)?.subjectName).filter((name): name is string => !!name)
        );

        if (enrolledSubjects.size !== assignedSubjectNames.size) {
             const missingSubjects = [...enrolledSubjects].filter(s => !assignedSubjectNames.has(s));
             return { isValid: false, missingSubjects };
        }
        
        for (const subject of enrolledSubjects) {
            if (!assignedSubjectNames.has(subject)) {
                const missingSubjects = [...enrolledSubjects].filter(s => !assignedSubjectNames.has(s));
                return { isValid: false, missingSubjects };
            }
        }
        return { isValid: true, missingSubjects: [] };
    };

    return (
        <div className="space-y-8">
            <section>
                <h2 className="text-2xl font-bold mb-4 text-cyan-400">Resumen de la Planificación</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard title="Total Alumnos" value={stats.totalStudents} />
                    <SummaryCard title="Alumnos Asignados" value={stats.assignedStudents} />
                    <SummaryCard title="Alumnos no Asignados" value={stats.unassignedStudentsCount} color="text-red-400" />
                    <SummaryCard title="Total Inscripciones" value={stats.totalEnrollments} />
                </div>
            </section>
            
            <DiagnosticPanel result={result} subjects={subjects} />

             {newlyAssignedStudents.length > 0 && (
                <section className="bg-gray-800 rounded-lg border border-green-700/50">
                    <div 
                        onClick={() => setIsNewlyAssignedOpen(!isNewlyAssignedOpen)}
                        className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-700/50"
                        role="button"
                        tabIndex={0}
                    >
                        <h2 className="text-xl font-bold text-green-400">Alumnos Asignados en esta Ejecución ({newlyAssignedStudents.length})</h2>
                        <svg className={`w-6 h-6 text-gray-400 transform transition-transform duration-300 ${isNewlyAssignedOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className={`transition-all ease-in-out duration-500 overflow-hidden ${isNewlyAssignedOpen ? 'max-h-[1000px]' : 'max-h-0'}`}>
                        <div className="p-4 pt-0">
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full text-left table-auto">
                                    <thead>
                                        <tr className="border-b border-gray-600">
                                            <th className="py-2 px-3 font-semibold text-gray-300 w-1/6">Código</th>
                                            <th className="py-2 px-3 font-semibold text-gray-300 w-1/3">Nombre Alumno</th>
                                            <th className="py-2 px-3 font-semibold text-gray-300">Nuevas Secciones Asignadas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {newlyAssignedStudents.map(assignment => (
                                            <tr key={assignment.code} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                                                <td className="py-2 px-3 text-gray-300 font-mono">{assignment.code}</td>
                                                <td className="py-2 px-3 text-gray-300">{assignment.name}</td>
                                                <td className="py-2 px-3 text-gray-300 font-mono text-sm">{assignment.sections.join(', ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            )}


            <section>
                 <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4 text-cyan-400">Resumen de Inscripciones por Asignatura</h3>
                    <div className="overflow-x-auto"><table className="w-full text-left table-auto">
                        <thead><tr className="border-b border-gray-600">
                            <th className="py-3 px-4 font-semibold text-gray-300">Asignatura</th>
                            <th className="py-3 px-4 font-semibold text-gray-300 text-center">Postulantes</th>
                            <th className="py-3 px-4 font-semibold text-gray-300 text-center">Sección 1</th>
                            <th className="py-3 px-4 font-semibold text-gray-300 text-center">Sección 2</th>
                            <th className="py-3 px-4 font-semibold text-gray-300 text-center w-1/4">Ocupación</th>
                            <th className="py-3 px-4 font-semibold text-gray-300 text-center">Listas</th>
                        </tr></thead>
                        <tbody>{subjects.map(({id, name, capacity}) => {
                            const sec1Count = sections.get(`${id}.1`)?.students.length ?? 0;
                            const sec2Count = sections.get(`${id}.2`)?.students.length ?? 0;
                            const totalApplicants = totalApplicantsBySubject.get(name) ?? 0;
                            const sec1Perc = capacity > 0 ? (sec1Count / capacity) * 100 : 0;
                            const sec2Perc = capacity > 0 ? (sec2Count / capacity) * 100 : 0;
                            return(
                            <tr key={id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="py-3 px-4 text-gray-300">{name}</td>
                                <td className="py-3 px-4 text-gray-300 font-mono text-center">{totalApplicants}</td>
                                <td className="py-3 px-4 text-cyan-400 font-mono text-center">{sec1Count}/{capacity}</td>
                                <td className="py-3 px-4 text-cyan-400 font-mono text-center">{sec2Count}/{capacity}</td>
                                <td className="py-3 px-4 text-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1/2 bg-gray-600 rounded-full h-2.5"><div className="bg-cyan-600 h-2.5 rounded-full" style={{width: `${sec1Perc}%`}}></div></div>
                                        <div className="w-1/2 bg-gray-600 rounded-full h-2.5"><div className="bg-cyan-600 h-2.5 rounded-full" style={{width: `${sec2Perc}%`}}></div></div>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <div className="flex justify-center items-center gap-3">
                                        <button onClick={() => handleDownloadSectionList(`${id}.1`)} title={`Descargar lista para Sección ${id}.1`} className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={sec1Count === 0}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button onClick={() => handleDownloadSectionList(`${id}.2`)} title={`Descargar lista para Sección ${id}.2`} className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={sec2Count === 0}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )})}</tbody>
                    </table></div>
                    <p className="text-xs text-center text-gray-500 mt-4">
                        El planificador analizó <strong>{stats.combinationsChecked.toLocaleString('es-ES')}</strong> combinaciones de horarios válidas para encontrar la solución óptima.
                    </p>
                </div>
            </section>
            
            {unassignedStudents.length > 0 && (
                <section>
                    <h2 className="text-2xl font-bold mb-4 text-red-400">Alumnos no Asignados</h2>
                     <div className="bg-gray-800 rounded-lg p-4 border border-red-700/50"><h3 className="text-lg font-semibold text-red-400 mb-3">Alumnos ({unassignedStudents.length})</h3>
                        <ul className="space-y-3 max-h-[600px] overflow-y-auto">{unassignedStudents.map((ua, index) => (
                            <li key={index} className="text-gray-300 text-sm p-3 bg-gray-700/50 rounded-lg">
                                <div className="font-medium mb-1 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span>{studentCodeToName.get(ua.studentCode) || 'Desconocido'} ({ua.studentCode})</span></div>
                                <div className="text-gray-400 mb-2 pl-7">{ua.reason}</div>
                                <div className="text-xs pl-7 mb-3"><span className="font-semibold text-gray-500">Asignaturas: </span>
                                    {ua.subjects.map((subject, i) => {
                                        const subjectId = subjectNameToIdMap.get(subject);
                                        const label = subjectId ? `${subjectId}. ${subject}` : subject;
                                        return (<span key={i} className={`ml-1.5 mt-1 inline-block px-2 py-1 rounded-full font-medium ${ua.conflictingSubjects.includes(subject) ? 'bg-red-900/80 text-red-200 ring-1 ring-red-700' : 'bg-gray-600 text-gray-300'}`}>{label}</span>);
                                    })}
                                </div>
                                <div className="pl-7 mt-2 flex flex-wrap gap-2">
                                    {(ua.type === 'SCHEDULE' || ua.type === 'CAPACITY') && ua.conflictingSubjects.map(sName => (
                                        <button key={sName} onClick={() => onEditSubject(sName)} className="text-xs bg-yellow-800 hover:bg-yellow-700 text-yellow-200 font-semibold py-1 px-3 rounded-lg flex items-center gap-1.5 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            Ajustar Horario para "{sName}"
                                        </button>
                                    ))}
                                    {ua.type === 'CONFLICT' && (
                                        <button onClick={onEditConflicts} className="text-xs bg-yellow-800 hover:bg-yellow-700 text-yellow-200 font-semibold py-1 px-3 rounded-lg flex items-center gap-1.5 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                            Revisar Restricciones
                                        </button>
                                    )}
                                </div>
                            </li>))}</ul></div></section>)}

            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-400">Asignaciones por Curso</h2>
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar alumno por nombre o código..."
                        className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition w-1/3"
                    />
                </div>
                <div className="space-y-4">{sortedCourses.map(course => { const isExpanded = searchTerm ? true : expandedCourses.has(course);
                    const isCopied = copiedCourse === course;
                    return (<div key={course} className="bg-gray-800 rounded-lg border border-gray-700 transition-all duration-300">
                        <div onClick={() => !searchTerm && handleToggleCourse(course)} className={`p-4 ${!searchTerm ? 'cursor-pointer' : ''} flex justify-between items-center hover:bg-gray-700/50 transition-colors rounded-t-lg`} role="button" tabIndex={0}>
                            <h3 className="text-xl font-semibold text-gray-200">Curso: {course} ({studentsByCourse.get(course)?.length} alumnos)</h3>
                            <div className="flex items-center gap-4">
                                <button onClick={(e) => { e.stopPropagation(); handleCopyCourse(course); }} disabled={isCopied} className={`text-sm font-semibold py-1 px-3 rounded-lg flex items-center gap-1.5 transition-colors ${isCopied ? 'bg-green-600 text-white cursor-default' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                    {isCopied ? (
                                         <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>¡Copiado!</>
                                    ) : (
                                         <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" /><path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 0v10h4V5H6z" /></svg>Copiar Lista</>
                                    )}
                                </button>
                                <svg className={`w-6 h-6 text-gray-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                        <div className={`transition-all ease-in-out duration-500 overflow-hidden ${isExpanded ? 'max-h-[3000px]' : 'max-h-0'}`}><div className={`p-4 pt-0 border-t border-gray-700`}><div className="overflow-x-auto mt-4">
                            <table className="w-full text-left table-auto"><thead><tr className="border-b border-gray-600">
                                <th className="py-2 px-3 font-semibold text-gray-300 w-1/6">Código</th>
                                <th className="py-2 px-3 font-semibold text-gray-300 w-1/4">Nombre Alumno</th>
                                <th className="py-2 px-3 font-semibold text-gray-300 text-center w-20">Estado</th>
                                <th className="py-2 px-3 font-semibold text-gray-300">Secciones</th>
                                <th className="py-2 px-3 font-semibold text-gray-300 text-center">Acciones</th>
                            </tr></thead><tbody>{studentsByCourse.get(course)!.map((assignment) => {
                                const validation = getValidationStatus(assignment);
                                return (
                                <tr key={assignment.code} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50">
                                    <td className="py-2 px-3 text-gray-300 font-mono">{assignment.code}</td>
                                    <td className="py-2 px-3 text-gray-300">{assignment.name}</td>
                                    <td className="py-2 px-3 text-center">
                                        {validation.isValid ? (
                                            <span title="Inscripción completa y validada." className="inline-block">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        ) : (
                                            <span title={`Faltan asignaturas: ${validation.missingSubjects.join(', ')}`} className="inline-block">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-gray-300 font-mono text-sm">{assignment.sections.join(', ')}</td>
                                    <td className="py-2 px-3 text-center">
                                        <button onClick={() => setEditingStudent(assignment)} className="p-1.5 text-gray-400 hover:text-cyan-400" title="Editar horario"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                        <button onClick={() => setViewingStudentSchedule(assignment)} className="p-1.5 text-gray-400 hover:text-cyan-400" title="Ver/Imprimir Horario"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" /></svg></button>
                                    </td>
                                </tr>
                            )})}</tbody></table></div></div></div></div>);
                })}</div>
            </section>
            {editingStudent && (
                 <ScheduleEditorModal 
                    studentAssignment={editingStudent}
                    isOpen={!!editingStudent}
                    onClose={() => setEditingStudent(null)}
                    onApplyChange={onApplyChange}
                    result={result}
                    conflictPairs={conflictPairs}
                    subjects={subjects}
                    scheduleConfig={scheduleConfig}
                />
            )}
            {viewingStudentSchedule && (
                <StudentScheduleModal 
                    isOpen={!!viewingStudentSchedule}
                    onClose={() => setViewingStudentSchedule(null)}
                    student={viewingStudentSchedule}
                    sections={sections}
                />
            )}
        </div>
    );
};