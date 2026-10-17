import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../../lib/supabaseService';

// Rondleiding in de app zelf (migratie 004400): we gaan langs de echte schermen, maken de rest donker en
// wijzen telkens één knop of plek aan (elementen met data-rondleiding="…"). Eén keer per account;
// opnieuw te bekijken via Instellingen ("Rondleiding bekijken" stuurt het event OPEN_RONDLEIDING).
// Staat een plek er niet (bv. oudleiding ziet sommige bollen niet), dan slaan we die stap over.

export const OPEN_RONDLEIDING = 'ksa:rondleiding';
export const openRondleiding = () => window.dispatchEvent(new Event(OPEN_RONDLEIDING));

const STAPPEN = [
  {
    route: '/',
    titel: 'Welkom in de KSA-app 👋',
    tekst: 'We tonen je even waar je alles vindt. Duurt een minuutje.',
  },
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

// Het zichtbare element met dit data-rondleiding (bv. de menubalk onderaan op gsm, de zijbalk op computer)
const zoekDoel = doel =>
  [...document.querySelectorAll(`[data-rondleiding="${doel}"]`)].find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

export const Rondleiding = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [stap, setStap] = useState(0);
  const [richting, setRichting] = useState(1);
  const [vak, setVak] = useState(null); // positie van de aangewezen plek
  const [klaar, setKlaar] = useState(false); // plek gevonden en in beeld

  // Nieuw account: automatisch starten (Godmode staat buiten de leiding)
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
      setRichting(1);
      setOpen(true);
    };
    window.addEventListener(OPEN_RONDLEIDING, toon);
    return () => window.removeEventListener(OPEN_RONDLEIDING, toon);
  }, []);

  const huidig = STAPPEN[stap];

  // Naar het juiste scherm gaan
  useEffect(() => {
    if (open && huidig && pathname !== huidig.route) navigate(huidig.route);
  }, [open, stap]); // eslint-disable-line react-hooks/exhaustive-deps

  const meet = useCallback(() => {
    if (!huidig?.doel) return setVak(null);
    const el = zoekDoel(huidig.doel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setVak({ x: r.left - MARGE, y: r.top - MARGE, b: r.width + 2 * MARGE, h: r.height + 2 * MARGE });
  }, [huidig]);

  // De plek zoeken (het scherm kan nog laden), in beeld brengen en meten; ontbreekt ze, dan de stap overslaan
  useLayoutEffect(() => {
    if (!open || !huidig) return;
    setKlaar(false);
    setVak(null);
    if (!huidig.doel) {
      setKlaar(true);
      return;
    }
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
        }, 450);
      } else if (++pogingen < 30) {
        setTimeout(zoek, 100);
      } else {
        // Niet gevonden: verder in dezelfde richting
        setStap(s => Math.min(STAPPEN.length - 1, Math.max(0, s + richting)));
      }
    };
    zoek();
    return () => {
      gestopt = true;
    };
  }, [open, stap, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meebewegen bij scrollen of draaien van het scherm
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', meet);
    window.addEventListener('scroll', meet, true);
    return () => {
      window.removeEventListener('resize', meet);
      window.removeEventListener('scroll', meet, true);
    };
  }, [open, meet]);

  if (!open || !currentUser || !huidig) return null;

  const sluit = async () => {
    setOpen(false);
    navigate('/');
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
  const laatste = stap === STAPPEN.length - 1;
  const volgende = () => {
    if (laatste) return sluit();
    setRichting(1);
    setStap(s => s + 1);
  };
  const vorige = () => {
    setRichting(-1);
    setStap(s => Math.max(0, s - 1));
  };

  // Tekstballon onder de plek, of erboven als er onderaan te weinig ruimte is
  const breedte = Math.min(360, window.innerWidth - 32);
  const ballon = vak
    ? (() => {
        const links = Math.min(Math.max(16, vak.x + vak.b / 2 - breedte / 2), window.innerWidth - breedte - 16);
        const onder = window.innerHeight - (vak.y + vak.h);
        return onder > 240
          ? { left: links, top: vak.y + vak.h + 12 }
          : { left: links, bottom: window.innerHeight - vak.y + 12 };
      })()
    : null;

  return (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Rondleiding">
      {/* Donker vlak met een gat op de aangewezen plek; klikken op de achtergrond doet niets */}
      {vak && klaar ? (
        <div
          className="absolute rounded-2xl pointer-events-none transition-all duration-300 ring-2 ring-white/80"
          style={{ left: vak.x, top: vak.y, width: vak.b, height: vak.h, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/70" />
      )}

      {klaar && (
        <div
          className="absolute bg-white dark:bg-[#1e2330] text-inkt dark:text-white rounded-3xl shadow-2xl p-5 space-y-3"
          style={
            ballon
              ? { ...ballon, width: breedte }
              : { width: breedte, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              {stap + 1} / {STAPPEN.length}
            </span>
            {!laatste && (
              <button type="button" onClick={sluit} className="text-sm font-bold text-gray-500 dark:text-gray-400">
                Overslaan
              </button>
            )}
          </div>
          <h2 className="text-xl font-extrabold leading-tight">{huidig.titel}</h2>
          <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{huidig.tekst}</p>
          <div className="flex gap-2 pt-1">
            {stap > 0 && (
              <button
                type="button"
                onClick={vorige}
                className="w-12 h-12 shrink-0 rounded-2xl bg-kaart-event dark:bg-white/10 flex items-center justify-center"
                aria-label="Vorige"
              >
                <span className="material-icons-round">arrow_back</span>
              </button>
            )}
            <button
              type="button"
              onClick={volgende}
              className="flex-1 h-12 rounded-2xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold"
            >
              {laatste ? 'Aan de slag' : stap === 0 ? 'Start' : 'Volgende'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
