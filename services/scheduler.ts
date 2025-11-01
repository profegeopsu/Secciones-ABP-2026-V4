import type { StudentEnrollments, ScheduleResult, Section, StudentAssignment, Subject, UnassignedStudentInfo, ScheduleConfig, StudentPreferences, BalancingStrategy } from '../types';

type Assignment = Map<number, string>; // Map<subjectId, sectionId>
type CurrentSectionSizes = Map<string, number>; // Map<sectionId, size>

let subjectMap: Map<string, Subject> = new Map();
let allSubjects: Subject[] = [];

function getSubjectNameById(id: number): string {
    const subject = allSubjects.find(s => s.id === id);
    return subject ? subject.name : `ID de Asignatura Desconocido ${id}`;
}

/**
 * Finds all valid, non-conflicting section assignments for a single student.
 */
function findValidAssignments(
    studentSubjects: number[],
    studentCode: string,
    conflictMap: Map<string, Set<string>>,
    sections: Map<string, Section>,
    scheduleConfig: ScheduleConfig
): Assignment[] {
    const validAssignments: Assignment[] = [];
    const studentConflicts = conflictMap.get(studentCode) || new Set<string>();

    function backtrack(subjectIndex: number, currentAssignment: Assignment, usedBlocks: Set<number>) {
        if (subjectIndex === studentSubjects.length) {
            validAssignments.push(new Map(currentAssignment));
            return;
        }

        const subjectId = studentSubjects[subjectIndex];
        const config = scheduleConfig[subjectId];
        if (!config) return;

        const processSection = (block: number, sectionIdSuffix: string) => {
            if (usedBlocks.has(block)) return;

            const sectionId = `${subjectId}.${sectionIdSuffix}`;
            const section = sections.get(sectionId);
            if (!section) return; // Section does not exist

            // Hard Constraint: Check capacity
            if (section.students.length >= section.capacity) {
                return;
            }

            // Hard Constraint: Check student conflicts
            let hasConflict = false;
            if (studentConflicts.size > 0) {
                for (const assignedStudentCode of section.students) {
                    if (studentConflicts.has(assignedStudentCode)) {
                        hasConflict = true;
                        break;
                    }
                }
            }

            if (!hasConflict) {
                currentAssignment.set(subjectId, sectionId);
                usedBlocks.add(block);
                backtrack(subjectIndex + 1, currentAssignment, usedBlocks);
                usedBlocks.delete(block);
                currentAssignment.delete(subjectId);
            }
        };

        // Try assigning to Section 1 (s1_block)
        processSection(config.s1_block, '1');
        // Try assigning to Section 2 (s2_block)
        processSection(config.s2_block, '2');
    }

    backtrack(0, new Map(), new Set());
    return validAssignments;
}

/**
 * Analyzes why a student could not be assigned.
 */
function diagnoseFailure(
    studentCode: string,
    studentSubjects: number[],
    conflictMap: Map<string, Set<string>>,
    sections: Map<string, Section>,
    studentCodeToName: Map<string, string>,
    scheduleConfig: ScheduleConfig
): Omit<UnassignedStudentInfo, 'studentCode'> {
    const allSubjectNames = studentSubjects.map(id => getSubjectNameById(id));
    const allSubjectIds = allSubjects.map(s => s.id);
    const potentialSchedules = findValidAssignments(studentSubjects, '', new Map(), sections, scheduleConfig);

    if (potentialSchedules.length === 0) {
        // Check for capacity issues first
        for(const subjectId of studentSubjects){
             const config = scheduleConfig[subjectId];
             if(config){
                 const section1 = sections.get(`${subjectId}.1`);
                 const section2 = sections.get(`${subjectId}.2`);
                 if(section1 && section1.students.length >= section1.capacity && section2 && section2.students.length >= section2.capacity){
                     return {
                        type: 'CAPACITY',
                        reason: `Conflicto de Capacidad: Ambas secciones para la asignatura '${getSubjectNameById(subjectId)}' están llenas.`,
                        subjects: allSubjectNames,
                        conflictingSubjects: [getSubjectNameById(subjectId)],
                    };
                 }
             }
        }
        
        // Then check for pure schedule conflict.
        let conflictingSubjectNames = new Set<string>();
         for (let i = 0; i < studentSubjects.length; i++) {
            for (let j = i + 1; j < studentSubjects.length; j++) {
                const subA = scheduleConfig[studentSubjects[i]];
                const subB = scheduleConfig[studentSubjects[j]];
                if (subA && subB) {
                     const blocksA = new Set([subA.s1_block, subA.s2_block]);
                     const blocksB = new Set([subB.s1_block, subB.s2_block]);
                     if (blocksA.size === blocksB.size && [...blocksA].every(b => blocksB.has(b))) {
                        conflictingSubjectNames.add(getSubjectNameById(studentSubjects[i]));
                        conflictingSubjectNames.add(getSubjectNameById(studentSubjects[j]));
                     }
                }
            }
        }

        return {
            type: 'SCHEDULE',
            reason: "Conflicto de Horario: La combinación de asignaturas es imposible de planificar.",
            subjects: allSubjectNames,
            conflictingSubjects: conflictingSubjectNames.size > 0 ? Array.from(conflictingSubjectNames) : allSubjectNames,
        };
    }

    const studentConflicts = conflictMap.get(studentCode) || new Set<string>();
    const blockingStudentsBySchedule: Set<string>[] = [];
    
    for (const schedule of potentialSchedules) {
        const blockingStudentsForThisSchedule = new Set<string>();
        for (const sectionId of schedule.values()) {
            const section = sections.get(sectionId);
            if (section) {
                for (const assignedStudentCode of section.students) {
                    if (studentConflicts.has(assignedStudentCode)) {
                        blockingStudentsForThisSchedule.add(assignedStudentCode);
                    }
                }
            }
        }
        if (blockingStudentsForThisSchedule.size > 0) {
            blockingStudentsBySchedule.push(blockingStudentsForThisSchedule);
        }
    }
    
    if (blockingStudentsBySchedule.length > 0) {
        let intersection = new Set(blockingStudentsBySchedule[0]);
        for(let i = 1; i < blockingStudentsBySchedule.length; i++){
            intersection = new Set([...intersection].filter(x => blockingStudentsBySchedule[i].has(x)));
        }

        if (intersection.size > 0) {
            const names = Array.from(intersection).map(code => `${studentCodeToName.get(code) || 'Desconocido'} (${code})`).join(', ');
            let reason = `Conflicto de Convivencia: Todos los horarios posibles están bloqueados por un conflicto con: ${names}.`;
            
            let suggestion = '';
            const otherAvailableSubjectIds = allSubjectIds.filter(id => !studentSubjects.includes(id));

            for (const subjectToReplaceId of studentSubjects) {
                const currentSubjectsWithoutOne = studentSubjects.filter(id => id !== subjectToReplaceId);
                for (const newSubjectId of otherAvailableSubjectIds) {
                    const newHypotheticalSubjects = [...currentSubjectsWithoutOne, newSubjectId];
                    if (findValidAssignments(newHypotheticalSubjects, studentCode, conflictMap, sections, scheduleConfig).length > 0) {
                        suggestion = ` Solución propuesta: Cambiar la asignatura '${getSubjectNameById(subjectToReplaceId)}' por '${getSubjectNameById(newSubjectId)}' podría resolver el conflicto.`;
                        break;
                    }
                }
                if (suggestion) break;
            }
            
            return { type: 'CONFLICT', reason: reason + suggestion, subjects: allSubjectNames, conflictingSubjects: [] };
        }
    }
    
    return { type: 'UNKNOWN', reason: "No se pudo asignar debido a un conflicto inevitable.", subjects: allSubjectNames, conflictingSubjects: [] };
}


/**
 * Calculates a cost for a potential assignment based on the selected strategy.
 */
function calculateAssignmentCost(
    assignment: Assignment,
    sectionSizes: CurrentSectionSizes,
    preference: 'mañana' | 'tarde' | undefined,
    scheduleConfig: ScheduleConfig,
    balancingStrategy: BalancingStrategy
): number {
    let cost = 0;
    // Base cost on section sizes, depending on the strategy
    if (balancingStrategy === 'equitable') {
        // Penalize larger sections more heavily to force better balance
        for (const sectionId of assignment.values()) {
            cost += Math.pow(sectionSizes.get(sectionId) || 0, 2);
        }
    } else { // 'speed' or default
        for (const sectionId of assignment.values()) {
            cost += sectionSizes.get(sectionId) || 0;
        }
    }


    // Soft Constraint: Add penalty for violating preference
    if (preference) {
        let preferenceMismatchPenalty = 0;
        for (const [subjectId, sectionId] of assignment.entries()) {
            const block = scheduleConfig[subjectId][sectionId.endsWith('.1') ? 's1_block' : 's2_block'];
            // Simple heuristic: Block 1 is morning, Block 3 is afternoon, Block 2 is flexible/morning
            const blockTime: 'mañana' | 'tarde' = block === 3 ? 'tarde' : 'mañana';
            if (preference === 'mañana' && blockTime === 'tarde') {
                preferenceMismatchPenalty += 10; // High penalty for afternoon block
            }
            if (preference === 'tarde' && blockTime === 'mañana') {
                preferenceMismatchPenalty += 5; // Lower penalty for morning block
            }
        }
        cost += preferenceMismatchPenalty;
    }
    return cost;
}

export function scheduleStudents(
    enrollments: StudentEnrollments,
    studentCourses: Map<string, string>,
    studentCodeToName: Map<string, string>,
    studentPreferences: StudentPreferences,
    preassignedSections: Map<string, string[]>,
    conflictPairs: string[][],
    subjectsConfig: Subject[],
    scheduleConfig: ScheduleConfig,
    balancingStrategy: BalancingStrategy
): ScheduleResult {
    allSubjects = subjectsConfig;
    subjectMap = new Map(subjectsConfig.map(s => [s.name, s]));
    
    const sections = new Map<string, Section>();
    const unassignedStudents: UnassignedStudentInfo[] = [];
    let totalEnrollments = 0;
    let combinationsChecked = 0;

    const conflictMap = new Map<string, Set<string>>();
    conflictPairs.forEach(([a, b]) => {
        if (!conflictMap.has(a)) conflictMap.set(a, new Set());
        if (!conflictMap.has(b)) conflictMap.set(b, new Set());
        conflictMap.get(a)!.add(b);
        conflictMap.get(b)!.add(a);
    });

    subjectsConfig.forEach(subject => {
        const config = scheduleConfig[subject.id];
        if (config) {
            sections.set(`${subject.id}.1`, { id: `${subject.id}.1`, subjectId: subject.id, subjectName: subject.name, block: config.s1_block, students: [], capacity: config.capacity });
            sections.set(`${subject.id}.2`, { id: `${subject.id}.2`, subjectId: subject.id, subjectName: subject.name, block: config.s2_block, students: [], capacity: config.capacity });
        }
    });

    const preassignedStudentCodes = new Set<string>();

    // Phase 1: Place pre-assigned students. Intra-student validation is now done upfront in App.tsx.
    for (const [studentCode, sectionIds] of preassignedSections.entries()) {
        for (const sectionId of sectionIds) {
            const section = sections.get(sectionId);
            if (section) {
                if (section.students.length >= section.capacity) {
                    throw new Error(`No se puede pre-asignar al alumno ${studentCodeToName.get(studentCode)} (${studentCode}) a la sección ${sectionId} porque está llena.`);
                }
                section.students.push(studentCode);
            } else {
                 throw new Error(`El alumno ${studentCodeToName.get(studentCode)} (${studentCode}) tiene una sección pre-asignada inválida ('${sectionId}') que no existe.`);
            }
        }
        preassignedStudentCodes.add(studentCode);
    }
    
    // Validate inter-student conflicts for pre-assigned students
    for (const [studentCode, sectionIds] of preassignedSections.entries()) {
        const studentConflicts = conflictMap.get(studentCode) || new Set();
        if (studentConflicts.size === 0) continue;
        
        for (const sectionId of sectionIds) {
            const section = sections.get(sectionId);
            if (section) {
                for (const otherStudentCode of section.students) {
                    if (studentCode !== otherStudentCode && studentConflicts.has(otherStudentCode)) {
                         throw new Error(`Conflicto de convivencia en los datos pre-asignados: ${studentCodeToName.get(studentCode)} (${studentCode}) y ${studentCodeToName.get(otherStudentCode)} (${otherStudentCode}) no pueden estar juntos en la sección ${sectionId}.`);
                    }
                }
            }
        }
    }


    const studentList = Array.from(enrollments.keys());
    const studentsToSchedule = studentList.filter(code => !preassignedStudentCodes.has(code));


    for (const studentCode of studentsToSchedule) {
        const rawSubjects = enrollments.get(studentCode) || new Set();
        const studentSubjects = [...new Set(Array.from(rawSubjects)
            .map(name => subjectsConfig.find(s => s.name === name)?.id)
            .filter((id): id is number => id !== undefined))];
        
        if (!totalEnrollments) { // Calculate total enrollments once.
            Array.from(enrollments.values()).forEach(set => totalEnrollments += set.size);
        }
        if (studentSubjects.length === 0) continue;

        const validAssignments = findValidAssignments(studentSubjects, studentCode, conflictMap, sections, scheduleConfig);
        combinationsChecked += validAssignments.length;

        if (validAssignments.length === 0) {
            const diagnosis = diagnoseFailure(studentCode, studentSubjects, conflictMap, sections, studentCodeToName, scheduleConfig);
            unassignedStudents.push({ studentCode, ...diagnosis });
            continue;
        }

        const sectionSizes: CurrentSectionSizes = new Map();
        sections.forEach((section, id) => sectionSizes.set(id, section.students.length));
        const studentPreference = studentPreferences.get(studentCode);

        let bestAssignment = validAssignments[0];
        let minCost = calculateAssignmentCost(bestAssignment, sectionSizes, studentPreference, scheduleConfig, balancingStrategy);

        for (let i = 1; i < validAssignments.length; i++) {
            const cost = calculateAssignmentCost(validAssignments[i], sectionSizes, studentPreference, scheduleConfig, balancingStrategy);
            if (cost < minCost) {
                minCost = cost;
                bestAssignment = validAssignments[i];
            }
        }

        for (const sectionId of bestAssignment.values()) {
            sections.get(sectionId)?.students.push(studentCode);
        }
    }
    
    const assignedStudentsSet = new Set<string>();
    sections.forEach(sec => sec.students.forEach(s => assignedStudentsSet.add(s)));

    const studentAssignments = new Map<string, StudentAssignment>();
    const studentToSectionsMap = new Map<string, string[]>();
    sections.forEach((section, sectionId) => {
        section.students.forEach(studentCode => {
            if (!studentToSectionsMap.has(studentCode)) studentToSectionsMap.set(studentCode, []);
            studentToSectionsMap.get(studentCode)!.push(sectionId);
        });
    });

    // Corrected Logic: Iterate over the map of successfully assigned students.
    studentToSectionsMap.forEach((assignedSections, studentCode) => {
        const course = studentCourses.get(studentCode);
        // Only create an assignment if we can find the student's original course info.
        if (course) {
            studentAssignments.set(studentCode, {
                code: studentCode,
                name: studentCodeToName.get(studentCode) || 'Desconocido',
                course,
                sections: assignedSections.sort(),
            });
        }
    });


    return {
        sections, unassignedStudents, studentAssignments, studentCodeToName,
        stats: {
            totalStudents: studentList.length, 
            totalEnrollments: Array.from(enrollments.values()).reduce((sum, current) => sum + current.size, 0), 
            assignedStudents: assignedStudentsSet.size, 
            unassignedStudentsCount: unassignedStudents.length,
            combinationsChecked: combinationsChecked
        },
    };
}