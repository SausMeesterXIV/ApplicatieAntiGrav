import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { ChevronBack } from '../../components/ChevronBack';

// Standaard deadline: over 3 dagen om 20:00 (lokale tijd, formaat voor datetime-local)
const standaardDeadline = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(20, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const NewPollScreen = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [vraag, setVraag] = useState('');
  const [opties, setOpties] = useState(['', '']);
  const [deadline, setDeadline] = useState(standaardDeadline);
  const [bezig, setBezig] = useState(false);

  const zetOptie = (i, waarde) => setOpties(prev => prev.map((o, j) => (j === i ? waarde : o)));

  const opslaan = async () => {
    const geldige = opties.map(o => o.trim()).filter(Boolean);
    if (!vraag.trim()) return showToast('Vul een vraag in', 'warning');
    if (geldige.length < 2) return showToast('Geef minstens twee opties', 'warning');
    if (new Set(geldige.map(o => o.toLowerCase())).size !== geldige.length) return showToast('Opties moeten verschillend zijn', 'warning');
    if (new Date(deadline) <= new Date()) return showToast('De deadline moet in de toekomst liggen', 'warning');

    setBezig(true);
    try {
      await db.createPoll({ vraag, opties: geldige, deadline, userId: currentUser.id });
      showToast('Poll aangemaakt: alle leiding krijgt een melding', 'success');
      navigate('/polls', { replace: true });
    } catch (e) {
      showToast('Aanmaken mislukt: ' + (e.message || 'onbekende fout'), 'error');
      setBezig(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Nieuwe poll</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-5">
        <label className="block">
          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Vraag</span>
          <textarea
            value={vraag}
            onChange={e => setVraag(e.target.value)}
            rows={2}
            placeholder="bv. Welk thema voor de leidingsfuif?"
            className="mt-1 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <section>
          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Opties</span>
          <div className="mt-1 space-y-2">
            {opties.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={o}
                  onChange={e => zetOptie(i, e.target.value)}
                  placeholder={`Optie ${i + 1}`}
                  className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {opties.length > 2 && (
                  <button onClick={() => setOpties(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                    <span className="material-icons-round">remove_circle</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setOpties(prev => [...prev, ''])} className="mt-2 text-sm font-bold text-blue-600 flex items-center gap-1">
            <span className="material-icons-round text-base">add</span> Optie toevoegen
          </button>
        </section>

        <label className="block">
          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Deadline</span>
          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700"
          />
        </label>

        <button onClick={opslaan} disabled={bezig} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">
          {bezig ? 'Aanmaken…' : 'Poll aanmaken'}
        </button>
      </main>
    </div>
  );
};
