import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { AppContextType } from '../App';
import { User } from '../types';
import * as db from '../lib/supabaseService';

export const BierpongManageScreen: React.FC = () => {
    const navigate = useNavigate();
    const { users, duoBierpongWinners, setDuoBierpongWinners } = useOutletContext<AppContextType>();

    const [search, setSearch] = useState('');
    const [selectedWinners, setSelectedWinners] = useState<string[]>(duoBierpongWinners);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const getUserName = (userId: string) => {
        const u = users.find(u => u.id === userId);
        return u?.nickname || u?.name || u?.naam || 'Onbekend';
    };
    const getUserAvatar = (userId: string) => users.find(u => u.id === userId)?.avatar;

    const toggleWinnerSelection = (userId: string) => {
        setSelectedWinners(prev => {
            if (prev.includes(userId)) return prev.filter(id => id !== userId);
            if (prev.length >= 2) return [prev[1], userId];
            return [...prev, userId];
        });
        setSaved(false);
    };

    const saveWinners = async () => {
        if (selectedWinners.length !== 2) return;
        
        setIsSaving(true);
        try {
            await db.setBierpongKampioenen(selectedWinners);
            setDuoBierpongWinners(selectedWinners);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Fout bij het opslaan van kampioenen:', error);
            // Je zou hier een toast kunnen toevoegen als die beschikbaar is
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = users.filter((u: User) =>
        (u.name || u.naam || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
            {/* Header */}
            <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
                <ChevronBack onClick={() => navigate(-1)} />
                <div className="flex-1">
                    <h1 className="text-2xl font-bold leading-tight tracking-tight">🏆 Bierpong Kampioenen</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Bierpongtoernooi Winnaars Beheren</p>
                </div>
            </header>

            <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-4 pt-4">

                {/* Selected winners preview */}
                <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-4 shadow-lg shadow-purple-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">👑</span>
                        <h3 className="text-white font-bold text-sm">
                            {selectedWinners.length === 2 ? 'Geselecteerde Kampioenen' : `Selecteer ${2 - selectedWinners.length} ${selectedWinners.length === 1 ? 'persoon' : 'personen'}`}
                        </h3>
                    </div>
                    <div className="flex gap-3 justify-center">
                        {[0, 1].map(slot => {
                            const winnerId = selectedWinners[slot];
                            if (!winnerId) {
                                return (
                                    <div key={slot} className="flex flex-col items-center bg-white/10 rounded-xl p-3 flex-1">
                                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center mb-2">
                                            <span className="material-icons-round text-white/30">person_add</span>
                                        </div>
                                        <p className="text-white/50 text-xs font-medium">Kies persoon</p>
                                    </div>
                                );
                            }
                            return (
                                <div key={slot} className="flex flex-col items-center bg-white/10 rounded-xl p-3 flex-1 relative">
                                    <button
                                        onClick={() => toggleWinnerSelection(winnerId)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md"
                                    >
                                        <span className="material-icons-round text-xs">close</span>
                                    </button>
                                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-300 mb-2">
                                        {getUserAvatar(winnerId) ? (
                                            <img src={getUserAvatar(winnerId)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-purple-300 flex items-center justify-center text-purple-700 font-bold">{getUserName(winnerId).charAt(0)}</div>
                                        )}
                                    </div>
                                    <p className="text-white font-bold text-xs text-center">{getUserName(winnerId)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Zoek leiding..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 shadow-sm"
                    />
                </div>

                {/* User list */}
                <div className="space-y-2">
                    {filteredUsers.map((user: User) => {
                        const isSelected = selectedWinners.includes(user.id);
                        return (
                            <div
                                key={user.id}
                                onClick={() => toggleWinnerSelection(user.id)}
                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                    ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500 dark:border-purple-400 shadow-sm'
                                    : 'bg-white dark:bg-[#1e293b] border-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isSelected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-white dark:ring-offset-[#0f172a]' : ''}`}>
                                        {user.avatar ? (
                                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
                                                {(user.name || user.naam || '').charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                                            {user.name || user.naam}
                                        </p>
                                        {user.nickname && (
                                            <p className="text-[10px] text-gray-400">({user.nickname})</p>
                                        )}
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                    <span className="material-icons-round text-sm">{isSelected ? 'check' : 'add'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Sticky save button */}
            <div className="fixed bottom-nav-offset left-0 right-0 px-4 pb-4 bg-gradient-to-t from-gray-50 dark:from-[#0f172a] pt-6">
                <button
                    onClick={saveWinners}
                    disabled={selectedWinners.length !== 2 || isSaving}
                    className={`w-full font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${saved
                        ? 'bg-green-600 text-white shadow-green-500/20'
                        : isSaving
                            ? 'bg-purple-400 text-white cursor-wait'
                            : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white shadow-purple-500/20'
                        }`}
                >
                    <span className="material-icons-round">
                        {saved ? 'check_circle' : isSaving ? 'sync' : 'emoji_events'}
                    </span>
                    {saved 
                        ? 'Opgeslagen!' 
                        : isSaving 
                            ? 'Bezig met opslaan...' 
                            : selectedWinners.length === 2 
                                ? 'Kampioenen Opslaan' 
                                : `Selecteer nog ${2 - selectedWinners.length} personen`}
                </button>
            </div>
        </div>
    );
};
