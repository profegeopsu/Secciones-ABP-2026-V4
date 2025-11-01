import type { Subject, ScheduleConfig } from './types';

export const initialSubjects: Subject[] = [
    { id: 1, name: "3EM PROBAB. Y ESTAD.", capacity: 35, s1_block: 1, s2_block: 2 },
    { id: 2, name: "3EM LECTURA Y ESCRITURA", capacity: 35, s1_block: 1, s2_block: 2 },
    { id: 3, name: "3EM GEOG. TERRITORIO", capacity: 35, s1_block: 1, s2_block: 3 },
    { id: 4, name: "3EM QUÍMICA", capacity: 35, s1_block: 1, s2_block: 3 },
    { id: 5, name: "3EM BIOL. ECOSISTEMAS", capacity: 35, s1_block: 2, s2_block: 3 },
    { id: 6, name: "3EM PROM. ESTILOS", capacity: 35, s1_block: 2, s2_block: 3 },
];

export const initialScheduleConfig: ScheduleConfig = {};
initialSubjects.forEach(s => {
    initialScheduleConfig[s.id] = {
        s1_block: s.s1_block,
        s2_block: s.s2_block,
        capacity: s.capacity,
    };
});