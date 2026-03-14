import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { AppContextType } from '../App';
import { Streak } from '../types';
import { useDrink } from '../contexts/DrinkContext';

interface Props {
    adminMode?: boolean;
}

export const StrepenHistoryScreen: React.FC<Props> = ({ adminMode = false }) => {
    const navigate = useNavigate();
    const { users, currentUser } = useOutletContext<AppContextType>();
    const { streaks, handleRemoveCost } = useDrink(); // Haal ALTIJD de meest up-to-date streaks uit DrinkContext

    const isTeamDrank = currentUser?.rol === 'hoofdleiding' || 
                        currentUser?.rol === 'godmode' || 
                        currentUser?.roles?.some((r: any) => String(r).toLowerCase().includes('drank'));

    interface BundledStreak {
        ids: string[];
        userId: string;
        drinkId: string | number;
        drinkName: string;
        totalPrice: number;
        totalAmount: number;
        timestamp: Date;
    }

    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Filter and sort streaks
    const displayStreaks = useMemo(() => {
        let filtered = [...(streaks || [])];
        if (!adminMode && currentUser) {
            filtered = filtered.filter(s => s.userId === currentUser.id);
        }

        // Sort by timestamp descending with safeguards
        return filtered.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            const validA = isNaN(timeA) ? 0 : timeA;
            const validB = isNaN(timeB) ? 0 : timeB;
            return validB - validA;
        });
    }, [streaks, adminMode, currentUser]);

    const getUserName = (userId: string) => {
        if (!currentUser) return 'Onbekend';
        // Gebruik uitsluitend de echte naam (naam/name) voor de geschiedenislogs
        if (userId === currentUser.id) return currentUser.naam || currentUser.name || 'Jij';
        const u = (users || []).find(u => u.id === userId);
        return u ? (u.naam || u.name) : 'Onbekend lid';
    };

    const getUserAvatar = (userId: string) => {
        if (!currentUser) return undefined;
        if (userId === currentUser.id) return currentUser.avatar;
        const u = (users || []).find(u => u.id === userId);
        return u?.avatar;
    };

    const handleRemove = async (ids: string[], e: React.MouseEvent) => {
        e.stopPropagation();
        const count = ids.length;
        if (window.confirm(`Ben je zeker dat je deze ${count === 1 ? 'streep' : count + ' strepen'} wil verwijderen?`)) {
            setDeletingId(ids[0]);
            for (const id of ids) {
                // Pass isTeamDrank in plaats van adminMode, zodat ze altijd rechten hebben
                await handleRemoveCost(id, isTeamDrank); 
            }
            setDeletingId(null);
        }
    };

    const formatDate = (date: Date) => {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'Onbekende datum';

            const today = new Date();
            const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

            if (isToday) {
                return `Vandaag om ${d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`;
            }
            return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return 'Foutieve datum';
        }
    };

    // Group by date for better UI
    const groupedStreaks = useMemo(() => {
        const groups: { [key: string]: BundledStreak[] } = {};
        displayStreaks.forEach(streak => {
            try {
                const d = new Date(streak.timestamp);
                let dateStr = 'Onbekende Datum';
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                }

                if (!groups[dateStr]) groups[dateStr] = [];

                const existingBundle = groups[dateStr].find(b => b.userId === streak.userId && b.drinkId === streak.drinkId);

                if (existingBundle) {
                    existingBundle.ids.push(streak.id);
                    existingBundle.totalPrice += streak.price;
                    existingBundle.totalAmount += (streak.amount || 1);
                    if (new Date(streak.timestamp) > new Date(existingBundle.timestamp)) {
                        existingBundle.timestamp = streak.timestamp;
                    }
                } else {
                    groups[dateStr].push({
                        ids: [streak.id],
                        userId: streak.userId,
                        drinkId: streak.drinkId,
                        drinkName: streak.drinkName,
                        totalPrice: streak.price,
                        totalAmount: streak.amount || 1,
                        timestamp: streak.timestamp
                    });
                }
            } catch (e) {
                const fallback = 'Foutieve Datum';
                if (!groups[fallback]) groups[fallback] = [];
                groups[fallback].push({
                    ids: [streak.id],
                    userId: streak.userId,
                    drinkId: streak.drinkId,
                    drinkName: streak.drinkName,
                    totalPrice: streak.price,
                    totalAmount: streak.amount || 1,
                    timestamp: streak.timestamp
                });
            }
        });

        // Sort bundles internally by timestamp descending
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });

        return groups;
    }, [displayStreaks]);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center justify-between transition-colors">
                <div className="flex items-center gap-2">
                    <ChevronBack onClick={() => navigate(-1)} />
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                            {adminMode ? 'Alle Gezette Strepen' : 'Mijn Geschiedenis'}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {displayStreaks.length} {displayStreaks.length === 1 ? 'streep' : 'strepen'} gezet
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6 pb-nav-safe space-y-6">
                {displayStreaks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <span className="material-icons-round text-5xl mb-4 opacity-20">history</span>
                        <p className="text-center font-medium opacity-60">Nog geen strepen gevonden.</p>
                    </div>
                ) : (
                    Object.entries(groupedStreaks).map(([dateLabel, groupStreaks]) => (
                        <div key={dateLabel}>
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 pl-1">
                                {dateLabel}
                            </h3>
                            <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-50 dark:divide-gray-800/50">
                                {groupStreaks.map(bundle => (
                                    <div key={bundle.ids[0]} className="p-3 sm:p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {adminMode ? (
                                                <img
                                                    src={getUserAvatar(bundle.userId) || `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserName(bundle.userId))}&background=random`}
                                                    alt=""
                                                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-100 dark:border-gray-700"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center shrink-0">
                                                    <span className="material-icons-round">local_bar</span>
                                                </div>
                                            )}
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-baseline justify-between w-full">
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {bundle.totalAmount > 1 ? `${bundle.totalAmount}x ` : ''}{bundle.drinkName}
                                                    </h4>
                                                    <span className="text-xs font-bold text-gray-900 dark:text-white ml-2 shrink-0">
                                                        €{bundle.totalPrice.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {adminMode && (
                                                        <>
                                                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                                                                {getUserName(bundle.userId)}
                                                            </span>
                                                            <span>•</span>
                                                        </>
                                                    )}
                                                    <span>{formatDate(bundle.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Delete button: Uitsluitend voor Team Drank & Admins */}
                                        {isTeamDrank && (
                                            <button
                                                onClick={(e) => handleRemove(bundle.ids, e)}
                                                disabled={deletingId === bundle.ids[0]}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0 ml-2"
                                            >
                                                {deletingId === bundle.ids[0] ? (
                                                    <span className="material-icons-round animate-spin">refresh</span>
                                                ) : (
                                                    <span className="material-icons-round">delete_outline</span>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};
