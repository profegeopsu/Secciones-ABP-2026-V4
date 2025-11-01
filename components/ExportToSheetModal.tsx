import React, { useState, useEffect } from 'react';

interface ExportToSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: () => Promise<{url: string}>;
}

export const ExportToSheetModal: React.FC<ExportToSheetModalProps> = ({ isOpen, onClose, onExport }) => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [sheetUrl, setSheetUrl] = useState<string | null>(null);

    const handleExport = async () => {
        setStatus('loading');
        setError(null);
        try {
            const result = await onExport();
            setSheetUrl(result.url);
            setStatus('success');
        } catch (err) {
            if (err instanceof Error) {
                setError(`Error al exportar: ${err.message}`);
            } else {
                setError("Ocurrió un error desconocido durante la exportación.");
            }
            setStatus('error');
        }
    };
    
    // Automatically trigger export when modal opens
    useEffect(() => {
        if(isOpen && status === 'idle'){
            handleExport();
        }
    }, [isOpen, status]);


    const resetAndClose = () => {
        onClose();
        // Delay reset to allow for closing animation
        setTimeout(() => {
            setStatus('idle');
            setError(null);
            setSheetUrl(null);
        }, 300);
    };

    if (!isOpen) return null;

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="p-6 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                        <p className="text-gray-300">Creando respaldo en Google Sheets... Por favor, espera.</p>
                        <p className="text-sm text-gray-500 mt-2">(Esto puede tardar unos segundos)</p>
                    </div>
                );
            case 'success':
                return (
                    <div className="p-8 text-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400 mx-auto mb-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <h4 className="text-lg font-semibold text-green-300 mb-2">¡Respaldo Exitoso!</h4>
                        <p className="text-gray-400 mb-4">Tus datos han sido guardados en la hoja de cálculo.</p>
                        <a href={sheetUrl!} target="_blank" rel="noopener noreferrer" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg inline-block">
                            Abrir Hoja de Cálculo
                        </a>
                    </div>
                );
            case 'error':
                 return (
                    <div className="p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mx-auto mb-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <h4 className="text-lg font-semibold text-red-300 mb-2">Error en el Respaldo</h4>
                        <p className="text-gray-400 bg-gray-700 p-3 rounded-md text-sm">{error}</p>
                    </div>
                );
            case 'idle':
            default:
                return null; // Content is rendered based on status change from useEffect
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-cyan-400">Respaldando en Google Sheets</h3>
                    <button onClick={resetAndClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                </div>
                {renderContent()}
                <div className="p-4 bg-gray-900/50 flex justify-end gap-4 rounded-b-lg">
                    {status === 'error' && (
                        <button onClick={handleExport} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg">
                            Reintentar
                        </button>
                    )}
                     <button onClick={resetAndClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};