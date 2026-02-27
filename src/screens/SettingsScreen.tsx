import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { User } from '../types';
import { AppContextType } from '../App';
import { supabase } from '../lib/supabase';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useOutletContext<AppContextType>();

  const onUpdateUser = async (user: User) => {
    setCurrentUser(user);
    try {
      await db.updateProfile(user.id, {
        naam: user.naam,
        rol: user.rol as string,
        avatar_url: user.avatar,
        nickname: user.nickname
      });
    } catch (e) {
      console.error('Failed to sync profile:', e);
    }
  };
  const [isDark, setIsDark] = useState(false);
  const [nickname, setNickname] = useState(currentUser.nickname || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNickname(currentUser.nickname || '');
    setAvatar(currentUser.avatar);
  }, [currentUser]);

  useEffect(() => {
    // Sync local state with the actual class on html element (applied in App.tsx)
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(newIsDark);
    localStorage.setItem('dark_mode', String(newIsDark));
  };

  const handleSaveNickname = () => {
    onUpdateUser({ ...currentUser, nickname });
    alert('Bijnaam opgeslagen!');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await db.uploadAvatar(currentUser.id, file);
      setAvatar(publicUrl);
      setCurrentUser({ ...currentUser, avatar: publicUrl });
      showToast('Profielfoto opgeslagen!', 'success');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      // Fallback: show local preview even if upload fails
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatar(result);
      };
      reader.readAsDataURL(file);
      showToast('Foto kon niet worden geüpload. Probeer opnieuw.', 'error');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] pb-24 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-4 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Instellingen</h1>
        </div>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <section className="p-6 flex flex-col items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e2330]/30 transition-colors">
          <div className="relative mb-4 group cursor-pointer" onClick={triggerFileInput}>
            <div className="w-24 h-24 rounded-full border-4 border-blue-100 dark:border-blue-900/50 p-1 overflow-hidden relative">
              <img src={avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
            </div>
            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              onClick={(e) => e.stopPropagation()}
            />
            <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-gray-50 dark:border-[#0f172a] transition-transform active:scale-95 group-hover:scale-110">
              <span className="material-icons-round text-sm block">edit</span>
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{currentUser.nickname || currentUser.name}</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">KSA Aalter</p>
        </section>

        {/* Profile Form */}
        <section className="p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1">Profiel</h3>
          <div className="bg-white dark:bg-[#1e2330] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Naam (Niet aanpasbaar)</label>
              <input
                type="text"
                value={currentUser.name}
                disabled
                className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Bijnaam</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Kies een bijnaam..."
                  className="flex-1 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  onClick={handleSaveNickname}
                  className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                  Opslaan
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Deze naam wordt getoond aan andere leiding.</p>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="p-4 pt-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1">Jouw Rollen</h3>
          <div className="flex flex-wrap gap-2">
            {currentUser.roles && currentUser.roles.length > 0 ? (
              currentUser.roles.map(role => (
                <span key={role} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                  <span className="material-icons-round text-lg mr-1.5">verified</span>
                  {role}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500 italic px-1">Geen speciale rollen toegewezen.</span>
            )}
          </div>
        </section>

        {/* Toggles */}
        <section className="px-4 py-2 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-1">Voorkeuren</h3>
            <div className="bg-white dark:bg-[#1e2330] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors">
              {/* Dark Mode */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className="material-icons-round text-blue-600 dark:text-blue-500">dark_mode</span>
                  <span className="font-medium text-gray-900 dark:text-white">Donkere Weergave</span>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out focus:outline-none ${isDark ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Notifications */}
              <button className="w-full flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="material-icons-round text-blue-600 dark:text-blue-500">notifications</span>
                  <span className="font-medium text-gray-900 dark:text-white">Meldingen</span>
                </div>
                <span className="material-icons-round text-gray-400">chevron_right</span>
              </button>

              {/* Credits & Poem */}
              <button
                onClick={() => navigate('/credits')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-icons-round text-blue-600 dark:text-blue-500">auto_awesome</span>
                  <span className="font-medium text-gray-900 dark:text-white">Credits</span>
                </div>
                <span className="material-icons-round text-gray-400">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
          >
            <span className="material-icons-round">logout</span>
            Uitloggen
          </button>
        </section>
      </main>
    </div>
  );
};