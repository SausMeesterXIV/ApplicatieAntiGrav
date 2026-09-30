import React, { useEffect, useRef, useState } from 'react';
import * as db from '../lib/supabaseService';
import { showToast } from './Toast';
import { useAuth } from '../features/auth/AuthContext';
import { isHoofdleiding } from '../lib/roleUtils';

const grootte = bytes =>
  !bytes ? '' : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const icoon = mime =>
  mime?.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'picture_as_pdf' : 'description';

/**
 * Bestanden kiezen voor een item dat nog niet opgeslagen is (nog geen id).
 * De ouder uploadt ze na het opslaan met db.uploadBijlage.
 */
export const NieuweBijlagen = ({ bestanden, onChange }) => (
  <div className="space-y-2">
    {bestanden.map((file, i) => (
      <div
        key={`${file.name}-${i}`}
        className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2"
      >
        <span className="material-icons-round text-blue-600 dark:text-blue-400 text-lg">{icoon(file.type)}</span>
        <span className="text-sm font-medium truncate flex-1">{file.name}</span>
        <span className="text-[10px] text-gray-400 shrink-0">{grootte(file.size)}</span>
        <button
          onClick={() => onChange(bestanden.filter((_, j) => j !== i))}
          className="text-gray-400 hover:text-red-500"
          title="Weghalen"
        >
          <span className="material-icons-round text-lg">close</span>
        </button>
      </div>
    ))}
    <label className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 cursor-pointer">
      <span className="material-icons-round text-lg">attach_file</span>
      Bijlage toevoegen (max {db.MAX_BIJLAGE_MB} MB)
      <input
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          const gekozen = [...(e.target.files || [])];
          e.target.value = '';
          onChange([...bestanden, ...gekozen]);
        }}
      />
    </label>
  </div>
);

/** Een bijlage openen via een tijdelijke link (venster eerst openen: anders blokkeert iOS de pop-up). */
export async function openBijlage(bijlage) {
  const venster = window.open('', '_blank');
  try {
    const url = await db.bijlageLink(bijlage);
    if (venster) venster.location.href = url;
    else window.location.href = url;
  } catch (e) {
    venster?.close();
    showToast('Kon de bijlage niet openen', 'error');
  }
}

/**
 * Bijlagen van een agenda-item ({ eventId }) of verslag ({ verslagId }).
 * magBeheren: de gebruiker mag het item aanpassen (toevoegen en alle bijlagen verwijderen).
 */
export const Bijlagen = ({ item, magBeheren = false }) => {
  const { currentUser } = useAuth();
  const invoer = useRef(null);
  const [bijlagen, setBijlagen] = useState([]);
  const [bezig, setBezig] = useState(false);
  const sleutel = item.eventId || item.verslagId;

  useEffect(() => {
    let actief = true;
    db.fetchBijlagen(item)
      .then(data => actief && setBijlagen(data))
      .catch(e => console.warn('Bijlagen laden mislukt', e));
    return () => {
      actief = false;
    };
  }, [sleutel]); // item is telkens een nieuw object; de id volstaat

  const voegToe = async e => {
    const bestanden = [...(e.target.files || [])];
    e.target.value = '';
    if (!bestanden.length) return;
    setBezig(true);
    for (const file of bestanden) {
      try {
        const nieuw = await db.uploadBijlage(item, file);
        setBijlagen(prev => [...prev, nieuw]);
      } catch (err) {
        showToast(err.message || `Uploaden van ${file.name} mislukt`, 'error');
      }
    }
    setBezig(false);
  };

  const verwijder = async bijlage => {
    if (!window.confirm(`Bijlage "${bijlage.naam}" verwijderen?`)) return;
    try {
      await db.verwijderBijlage(bijlage);
      setBijlagen(prev => prev.filter(b => b.id !== bijlage.id));
    } catch {
      showToast('Verwijderen mislukt', 'error');
    }
  };

  const magVerwijderen = b => magBeheren || isHoofdleiding(currentUser) || b.geupload_door === currentUser?.id;

  if (!bijlagen.length && !magBeheren) return null;

  return (
    <div className="space-y-2">
      {bijlagen.map(b => (
        <div
          key={b.id}
          className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2"
        >
          <button onClick={() => openBijlage(b)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <span className="material-icons-round text-blue-600 dark:text-blue-400 text-lg">{icoon(b.mime)}</span>
            <span className="text-sm font-medium truncate text-gray-900 dark:text-white">{b.naam}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{grootte(b.grootte)}</span>
          </button>
          {magVerwijderen(b) && (
            <button onClick={() => verwijder(b)} className="text-gray-400 hover:text-red-500" title="Verwijderen">
              <span className="material-icons-round text-lg">close</span>
            </button>
          )}
        </div>
      ))}

      {magBeheren && (
        <>
          <input ref={invoer} type="file" multiple className="hidden" onChange={voegToe} />
          <button
            onClick={() => invoer.current?.click()}
            disabled={bezig}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-50"
          >
            <span className="material-icons-round text-lg">attach_file</span>
            {bezig ? 'Uploaden…' : `Bijlage toevoegen (max ${db.MAX_BIJLAGE_MB} MB)`}
          </button>
        </>
      )}
    </div>
  );
};
