import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { hapticSuccess } from '../lib/haptics';
import { hasRole } from '../lib/roleUtils';

export const NewMessageScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, users, availableRoles } = useAuth();
  
  type TargetType = 'individual' | 'group' | 'team' | 'balance';

  // State
  const [targetType, setTargetType] = useState<TargetType>('individual');
  const [selectedTarget, setSelectedTarget] = useState<string>(''); // Voor de specifieke groep of team
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // Voor individuele selectie
  const [recipientCount, setRecipientCount] = useState(0);
  
  // Splits de rollen op voor de UI
  const groepen = useMemo(() => availableRoles.filter(r => r.category === 'Groep'), [availableRoles]);
  const teams = useMemo(() => availableRoles.filter(r => r.category === 'Team' || r.category === 'Bestuur'), [availableRoles]);

  // Effect om het aantal ontvangers te berekenen
  useEffect(() => {
    const calculateRecipients = async () => {
      let count = 0;
      if (targetType === 'individual') {
        count = selectedUsers.length;
      } else if (targetType === 'group') {
        count = selectedTarget 
          ? users.filter(u => (u.roles || []).includes(selectedTarget)).length 
          : 0;
      } else if (targetType === 'team') {
        count = selectedTarget 
          ? users.filter(u => hasRole(u, selectedTarget as any)).length 
          : 0;
      } else if (targetType === 'balance') {
        try {
          const allBalances = await db.fetchAllBalances();
          count = users.filter(u => (allBalances[u.id] || 0) > 0).length;
        } catch (e) {
          count = 0;
        }
      }
      setRecipientCount(count);
    };

    calculateRecipients();
  }, [targetType, selectedTarget, selectedUsers, users]);
  const [isOfficial, setIsOfficial] = useState(true);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      showToast('Vul een onderwerp en bericht in', 'error');
      return;
    }

    if (targetType === 'individual' && selectedUsers.length === 0) {
      showToast('Selecteer minimaal één ontvanger', 'error');
      return;
    }

    setIsSending(true);

    setTimeout(async () => {
      try {
        const senderId = currentUser?.id || '';
        const senderName = isOfficial ? 'KSA Aalter' : (currentUser?.naam || 'Leiding');
        let recipientIds: string[] = [];

        // BEPALEN VAN DE ONTVANGERS
        if (targetType === 'individual') {
          recipientIds = selectedUsers;
        } else if (targetType === 'group') {
          // Filter op specifieke leidingsgroep (Pagadders, etc.)
          recipientIds = users
            .filter(u => (u.roles || []).includes(selectedTarget))
            .map(u => u.id);
        } else if (targetType === 'team') {
          // Filter op team/rol via de hasRole utility
          recipientIds = users
            .filter(u => hasRole(u, selectedTarget))
            .map(u => u.id);
        } else if (targetType === 'balance') {
          // Iedereen met een rekening > 0
          const allBalances = await db.fetchAllBalances();
          recipientIds = users
            .filter(u => (allBalances[u.id] || 0) > 0)
            .map(u => u.id);
        }

        if (recipientIds.length === 0) {
          showToast('Geen ontvangers gevonden voor deze selectie', 'error');
          setIsSending(false);
          return;
        }

        // Versturen
        const promises = recipientIds.map(id => 
          db.addNotificatie(senderId, id, subject, content, senderName, '', isOfficial ? 'official' : 'official')
        );

        await Promise.all(promises);
        
        hapticSuccess();
        showToast('Bericht succesvol verzonden!', 'success');
        navigate(-1);
      } catch (error) {
        showToast('Fout bij verzenden', 'error');
        setIsSending(false);
      }
    }, 10);
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500">
          <span className="material-icons-round text-2xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">Nieuw Bericht</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="space-y-4 mb-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Type Ontvanger</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'individual', label: 'Individueel', icon: 'person' },
              { id: 'group', label: 'Leidingsgroep', icon: 'groups' },
              { id: 'team', label: 'Teams', icon: 'engineering' },
              { id: 'balance', label: 'Open Rekening', icon: 'payments' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTargetType(t.id as TargetType); setSelectedTarget(''); }}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${targetType === t.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-[#1e293b] text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-800'}`}
              >
                <span className="material-icons-round text-lg">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Conditionele invoer op basis van selectie */}
          {targetType === 'group' && (
            <div className="relative mt-3">
              <select 
                value={selectedTarget} 
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="">Kies een groep...</option>
                {groepen.map((g: any) => <option key={g.id} value={g.label}>{g.label}</option>)}
              </select>
              <span className="material-icons-round absolute right-3 top-3.5 text-gray-400 pointer-events-none">expand_more</span>
            </div>
          )}

          {targetType === 'team' && (
            <div className="relative mt-3">
              <select 
                value={selectedTarget} 
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:border-blue-500 shadow-sm"
              >
                <option value="">Kies een team...</option>
                {teams.map((t: any) => <option key={t.id} value={t.label}>{t.label}</option>)}
              </select>
              <span className="material-icons-round absolute right-3 top-3.5 text-gray-400 pointer-events-none">expand_more</span>
            </div>
          )}

          {targetType === 'balance' && (
            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 mt-3 rounded-xl border border-amber-100 dark:border-amber-900/30 animate-in fade-in slide-in-from-top-1">
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-widest">Informatie</p>
              <p className="text-xs text-amber-800 dark:text-amber-200">Dit bericht wordt gestuurd naar iedereen die momenteel een negatieve balans heeft.</p>
            </div>
          )}

          {/* PREVIEW BADGE */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 animate-in fade-in duration-300 mt-4">
            <span className="material-icons-round text-blue-600 text-sm">info</span>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Dit bericht wordt verzonden naar <span className="font-bold">{recipientCount}</span> {recipientCount === 1 ? 'persoon' : 'personen'}.
            </p>
          </div>

          {targetType === 'individual' && (
            <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1 shadow-sm mt-3 custom-scrollbar">
              {users.map(user => (
                <div key={user.id} onClick={() => toggleUser(user.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedUsers.includes(user.id) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="text-sm font-medium">{user.naam}</span>
                  {selectedUsers.includes(user.id) && <span className="material-icons-round text-sm">check</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Onderwerp" className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
          <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Bericht..." className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none shadow-sm" />
        </section>

        <div onClick={() => setIsOfficial(!isOfficial)} className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all shadow-sm ${isOfficial ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-gray-800'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOfficial ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
            <span className="material-icons-round text-xl">security</span>
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-sm ${isOfficial ? 'text-blue-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>Versturen als Hoofdleiding</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Wordt verzonden onder de naam 'KSA Aalter'.</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isOfficial ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
            {isOfficial && <span className="material-icons-round text-white text-[10px]">check</span>}
          </div>
        </div>
      </main>

      <footer className="p-4 bg-gray-50 dark:bg-[#0f172a] border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={handleSend}
          disabled={isSending || recipientCount === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {isSending ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Verstuur Bericht</span>
              <span className="material-icons-round">send</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};