import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';

export const FinanceDashboardScreen: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a]">
            <header className="px-6 py-6 flex items-center gap-4 bg-white dark:bg-[#1e2330] shadow-sm sticky top-0 z-20">
                <ChevronBack onClick={() => navigate(-1)} />
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Financiën</h1>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner border border-yellow-200 dark:border-yellow-800">
                    <span className="material-icons-round text-5xl text-yellow-600 dark:text-yellow-500">construction</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Under Construction</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                    Deze module wordt momenteel gebouwd. Binnenkort kan je hier alle financiële overzichten, facturen en onkostennota's beheren.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-8 px-8 py-3.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm active:scale-95"
                >
                    Terug naar home
                </button>
            </main>
        </div>
    );
};
