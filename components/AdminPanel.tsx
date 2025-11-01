import React from 'react';
import type { Subject, ScheduleConfig, BalancingStrategy } from '../types';

interface AdminPanelProps {
    subjects: Subject[];
    setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
    scheduleConfig: ScheduleConfig;
    setScheduleConfig: React.Dispatch<React.SetStateAction<ScheduleConfig>>;
    balancingStrategy: BalancingStrategy;
    setBalancingStrategy: React.Dispatch<React.SetStateAction<BalancingStrategy>>;
    isSchedulingActive: boolean;
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    editingSubject: Subject | null;
    setEditingSubject: React.Dispatch<React.SetStateAction<Subject | null>>;
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const { 
        subjects, setSubjects, scheduleConfig, setScheduleConfig, balancingStrategy, setBalancingStrategy,
        isSchedulingActive, isOpen, setIsOpen, editingSubject, setEditingSubject
    } = props;

    const handleSaveSubject = (subjectToSave: Subject) => {
        const isNew = !subjects.some(s => s.id === subjectToSave.id);
        if (isNew) {
            setSubjects([...subjects, subjectToSave]);
        } else {
            setSubjects(subjects.map(s => s.id === subjectToSave.id ? subjectToSave : s));
        }
        setScheduleConfig(prev => ({
            ...prev,
            [subjectToSave.id]: {
                s1_block: subjectToSave.s1_block,
                s2_block: subjectToSave.s2_block,
                capacity: subjectToSave.capacity,
            }
        }));
        setEditingSubject(null);
    };

    const handleAddNew = () => {
        const newId = subjects.length > 0 ? Math.max(...subjects.map(s => s.id)) + 1 : 1;
        setEditingSubject({ id: newId, name: '', capacity: 30, s1_block: 1, s2_block: 2 });
    };

    const handleDelete = (subjectId: number) => {
        if(window.confirm("¿Estás seguro de que quieres eliminar esta asignatura?")) {
            setSubjects(subjects.filter(s => s.id !== subjectId));
            const newConfig = { ...scheduleConfig };
            delete newConfig[subjectId];
            setScheduleConfig(newConfig);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
            <div onClick={() => setIsOpen(!isOpen)} className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-700/50">
                <div className="flex items-center">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-3 text-cyan-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5" />
                    </svg>
                    <h2 className="text-xl font-semibold text-gray-200">Panel de Configuración</h2>
                </div>
                 <svg className={`w-6 h-6 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
             <div className={`transition-all ease-in-out duration-500 overflow-hidden ${isOpen ? 'max-h-[1500px]' : 'max-h-0'}`}>
                <div className="p-6 pt-2 border-t border-gray-700 text-gray-300 space-y-6">
                    {isSchedulingActive && <div className="bg-yellow-900/50 text-yellow-300 text-sm p-3 rounded-md">La configuración está bloqueada. Regenera los horarios para aplicar los cambios.</div>}
                    
                    <div>
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">Configuración Global del Planificador</h3>
                         <div className="bg-gray-700/50 p-4 rounded-lg">
                            <label htmlFor="balancingStrategy" className="block text-sm font-medium text-gray-200 mb-2">Estrategia de Equilibrio</label>
                            <select 
                                id="balancingStrategy"
                                value={balancingStrategy}
                                onChange={(e) => setBalancingStrategy(e.target.value as BalancingStrategy)}
                                disabled={isSchedulingActive}
                                className="w-full bg-gray-900 p-2 rounded-md border border-gray-600 disabled:opacity-50"
                            >
                                <option value="speed">Velocidad (Buen Equilibrio)</option>
                                <option value="equitable">Distribución Equitativa (Más Lento)</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-2">
                                {balancingStrategy === 'speed' 
                                    ? "Prioriza la velocidad de asignación. Bueno para resultados rápidos y la mayoría de los casos."
                                    : "Garantiza la distribución más equitativa posible entre secciones. Puede ser más lento."}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">Configuración de Asignaturas</h3>
                        {!editingSubject ? (
                            <>
                            <table className="w-full text-left table-auto text-sm">
                                <thead><tr className="border-b border-gray-600"><th className="p-2">ID</th><th className="p-2">Nombre</th><th className="p-2">Bloques</th><th className="p-2">Capacidad</th><th className="p-2">Acciones</th></tr></thead>
                                <tbody>{subjects.sort((a,b) => a.id - b.id).map(s => <tr key={s.id} className="border-b border-gray-700">
                                    <td className="p-2">{s.id}</td><td>{s.name}</td><td>{s.s1_block}, {s.s2_block}</td><td>{s.capacity}</td>
                                    <td className="p-2">
                                        <button onClick={() => setEditingSubject(s)} disabled={isSchedulingActive} className="text-cyan-400 disabled:opacity-50">Editar</button> | 
                                        <button onClick={() => handleDelete(s.id)} disabled={isSchedulingActive} className="text-red-400 disabled:opacity-50">Eliminar</button>
                                    </td></tr>)}</tbody>
                            </table>
                            <button onClick={handleAddNew} disabled={isSchedulingActive} className="mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">Añadir Asignatura</button>
                            </>
                        ) : ( <SubjectForm subject={editingSubject} onSave={handleSaveSubject} onCancel={() => setEditingSubject(null)} /> )}
                    </div>
                </div>
             </div>
        </div>
    );
};

const SubjectForm: React.FC<{subject: Subject, onSave: (s: Subject) => void, onCancel: () => void}> = ({subject, onSave, onCancel}) => {
    const [formState, setFormState] = React.useState(subject);
    
    React.useEffect(() => {
        setFormState(subject);
    }, [subject]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormState({...formState, [e.target.name]: e.target.type === 'number' ? parseInt(e.target.value) : e.target.value});
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(formState.s1_block === formState.s2_block) { alert("Los bloques de las secciones no pueden ser iguales."); return; }
        onSave(formState);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-700/50 p-4 rounded-lg">
            <h4 className="text-lg font-semibold">{subject.id ? `Editando Asignatura (ID: ${subject.id})` : 'Nueva Asignatura'}</h4>
             <div><label className="text-sm font-medium">Nombre</label><input type="text" name="name" value={formState.name} onChange={handleChange} required className="w-full bg-gray-900 p-2 rounded-md mt-1"/></div>
             <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-medium">Capacidad</label><input type="number" name="capacity" value={formState.capacity} onChange={handleChange} min="1" required className="w-full bg-gray-900 p-2 rounded-md mt-1"/></div>
                <div><label className="text-sm font-medium">Bloque Sec. 1</label><select name="s1_block" value={formState.s1_block} onChange={handleChange} className="w-full bg-gray-900 p-2 rounded-md mt-1"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
                <div><label className="text-sm font-medium">Bloque Sec. 2</label><select name="s2_block" value={formState.s2_block} onChange={handleChange} className="w-full bg-gray-900 p-2 rounded-md mt-1"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
             </div>
            <div className="flex gap-4"><button type="submit" className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded">Guardar</button><button type="button" onClick={onCancel} className="bg-gray-500 hover:bg-gray-400 text-white font-bold py-2 px-4 rounded">Cancelar</button></div>
        </form>
    );
}
