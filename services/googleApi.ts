import type { StudentAssignment } from '../types';

// This version MUST match the version inside the GOOGLE_APPS_SCRIPT constant in DataSource.tsx
const SCRIPT_VERSION = '7.0.0-BI_DIRECTIONAL';

/**
 * Checks if the deployed Google Apps Script matches the version expected by the client.
 */
async function checkScriptVersion(scriptUrl: string): Promise<void> {
    try {
        const url = new URL(scriptUrl);
        url.searchParams.set('action', 'getVersion');
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`No se pudo conectar al script (HTTP ${response.status}).`);
        }
        const versionResponse = await response.json();
        if (versionResponse.version !== SCRIPT_VERSION) {
            throw new Error(`La versión de tu script de Google (${versionResponse.version || 'desconocida'}) no coincide con la versión requerida por la aplicación (${SCRIPT_VERSION}). Por favor, copia el script más reciente desde la aplicación e impleméntalo de nuevo.`);
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
             throw new Error("Error de conexión (CORS): No se pudo conectar al script. Asegúrate de que tu script en Google Apps Script esté configurado para permitir el acceso a 'Cualquier persona'.");
        }
        throw error;
    }
}

/**
 * Fetches the names of all sheets in the spreadsheet.
 */
export async function getSheetNames(scriptUrl: string): Promise<string[]> {
    await checkScriptVersion(scriptUrl);
    
    const url = new URL(scriptUrl);
    url.searchParams.set('action', 'getSheetNames');

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`El script devolvió un error (HTTP ${response.status}).`);
    
    const jsonResponse = await response.json();
    if (jsonResponse.status === 'error') throw new Error(`Error del script: ${jsonResponse.message}`);
    if (!Array.isArray(jsonResponse.data)) throw new Error("La respuesta del script para los nombres de las hojas no fue válida.");
    
    return jsonResponse.data;
}


/**
 * Fetches student data from a specified Google Sheet.
 */
export async function fetchFromGoogleScript(scriptUrl:string, sheetName: string): Promise<string[][]> {
    await checkScriptVersion(scriptUrl);
    
    const url = new URL(scriptUrl);
    url.searchParams.set('action', 'getSheetData');
    url.searchParams.set('sheetName', sheetName);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`El script devolvió un error (HTTP ${response.status}).`);
    
    const jsonResponse = await response.json();
    if (jsonResponse.status === 'error') throw new Error(`Error del script: ${jsonResponse.message}`);
    if (!Array.isArray(jsonResponse.data)) throw new Error("La respuesta del script para los datos de la hoja no fue válida.");

    return jsonResponse.data;
}


/**
 * Exports the generated assignments back to the source Google Sheet.
 */
export async function exportToGoogleScript(
    scriptUrl: string, 
    sourceSheetName: string, 
    studentAssignments: Map<string, StudentAssignment>
): Promise<{ url: string }> {
    await checkScriptVersion(scriptUrl);

    const assignmentsPayload = Array.from(studentAssignments.values()).map(assignment => ({
        code: assignment.code,
        sections: assignment.sections.join(', '),
    }));

    const payload = {
        action: 'updateAssignments',
        sheetName: sourceSheetName,
        assignments: assignmentsPayload,
    };

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow',
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del servidor de Google (${response.status}): ${errorText || response.statusText}`);
        }

        const jsonResponse = await response.json();

        if (jsonResponse.status === 'success' && jsonResponse.url) {
            return { url: jsonResponse.url };
        } else {
            throw new Error(jsonResponse.message || 'La respuesta del script de Google no fue válida.');
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
             throw new Error('Error de red (CORS). No se pudo conectar al script. Asegúrate de que tu script esté configurado para permitir el acceso a \'Cualquier persona\'.');
        }
        throw error;
    }
}