import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

export const CredentialsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [naam, setNaam] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Validatie logica
  const TEST_EMAIL = 'it.takes.jaguarke@gmail.com';
  const REQUIRED_DOMAIN = '@ksa-aalter.be';

  const isValidEmailDomain = (emailAddr: string) => {
    const cleanedEmail = emailAddr.trim().toLowerCase();
    return cleanedEmail.endsWith(REQUIRED_DOMAIN) || cleanedEmail === TEST_EMAIL;
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showToast('Vul eerst je email in om een reset link te ontvangen.', 'error');
      return;
    }
    
    if (!isValidEmailDomain(email)) {
      showToast(`Gebruik een geldig ${REQUIRED_DOMAIN} adres.`, 'error');
      return;
    }

    setLoading(true);
    try {
      // Gebruik een robuuste redirect URL voor zowel web als mobiel
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://applicatieantigrav.vercel.app/reset-password',
      });
      if (error) throw error;
      showToast('Wachtwoord reset link verstuurd naar je email!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Fout bij het versturen van de reset link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmailDomain(email)) {
      showToast(`Inloggen mislukt: gebruik je ${REQUIRED_DOMAIN} email.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Check if account is active
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('actief')
          .eq('id', data.user.id)
          .single();

        if (profile && profile.actief === false) {
          await supabase.auth.signOut();
          showToast('Sorry, je account is gedeactiveerd. Voor verdere vragen moet je bij de hoofdleiding zijn!', 'error');
          return;
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Fout bij het inloggen', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naam.trim()) {
      showToast('Vul je naam in', 'error');
      return;
    }

    if (!isValidEmailDomain(email)) {
      showToast(`Registreren verplicht met een ${REQUIRED_DOMAIN} email adres.`, 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            naam: naam.trim(),
            full_name: naam.trim(),
            display_name: naam.trim()
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([{
            id: data.user.id,
            naam: naam.trim(),
            name: naam.trim(),
            email: email,
            rol: 'standaard',
            actief: true,
          }], { onConflict: 'id' });

        if (profileError) {
          console.error('Profile creation/update error:', profileError);
        }
      }

      showToast('Account aangemaakt! Je bent nu ingelogd.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Fout bij het registreren', 'error');
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
              {isRegister ? 'Maak een nieuw account aan' : 'Log in om verder te gaan'}
            </p>
          </div>

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Naam</label>
                <input
                  type="text"
                  required
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                  placeholder="Voornaam Achternaam"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                placeholder="voornaam.achternaam@ksa-aalter.be"
              />
              {/* Visuele hint voor de gebruiker */}
              <p className="mt-2 ml-1 text-[10px] text-gray-400 dark:text-gray-500 italic">
                * Verplicht met @ksa-aalter.be email adres
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Wachtwoord</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {!isRegister && (
              <div className="flex items-center justify-between pt-2 px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-gray-300 dark:border-gray-600'}`}>
                    {rememberMe && <span className="material-icons-round text-white text-xs">check</span>}
                  </div>
                  <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Blijf ingelogd</span>
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
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : (isRegister ? 'Account Aanmaken' : 'Inloggen')}
            </button>
          </form>

          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {isRegister ? '← Terug naar inloggen' : 'Nog geen account? Registreer hier'}
            </button>
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
