import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../../lib/supabaseService';

// Rondleiding voor nieuwe accounts (migratie 004400): een paar kaarten om door te vegen, één keer per account.
// Opnieuw te bekijken via Instellingen ("Rondleiding bekijken" stuurt het event OPEN_RONDLEIDING).

export const OPEN_RONDLEIDING = 'ksa:rondleiding';
export const openRondleiding = () => window.dispatchEvent(new Event(OPEN_RONDLEIDING));

const KAARTEN = [
  {
    icoon: 'waving_hand',
    kleur: 'bg-bol-agenda dark:bg-bol-agenda-d',
    titel: 'Welkom in de KSA-app',
    tekst: [
      'Alles voor de leiding op één plek: strepen, je drankrekening, friet, de agenda en berichten.',
      'Bovenaan het startscherm staan bollen. Tik erop om naar Friet, Agenda, Polls, Mijn leiding en meer te gaan. Een oranje ring betekent: er is iets nieuws.',
    ],
  },
  {
    icoon: 'sports_bar',
    kleur: 'bg-kaart-strepen dark:bg-kaart-strepen-d',
    titel: 'Strepen',
    tekst: [
      'Drink je iets op het lokaal? Tik op het startscherm op de grote +1-knop van je snelle drank.',
      'Een andere drank of meer tegelijk? Ga naar Strepen (het glas onderaan). Per ongeluk gestreept? Binnen het uur kan je het verwijderen via Mijn geschiedenis.',
    ],
  },
  {
    icoon: 'euro',
    kleur: 'bg-bol-verslagen dark:bg-bol-verslagen-d',
    titel: 'Je rekening betalen',
    tekst: [
      'In Strepen zie je je voorlopige rekening. Sluit Drankteam de periode af, dan krijg je een factuur in Mijn rekening.',
      'Betaal met de QR-code in je bank-app, of kopieer rekening, bedrag en mededeling. Gebruik altijd die mededeling: zo ziet de app dat je betaald hebt.',
    ],
  },
  {
    icoon: 'lunch_dining',
    kleur: 'bg-bol-friet dark:bg-bol-friet-d',
    titel: 'Friet',
    tekst: [
      'Iemand opent een frietronde met een besteluur en jij krijgt een melding. Kies in de bol Friet wat je wil.',
      'Het bedrag komt op je drankrekening. Je kan ook bestellen voor iemand anders.',
    ],
  },
  {
    icoon: 'event',
    kleur: 'bg-bol-polls dark:bg-bol-polls-d',
    titel: 'Agenda en meldingen',
    tekst: [
      'In de agenda staan vergaderingen, weekends en kamp. Duid aan of je komt.',
      'Zet in Instellingen meldingen aan, zodat je niets mist. Op een iPhone werkt dat enkel als de app op je beginscherm staat (Deel → Zet op beginscherm).',
    ],
  },
  {
    icoon: 'settings',
    kleur: 'bg-bol-leiding dark:bg-bol-leiding-d',
    titel: 'Maak het je eigen',
    tekst: [
      'In Instellingen (het tandwiel) tik je op je cirkel voor een profielfoto, kies je een bijnaam en je snelle drank, en zet je de donkere weergave aan.',
      'Daar verander je ook de volgorde van de bollen, en vind je deze rondleiding terug.',
    ],
  },
];

export const Rondleiding = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [stap, setStap] = useState(0);
  const start = useRef(null);

  // Nieuw account: automatisch tonen (Godmode staat buiten de leiding)
  useEffect(() => {
    if (currentUser && !currentUser.rondleiding_gezien_op && !currentUser.isGodmode) {
      setStap(0);
      setOpen(true);
    }
  }, [currentUser?.id, currentUser?.rondleiding_gezien_op]);

  // Opnieuw bekijken vanuit Instellingen
  useEffect(() => {
    const toon = () => {
      setStap(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_RONDLEIDING, toon);
    return () => window.removeEventListener(OPEN_RONDLEIDING, toon);
  }, []);

  if (!open || !currentUser) return null;

  const sluit = async () => {
    setOpen(false);
    if (!currentUser.rondleiding_gezien_op) {
      const nu = new Date().toISOString();
      setCurrentUser({ ...currentUser, rondleiding_gezien_op: nu });
      try {
        await updateProfile(currentUser.id, { rondleiding_gezien_op: nu });
      } catch (e) {
        console.warn('Rondleiding gezien bewaren mislukt', e);
      }
    }
  };

  const kaart = KAARTEN[stap];
  const laatste = stap === KAARTEN.length - 1;
  const volgende = () => (laatste ? sluit() : setStap(s => s + 1));
  const vorige = () => setStap(s => Math.max(0, s - 1));

  // Vegen: naar links = volgende, naar rechts = vorige
  const onTouchStart = e => (start.current = e.touches[0].clientX);
  const onTouchEnd = e => {
    if (start.current == null) return;
    const dx = e.changedTouches[0].clientX - start.current;
    start.current = null;
    if (dx < -50) volgende();
    else if (dx > 50) vorige();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rondleiding"
      className="fixed inset-0 z-[90] bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex justify-end">
          {!laatste && (
            <button type="button" onClick={sluit} className="px-3 py-2 text-sm font-bold text-gray-500 dark:text-gray-400">
              Overslaan
            </button>
          )}
        </div>

        <div key={stap} className="flex-1 flex flex-col justify-center gap-6 animate-in fade-in">
          <div className={`w-24 h-24 rounded-[28px] ${kaart.kleur} flex items-center justify-center`}>
            <span className="material-icons-round text-5xl">{kaart.icoon}</span>
          </div>
          <h2 className="text-[30px] leading-tight font-extrabold tracking-tight">{kaart.titel}</h2>
          <div className="space-y-3 text-[17px] leading-relaxed text-gray-600 dark:text-gray-300">
            {kaart.tekst.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 py-6" aria-hidden>
          {KAARTEN.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === stap ? 'w-6 bg-inkt dark:bg-white' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {stap > 0 && (
            <button type="button" onClick={vorige} className="w-14 h-14 shrink-0 rounded-2xl bg-kaart-event dark:bg-kaart-event-d flex items-center justify-center" aria-label="Vorige">
              <span className="material-icons-round">arrow_back</span>
            </button>
          )}
          <button
            type="button"
            onClick={volgende}
            className="flex-1 h-14 rounded-2xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold text-base"
          >
            {laatste ? 'Aan de slag' : 'Volgende'}
          </button>
        </div>
      </div>
    </div>
  );
};
