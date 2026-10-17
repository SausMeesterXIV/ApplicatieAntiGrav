import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, loginAls, resetTestdata, tabel } from './fakeSupabase';
import { DEMO_PERSONEN } from './testdata';

// Demomodus: zwevende knop om snel als iemand anders in te loggen of de testdata te resetten.
// Wordt enkel geladen in npm run dev (mode "demo"), nooit in de echte app.

function DemoBalk() {
  const [open, setOpen] = useState(false);
  const [wie, setWie] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setWie(data.session?.user.id || null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setWie(s?.user.id || null));
    return () => data.subscription.unsubscribe();
  }, []);

  const profielen = tabel('profiles');
  const persoon = email => profielen.find(p => p.email === email);
  const ik = profielen.find(p => p.id === wie);

  return (
    <div style={{ position: 'fixed', right: 8, bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))', zIndex: 9999 }} className="font-sans">
      {open && (
        <div className="mb-2 w-64 rounded-2xl bg-white dark:bg-[#1e2330] text-inkt dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
          <p className="font-bold">Demomodus</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Testdata in je browser, niets gaat naar de echte app. Inloggen kan met elk wachtwoord.
          </p>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 pt-1">Inloggen als</p>
          {DEMO_PERSONEN.map(d => {
            const p = persoon(d.email);
            if (!p) return null;
            const actief = p.id === wie;
            return (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  loginAls(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left rounded-xl px-3 py-2 ${actief ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-gray-100 dark:bg-white/10'}`}
              >
                <span className="block font-semibold">{p.naam}</span>
                <span className={`block text-xs ${actief ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {d.wat} · {d.email}
                </span>
              </button>
            );
          })}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" onClick={() => loginAls(null)} className="rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2 font-semibold">
              Uitloggen
            </button>
            <button
              type="button"
              onClick={() => window.confirm('Alle testdata terugzetten naar het begin?') && resetTestdata()}
              className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 font-semibold"
            >
              Reset data
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="ml-auto block rounded-full bg-orange-500 text-white text-xs font-black tracking-wider px-3 py-2 shadow-lg"
        title="Demomodus"
      >
        DEMO{ik ? ` · ${ik.voornaam || ik.naam}` : ''}
      </button>
    </div>
  );
}

export function toonDemoBalk() {
  const plek = document.createElement('div');
  document.body.appendChild(plek);
  createRoot(plek).render(<DemoBalk />);
}
