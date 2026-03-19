import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

export const ResetPasswordScreen: React.FC = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            // Supabase stuurt dit event als je via een herstel-link binnenkomt
            if (event === 'PASSWORD_RECOVERY') {
                console.log('Wachtwoord herstelmodus actief');
            } else if (event === 'SIGNED_OUT') {
                navigate('/login');
            }
        });

        // Check of we een sessie hebben (de link logt je tijdelijk in)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && mounted) {
                // Als er geen sessie is, is de link ongeldig of verlopen
                navigate('/login');
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [navigate]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Dit werkt enkel omdat de gebruiker via de mail-link tijdelijk geauthenticeerd is
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            showToast('Wachtwoord succesvol gewijzigd!', 'success');
            navigate('/');
        } catch (error: any) {
            showToast(error.message || 'Fout bij het resetten van wachtwoord', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen pt-[env(safe-area-inset-top,0px)] bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="w-full max-w-sm space-y-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/20 flex items-center justify-center mb-6">
                            <span className="material-icons-round text-4xl text-white">lock_reset</span>
                        </div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Nieuw Wachtwoord</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Kies een nieuw, veilig wachtwoord voor je account.
                        </p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Nieuw Wachtwoord</label>
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
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center"
                        >
                            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Wachtwoord Opslaan'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};
