import React, { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';
import { useFries } from '../friet/FriesContext';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../../components/ChevronBack';
import { showToast } from '../../components/Toast';
import { hasRole } from '../../lib/roleUtils';
import { Groep, Rij } from '../../components/Lijst';
import { SPECIAL_DRINKS } from '../../lib/constants';
import { euro } from '../../lib/geld';
import { LeiderStrepenSheet } from './LeiderStrepenSheet';
import { drankSheet } from '../../lib/drankSheet';

// Team Drank (design-update): zelfde stijl als het startscherm, Strepen en Instellingen.
// Drie weergaven op één scherm: het overzicht, openstaande saldo's en het logboek met correcties.

const Kopje = ({ children }) => (
  <h2 className="px-2 text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{children}</h2>
);

const Pil = ({ icoon, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 flex items-center gap-1.5 rounded-full bg-kaart-event dark:bg-kaart-event-d px-4 py-2.5 text-sm font-bold active:scale-[0.98]"
  >
    <span className="material-icons-round text-base">{icoon}</span>
    {children}
  </button>
);

export const TeamDrankDashboardScreen = () => {
  const navigate = useNavigate();
  const { users, currentUser, loading } = useAuth();
  const { streaks, activePeriod, handleDeleteStreak } = useDrink();
  const { friesOrders } = useFries();

  const canAccess = hasRole(currentUser, 'drank');

  React.useEffect(() => {
    // Wacht met de redirect tot het laden voltooid is
    if (!loading && !canAccess) {
      showToast('Geen toegang tot Team Drank dashboard', 'error');
      navigate('/');
    }
  }, [canAccess, navigate, loading]);

  const [activeView, setActiveView] = useState(() => {
    return sessionStorage.getItem('teamDrankActiveView') || 'dashboard';
  });

  React.useEffect(() => {
    sessionStorage.setItem('teamDrankActiveView', activeView);
  }, [activeView]);

  // Google Sheet (enkel lezen): bij het openen van het dashboard meteen bijwerken, zodat ze vers is
  const [sheetUrl, setSheetUrl] = useState(null);
  React.useEffect(() => {
    if (!canAccess) return;
    drankSheet('url')
      .then(d => {
        setSheetUrl(d?.url || null);
        if (d?.url) drankSheet('sync').catch(() => {});
      })
      .catch(() => {});
  }, [canAccess]);
  const openSheet = () => {
    window.open(sheetUrl, '_blank', 'noopener');
    drankSheet('sync').catch(e => showToast(e.message, 'error'));
  };

  const [expandedWeek, setExpandedWeek] = useState(null);
  const [zoek, setZoek] = useState('');
  const [gekozenLeiderId, setGekozenLeiderId] = useState(null);
  const gekozenLeider = (users || []).find(u => u.id === gekozenLeiderId) || null;

  const periodStreaks = useMemo(() => {
    return (streaks || []).filter(s => s.period_id === activePeriod?.id);
  }, [streaks, activePeriod]);

  const drankrekeningen = useMemo(() => {
    const data = {};

    periodStreaks.forEach(s => {
      if (!data[s.userId]) {
        const u = (users || []).find(user => user.id === s.userId);
        data[s.userId] = { userId: s.userId, userName: u?.naam || 'Onbekend', strepenKost: 0, frietenKost: 0 };
      }
      data[s.userId].strepenKost += s.price * s.amount;
    });

    const periodFriesOrders = (friesOrders || []).filter(o => o.periodId === activePeriod?.id);
    periodFriesOrders.forEach(o => {
      if (!data[o.userId]) {
        const u = (users || []).find(user => user.id === o.userId);
        data[o.userId] = {
          userId: o.userId,
          userName: u?.naam || o.userName || 'Onbekend',
          strepenKost: 0,
          frietenKost: 0,
        };
      }
      data[o.userId].frietenKost += o.totalPrice;
    });

    return Object.values(data).sort((a, b) => b.strepenKost + b.frietenKost - (a.strepenKost + a.frietenKost));
  }, [periodStreaks, users, friesOrders, activePeriod]);

  const totaalStrepen = drankrekeningen.reduce((a, b) => a + b.strepenKost, 0);
  const totaalFriet = drankrekeningen.reduce((a, b) => a + b.frietenKost, 0);
  const totaalOpenstaand = totaalStrepen + totaalFriet;

  const weeklyStreaks = useMemo(() => {
    const weeks = {};

    periodStreaks.forEach(s => {
      const date = new Date(s.timestamp);
      const ksaDate = new Date(date);
      const day = ksaDate.getDay();
      const hour = ksaDate.getHours();

      let diff = day === 6 ? (hour < 8 ? 7 : 0) : day + 1;

      const weekStart = new Date(ksaDate);
      weekStart.setDate(ksaDate.getDate() - diff);
      weekStart.setHours(8, 0, 0, 0);

      const weekLabel = `Zat ${weekStart.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' }).replace('.', '')}`;

      if (!weeks[weekLabel]) {
        weeks[weekLabel] = { streaks: [], summary: '' };
      }
      weeks[weekLabel].streaks.push(s);
    });

    Object.keys(weeks).forEach(label => {
      const drinkTotals = {};
      weeks[label].streaks.forEach(s => {
        drinkTotals[s.drinkLabel || s.drinkName] = (drinkTotals[s.drinkLabel || s.drinkName] || 0) + s.amount;
      });
      weeks[label].summary = Object.entries(drinkTotals)
        .map(([name, count]) => `${count} ${name}`)
        .join(', ');
    });

    return weeks;
  }, [periodStreaks]);

  const topTenBeer = useMemo(() => {
    const scores = {};
    periodStreaks.forEach(s => {
      if (s.drinkName === SPECIAL_DRINKS.PINT_FREEDOM) {
        scores[s.userId] = (scores[s.userId] || 0) + s.amount;
      }
    });

    return Object.entries(scores)
      .map(([userId, count]) => ({
        userId,
        userName: users.find(u => u.id === userId)?.naam || 'Onbekend',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [periodStreaks, users]);

  // Alle actieve leiding (ook wie nog niets streepte), met hun strepen in de open periode
  const leiding = useMemo(() => {
    const perLeider = {};
    periodStreaks.forEach(s => {
      const p = (perLeider[s.userId] ||= { aantal: 0, bedrag: 0 });
      p.aantal += s.amount;
      p.bedrag += s.price * s.amount;
    });
    const q = zoek.trim().toLowerCase();
    return (users || [])
      .filter(u => u.actief)
      .filter(u => !q || `${u.naam || ''} ${u.nickname || ''}`.toLowerCase().includes(q))
      .map(u => ({ ...u, ...(perLeider[u.id] || { aantal: 0, bedrag: 0 }) }))
      .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  }, [users, periodStreaks, zoek]);

  // handleDeleteStreak toont zelf een melding
  const onMinKnop = streakId => {
    if (window.confirm('Weet je zeker dat je deze streep wil verwijderen?')) handleDeleteStreak(streakId);
  };

  const handleBack = () => {
    if (activeView !== 'dashboard') {
      setActiveView('dashboard');
    } else {
      navigate(-1);
    }
  };

  // Niets tonen zolang we laden of zonder toegang. Pas NA alle hooks: een vroege return ervoor
  // verandert het aantal hooks tussen renders en laat React crashen.
  if (loading || !canAccess) return null;

  const titel =
    {
      dashboard: 'Team Drank',
      leiding: 'Strepen per leider',
      balances: "Openstaande saldo's",
      logbook: 'Logboek',
    }[activeView] || 'Team Drank';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={handleBack} />
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight truncate">{titel}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            Periode: {activePeriod?.naam || 'geen open periode'}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2 space-y-6">
        {activeView === 'dashboard' && (
          <>
            {/* Lopende rekeningen */}
            <article className="rounded-[28px] bg-kaart-strepen dark:bg-kaart-strepen-d p-6">
              <p className="text-base text-slate-600 dark:text-slate-300">Lopende rekeningen</p>
              <p className="text-5xl font-extrabold leading-tight tabular-nums">{euro(totaalOpenstaand)}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white dark:bg-white/10 px-4 py-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Strepen</p>
                  <p className="text-lg font-extrabold tabular-nums">{euro(totaalStrepen)}</p>
                </div>
                <div className="rounded-2xl bg-white dark:bg-white/10 px-4 py-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Friet</p>
                  <p className="text-lg font-extrabold tabular-nums">{euro(totaalFriet)}</p>
                </div>
              </div>
            </article>

            <Groep titel="Deze periode">
              <Rij
                icoon="edit_note"
                label="Strepen per leider"
                sub="Bijzetten of verwijderen"
                onClick={() => setActiveView('leiding')}
              />
              <Rij
                icoon="group_add"
                label="Extra kosten"
                sub="Bv. cara's: totaal verdelen of per persoon"
                onClick={() => navigate('/extra-kosten')}
              />
              <Rij
                icoon="account_balance"
                label="Openstaande saldo's"
                waarde={`${drankrekeningen.length} leiding`}
                onClick={() => setActiveView('balances')}
              />
              <Rij
                icoon="history"
                label="Logboek en correcties"
                waarde={`${periodStreaks.length} strepen`}
                onClick={() => setActiveView('logbook')}
              />
            </Groep>

            <Groep titel="Beheer">
              <Rij
                icoon="inventory"
                label="Voorraad en prijzen"
                sub="Dranken toevoegen of aanpassen"
                onClick={() => navigate('/strepen/voorraad')}
              />
              <Rij
                icoon="receipt_long"
                label="Facturen"
                sub="Periode afsluiten en facturen maken"
                onClick={() => navigate('/strepen/facturatie')}
              />
              <Rij
                icoon="request_quote"
                label="Aankoopfacturen"
                sub="Brouwer, drankcentrale: bedrag, mededeling en foto"
                onClick={() => navigate('/aankoopfacturen')}
              />
              {sheetUrl && (
                <Rij icoon="table_chart" label="Google Sheet" sub="Drankrekening, bakken en facturen" onClick={openSheet} />
              )}
              <Rij
                icoon="inventory_2"
                label="Archief"
                sub="Oude periodes en facturen"
                onClick={() => navigate('/strepen/facturatie/archief')}
              />
              <Rij
                icoon="elderly"
                label="Oudleiding"
                sub="Code om te registreren, accounts"
                onClick={() => navigate('/strepen/oudleiding')}
              />
            </Groep>

            {/* Top 10 pinten */}
            <section className="space-y-2">
              <Kopje>Top 10 pinten</Kopje>
              <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden">
                {topTenBeer.length > 0 ? (
                  <ol className="divide-y divide-white dark:divide-white/5">
                    {topTenBeer.map((item, index) => (
                      <li key={item.userId} className="px-5 py-3.5 flex items-center gap-3">
                        <span
                          className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold tabular-nums ${
                            index === 0 ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-white dark:bg-white/10'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="flex-1 min-w-0 font-semibold truncate">{item.userName}</span>
                        <span className="text-lg font-extrabold tabular-nums">{item.count}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nog geen pinten gestreept deze periode.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {/* Strepen per leider: iemand kiezen om strepen bij te zetten of te verwijderen */}
        {activeView === 'leiding' && (
          <>
            <label className="flex items-center gap-2 rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-4">
              <span className="material-icons-round text-xl text-gray-500 dark:text-gray-400">search</span>
              <input
                type="search"
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                placeholder="Zoek leiding"
                aria-label="Zoek leiding"
                className="flex-1 min-w-0 bg-transparent border-0 py-3.5 text-base focus:outline-none focus:ring-0"
              />
            </label>

            <section className="space-y-2">
              <Kopje>{zoek.trim() ? `${leiding.length} gevonden` : 'Alle leiding'}</Kopje>
              <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
                {leiding.map(u => (
                  <Rij
                    key={u.id}
                    label={u.naam}
                    sub={u.aantal ? `${u.aantal} ${u.aantal === 1 ? 'streep' : 'strepen'}` : 'Nog niets gestreept'}
                    waarde={u.aantal ? euro(u.bedrag) : undefined}
                    onClick={() => setGekozenLeiderId(u.id)}
                  />
                ))}
                {leiding.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Niemand gevonden.</p>
                )}
              </div>
            </section>
          </>
        )}

        {/* Openstaande saldo's per leider */}
        {activeView === 'balances' && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              <Pil
                icoon="download"
                onClick={() => navigate(`/strepen/facturatie/billing-excel?periodId=${activePeriod?.id}`)}
              >
                Excel
              </Pil>
              <Pil icoon="receipt_long" onClick={() => navigate('/strepen/facturatie')}>
                Facturen en afsluiten
              </Pil>
              <Pil icoon="history" onClick={() => navigate('/strepen/facturatie/archief')}>
                Oude saldo's
              </Pil>
            </div>

            <section className="space-y-2">
              <Kopje>Per leider</Kopje>
              <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
                {drankrekeningen.map(rek => (
                  <div key={rek.userId} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{rek.userName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        Strepen {euro(rek.strepenKost)} · Friet {euro(rek.frietenKost)}
                      </p>
                    </div>
                    <p className="text-lg font-extrabold tabular-nums shrink-0">
                      {euro(rek.strepenKost + rek.frietenKost)}
                    </p>
                  </div>
                ))}
                {drankrekeningen.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nog geen rekeningen in deze periode.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {/* Logboek */}
        {activeView === 'logbook' && (
          <>
            <div className="flex gap-2">
              <Pil icoon="list" onClick={() => navigate('/strepen/geschiedenis-alle')}>
                Alle strepen
              </Pil>
            </div>

            <section className="space-y-2">
              <Kopje>Per week</Kopje>
              <div className="space-y-2">
                {Object.entries(weeklyStreaks).map(([weekLabel, data]) => {
                  const open = expandedWeek === weekLabel;
                  return (
                    <div key={weekLabel} className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedWeek(open ? null : weekLabel)}
                        aria-expanded={open}
                        className="w-full px-5 py-4 flex items-center gap-3 text-left active:bg-black/5 dark:active:bg-white/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{weekLabel}</span>
                          <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                            {data.summary || 'Geen consumpties'}
                          </span>
                        </span>
                        <span
                          className={`material-icons-round text-xl text-gray-500 dark:text-gray-400 transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        >
                          expand_more
                        </span>
                      </button>

                      {open && (
                        <ul className="divide-y divide-white dark:divide-white/5 border-t border-white dark:border-white/5">
                          {data.streaks.map(s => {
                            const userName = (users || []).find(u => u.id === s.userId)?.naam || 'Onbekend';
                            return (
                              <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{userName}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                                    {s.bron === 'sheet' && s.amount > 0 ? '+' : ''}
                                    {s.amount} {s.drinkLabel || s.drinkName} · {euro(s.price)}
                                    {/* Aangepast in de Google Sheet: enkel hier zichtbaar, geen melding voor de leider */}
                                    {s.bron === 'sheet' && (
                                      <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-white dark:bg-white/10 px-2 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                                        via Sheet
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onMinKnop(s.id)}
                                  className="shrink-0 rounded-full bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 px-3.5 py-2 text-sm font-bold active:scale-95"
                                  aria-label={`Streep van ${userName} verwijderen`}
                                >
                                  Verwijder
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {Object.keys(weeklyStreaks).length === 0 && (
                  <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nog geen strepen in deze periode.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <LeiderStrepenSheet leider={gekozenLeider} onClose={() => setGekozenLeiderId(null)} />
    </div>
  );
};
