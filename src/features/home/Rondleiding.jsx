import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../../lib/supabaseService';

// Rondleiding (migratie 004400): eerst een welkomstscherm, daarna gaan we langs de echte schermen, maken de rest
// donker en wijzen telkens één knop of plek aan (elementen met data-rondleiding="…"). Eén keer per account;
// opnieuw te bekijken via Instellingen ("Rondleiding bekijken" stuurt het event OPEN_RONDLEIDING).
// Staat een plek er niet (bv. oudleiding ziet sommige bollen niet), dan slaan we die stap over.

export const OPEN_RONDLEIDING = 'ksa:rondleiding';
export const openRondleiding = () => window.dispatchEvent(new Event(OPEN_RONDLEIDING));

const STAPPEN = [
  {
    route: '/',
    doel: 'bollen',
    titel: 'De bollen',
    tekst: 'Tik op een bol om naar Friet, Agenda, Polls, Verslagen, Mijn leiding en meer te gaan. Een oranje ring betekent: er is iets nieuws.',
  },
  {
    route: '/',
    doel: 'snel-streep',
    titel: 'Snel een streep',
    tekst: 'Drink je iets? Eén tik hier zet een streep voor je snelle drank. Per ongeluk? Binnen het uur verwijder je ze via Strepen → Mijn geschiedenis.',
  },
  {
    route: '/',
    doel: 'nav-strepen',
    titel: 'Strepen',
    tekst: 'Hier zet je strepen voor andere dranken, of meerdere tegelijk.',
  },
  {
    route: '/strepen',
    doel: 'strepen-zetten',
    titel: 'Drank kiezen',
    tekst: 'Kies een drank en het aantal, en bevestig met de knop eronder.',
  },
  {
    route: '/strepen',
    doel: 'rekening',
    titel: 'Je rekening',
    tekst: 'Wat je deze periode al streepte. Tik erop voor je facturen: betaal met de QR-code, of kopieer rekening, bedrag en mededeling. Altijd met die mededeling!',
  },
  {
    route: '/',
    doel: 'bol-friet',
    titel: 'Friet',
    tekst: 'Opent iemand een frietronde, dan krijg je een melding. Bestel hier vóór het besteluur; het bedrag komt op je rekening.',
  },
  {
    route: '/',
    doel: 'nav-agenda',
    titel: 'Agenda',
    tekst: 'Vergaderingen, weekends en kamp. Duid bij elk item aan of je komt.',
  },
  {
    route: '/',
    doel: 'nav-notificaties',
    titel: 'Meldingen',
    tekst: 'Berichten van de leiding, nudges en friet-meldingen komen hier binnen.',
  },
  {
    route: '/settings',
    doel: 'profielfoto',
    titel: 'Je profielfoto',
    tekst: 'Tik op je cirkel om een foto te kiezen. Zo herkent iedereen je in Mijn leiding.',
  },
  {
    route: '/settings',
    doel: 'startscherm-instellingen',
    titel: 'Je startscherm',
    tekst: 'Kies je snelle drank en zet de bollen in de volgorde die jij wil.',
  },
  {
    route: '/settings',
    doel: 'meldingen-instellingen',
    titel: 'Meldingen aanzetten',
    tekst: 'Zet pushmeldingen aan zodat je niets mist. Op een iPhone werkt dat enkel als de app op je beginscherm staat (Deel → Zet op beginscherm).',
  },
  {
    route: '/settings',
    doel: 'weergave',
    titel: 'Donkere weergave',
    tekst: 'Liever donker? Zet het hier aan.',
  },
  {
    route: '/settings',
    doel: 'rondleiding-knop',
    titel: 'Klaar!',
    tekst: 'Deze rondleiding vind je hier altijd terug. Veel plezier met de app!',
  },
];

const MARGE = 8; // ruimte rond de aangewezen plek
const PIJL = 10; // grootte van het pijltje van de tekstballon

// Het zichtbare element met dit data-rondleiding (bv. de menubalk onderaan op gsm, de zijbalk op computer)
const zoekDoel = doel =>
  [...document.querySelectorAll(`[data-rondleiding="${doel}"]`)].find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

// Welkomstscherm vóór de rondleiding (over het hele scherm)
const Welkom = ({ naam, onStart, onOverslaan }) => (
  <div className="fixed inset-0 z-[10000] bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white flex flex-col" role="dialog" aria-modal="true" aria-label="Welkom">
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="w-24 h-24 rounded-[28px] bg-bol-agenda dark:bg-bol-agenda-d flex items-center justify-center">
          <span className="material-icons-round text-5xl">waving_hand</span>
        </div>
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">
          Welkom{naam ? `, ${naam}` : ''}!
        </h1>
        <div className="space-y-3 text-[17px] leading-relaxed text-gray-600 dark:text-gray-300">
          <p>Dit is de app van de leiding van KSA Aalter: strepen, je drankrekening, friet, de agenda en berichten, alles op één plek.</p>
          <p>We tonen je in een minuutje waar je alles vindt, op de echte schermen.</p>
        </div>
      </div>
      <div className="space-y-2">
        <button type="button" onClick={onStart} className="w-full h-14 rounded-2xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold text-base">
          Rondleiding starten
        </button>
        <button type="button" onClick={onOverslaan} className="w-full h-12 rounded-2xl font-bold text-gray-500 dark:text-gray-400">
          Overslaan
        </button>
      </div>
    </div>
  </div>
);

export const Rondleiding = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [welkom, setWelkom] = useState(true);
  const [stap, setStap] = useState(0);
  const [richting, setRichting] = useState(1);
  const [vak, setVak] = useState(null); // positie van de aangewezen plek (blijft staan tot de volgende gemeten is)
  const [klaar, setKlaar] = useState(false); // plek gevonden en in beeld

  const start = () => {
    setWelkom(true);
    setStap(0);
    setRichting(1);
    setVak(null);
    setOpen(true);
  };

  // Nieuw account: automatisch starten (Godmode staat buiten de leiding)
  useEffect(() => {
    if (currentUser && !currentUser.rondleiding_gezien_op && !currentUser.isGodmode) start();
  }, [currentUser?.id, currentUser?.rondleiding_gezien_op]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opnieuw bekijken vanuit Instellingen
  useEffect(() => {
    window.addEventListener(OPEN_RONDLEIDING, start);
    return () => window.removeEventListener(OPEN_RONDLEIDING, start);
  }, []);

  const bezig = open && !welkom;
  const huidig = STAPPEN[stap];

  // Naar het juiste scherm gaan
  useEffect(() => {
    if (bezig && pathname !== huidig.route) navigate(huidig.route);
  }, [bezig, stap]); // eslint-disable-line react-hooks/exhaustive-deps

  const meet = useCallback(() => {
    const el = huidig && zoekDoel(huidig.doel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setVak({ x: r.left - MARGE, y: r.top - MARGE, b: r.width + 2 * MARGE, h: r.height + 2 * MARGE });
  }, [huidig]);

  // De plek zoeken (het scherm kan nog laden), in beeld brengen en meten; ontbreekt ze, dan de stap overslaan
  useLayoutEffect(() => {
    if (!bezig) return;
    setKlaar(false);
    let pogingen = 0;
    let gestopt = false;
    const zoek = () => {
      if (gestopt) return;
      if (pathname !== huidig.route) return setTimeout(zoek, 100);
      const el = zoekDoel(huidig.doel);
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        setTimeout(() => {
          if (gestopt) return;
          meet();
          setKlaar(true);
        }, 400);
      } else if (++pogingen < 30) {
        setTimeout(zoek, 100);
      } else {
        // Niet gevonden: verder in dezelfde richting (of klaar als het de laatste was)
        const volgende = stap + richting;
        if (volgende < 0 || volgende >= STAPPEN.length) setKlaar(true);
        else setStap(volgende);
      }
    };
    zoek();
    return () => {
      gestopt = true;
    };
  }, [bezig, stap, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meebewegen bij scrollen of draaien van het scherm
  useEffect(() => {
    if (!bezig) return;
    window.addEventListener('resize', meet);
    window.addEventListener('scroll', meet, true);
    return () => {
      window.removeEventListener('resize', meet);
      window.removeEventListener('scroll', meet, true);
    };
  }, [bezig, meet]);

  if (!open || !currentUser) return null;

  const sluit = async () => {
    setOpen(false);
    if (!welkom) navigate('/');
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

  if (welkom) {
    return <Welkom naam={currentUser.voornaam || currentUser.nickname} onStart={() => setWelkom(false)} onOverslaan={sluit} />;
  }

  const laatste = stap === STAPPEN.length - 1;
  const volgende = () => {
    if (laatste) return sluit();
    setRichting(1);
    setStap(s => s + 1);
  };
  const vorige = () => {
    if (stap === 0) return setWelkom(true);
    setRichting(-1);
    setStap(s => s - 1);
  };

  // Tekstballon onder de plek (pijltje omhoog), of erboven als er onderaan te weinig ruimte is
  const breedte = Math.min(360, window.innerWidth - 32);
  let ballon = null;
  if (vak) {
    const links = Math.min(Math.max(16, vak.x + vak.b / 2 - breedte / 2), window.innerWidth - breedte - 16);
    const pijlX = Math.min(Math.max(24, vak.x + vak.b / 2 - links), breedte - 24);
    const onder = window.innerHeight - (vak.y + vak.h) > 250;
    ballon = {
      stijl: onder
        ? { left: links, top: vak.y + vak.h + PIJL + 6 }
        : { left: links, bottom: window.innerHeight - vak.y + PIJL + 6 },
      pijl: onder ? { left: pijlX - PIJL, top: -PIJL / 2 - 1 } : { left: pijlX - PIJL, bottom: -PIJL / 2 - 1 },
    };
  }

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Rondleiding">
      {/* Donker vlak met een gat op de aangewezen plek; het gat schuift mee naar de volgende plek */}
      {vak ? (
        <div
          className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-out"
          style={{ left: vak.x, top: vak.y, width: vak.b, height: vak.h, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)' }}
        >
          {klaar && <span className="absolute inset-0 rounded-2xl ring-2 ring-white/90 animate-pulse" />}
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-900/70" />
      )}

      {klaar && ballon && (
        <div
          key={stap}
          className="absolute bg-white dark:bg-[#1e2330] text-inkt dark:text-white rounded-3xl shadow-2xl p-5 space-y-3 animate-in fade-in"
          style={{ ...ballon.stijl, width: breedte }}
        >
          <span
            className="absolute bg-white dark:bg-[#1e2330] rotate-45 rounded-[3px]"
            style={{ ...ballon.pijl, width: PIJL * 2, height: PIJL * 2 }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between">
            <div className="flex gap-1" aria-label={`Stap ${stap + 1} van ${STAPPEN.length}`}>
              {STAPPEN.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stap ? 'w-4 bg-inkt dark:bg-white' : i < stap ? 'w-1.5 bg-gray-400 dark:bg-gray-500' : 'w-1.5 bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
            {!laatste && (
              <button type="button" onClick={sluit} className="text-sm font-bold text-gray-500 dark:text-gray-400">
                Overslaan
              </button>
            )}
          </div>
          <h2 className="relative text-xl font-extrabold leading-tight">{huidig.titel}</h2>
          <p className="relative text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{huidig.tekst}</p>
          <div className="relative flex gap-2 pt-1">
            <button
              type="button"
              onClick={vorige}
              className="w-12 h-12 shrink-0 rounded-2xl bg-kaart-event dark:bg-white/10 flex items-center justify-center"
              aria-label="Vorige"
            >
              <span className="material-icons-round">arrow_back</span>
            </button>
            <button type="button" onClick={volgende} className="flex-1 h-12 rounded-2xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold">
              {laatste ? 'Aan de slag' : 'Volgende'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
