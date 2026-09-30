import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from '../drank/DrinkContext';
import { supabase } from '../../lib/supabase';
import * as db from '../../lib/supabaseService';
import { isHoofdleiding } from '../../lib/roleUtils';
import { SPECIAL_DRINKS } from '../../lib/constants';
import { showToast } from '../../components/Toast';
import { BottomSheet } from '../../components/Modal';
import { isHapticEnabled, setHapticEnabled as saveHapticPref, hapticFeedback } from '../../lib/haptics';
import { UserAvatar } from '../../components/UserAvatar';
import { WachtwoordWijzigen } from './WachtwoordWijzigen';
import { PushInstelling } from './PushInstelling';
import { bollenVoor, gekozenVolgorde } from '../home/bollen';

// Instellingen (design-update): gegroepeerde lijst — Account, Startscherm, Meldingen, Weergave, Beheer.

const Groep = ({ titel, children }) => (
  <section className="space-y-2">
    <h2 className="px-2 text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{titel}</h2>
    <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
      {children}
    </div>
  </section>
);

const Rij = ({ label, waarde, onClick, icoon = 'chevron_right' }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left active:bg-black/5 dark:active:bg-white/5"
  >
    <span className="font-semibold text-base">{label}</span>
    <span className="flex items-center gap-1 min-w-0 text-gray-500 dark:text-gray-400">
      {waarde && <span className="truncate text-sm">{waarde}</span>}
      <span className="material-icons-round text-xl">{icoon}</span>
    </span>
  </button>
);

const Schakelaar = ({ label, aan, onChange }) => (
  <div className="flex items-center justify-between gap-3 px-5 py-4">
    <span className="font-semibold text-base">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={aan}
      aria-label={label}
      onClick={onChange}
      className={`w-12 h-7 rounded-full relative transition-colors ${aan ? 'bg-inkt dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full shadow transition-transform ${
          aan ? 'translate-x-5 bg-white dark:bg-inkt' : 'bg-white'
        }`}
      />
    </button>
  </div>
);

export const SettingsScreen = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAuth();
  const { dranken } = useDrink();

  const [wachtwoordOpen, setWachtwoordOpen] = useState(false);
  const [bijnaamOpen, setBijnaamOpen] = useState(false);
  const [drankOpen, setDrankOpen] = useState(false);
  const [bijnaam, setBijnaam] = useState(currentUser?.nickname || '');
  const [isDark, setIsDark] = useState(false);
  const [hapticOn, setHapticOn] = useState(false);
  const fotoInvoer = useRef(null);

  useEffect(() => setBijnaam(currentUser?.nickname || ''), [currentUser?.nickname]);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setHapticOn(isHapticEnabled());
  }, []);

  const aantalBollen = useMemo(() => bollenVoor(currentUser, gekozenVolgorde(currentUser)).length, [currentUser]);
  const drankKeuzes = dranken.filter(d => d.name !== SPECIAL_DRINKS.BAK_FREEDOM);
  const snelleDrank = drankKeuzes.find(d => String(d.id) === String(currentUser?.quickDrinkId)) || drankKeuzes[0];

  const toggleDarkMode = () => {
    const nieuw = !isDark;
    document.documentElement.classList.toggle('dark', nieuw);
    document.getElementById('theme-color-meta')?.setAttribute('content', nieuw ? '#0f172a' : '#ffffff');
    setIsDark(nieuw);
    try {
      localStorage.setItem('dark_mode', String(nieuw));
    } catch {
      // niet bewaard: geldt enkel voor deze sessie
    }
  };

  const toggleHaptic = () => {
    const nieuw = !hapticOn;
    setHapticOn(nieuw);
    saveHapticPref(nieuw);
    if (nieuw) hapticFeedback();
  };

  const bewaarBijnaam = async () => {
    const schoon = bijnaam.trim();
    try {
      await db.updateProfile(currentUser.id, { nickname: schoon || null });
      setCurrentUser({ ...currentUser, nickname: schoon || null });
      showToast('Bijnaam opgeslagen', 'success');
      setBijnaamOpen(false);
    } catch {
      showToast('Bijnaam opslaan mislukt', 'error');
    }
  };

  const kiesDrank = async drank => {
    try {
      await db.updateProfile(currentUser.id, { quick_drink_id: drank.id });
      setCurrentUser({ ...currentUser, quickDrinkId: drank.id, quick_drink_id: drank.id });
      showToast(`Snelle drank: ${drank.name}`, 'success');
      setDrankOpen(false);
    } catch {
      showToast('Snelle drank opslaan mislukt', 'error');
    }
  };

  const nieuweFoto = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await db.uploadAvatar(currentUser.id, file);
      setCurrentUser({ ...currentUser, avatar: url, avatar_url: url });
      showToast('Profielfoto opgeslagen', 'success');
    } catch (err) {
      console.error('Profielfoto uploaden mislukt', err);
      showToast('Profielfoto uploaden mislukt. Probeer opnieuw.', 'error');
    }
  };

  // Rollen onder je naam; "Hoofdleiding" ook als de rollenlijst leeg is (bv. vóór de migraties)
  const labels = currentUser?.roles || [];
  const rollen =
    (isHoofdleiding(currentUser) && !labels.includes('Hoofdleiding') ? ['Hoofdleiding', ...labels] : labels).join(
      ' · ',
    ) || 'Leiding';

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2">
        <h1 className="text-[28px] font-extrabold tracking-tight">Instellingen</h1>
      </header>

      <main className="flex-1 px-4 space-y-6">
        {/* Profiel */}
        <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fotoInvoer.current?.click()}
            className="relative shrink-0 rounded-full"
            aria-label="Profielfoto wijzigen"
          >
            <UserAvatar user={currentUser || undefined} size="lg" />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-inkt dark:bg-white text-white dark:text-inkt flex items-center justify-center">
              <span className="material-icons-round text-sm">photo_camera</span>
            </span>
          </button>
          <input ref={fotoInvoer} type="file" accept="image/*" className="hidden" onChange={nieuweFoto} />
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{currentUser?.naam}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{rollen}</p>
          </div>
        </div>

        <Groep titel="Account">
          <Rij label="Bijnaam" waarde={currentUser?.nickname || 'Geen'} onClick={() => setBijnaamOpen(true)} />
          <Rij label="Wachtwoord wijzigen" onClick={() => setWachtwoordOpen(true)} />
        </Groep>

        <Groep titel="Startscherm">
          <Rij label="Volgorde bollen" waarde={`${aantalBollen} bollen`} onClick={() => navigate('/settings/bollen')} />
          <Rij label="Snelle drank" waarde={snelleDrank?.name || 'Kies'} onClick={() => setDrankOpen(true)} />
        </Groep>

        <Groep titel="Meldingen">
          <PushInstelling />
          <Rij label="Alle meldingen" onClick={() => navigate('/notificaties')} />
        </Groep>

        <Groep titel="Weergave">
          <Schakelaar label="Donkere weergave" aan={isDark} onChange={toggleDarkMode} />
          <Schakelaar label="Trillen bij acties" aan={hapticOn} onChange={toggleHaptic} />
        </Groep>

        <Groep titel="Beheer">
          {isHoofdleiding(currentUser) && (
            <Rij label="Rollen en werkgroepen" onClick={() => navigate('/admin/rollen')} />
          )}
          <Rij label="Credits" onClick={() => navigate('/credits')} />
        </Groep>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded-2xl py-4 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15"
        >
          Uitloggen
        </button>
      </main>

      <WachtwoordWijzigen isOpen={wachtwoordOpen} onClose={() => setWachtwoordOpen(false)} />

      <BottomSheet isOpen={bijnaamOpen} onClose={() => setBijnaamOpen(false)} title="Bijnaam">
        <div className="space-y-3 pb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Deze naam zien andere leiding, bv. in de ranking.</p>
          <input
            id="bijnaam"
            value={bijnaam}
            onChange={e => setBijnaam(e.target.value)}
            maxLength={30}
            placeholder="Kies een bijnaam"
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          />
          <button
            type="button"
            onClick={bewaarBijnaam}
            className="w-full py-3 rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt font-bold"
          >
            Opslaan
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={drankOpen}
        onClose={() => setDrankOpen(false)}
        title="Snelle drank"
        subtitle="De grote +1-knop op je startscherm"
      >
        <ul className="pb-4 divide-y divide-gray-100 dark:divide-gray-800">
          {drankKeuzes.map(d => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => kiesDrank(d)}
                className="w-full flex items-center justify-between py-3.5 text-left"
              >
                <span className="font-semibold">{d.name}</span>
                {String(d.id) === String(snelleDrank?.id) && <span className="material-icons-round">check</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
};
