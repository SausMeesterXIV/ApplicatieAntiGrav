import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/Modal';
import { showToast } from '../../components/Toast';

// Wachtwoord wijzigen voor de ingelogde gebruiker
export const WachtwoordWijzigen = ({ isOpen, onClose }) => {
  const [nieuw, setNieuw] = useState('');
  const [herhaal, setHerhaal] = useState('');
  const [bezig, setBezig] = useState(false);

  const sluit = () => {
    setNieuw('');
    setHerhaal('');
    onClose();
  };

  const opslaan = async () => {
    if (nieuw.length < 8) return showToast('Kies een wachtwoord van minstens 8 tekens', 'warning');
    if (nieuw !== herhaal) return showToast('De wachtwoorden zijn niet gelijk', 'warning');
    setBezig(true);
    const { error } = await supabase.auth.updateUser({ password: nieuw });
    setBezig(false);
    if (error) return showToast('Wijzigen mislukt: ' + error.message, 'error');
    showToast('Wachtwoord gewijzigd', 'success');
    sluit();
  };

  return (
    <Modal isOpen={isOpen} onClose={sluit} title="Wachtwoord wijzigen">
      <div className="space-y-3">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nieuw wachtwoord (min. 8 tekens)"
          value={nieuw}
          onChange={e => setNieuw(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Herhaal nieuw wachtwoord"
          value={herhaal}
          onChange={e => setHerhaal(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        />
        <button onClick={opslaan} disabled={bezig} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">
          {bezig ? 'Opslaan…' : 'Wachtwoord opslaan'}
        </button>
      </div>
    </Modal>
  );
};
