import React, { useState, useEffect, useCallback } from 'react';

interface ConflictEditorProps {
    onConflictsChange: (pairs: string[][]) => void;
    validStudentCodes: string[];
    studentCodeToName: Map<string, string>;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const ConflictEditor: React.FC<ConflictEditorProps> = ({ onConflictsChange, validStudentCodes, studentCodeToName, isOpen, setIsOpen }) => {
    const [text, setText] = useState('');
    const [invalidCodes, setInvalidCodes] = useState<Set<string>>(new Set());
    const [formatErrors, setFormatErrors] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeSuggestion, setActiveSuggestion] = useState(0);

    const updateSuggestions = useCallback((currentText: string) => {
        const lines = currentText.split('\n');
        const lastLine = lines[lines.length - 1];
        const parts = lastLine.split(',');
        const currentPart = parts[parts.length - 1].trim().toUpperCase();

        if (currentPart.length > 0) {
            const filtered = validStudentCodes.filter(code => 
                code.toUpperCase().startsWith(currentPart)
            );
            setSuggestions(filtered.slice(0, 5)); // Limit suggestions
        } else {
            setSuggestions([]);
        }
        setActiveSuggestion(0);
    }, [validStudentCodes]);
    
    useEffect(() => {
        const lines = text.split('\n');
        const validPairs: string[][] = [];
        const currentFormatErrors: string[] = [];

        lines.forEach((line, index) => {
            const codes = line.split(',').map(code => code.trim().toUpperCase()).filter(Boolean);
            if (codes.length === 0) {
                return; // Ignore empty lines
            }

            const isLastLine = index === lines.length - 1;

            if (codes.length === 2) {
                validPairs.push(codes);
            } else if (codes.length > 2) {
                // Unambiguously an error, show immediately
                currentFormatErrors.push(`Línea ${index + 1}: Se esperaban 2 códigos, pero se encontraron ${codes.length}.`);
            } else if (codes.length === 1 && !isLastLine) {
                // A "finished" line with only one code is an error
                currentFormatErrors.push(`Línea ${index + 1}: Se esperaban 2 códigos, pero se encontró 1.`);
            }
            // Implicitly allow the last line to have 1 code without showing an error
        });
        
        onConflictsChange(validPairs);
        setFormatErrors(currentFormatErrors);

        const validCodesSet = new Set(validStudentCodes);
        const allEnteredCodes = text.split(/[\n,]/).map(c => c.trim().toUpperCase()).filter(Boolean);
        const currentInvalid = new Set<string>();
        if (validCodesSet.size > 0) {
             allEnteredCodes.forEach(code => {
                if (code && !validCodesSet.has(code)) {
                    currentInvalid.add(code);
                }
            });
        }
        setInvalidCodes(currentInvalid);

    }, [text, onConflictsChange, validStudentCodes]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        updateSuggestions(newText);
    };

    const handleSuggestionClick = (suggestion: string) => {
        const lines = text.split('\n');
        const lastLine = lines[lines.length - 1];
        const parts = lastLine.split(',');
        parts[parts.length - 1] = ` ${suggestion}`;
        lines[lines.length - 1] = parts.join(',');
        setText(lines.join('\n'));
        setSuggestions([]);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
         if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestion(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSuggestionClick(suggestions[activeSuggestion]);
        } else if (e.key === 'Escape') {
            setSuggestions([]);
        }
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg h-full flex flex-col">
            <div onClick={() => setIsOpen(!isOpen)} className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-700/50">
                <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <h2 className="text-xl font-semibold text-gray-200">Restricciones de Convivencia</h2>
                </div>
                <svg className={`w-6 h-6 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
             <div className={`transition-all ease-in-out duration-500 overflow-hidden ${isOpen ? 'max-h-[1000px] flex-grow flex flex-col' : 'max-h-0'}`}>
                <div className="p-6 pt-4 border-t border-gray-700 relative flex-grow flex flex-col">
                    <p className="text-gray-400 mb-4">
                        Introduce los pares de alumnos que no deben quedar en la misma sección para ninguna asignatura.
                        <br />
                        El formato es un par de <strong>códigos de alumno</strong> por línea, separados por coma (ej: A21, C15).
                    </p>
                    <textarea
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition flex-grow"
                        placeholder="A21, C15&#10;B04, D11"
                        aria-label="Editor de conflictos de alumnos"
                    />
                    {suggestions.length > 0 && (
                        <ul className="absolute z-10 w-1/2 mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {suggestions.map((code, index) => (
                                <li 
                                    key={code}
                                    className={`p-2 cursor-pointer hover:bg-cyan-600 ${index === activeSuggestion ? 'bg-cyan-700' : ''}`}
                                    onClick={() => handleSuggestionClick(code)}
                                >
                                <strong>{code}</strong> - {studentCodeToName.get(code) || 'Nombre no encontrado'}
                                </li>
                            ))}
                        </ul>
                    )}
                    {invalidCodes.size > 0 && (
                        <div className="mt-3 text-sm text-yellow-300 bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2" role="alert">
                            <strong>Códigos no encontrados:</strong> {Array.from(invalidCodes).join(', ')}. Por favor, verifica que sean correctos.
                        </div>
                    )}
                    {formatErrors.length > 0 && (
                        <div className="mt-3 text-sm text-red-300 bg-red-900/50 border border-red-700 rounded-lg px-3 py-2" role="alert">
                            <strong>Error de formato:</strong>
                            <ul className="list-disc list-inside ml-2">
                                {formatErrors.map((error, index) => <li key={index}>{error}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};