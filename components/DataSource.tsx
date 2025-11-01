import React, { useState, useEffect, useCallback } from 'react';
import { getSheetNames, fetchFromGoogleScript } from '../services/googleApi';
import type { DataSourceInfo } from '../App';

// This version MUST match the SCRIPT_VERSION constant in services/googleApi.ts
export const GOOGLE_APPS_SCRIPT = `
// Copia y pega este código en el editor de Apps Script de tu Google Sheet (Extensiones > Apps Script)
const SCRIPT_VERSION = '7.0.0-BI_DIRECTIONAL';

function doGet(e) {
  const response = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  let output;
  try {
    const action = e.parameter.action || 'getVersion';
    
    if (action === 'getVersion') {
      output = { version: SCRIPT_VERSION };
    } else if (action === 'getSheetNames') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw new Error("Este script debe estar asociado a una Hoja de Cálculo de Google.");
      const sheets = ss.getSheets();
      const sheetNames = sheets.map(sheet => sheet.getName()).filter(name => name !== 'Respaldo');
      output = { status: 'success', data: sheetNames };
    } else if (action === 'getSheetData') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw new Error("Este script debe estar asociado a una Hoja de Cálculo de Google.");
      const sheetName = e.parameter.sheetName;
      if (!sheetName) throw new Error("Parámetro 'sheetName' es requerido.");
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(\`La hoja '\${sheetName}' no fue encontrada.\`);
      const data = sheet.getDataRange().getValues();
      output = { status: 'success', data: data };
    } else {
      throw new Error(\`Acción desconocida: \${action}\`);
    }
  } catch (err) {
    output = { status: 'error', message: err.message, stack: err.stack };
  }
  response.setContent(JSON.stringify(output));
  return response;
}

function doPost(e) {
  const response = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  let output;
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'updateAssignments') {
      output = updateAssignments(payload);
    } else {
      throw new Error(\`Acción POST desconocida: \${payload.action}\`);
    }
  } catch (err) {
    output = { status: 'error', message: err.message, stack: err.stack };
  }
  response.setContent(JSON.stringify(output));
  return response;
}

function updateAssignments(payload) {
  const { sheetName, assignments } = payload;
  if (!sheetName || !assignments) throw new Error("Payload para 'updateAssignments' debe contener 'sheetName' y 'assignments'.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(\`La hoja '\${sheetName}' no fue encontrada para actualizar.\`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  
  const codeIndex = headers.indexOf('código');
  if (codeIndex === -1) throw new Error("No se encontró la columna 'código' en la hoja.");
  
  let sectionsColIndex = headers.indexOf('secciones asignadas');
  if (sectionsColIndex === -1) {
    sectionsColIndex = headers.length;
    sheet.getRange(1, sectionsColIndex + 1).setValue('Secciones Asignadas');
  }
  
  const studentCodeToRow = new Map();
  for (let i = 1; i < data.length; i++) {
    const code = data[i][codeIndex].toString().trim().toUpperCase();
    if (code) studentCodeToRow.set(code, i + 1);
  }
  
  assignments.forEach(assignment => {
    const row = studentCodeToRow.get(assignment.code.toString().trim().toUpperCase());
    if (row) {
      sheet.getRange(row, sectionsColIndex + 1).setValue(assignment.sections);
    }
  });

  SpreadsheetApp.flush();
  
  return {
    status: 'success',
    message: \`Datos actualizados exitosamente en la hoja '\${sheetName}'.\`,
    url: ss.getUrl()
  };
}
`;


interface DataSourceProps {
    onDataProcessed: (data: string[][], sourceInfo: DataSourceInfo) => void;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    scriptUrl: string;
    setScriptUrl: (url: string) => void;
    sheetNames: string[];
    setSheetNames: (names: string[]) => void;
    selectedSheet: string;
    setSelectedSheet: (sheet: string) => void;
}

const parsePastedData = (text: string): string[][] => {
    return text
        .trim()
        .split('\n')
        .map(line => {
            const cells = line.split('\t'); // Prioritize tabs, common from spreadsheets
            return cells.length > 1 ? cells : line.split(','); // Fallback to comma
        })
        .map(row => row.map(cell => cell.trim().replace(/^"|"$/g, ''))) // Trim and remove quotes
        .filter(row => row.length > 1 || (row.length === 1 && row[0])); // Filter out empty lines
};


export const DataSource: React.FC<DataSourceProps> = (props) => {
    const { 
        onDataProcessed, setIsLoading, setError, 
        scriptUrl, setScriptUrl, sheetNames, setSheetNames, selectedSheet, setSelectedSheet 
    } = props;
    
    const [activeTab, setActiveTab] = useState<'paste' | 'google'>('paste');
    const [pastedData, setPastedData] = useState('');
    const [isSheetLoading, setIsSheetLoading] = useState(false);
    const [isScriptCopied, setIsScriptCopied] = useState(false);

    const handleProcessPaste = () => {
        if (!pastedData.trim()) {
            setError("Por favor, pega los datos de los alumnos en el área de texto.");
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            const dataArray = parsePastedData(pastedData);
            onDataProcessed(dataArray, { type: 'paste' });
        } catch (err) {
            if (err instanceof Error) setError(`Error al procesar los datos pegados: ${err.message}`);
            else setError('Ocurrió un error desconocido.');
            setIsLoading(false);
        }
    };

    const handleLoadSheets = useCallback(async () => {
        if (!scriptUrl) {
            setError("Por favor, introduce la URL del script de Google.");
            return;
        }
        setIsSheetLoading(true);
        setError(null);
        try {
            const names = await getSheetNames(scriptUrl);
            setSheetNames(names);
            if (names.length > 0) {
                setSelectedSheet(names[0]);
            } else {
                setError("No se encontraron hojas en el documento. Asegúrate de que no esté vacío.");
            }
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError('Ocurrió un error desconocido al cargar las hojas.');
            setSheetNames([]);
        } finally {
            setIsSheetLoading(false);
        }
    }, [scriptUrl, setError, setSheetNames, setSelectedSheet]);

    const handleImport = async () => {
        if (!scriptUrl || !selectedSheet) {
            setError("Asegúrate de haber cargado las hojas y seleccionado una para importar.");
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            const data = await fetchFromGoogleScript(scriptUrl, selectedSheet);
            onDataProcessed(data, { type: 'sheet', url: scriptUrl, name: selectedSheet });
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError('Ocurrió un error desconocido al importar los datos.');
            setIsLoading(false);
        }
    };
    
    const copyScriptToClipboard = () => {
        navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT.trim())
            .then(() => {
                setIsScriptCopied(true);
                setTimeout(() => setIsScriptCopied(false), 2000);
            });
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col">
            <div className="flex border-b border-gray-700">
                <button onClick={() => setActiveTab('paste')} className={`flex-1 py-3 px-4 text-center font-semibold transition-colors ${activeTab === 'paste' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>Pegar Datos</button>
                <button onClick={() => setActiveTab('google')} className={`flex-1 py-3 px-4 text-center font-semibold transition-colors ${activeTab === 'google' ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}>Sincronizar con Google Sheets</button>
            </div>
            {activeTab === 'paste' ? (
                <div className="p-6 flex flex-col flex-grow">
                     <p className="text-gray-400 mb-4 text-sm">Pega los datos de tu hoja de cálculo. Asegúrate de incluir encabezados: <strong>código, curso, nombre, asignatura</strong>.</p>
                    <textarea value={pastedData} onChange={(e) => setPastedData(e.target.value)} rows={8} className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition flex-grow" placeholder="código,curso,nombre,asignatura,preferencia (opcional)..." />
                    <button onClick={handleProcessPaste} className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition">Procesar Datos Pegados</button>
                </div>
            ) : (
                <div className="p-6 flex flex-col flex-grow space-y-4">
                     <div>
                        <label htmlFor="scriptUrl" className="block text-sm font-medium text-gray-300 mb-1">1. URL del Script de Google</label>
                        <div className="flex gap-2">
                             <input type="url" id="scriptUrl" value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} placeholder="Pega la URL de la aplicación web de tu script" className="flex-grow bg-gray-900 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                             <button onClick={handleLoadSheets} disabled={isSheetLoading} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">{isSheetLoading ? 'Cargando...' : 'Cargar Hojas'}</button>
                        </div>
                    </div>
                    {sheetNames.length > 0 && (
                        <div>
                             <label htmlFor="sheetSelect" className="block text-sm font-medium text-gray-300 mb-1">2. Selecciona la Hoja de Alumnos</label>
                            <select id="sheetSelect" value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none">
                                {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                    )}
                     <button onClick={handleImport} disabled={!selectedSheet} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        Importar y Planificar
                    </button>
                    <div className="pt-4 border-t border-gray-700 space-y-2">
                        <style>{`
                            details > summary { list-style: none; }
                            details > summary::-webkit-details-marker { display: none; }
                            details[open] .details-arrow { transform: rotate(180deg); }
                        `}</style>
                        <h3 className="text-sm font-semibold text-gray-400">¿Primera vez? Sigue las instrucciones:</h3>
                         <p className="text-xs text-gray-500">1. Abre tu Google Sheet, ve a <strong>Extensiones &gt; Apps Script</strong> y pega el código de abajo.</p>
                        <details>
                            <summary className="cursor-pointer p-2 text-xs font-semibold text-gray-300 hover:bg-gray-700/50 rounded-md bg-gray-900 border border-gray-600 list-none flex justify-between items-center">
                                <span>Mostrar/Ocular Código del Script</span>
                                <svg className="w-4 h-4 transition-transform transform details-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </summary>
                            <div className="relative mt-1">
                                <pre className="bg-gray-900 border border-gray-600 p-3 rounded-md text-xs text-gray-300 overflow-auto max-h-[250px]">{GOOGLE_APPS_SCRIPT.trim()}</pre>
                                <button onClick={copyScriptToClipboard} className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors">{isScriptCopied ? '¡Copiado!' : 'Copiar'}</button>
                            </div>
                        </details>
                        <p className="text-xs text-gray-500">2. Haz clic en <strong>Implementar &gt; Nueva implementación</strong> (como 'Aplicación web', con acceso para 'Cualquier persona') y copia la URL.</p>
                    </div>
                </div>
            )}
        </div>
    );
};