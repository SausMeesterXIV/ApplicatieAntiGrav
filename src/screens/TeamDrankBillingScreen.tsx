import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BillingPeriod, BillingCorrection } from '../types';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const TeamDrankBillingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users: appUsers, streaks, activePeriod, billingPeriods, drinks } = useOutletContext<AppContextType>();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [corrections, setCorrections] = useState<BillingCorrection[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [paidUsers, setPaidUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('open');

  // Correction modal
  const [correctionModal, setCorrectionModal] = useState<{ userId: string; userName: string } | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  // Choose the open period by default
  useEffect(() => {
    if (activePeriod && !selectedPeriodId) {
      setSelectedPeriodId(activePeriod.id);
    } else if (billingPeriods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(billingPeriods[0].id);
    }
  }, [activePeriod, billingPeriods]);

  // Load corrections when period changes
  useEffect(() => {
    if (!selectedPeriodId) return;
    setLoadingCorrections(true);
    db.fetchBillingCorrections(selectedPeriodId)
      .then(setCorrections)
      .catch(err => console.error(err))
      .finally(() => setLoadingCorrections(false));
  }, [selectedPeriodId]);

  // Load paid users from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`teamDrankPaidUsers_${selectedPeriodId}`);
    setPaidUsers(saved ? JSON.parse(saved) : []);
  }, [selectedPeriodId]);

  const selectedPeriod = useMemo(() => {
    return billingPeriods.find(p => p.id === selectedPeriodId) || activePeriod;
  }, [billingPeriods, selectedPeriodId, activePeriod]);

  // ========== DYNAMIC PRICING ==========
  const billingData = useMemo(() => {
    if (!selectedPeriod) return [];

    // Filter streaks for this period
    const periodStreaks = streaks.filter(s => s.period_id === selectedPeriod.id);
    const totalStrepen = periodStreaks.reduce((sum, s) => sum + s.amount, 0);
    const prijsPerStreep = totalStrepen > 0 ? selectedPeriod.geschatte_kost / totalStrepen : 0;

    return (appUsers || []).map(user => {
      const userStreaks = periodStreaks.filter(s => s.userId === user.id);
      const userStrepen = userStreaks.reduce((sum, s) => sum + s.amount, 0);
      const userCorrections = corrections.filter(c => c.user_id === user.id);
      const totalCorrection = userCorrections.reduce((sum, c) => sum + c.correctie_bedrag, 0);

      const berekendBedrag = Number((userStrepen * prijsPerStreep).toFixed(2));
      const totaalSchuld = Number((berekendBedrag + totalCorrection).toFixed(2));

      const isPaidOverride = paidUsers.includes(user.id);
      const isPaid = totaalSchuld <= 0 || isPaidOverride;

      return {
        ...user,
        userStrepen,
        berekendBedrag,
        totalCorrection,
        totaalSchuld,
        isPaid,
        effectiveDebt: isPaid ? 0 : totaalSchuld,
      };
    });
  }, [appUsers, streaks, selectedPeriod, corrections, paidUsers]);

  const totalOutstanding = billingData.reduce((acc, u) => acc + u.effectiveDebt, 0);
  const prijsPerStreep = useMemo(() => {
    if (!selectedPeriod) return 0;
    const totalStrepen = streaks.filter(s => s.period_id === selectedPeriod.id).reduce((sum, s) => sum + s.amount, 0);
    return totalStrepen > 0 ? selectedPeriod.geschatte_kost / totalStrepen : 0;
  }, [streaks, selectedPeriod]);

  const togglePayment = (id: string, currentPaidStatus: boolean) => {
    let newPaidUsers;
    if (currentPaidStatus) {
      newPaidUsers = paidUsers.filter(uid => uid !== id);
    } else {
      newPaidUsers = [...paidUsers, id];
    }
    setPaidUsers(newPaidUsers);
    localStorage.setItem(`teamDrankPaidUsers_${selectedPeriodId}`, JSON.stringify(newPaidUsers));
  };

  const filteredUsers = billingData.filter(user => {
    if (filter === 'all') return true;
    if (filter === 'open') return !user.isPaid;
    if (filter === 'paid') return user.isPaid;
    return true;
  });

  const handleAddCorrection = async () => {
    if (!correctionModal || !selectedPeriodId) return;
    const bedrag = parseFloat(correctionAmount.replace(',', '.'));
    if (isNaN(bedrag)) {
      showToast('Ongeldig bedrag', 'warning');
      return;
    }

    try {
      const newCorrection = await db.addBillingCorrection(
        correctionModal.userId,
        selectedPeriodId,
        bedrag,
        correctionNote || undefined
      );
      setCorrections(prev => [newCorrection, ...prev]);
      showToast(`Correctie van €${bedrag.toFixed(2)} toegevoegd`, 'success');
      setCorrectionModal(null);
      setCorrectionAmount('');
      setCorrectionNote('');
    } catch (err) {
      showToast('Fout bij toevoegen correctie', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <span className="material-icons-round text-2xl">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Drankrekeningen</h1>
              <button
                onClick={() => navigate(`/strepen/facturatie/billing-excel?periodId=${selectedPeriodId}`)}
                className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-blue-500/20 flex items-center gap-1"
              >
                <span className="material-icons-round text-sm">download</span>
                EXCEL
              </button>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-4">
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm appearance-none"
          >
            {billingPeriods.map(p => (
              <option key={p.id} value={p.id}>
                {p.naam} {p.is_closed ? '(Afgesloten)' : '(Open)'}
              </option>
            ))}
          </select>
        </div>

        {/* Period Info Banner */}
        {selectedPeriod && (
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Factuurkosten</span>
              <span className="font-bold text-gray-900 dark:text-white">€ {selectedPeriod.geschatte_kost.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-500 dark:text-gray-400">Prijs per streep</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {prijsPerStreep > 0 ? `€ ${prijsPerStreep.toFixed(2).replace('.', ',')}` : 'N.v.t.'}
              </span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'all' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Alle ({billingData.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'open' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Openstaand ({billingData.filter(u => !u.isPaid).length})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === 'paid' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] text-gray-500 border-gray-200 dark:border-gray-700'}`}
          >
            Betaald ({billingData.filter(u => u.isPaid).length})
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 overflow-y-auto pt-2">
        {/* Ledger List */}
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all shadow-sm group ${user.isPaid
                ? 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800 opacity-75'
                : 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden shadow-inner">
                    <img src={user?.avatar} alt={user?.naam || user?.name || 'Gebruiker'} className="w-full h-full object-cover" />
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1e293b] ${user.isPaid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{user?.naam || user?.name || 'Onbekend'}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.userStrepen} strepen
                    {user.totalCorrection !== 0 && (
                      <span className={`ml-1 ${user.totalCorrection > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                        {user.totalCorrection > 0 ? '+' : ''}€{user.totalCorrection.toFixed(2).replace('.', ',')} correctie
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className={`font-bold text-base ${user.isPaid ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {user.isPaid ? 'Betaald' : `€ ${user.totaalSchuld.toFixed(2).replace('.', ',')}`}
                  </div>
                  {!user.isPaid && user.berekendBedrag > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {user.userStrepen} × €{prijsPerStreep.toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>

                {/* Correction button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCorrectionModal({ userId: user.id, userName: user.naam || user.name || 'Onbekend' });
                    setCorrectionAmount('');
                    setCorrectionNote('');
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Correctie toevoegen"
                >
                  <span className="material-icons-round text-gray-400 text-sm">edit</span>
                </button>

                {/* Payment toggle */}
                <div
                  onClick={() => togglePayment(user.id, user.isPaid)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${user.isPaid ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400'}`}
                >
                  {user.isPaid && <span className="material-icons-round text-white text-sm">check</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Action Card */}
      <div className="fixed left-0 right-0 px-6 z-20 flex justify-center pointer-events-none" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="bg-blue-600 rounded-full px-6 py-3 shadow-xl shadow-blue-900/20 text-white flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-medium text-blue-100">Openstaand saldo:</span>
          <span className="text-base font-bold">€ {totalOutstanding.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      {/* Correction Modal */}
      {correctionModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Correctie toevoegen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">voor {correctionModal.userName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bedrag (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-500 text-sm">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={correctionAmount}
                    onChange={(e) => setCorrectionAmount(e.target.value)}
                    placeholder="bijv. 5.00 of -3.50"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-7 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Positief = extra schuld, negatief = aftrek/korting</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notitie (optioneel)</label>
                <input
                  type="text"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="bijv. Frituurkosten, Kapot glas, ..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCorrectionModal(null)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleAddCorrection}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};