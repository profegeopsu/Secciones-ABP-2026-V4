export type StudentEnrollments = Map<string, Set<string>>;
export type StudentPreferences = Map<string, 'mañana' | 'tarde'>;

export interface Subject {
    id: number;
    name: string;
    capacity: number;
    s1_block: number;
    s2_block: number;
}

export interface Section {
    id: string; // e.g., "1.1", "1.2"
    subjectId: number;
    subjectName: string;
    block: number;
    students: string[]; // Now stores student codes
    capacity: number;
}

export interface StudentAssignment {
    name: string;
    code: string;
    course: string;
    sections: string[];
}

export interface UnassignedStudentInfo {
    studentCode: string;
    reason: string;
    type: 'CAPACITY' | 'SCHEDULE' | 'CONFLICT' | 'UNKNOWN';
    subjects: string[];
    conflictingSubjects: string[];
}

export interface ScheduleResult {
    sections: Map<string, Section>;
    unassignedStudents: UnassignedStudentInfo[];
    studentAssignments: Map<string, StudentAssignment>; // Key is student code
    studentCodeToName: Map<string, string>;
    stats: {
        totalStudents: number;
        totalEnrollments: number;
        assignedStudents: number;
        unassignedStudentsCount: number;
        combinationsChecked: number;
    };
}

export type ScheduleConfig = Record<number, { s1_block: number, s2_block: number, capacity: number }>;

export type BalancingStrategy = 'speed' | 'equitable';

export interface PreassignmentConflictInfo {
    studentCode: string;
    studentName: string;
    conflictingBlock: number;
    conflictingSections: string[];
    allPreassignedSections: string[];
    enrollments: Set<string>;
}