import React, { useCallback, useRef } from 'react';

interface FileUploadProps {
    onDataProcessed: (data: string[][]) => void;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
}

const csvToArray = (str: string): string[][] => {
    const result: string[][] = [];
    let currentLine: string[] = [];
    let inQuote = false;
    let value = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (inQuote) {
            if (char === '"' && str[i + 1] === '"') { value += '"'; i++; } 
            else if (char === '"') { inQuote = false; } 
            else { value += char; }
        } else {
            if (char === '"') { inQuote = true; } 
            else if (char === ',' || char === ';') { currentLine.push(value.trim()); value = ''; } 
            else if (char === '\n' || char === '\r') {
                if (i > 0 && str[i-1] !== '\n' && str[i-1] !== '\r') {
                    currentLine.push(value.trim());
                    if (currentLine.length > 1 || currentLine[0]) {
                        result.push(currentLine);
                    }
                    currentLine = [];
                    value = '';
                }
            } else { value += char; }
        }
    }
    if (value || currentLine.length > 0) {
       currentLine.push(value.trim());
       if (currentLine.length > 1 || currentLine[0]) {
           result.push(currentLine);
       }
    }
    return result.filter(line => line.length > 1 && line.some(cell => cell.length > 0));
};

export const FileUpload: React.FC<FileUploadProps> = ({ onDataProcessed, setIsLoading, setError }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const data = csvToArray(text);
                    onDataProcessed(data);
                } catch(err) {
                     if (err instanceof Error) setError(`Error al procesar el archivo: ${err.message}`);
                     else setError('Ocurrió un error desconocido al procesar el archivo.');
                    setIsLoading(false);
                }
            };
            reader.onerror = () => {
                 setError('Error al leer el archivo.');
                 setIsLoading(false);
            }
            reader.readAsText(file, 'UTF-8');
        }
         // Reset file input to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
    }, [onDataProcessed, setIsLoading, setError]);

    const handleClick = () => fileInputRef.current?.click();

    return (
        <div className="p-8 text-center h-full flex flex-col justify-center items-center">
            <h3 className="text-xl font-semibold mb-2 text-gray-200">Subir Archivo de Inscripciones</h3>
            <p className="text-gray-400 mb-4 text-sm">
                El archivo debe ser un CSV con las columnas: <strong>Código, Curso, Nombre, Asignatura</strong>.
                <br />
                Opcionalmente, puedes incluir una columna de <strong>Preferencia</strong> ('mañana' o 'tarde').
            </p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,text/csv" className="hidden"/>
            <button onClick={handleClick} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">
                Seleccionar Archivo
            </button>
        </div>
    );
};