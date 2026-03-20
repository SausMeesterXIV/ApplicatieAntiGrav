import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as db from '../lib/supabaseService';
import { showToast } from '../components/Toast';
import { hapticSuccess } from '../lib/haptics';

export const NewMessageScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, users } = useAuth();
  
  // State
  const [targetType, setTargetType] = useState<'individual' | 'group'>('group');
  const [selectedGroup, setSelectedGroup] = useState('leaders');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
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

    // Gebruik setTimeout om de UI de kans te geven de 'isSending' status te tekenen
    setTimeout(async () => {
      try {
        const senderId = currentUser?.id || '';
        const senderName = isOfficial ? 'KSA Aalter' : (currentUser?.naam || 'Leiding');
        
        let recipientIds: string[] = [];
        
        if (targetType === 'group') {
          if (selectedGroup === 'everyone') recipientIds = ['all'];
          else if (selectedGroup === 'leaders') recipientIds = users.map(u => u.id);
          else if (selectedGroup === 'admins') recipientIds = users.filter(u => u.rol === 'hoofdleiding' || u.rol === 'godmode').map(u => u.id);
          else recipientIds = ['all'];
        } else {
          recipientIds = selectedUsers;
        }

        // Verstuur meldingen in kleine batches om de browser niet te bevriezen
        const promises = recipientIds.map(id => 
          db.addNotificatie(senderId, id, subject, content, senderName, '')
        );

        await Promise.all(promises);
        
        hapticSuccess();
        showToast('Bericht succesvol verzonden!', 'success');
        navigate(-1);
      } catch (error: any) {
        console.error('Send error:', error);
        showToast('Fout bij verzenden', 'error');
        setIsSending(false);
      }
    }, 10); // 10ms vertraging is genoeg om INP te voorkomen
  };

  const recipientCount = targetType === 'group' ? (selectedGroup === 'everyone' ? users.length : 'Groep') : selectedUsers.length;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500">
          <span className="material-icons-round text-2xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">Nieuw Bericht</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl mb-3 border border-gray-200 dark:border-gray-700 shadow-sm">
            <button onClick={() => setTargetType('individual')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${targetType === 'individual' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>Individueel</button>
            <button onClick={() => setTargetType('group')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${targetType === 'group' ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>Groep</button>
          </div>

          {targetType === 'group' ? (
            <div className="relative">
              <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="w-full bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white appearance-none focus:outline-none focus:border-blue-500 shadow-sm">
                <option value="everyone">Iedereen (Actief)</option>
                <option value="leaders">Alle Leiding</option>
                <option value="admins">Hoofdleiding</option>
                <option value="debtors">Openstaande rekening</option>
              </select>
              <span className="material-icons-round absolute right-3 top-3.5 text-gray-400 pointer-events-none">expand_more</span>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1 shadow-sm">
              {users.map(user => (
                <div key={user.id} onClick={() => toggleUser(user.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${selectedUsers.includes(user.id) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="text-sm font-medium">{user.naam}</span>
                  {selectedUsers.includes(user.id) && <span className="material-icons-round text-sm">check</span>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 ml-1">Ontvangers: <span className="font-bold">{recipientCount}</span></p>
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
          disabled={isSending}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          {isSending ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span className="material-icons-round">send</span>
              <span>Versturen</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};