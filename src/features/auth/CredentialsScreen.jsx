import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { authFout } from '../../lib/authFouten';
import { naarLoginEmail, gebruikersnaamGeldig, registreerOudleiding } from '../../lib/oudleiding';

export const CredentialsScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [voornaam, setVoornaam] = useState('');
  const [achternaam, setAchternaam] = useState('');
  const naam = `${voornaam.trim()} ${achternaam.trim()}`.trim();
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  // Oudleiding registreert met gebruikersnaam en de code van Drankteam (geen @ksa-aalter.be-mail)
  const [isOudleiding, setIsOudleiding] = useState(false);
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Validatie logica
  const TEST_EMAIL = 'it.takes.jaguarke@gmail.com';
  const REQUIRED_DOMAIN = '@ksa-aalter.be';

  const isValidEmailDomain = emailAddr => {
    const cleanedEmail = emailAddr.trim().toLowerCase();
    return cleanedEmail.endsWith(REQUIRED_DOMAIN) || cleanedEmail === TEST_EMAIL;
  };
  // Inloggen: leiding met e-mail, oudleiding met gebruikersnaam (zonder @)
  const isGebruikersnaam = invoer => !invoer.includes('@');

  // Er wordt nooit gemaild: je vraagt een code aan een leider die je zelf kiest (scherm Wachtwoord vergeten)
  const handleForgotPassword = () => {
    if (email.trim() && isGebruikersnaam(email)) {
      showToast('Oudleiding: vraag Drankteam om een nieuw wachtwoord.', 'info');
      return;
    }
    navigate('/wachtwoord-vergeten', { state: { email: email.trim() } });
  };

  const handleLogin = async e => {
    e.preventDefault();

    if (!isGebruikersnaam(email) && !isValidEmailDomain(email)) {
      showToast(`Inloggen mislukt: gebruik je ${REQUIRED_DOMAIN} email (oudleiding: je gebruikersnaam).`, 'error');
      return;
    }

    setLoading(true);
    try {
      // Spatie of hoofdletter van het gsm-toetsenbord laten het inloggen anders mislukken
      const { data, error } = await supabase.auth.signInWithPassword({
        email: naarLoginEmail(email),
        password,
      });
      if (error) throw error;

      // Check if account is active
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('actief').eq('id', data.user.id).single();

        if (profile && profile.actief === false) {
          await supabase.auth.signOut();
          showToast(
            'Sorry, je account is gedeactiveerd. Voor verdere vragen moet je bij de hoofdleiding zijn!',
            'error'
          );
          return;
        }
      }
    } catch (error) {
      showToast(authFout(error, 'Fout bij het inloggen'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    if (!voornaam.trim() || !achternaam.trim()) {
      showToast('Vul je voornaam en achternaam in', 'error');
      return;
    }

    if (isOudleiding) {
      if (!gebruikersnaamGeldig(email.trim().toLowerCase())) {
        showToast('Gebruikersnaam: 3 tot 30 tekens, enkel kleine letters, cijfers, punt, - of _', 'error');
        return;
      }
      setLoading(true);
      try {
        await registreerOudleiding({ naam, gebruikersnaam: email, wachtwoord: password, code });
        showToast('Welkom terug! Je account voor oudleiding is klaar.', 'success');
      } catch (error) {
        showToast(authFout(error, error.message || 'Fout bij het registreren'), 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isValidEmailDomain(email)) {
      showToast(`Registreren verplicht met een ${REQUIRED_DOMAIN} email adres.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            voornaam: voornaam.trim(),
            achternaam: achternaam.trim(),
            naam,
            full_name: naam,
            display_name: naam,
          },
        },
      });
      if (error) throw error;

      // Het profiel maakt de database zelf aan (trigger handle_new_user). Een nieuw account wacht op
      // goedkeuring door de leiding; de app toont dan het wachtscherm.
      if (data.session) {
        showToast('Account aangemaakt! Iemand van de leiding moet je nog goedkeuren.', 'success');
      } else {
        showToast(
          'Account aangemaakt! Bevestig je e-mailadres via de link in je mailbox (kijk ook in spam).',
          'success'
        );
      }
    } catch (error) {
      showToast(authFout(error, 'Fout bij het registreren'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/20 flex items-center justify-center mb-6 rotate-3">
              <span className="material-icons-round text-4xl text-white">local_fire_department</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">KSA LeidingsApp</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {isRegister
                ? isOudleiding
                  ? 'Account voor oudleiding, met de code van Drankteam'
                  : 'Maak een nieuw account aan'
                : 'Log in om verder te gaan'}
            </p>
          </div>

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Voornaam', voornaam, setVoornaam, 'given-name', 'bv. Jan'],
                  ['Achternaam', achternaam, setAchternaam, 'family-name', 'bv. Peeters'],
                ].map(([label, waarde, zet, autoComplete, placeholder]) => (
                  <div key={label} className="min-w-0">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete={autoComplete}
                      value={waarde}
                      onChange={e => zet(e.target.value)}
                      className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">
                {isRegister ? (isOudleiding ? 'Gebruikersnaam' : 'Email') : 'Email of gebruikersnaam'}
              </label>
              <input
                type="text"
                inputMode="email"
                required
                autoComplete={isRegister && isOudleiding ? 'username' : 'email'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                placeholder={isRegister && isOudleiding ? 'bv. jan.peeters' : 'voornaam.achternaam@ksa-aalter.be'}
              />
              {/* Visuele hint voor de gebruiker */}
              <p className="mt-2 ml-1 text-[10px] text-gray-400 dark:text-gray-500 italic">
                {isRegister && isOudleiding
                  ? '* Kleine letters, cijfers, punt, - of _. Hiermee log je later in.'
                  : isRegister
                    ? '* Verplicht met @ksa-aalter.be email adres'
                    : '* Leiding: je @ksa-aalter.be-adres. Oudleiding: je gebruikersnaam.'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">
                Wachtwoord
              </label>
              <input
                type="password"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                placeholder="••••••••"
                minLength={8}
              />
            </div>

            {isRegister && isOudleiding && (
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">
                  Code van Drankteam
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                  placeholder="Vraag de code aan Drankteam"
                />
              </div>
            )}

            {!isRegister && (
              <div className="flex items-center justify-between pt-2 px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-gray-300 dark:border-gray-600'}`}
                  >
                    {rememberMe && <span className="material-icons-round text-white text-xs">check</span>}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    Blijf ingelogd
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Wachtwoord vergeten?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : isRegister ? (
                'Account Aanmaken'
              ) : (
                'Inloggen'
              )}
            </button>
          </form>

          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setIsOudleiding(false);
              }}
              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {isRegister ? '← Terug naar inloggen' : 'Nog geen account? Registreer hier'}
            </button>
            {isRegister && (
              <button
                onClick={() => setIsOudleiding(!isOudleiding)}
                className="text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors"
              >
                {isOudleiding
                  ? 'Ik ben leiding (met @ksa-aalter.be)'
                  : 'Oudleiding zonder @ksa-aalter.be? Registreer met een code'}
              </button>
            )}
            <button
              onClick={() => navigate('/credits')}
              className="text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
            >
              Bekijk Credits
            </button>
            <p className="text-[10px] text-gray-300 dark:text-gray-600">Versie 1.0.1 (Build 2026.03)</p>
          </div>
        </div>
      </main>
    </div>
  );
};
