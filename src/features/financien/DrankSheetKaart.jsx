import React, { useEffect, useState } from 'react';
import { showToast } from '../../components/Toast';
import { drankSheet } from '../../lib/drankSheet';

// Link naar de Google Sheet van Drankteam (edge function drank-sheet). Ze wordt bijgewerkt bij het openen.
export const DrankSheetKaart = () => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    drankSheet('url')
      .then(d => setUrl(d?.url || null))
      .catch(() => setUrl(null));
  }, []);

  if (!url) return null;

  const open = () => {
    window.open(url, '_blank', 'noopener');
    drankSheet('sync').catch(e => showToast(e.message, 'error'));
  };

  return (
    <button
      type="button"
      onClick={open}
      className="w-full flex items-center gap-3 bg-white dark:bg-[#1e2330] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-left"
    >
      <span className="material-icons-round text-xl text-gray-500">table_chart</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold">Google Sheet</span>
        <span className="block text-sm text-gray-500 truncate">Rekeningen, strepen en facturen van drank</span>
      </span>
      <span className="material-icons-round text-xl text-gray-400">open_in_new</span>
    </button>
  );
};
