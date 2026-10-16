import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { ChevronBack } from '../../components/ChevronBack';

// Wachtwoord vergeten zonder mail (migratie 002900):
// 1. e-mail invullen en een leider kiezen -> die ziet je vraag wanneer hij de app opent en maakt een code;
// 2. de code (6 cijfers, 10 minuten geldig) en een nieuw wachtwoord ingeven.

const veld =
  'w-full rounded-2xl bg-kaart-event dark:bg-kaart-event-d border-0 px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30';

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2 ml-1">
    {children}
  </label>
);

export const WachtwoordVergetenScreen = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [stap, setStap] = useState('aanvragen'); // 'aanvragen' | 'code'
  const [email, setEmail] = useState(state?.email || '');
  const [leiders, setLeiders] = useState([]);
  const [leiderId, setLeiderId] = useState('');
  const [code, setCode] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [herhaal, setHerhaal] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    db.fetchResetLeiders()
      .then(setLeiders)
      .catch(() => showToast('De lijst met leiding kon niet geladen worden. Probeer opnieuw.', 'error'));
  }, []);

  const gekozen = leiders.find(l => l.id === leiderId);

  const aanvragen = async e => {
    e.preventDefault();
    if (!email.trim().includes('@')) return showToast('Vul je e-mailadres in', 'error');
    if (!leiderId) return showToast('Kies een leider', 'error');
    setBezig(true);
    try {
      await db.vraagWachtwoordReset(email.trim(), leiderId);
      setStap('code');
    } catch {
      showToast('Aanvragen lukte niet. Probeer opnieuw.', 'error');
    } finally {
      setBezig(false);
    }
  };

  const instellen = async e => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) return showToast('De code heeft 6 cijfers', 'error');
    if (wachtwoord.length < 8) return showToast('Je wachtwoord moet minstens 8 tekens hebben', 'error');
    if (wachtwoord !== herhaal) return showToast('De twee wachtwoorden zijn niet hetzelfde', 'error');
    setBezig(true);
    try {
      await db.zetWachtwoordMetCode(email.trim(), code.replace(/\s/g, ''), wachtwoord);
      showToast('Je wachtwoord is aangepast. Log nu in.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={() => (stap === 'code' ? setStap('aanvragen') : navigate('/login'))} />
        <h1 className="text-[28px] font-extrabold tracking-tight">Wachtwoord vergeten</h1>
      </header>

      <main className="flex-1 px-4 pt-2 pb-10 w-full max-w-md mx-auto">
        {stap === 'aanvragen' ? (
          <form onSubmit={aanvragen} className="space-y-5">
            <p className="text-gray-600 dark:text-gray-300">
              De app stuurt geen mails. Kies een leider die je goed kent: die ziet je vraag wanneer hij of zij de app
              opent, en geeft je een code van 6 cijfers.
            </p>

            <div>
              <Label htmlFor="reset-email">Je e-mailadres</Label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voornaam.achternaam@ksa-aalter.be"
                className={veld}
              />
            </div>

            <div>
              <Label htmlFor="reset-leider">Wie geeft je de code?</Label>
              <select id="reset-leider" value={leiderId} onChange={e => setLeiderId(e.target.value)} className={veld}>
                <option value="">Kies een leider</option>
                {leiders.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.naam}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={bezig}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold active:scale-[0.99] disabled:opacity-50"
            >
              {bezig ? 'Even geduld…' : 'Code aanvragen'}
            </button>
            <button
              type="button"
              onClick={() => setStap('code')}
              className="w-full rounded-2xl bg-kaart-event dark:bg-kaart-event-d py-4 font-bold active:scale-[0.99]"
            >
              Ik heb al een code
            </button>
          </form>
        ) : (
          <form onSubmit={instellen} className="space-y-5">
            <div className="rounded-[28px] bg-kaart-strepen dark:bg-kaart-strepen-d p-5 space-y-1">
              <p className="font-bold">{gekozen ? `Vraag nu de code aan ${gekozen.naam}.` : 'Vraag de code aan de leider die je koos.'}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Die ziet je vraag wanneer hij of zij de app opent. De code is 10 minuten geldig nadat ze gemaakt is.
              </p>
            </div>

            <div>
              <Label htmlFor="reset-email2">Je e-mailadres</Label>
              <input
                id="reset-email2"
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={veld}
              />
            </div>

            <div>
              <Label htmlFor="reset-code">Code (6 cijfers)</Label>
              <input
                id="reset-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                className={`${veld} text-center text-2xl font-extrabold tracking-[0.3em] tabular-nums`}
              />
            </div>

            <div>
              <Label htmlFor="reset-ww">Nieuw wachtwoord</Label>
              <input
                id="reset-ww"
                type="password"
                autoComplete="new-password"
                value={wachtwoord}
                onChange={e => setWachtwoord(e.target.value)}
                placeholder="Minstens 8 tekens"
                className={veld}
              />
            </div>
            <div>
              <Label htmlFor="reset-ww2">Herhaal nieuw wachtwoord</Label>
              <input
                id="reset-ww2"
                type="password"
                autoComplete="new-password"
                value={herhaal}
                onChange={e => setHerhaal(e.target.value)}
                className={veld}
              />
            </div>

            <button
              type="submit"
              disabled={bezig}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold active:scale-[0.99] disabled:opacity-50"
            >
              {bezig ? 'Even geduld…' : 'Wachtwoord instellen'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};
