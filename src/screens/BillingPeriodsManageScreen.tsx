import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AppContextType } from '../App';
import { BillingPeriod } from '../types';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { Modal, BottomSheet } from '../components/Modal';
import { SkeletonRow } from '../components/Skeleton';

export const BillingPeriodsManageScreen: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser, billingPeriods, setBillingPeriods, setActivePeriod } = useOutletContext<AppContextType>();
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [startDate, setStartDate] = useState('');

    // States for editing
    const [editingPeriod, setEditingPeriod] = useState<BillingPeriod | null>(null);
    const [editName, setEditName] = useState('');

    const loadPeriods = async () => {
        try {
            const [periods, openPeriod] = await Promise.all([
                db.fetchBillingPeriods(),
                db.fetchOpenBillingPeriod(),
            ]);
            setBillingPeriods(periods);
            setActivePeriod(openPeriod);
        } catch (error) {
            console.error(error);
            showToast('Fout bij laden periodes', 'error');
        }
    };

    const handleUpdateName = async () => {
        if (!editingPeriod || !editName) return;

        try {
            await db.updateBillingPeriod(editingPeriod.id, { naam: editName });
            showToast('Naam aangepast', 'success');
            setEditingPeriod(null);
            loadPeriods();
        } catch (error) {
            showToast('Fout bij aanpassen', 'error');
        }
    };

    const handleCreatePeriod = async () => {
        if (!newName || !startDate) {
            showToast('Vul een naam en startdatum in', 'warning');
            return;
        }

        try {
            await db.createBillingPeriod({
                naam: newName,
                start_datum: startDate ? new Date(startDate).toISOString() : undefined,
            });
            showToast('Periode aangemaakt', 'success');
            setShowAddModal(false);
            setNewName('');
            setStartDate('');
            loadPeriods();
        } catch (error) {
            showToast('Fout bij aanmaken', 'error');
        }
    };

    const closePeriod = async (period: BillingPeriod) => {
        if (!window.confirm(`Weet je zeker dat je "${period.naam}" wilt afsluiten?`)) return;

        try {
            await db.updateBillingPeriod(period.id, { is_closed: true, eind_datum: new Date().toISOString() });
            showToast('Periode afgesloten', 'success');
            loadPeriods();
        } catch (error) {
            showToast('Fout bij afsluiten', 'error');
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white pb-24">
            {/* Header */}
            <header className="px-4 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold flex-1">Periodebeheer</h1>
                    {(currentUser.rol === 'hoofdleiding' || currentUser.rol === 'team_drank' || currentUser.rol === 'godmode') && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-500/20"
                        >
                            <span className="material-icons-round">add</span>
                        </button>
                    )}
                </div>
            </header>

            <main className="p-4 space-y-4">
                {loading ? (
                    <>
                        {[...Array(5)].map((_, i) => (
                            <SkeletonRow key={i} />
                        ))}
                    </>
                ) : billingPeriods.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        Geen periodes gevonden. Maak er een aan om te beginnen.
                    </div>
                ) : (
                    billingPeriods.map(period => (
                        <div key={period.id} className={`p-4 rounded-2xl border transition-all ${!period.is_closed ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg">{period.naam}</h3>
                                        {!period.is_closed && (
                                            <button
                                                onClick={() => {
                                                    setEditingPeriod(period);
                                                    setEditName(period.naam);
                                                }}
                                                className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">edit</span>
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(period.start_datum).toLocaleDateString('nl-BE')}
                                        {period.eind_datum ? ` — ${new Date(period.eind_datum).toLocaleDateString('nl-BE')}` : ' — heden'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {period.geschatte_kost > 0 && (
                                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            € {period.geschatte_kost.toFixed(2).replace('.', ',')}
                                        </span>
                                    )}
                                    {!period.is_closed ? (
                                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Open</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Gesloten</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                {!period.is_closed && (
                                    <button
                                        onClick={() => closePeriod(period)}
                                        className="bg-red-50 text-red-600 dark:bg-red-900/20 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30"
                                    >
                                        Afsluiten
                                    </button>
                                )}
                                <button
                                    onClick={() => navigate(`/strepen/facturatie/billing-excel?periodId=${period.id}`)}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-sm">download</span>
                                    Excel Export
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </main>

            {/* Add Modal */}
            <BottomSheet 
                isOpen={showAddModal} 
                onClose={() => setShowAddModal(false)} 
                title="Nieuwe Periode"
            >
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Naam</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="v.b. Maart - April 2024"
                                className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Startdatum (verplicht)</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                        >
                            Annuleren
                        </button>
                        <button
                            onClick={handleCreatePeriod}
                            className="flex-[2] bg-blue-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                        >
                            Opslaan
                        </button>
                    </div>
                </div>
            </BottomSheet>

            {/* Edit Modal */}
            <Modal 
                isOpen={!!editingPeriod} 
                onClose={() => setEditingPeriod(null)} 
                title="Naam Aanpassen"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nieuwe Naam</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setEditingPeriod(null)}
                            className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
                        >
                            Annuleren
                        </button>
                        <button
                            onClick={handleUpdateName}
                            className="flex-[2] bg-blue-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                        >
                            Aanpassen
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
