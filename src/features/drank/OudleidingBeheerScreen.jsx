import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { UserAvatar } from '../../components/UserAvatar';
import { showToast } from '../../components/Toast';
import {
  fetchOudleidingCode,
  gebruikersnaamVan,
  zetOudleidingActief,
  zetOudleidingCode,
  zetOudleidingWachtwoord,
} from '../../lib/oudleiding';

// Drankteam (en hoofdleiding): de code waarmee oudleiding registreert, en de oudleiding-accounts
// (nieuw wachtwoord, want zij kunnen geen mail ontvangen; account aan/uit).
export const OudleidingBeheerScreen = () => {
  const navigate = useNavigate();
  const { users, refreshRoles } = useAuth();
  const [instelling, setInstelling] = useState(null);
  const [nieuweCode, setNieuweCode] = useState('');
  const [bezig, setBezig] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);

  const laad = () =>
    fetchOudleidingCode()
      .then(setInstelling)
      .catch(() => showToast('De code kon niet geladen worden (migratie uitgevoerd?)', 'error'));

  useEffect(() => {
    laad();
  }, []);

  const oudleiding = useMemo(
    () => users.filter(u => u.isOudleiding).sort((a, b) => (a.naam || '').localeCompare(b.naam || '')),
    [users],
  );

  const bewaarCode = async code => {
    setBezig(true);
    try {
      await zetOudleidingCode(code);
      setNieuweCode('');
      await laad();
      showToast(code ? 'Nieuwe code ingesteld' : 'Registreren voor oudleiding staat uit', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Oudleiding</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-6">
        <section className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <div>
            <h2 className="font-bold">Code om te registreren</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Oudleiding registreert in de app (Registreer &gt; „Oudleiding zonder @ksa-aalter.be?") met een
              gebruikersnaam, een wachtwoord en deze code. Ze zien enkel strepen, hun drankrekening en friet. Verander
              de code af en toe, of zet registreren uit.
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Huidige code</span>
            <span className="font-mono font-bold text-lg select-all">
              {instelling?.code || <span className="text-sm font-sans text-gray-400">uit (geen code)</span>}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={nieuweCode}
              onChange={e => setNieuweCode(e.target.value)}
              placeholder="Nieuwe code (min. 6 tekens)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => bewaarCode(nieuweCode)}
              disabled={bezig || nieuweCode.trim().length < 6}
              className="px-4 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold disabled:opacity-40"
            >
              Instellen
            </button>
          </div>
          {instelling?.code && (
            <button
              type="button"
              onClick={() => bewaarCode(null)}
              disabled={bezig}
              className="w-full rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 active:scale-[0.99] disabled:opacity-40"
            >
              <span className="material-icons-round text-lg">block</span>
              Registreren uitzetten
            </button>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">
            Accounts ({oudleiding.length})
          </h2>
          {oudleiding.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 px-1">
              Nog geen oudleiding. Leiding die stopt, zet de hoofdleiding op „Oudleiding" (Rollen); zij houden hun
              account en historiek.
            </p>
          )}
          {oudleiding.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => setGeselecteerd(u)}
              className="w-full text-left bg-white dark:bg-[#1e2330] p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3"
            >
              <UserAvatar user={u} size="md" />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">
                  {u.naam}
                  {!u.actief && <span className="ml-2 text-xs font-bold text-red-500">inactief</span>}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  {gebruikersnaamVan(u.email) ? `Gebruikersnaam: ${gebruikersnaamVan(u.email)}` : u.email}
                </span>
              </span>
              <span className="material-icons-round text-gray-300">chevron_right</span>
            </button>
          ))}
        </section>
      </main>

      {geselecteerd && (
        <OudleiderSheet
          key={geselecteerd.id}
          leider={geselecteerd}
          onClose={() => setGeselecteerd(null)}
          onSaved={refreshRoles}
        />
      )}
    </div>
  );
};

const OudleiderSheet = ({ leider, onClose, onSaved }) => {
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const gebruikersnaam = gebruikersnaamVan(leider.email);

  const nieuwWachtwoord = async () => {
    setBezig(true);
    try {
      await zetOudleidingWachtwoord(leider.id, wachtwoord);
      showToast(`Nieuw wachtwoord ingesteld. Geef het door aan ${leider.naam}.`, 'success');
      setWachtwoord('');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  const wisselActief = async () => {
    setBezig(true);
    try {
      await zetOudleidingActief(leider.id, !leider.actief);
      await onSaved();
      showToast(leider.actief ? `${leider.naam} kan niet meer inloggen` : `${leider.naam} is weer actief`, 'success');
      onClose();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={leider.naam}
      subtitle={gebruikersnaam ? `Gebruikersnaam: ${gebruikersnaam}` : leider.email}
    >
      <div className="space-y-5 pb-4">
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Nieuw wachtwoord</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Oudleiding kan „Wachtwoord vergeten" niet gebruiken. Stel hier een nieuw in en geef het persoonlijk door; ze
            kunnen het daarna zelf wijzigen bij Instellingen.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={wachtwoord}
              onChange={e => setWachtwoord(e.target.value)}
              placeholder="Minstens 8 tekens"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={nieuwWachtwoord}
              disabled={bezig || wachtwoord.length < 8}
              className="px-4 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold disabled:opacity-40"
            >
              Instellen
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={wisselActief}
          disabled={bezig}
          className={`w-full py-3 rounded-xl font-bold disabled:opacity-50 ${
            leider.actief ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-green-600 text-white'
          }`}
        >
          {leider.actief ? 'Account uitzetten (kan niet meer inloggen)' : 'Account terug aanzetten'}
        </button>
      </div>
    </BottomSheet>
  );
};
