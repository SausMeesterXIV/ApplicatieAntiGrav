import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDrink } from '../contexts/DrinkContext';
import { useFries } from '../contexts/FriesContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { showToast } from '../components/Toast';
import { hasRole } from '../lib/roleUtils';

export const TeamDrankDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
    const { users, currentUser } = useAuth();
  const { streaks, activePeriod, handleRemoveCost : handleDeleteStreak } = useDrink();
  const { friesOrders } = useFries();
  
  const canAccess = hasRole(currentUser, 'drank');

  React.useEffect(() => {
    if (!canAccess) {
      showToast('Geen toegang tot Team Drank dashboard', 'error');
      navigate('/');
    }
  }, [canAccess, navigate]);

  if (!canAccess) return null;

  // States voor UI deellijsten
  const [activeView, setActiveView] = useState<'dashboard' | 'balances' | 'logbook'>(() => {
    return (sessionStorage.getItem('teamDrankActiveView') as 'dashboard' | 'balances' | 'logbook') || 'dashboard';
  });

  React.useEffect(() => {
    sessionStorage.setItem('teamDrankActiveView', activeView);
  }, [activeView]);

  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  // --- Berekeningen voor Drankrekening & Wekelijkse Totalen ---
  // In een echte applicatie filter je hier ook de `frituur_bestellingen` list op `activePeriod.id`
  const periodStreaks = useMemo(() => {
    return (streaks || []).filter(s => s.period_id === activePeriod?.id);
  }, [streaks, activePeriod]);

  // Voorlopige drankrekening: groepeer per leiding (Frieten + Strepen = Totaal)
  const drankrekeningen = useMemo(() => {
    const data: Record<string, { userId: string; userName: string; strepenKost: number; frietenKost: number }> = {};

    periodStreaks.forEach(s => {
      if (!data[s.userId]) {
        const u = (users || []).find(user => user.id === s.userId);
        data[s.userId] = { userId: s.userId, userName: u?.naam || 'Onbekend', strepenKost: 0, frietenKost: 0 };
      }
      data[s.userId].strepenKost += s.price * s.amount;
    });

    // Voeg Frituurkosten toe
    const periodFriesOrders = (friesOrders || []).filter(o => o.periodId === activePeriod?.id);
    periodFriesOrders.forEach(o => {
      if (!data[o.userId]) {
        const u = (users || []).find(user => user.id === o.userId);
        data[o.userId] = { userId: o.userId, userName: u?.naam || o.userName || 'Onbekend', strepenKost: 0, frietenKost: 0 };
      }
      data[o.userId].frietenKost += o.totalPrice;
    });

    return Object.values(data).sort((a, b) => (b.strepenKost + b.frietenKost) - (a.strepenKost + a.frietenKost));
  }, [periodStreaks, users, friesOrders, activePeriod]);

  const totaalOpenstaand = drankrekeningen.reduce((acc, curr) => acc + curr.strepenKost + curr.frietenKost, 0);

  // Wekelijkse groepering voor dropdowns (Start zaterdag 08:00)
  const weeklyStreaks = useMemo(() => {
    const weeks: Record<string, { streaks: typeof periodStreaks; summary: string }> = {};

    periodStreaks.forEach(s => {
      const date = new Date(s.timestamp);

      // Bereken de start van de 'KSA week' (vorige zaterdag 08:00)
      const ksaDate = new Date(date);
      // Als het voor zaterdag 08:00 is, hoort het bij de vorige 'week'
      const day = ksaDate.getDay(); // 0=Sun, 6=Sat
      const hour = ksaDate.getHours();

      let diff = day === 6 ? (hour < 8 ? 7 : 0) : (day + 1);

      const weekStart = new Date(ksaDate);
      weekStart.setDate(ksaDate.getDate() - diff);
      weekStart.setHours(8, 0, 0, 0);

      const weekLabel = `Zat ${weekStart.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' }).replace('.', '')}`;

      if (!weeks[weekLabel]) {
        weeks[weekLabel] = { streaks: [], summary: '' };
      }
      weeks[weekLabel].streaks.push(s);
    });

    // Genereer samenvattingen per week
    Object.keys(weeks).forEach(label => {
      const drinkTotals: Record<string, number> = {};
      weeks[label].streaks.forEach(s => {
        drinkTotals[s.drinkName] = (drinkTotals[s.drinkName] || 0) + s.amount;
      });
      weeks[label].summary = Object.entries(drinkTotals)
        .map(([name, count]) => `${count}x ${name}`)
        .join(', ');
    });

    return weeks;
  }, [periodStreaks]);

  const onMinKnop = async (streakId: string) => {
    if (window.confirm('Weet je zeker dat je deze consumptie wil corrigeren (-1 streepje)?')) {
      await handleDeleteStreak(streakId);
      showToast('Correctie toegepast!', 'success');
    }
  };

  const handleBack = () => {
    if (activeView !== 'dashboard') {
      setActiveView('dashboard');
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      <header className="px-4 py-6 sticky top-0 bg-gray-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md z-20 flex justify-between items-center border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={handleBack} />
          <div>
            <h1 className="text-xl font-black">
              {activeView === 'dashboard' ? 'Team Drank' : activeView === 'balances' ? "Openstaande Saldo's" : 'Logboek'}
            </h1>
            <p className="text-xs text-gray-500 font-medium">Periode: {activePeriod?.naam || 'Geen'}</p>
          </div>
        </div>


      </header>

      <main className="px-4 py-6 space-y-8 pb-nav-safe">

        {activeView === 'dashboard' && (
          <>
            {/* 1. Financiën Widget */}
            <section>
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10">
                  <span className="material-icons-round text-9xl">account_balance_wallet</span>
                </div>
                <p className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-1">Totaal Lopende Rekeningen</p>
                <h2 className="text-4xl font-black">€ {totaalOpenstaand.toFixed(2).replace('.', ',')}</h2>
                <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm font-semibold">
                  <span>Strepen: € {drankrekeningen.reduce((a, b) => a + b.strepenKost, 0).toFixed(2).replace('.', ',')}</span>
                  <span>Frituur: € {drankrekeningen.reduce((a, b) => a + b.frietenKost, 0).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </section>

            {/* Navigatie Knoppen */}
            <section className="grid gap-3">
              <div
                onClick={() => setActiveView('balances')}
                className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                    <span className="material-icons-round">account_balance</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">Openstaande Saldo's</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Bekijk schulden van leden</p>
                  </div>
                </div>
                <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>

              <div
                onClick={() => setActiveView('logbook')}
                className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                    <span className="material-icons-round text-indigo-700 dark:text-indigo-300">history</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">Logboek & Correcties</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recente consumpties bekijken en wissen</p>
                  </div>
                </div>
                <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
              </div>

              <div className="pt-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 px-1">Beheer & Instellingen</h4>
                <div className="grid gap-3">
                  <div onClick={() => navigate('/strepen/voorraad')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                        <span className="material-icons-round">inventory</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors">Voorraad & Prijzen</h3>
                        <p className="text-xs text-gray-500">Dranken toevoegen of aanpassen</p>
                      </div>
                    </div>
                    <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>

                  <div onClick={() => navigate('/strepen/facturatie')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <span className="material-icons-round">receipt_long</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">Factuurbeheer</h3>
                        <p className="text-xs text-gray-500">Facturen genereren voor leden</p>
                      </div>
                    </div>
                    <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>

                  <div onClick={() => navigate('/strepen/facturatie/beheer')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <span className="material-icons-round font-bold">grid_on</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Excel Beheer</h3>
                        <p className="text-xs text-gray-500">Gegevens rechtstreeks aanpassen</p>
                      </div>
                    </div>
                    <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>

                  <div onClick={() => navigate('/strepen/facturatie/archief')} className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <span className="material-icons-round">inventory_2</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Archief</h3>
                        <p className="text-xs text-gray-500">Oude periodes en facturen inkijken</p>
                      </div>
                    </div>
                    <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* 2. Lopende Drankrekeningen per Leiding */}
        {activeView === 'balances' && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm px-1">Lopende Saldo's (Nu)</h3>
                <p className="text-[10px] text-gray-400 px-1 mt-0.5">Huidige consumpties van {activePeriod?.naam}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
              <button
                onClick={() => navigate(`/strepen/facturatie/billing-excel?periodId=${activePeriod?.id}`)}
                className="shrink-0 flex items-center gap-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-green-100 border border-green-200 dark:border-green-800/50"
              >
                <span className="material-icons-round text-sm">download</span>
                Excel Downloaden
              </button>
              <button
                onClick={() => navigate('/strepen/facturatie')}
                className="shrink-0 flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-blue-100 border border-blue-200 dark:border-blue-800/50"
              >
                <span className="material-icons-round text-sm">receipt_long</span>
                Alle Facturen / Afsluiten
              </button>
              <button
                onClick={() => navigate('/strepen/facturatie/archief')}
                className="shrink-0 flex items-center gap-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-purple-100 border border-purple-200 dark:border-purple-800/50"
              >
                <span className="material-icons-round text-sm">history</span>
                Oude Saldo's
              </button>
            </div>
            <div className="bg-white dark:bg-[#1e2330] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800">
              {drankrekeningen.map(rek => (
                <div key={rek.userId} className="p-4 flex justify-between items-center group">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white block">{rek.userName}</span>
                    <span className="text-xs text-gray-400">Str: €{rek.strepenKost.toFixed(2)} | Fri: €{rek.frietenKost.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-lg text-red-500 dark:text-red-400">€ {(rek.strepenKost + rek.frietenKost).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              ))}
              {drankrekeningen.length === 0 && <div className="p-4 text-center text-sm text-gray-400 font-medium">Geen rekeningen lopend in deze periode.</div>}
            </div>
          </section>
        )}

        {activeView === 'logbook' && (
          <section>
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-sm px-1">Logboek (Correcties Maken)</h3>
              <button onClick={() => navigate('/strepen/geschiedenis-alle')} className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors">
                Alle Strepen Historiek
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(weeklyStreaks).map(([weekLabel, data]) => (
                <div key={weekLabel} className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setExpandedWeek(expandedWeek === weekLabel ? null : weekLabel)}
                    className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors gap-3"
                  >
                    <div className="shrink-0 flex items-center">
                      <span className="font-bold text-sm text-gray-900 dark:text-white whitespace-nowrap">{weekLabel}</span>
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md truncate block max-w-full">
                        {data.summary || 'Geen consumpties'}
                      </span>
                    </div>

                    <span className="material-icons-round text-gray-400 transition-transform duration-200 shrink-0" style={{ transform: expandedWeek === weekLabel ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                  </button>

                  {expandedWeek === weekLabel && (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {data.streaks.map(s => {
                        const userName = (users || []).find(u => u.id === s.userId)?.naam || 'Onbekend';
                        return (
                          <div key={s.id} className="p-3 pl-4 flex items-center justify-between text-sm group">
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white block">{userName}</span>
                              <span className="text-xs font-medium text-gray-500">{s.amount}x {s.drinkName} (€{s.price.toFixed(2).replace('.', ',')})</span>
                            </div>
                            {/* DE CRUCIALE CORRECTIE KNOP (MIN) */}
                            <button
                              onClick={() => onMinKnop(s.id)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 p-2 rounded-xl transition-colors flex items-center gap-1 active:scale-95"
                              title="Verwijder (corrigeer) dit kasticketje"
                            >
                              <span className="material-icons-round text-sm">remove_circle</span>
                              <span className="text-xs font-bold">Wis</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(weeklyStreaks).length === 0 && <p className="text-xs text-center text-gray-400 italic">Geen strepen of frietbestellingen in deze periode.</p>}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};