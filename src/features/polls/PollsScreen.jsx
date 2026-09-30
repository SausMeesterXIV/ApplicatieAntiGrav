import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as db from '../../lib/supabaseService';
import { hasRecht, isHoofdleiding } from '../../lib/roleUtils';
import { showToast } from '../../components/Toast';
import { ChevronBack } from '../../components/ChevronBack';

const formatDeadline = d =>
  new Date(d).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Polls: open polls bovenaan, stemmen of stem aanpassen tot de deadline, resultaten voor iedereen
export const PollsScreen = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [polls, setPolls] = useState([]);
  const [laden, setLaden] = useState(true);

  const laad = async () => {
    setPolls(await db.fetchPolls());
    setLaden(false);
  };

  useEffect(() => {
    laad();
  }, []);

  const stem = async (poll, optieId) => {
    if (!poll.isOpen || !currentUser) return;
    const mijn = poll.stemmen.find(s => s.user_id === currentUser.id);
    const nieuw = mijn?.optie_id === optieId ? null : optieId; // nogmaals tikken = stem intrekken
    setPolls(prev =>
      prev.map(p =>
        p.id !== poll.id
          ? p
          : {
              ...p,
              stemmen: [
                ...p.stemmen.filter(s => s.user_id !== currentUser.id),
                ...(nieuw ? [{ user_id: currentUser.id, optie_id: nieuw }] : []),
              ],
            }
      )
    );
    try {
      await db.stemOpPoll(poll.id, currentUser.id, nieuw);
    } catch (e) {
      showToast('Stemmen mislukt: ' + (e.message || 'onbekende fout'), 'error');
      laad();
    }
  };

  const verwijder = async poll => {
    if (!window.confirm(`Poll "${poll.vraag}" verwijderen?`)) return;
    try {
      await db.deletePoll(poll.id);
      setPolls(prev => prev.filter(p => p.id !== poll.id));
    } catch (e) {
      showToast('Verwijderen mislukt', 'error');
    }
  };

  const gesorteerd = [...polls].sort((a, b) =>
    a.isOpen === b.isOpen
      ? a.isOpen
        ? new Date(a.deadline) - new Date(b.deadline)
        : new Date(b.deadline) - new Date(a.deadline)
      : a.isOpen
        ? -1
        : 1
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold flex-1">Polls</h1>
        {hasRecht(currentUser, 'polls_maken') && (
          <button
            onClick={() => navigate('/polls/nieuw')}
            className="text-sm font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1"
          >
            <span className="material-icons-round text-base">add</span> Nieuw
          </button>
        )}
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-4">
        {laden && <p className="text-center text-sm text-gray-500 py-8">Laden…</p>}
        {!laden && polls.length === 0 && <p className="text-center text-sm text-gray-500 py-8">Nog geen polls.</p>}

        {gesorteerd.map(poll => {
          const totaal = poll.stemmen.length;
          const mijnStem = poll.stemmen.find(s => s.user_id === currentUser?.id)?.optie_id;
          const magBeheren = poll.gemaakt_door === currentUser?.id || isHoofdleiding(currentUser);
          return (
            <article
              key={poll.id}
              className={`bg-white dark:bg-[#1e2330] rounded-2xl p-4 border ${
                poll.isOpen ? 'border-blue-200 dark:border-blue-900/50' : 'border-gray-100 dark:border-gray-800 opacity-80'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h2 className="font-bold text-lg leading-tight">{poll.vraag}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {poll.isOpen ? `Stemmen kan tot ${formatDeadline(poll.deadline)}` : `Afgesloten op ${formatDeadline(poll.deadline)}`}
                    {' · '}
                    {totaal} {totaal === 1 ? 'stem' : 'stemmen'}
                  </p>
                </div>
                {magBeheren && (
                  <button onClick={() => verwijder(poll)} className="text-gray-300 hover:text-red-500" title="Verwijderen">
                    <span className="material-icons-round">delete</span>
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {poll.opties.map(o => {
                  const aantal = poll.stemmen.filter(s => s.optie_id === o.id).length;
                  const pct = totaal ? Math.round((aantal / totaal) * 100) : 0;
                  const gekozen = mijnStem === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => stem(poll, o.id)}
                      disabled={!poll.isOpen}
                      className={`relative w-full text-left rounded-xl border overflow-hidden ${
                        gekozen ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 ${gekozen ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-2 px-3 py-2.5">
                        <span className="material-icons-round text-base text-blue-600">
                          {gekozen ? 'radio_button_checked' : 'radio_button_unchecked'}
                        </span>
                        <span className="flex-1 font-medium">{o.tekst}</span>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          {aantal} · {pct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {poll.isOpen && mijnStem && (
                <p className="text-xs text-gray-500 mt-2">Tik een andere optie om je stem aan te passen, of dezelfde om ze in te trekken.</p>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
};
