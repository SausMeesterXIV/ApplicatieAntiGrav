import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlbums, maakAlbum, uploadFoto } from '../../lib/driveFotos';
import { ChevronBack } from '../../components/ChevronBack';
import { showToast } from '../../components/Toast';

// Foto's: albums (mappen) in de Google Drive van KSA, waar ook het cameraatje naartoe uploadt.
// Bekijken gebeurt in Drive zelf (daar staan ook de rechten); via de app kan leiding foto's toevoegen.

const datumTekst = d => new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });

export const FotosScreen = () => {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [upload, setUpload] = useState(null); // { albumId, nr, totaal, voortgang }
  const invoer = useRef(null);
  const doelAlbum = useRef(null);

  const laad = async () => {
    setLaden(true);
    try {
      setAlbums(await fetchAlbums());
      setFout(null);
    } catch (e) {
      setFout(e.message);
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    laad();
  }, []);

  const nieuwAlbum = async () => {
    const naam = window.prompt('Naam van het nieuwe album, bv. "Weekend Sim november 2026"');
    if (!naam?.trim()) return;
    try {
      const album = await maakAlbum(naam);
      // Nieuw album net onder de hoofdmap
      setAlbums(prev => [...prev.filter(a => a.hoofdmap), album, ...prev.filter(a => !a.hoofdmap)]);
      showToast('Album gemaakt', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const kiesFotos = album => {
    if (upload) return;
    doelAlbum.current = album;
    invoer.current?.click();
  };

  const verstuur = async e => {
    const bestanden = [...(e.target.files || [])];
    e.target.value = '';
    const album = doelAlbum.current;
    if (!bestanden.length || !album) return;

    let gelukt = 0;
    for (let i = 0; i < bestanden.length; i++) {
      setUpload({ albumId: album.id, nr: i + 1, totaal: bestanden.length, voortgang: 0 });
      try {
        await uploadFoto(album.id, bestanden[i], v => setUpload(u => u && { ...u, voortgang: v }));
        gelukt++;
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    setUpload(null);
    if (gelukt)
      showToast(`${gelukt} ${gelukt === 1 ? 'bestand' : 'bestanden'} toegevoegd aan "${album.naam}"`, 'success');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-xl font-bold flex-1">Foto's</h1>
          {!fout && (
            <button
              onClick={nieuwAlbum}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1"
            >
              <span className="material-icons-round text-base">create_new_folder</span> Nieuw album
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-3">
        <p className="text-xs text-gray-500">
          De foto's staan in de Google Drive van KSA, samen met die van het cameraatje. Tik op een album om het in Drive
          te openen. Voeg enkel foto's toe die gedeeld mogen worden (toestemming ouders).
        </p>

        {upload && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Uploaden {upload.nr} van {upload.totaal}… Laat de app open.
            </p>
            <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.round(upload.voortgang * 100)}%` }}
              />
            </div>
          </div>
        )}

        {laden && <p className="text-center text-sm text-gray-500 py-6">Laden…</p>}
        {!laden && fout && (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-gray-500">{fout}</p>
            <button onClick={laad} className="text-sm font-bold text-blue-600">
              Opnieuw proberen
            </button>
          </div>
        )}
        {!laden && !fout && albums.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">Nog geen albums. Maak er een met "Nieuw album".</p>
        )}

        <input ref={invoer} type="file" accept="image/*,video/*" multiple className="hidden" onChange={verstuur} />

        {albums.map(album => (
          <div
            key={album.id}
            className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3"
          >
            <a
              href={album.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 flex-1 min-w-0"
              title="Openen in Google Drive"
            >
              <span className="material-icons-round text-amber-500 text-3xl">
                {album.hoofdmap ? 'folder_special' : 'photo_library'}
              </span>
              <div className="min-w-0">
                <p className="font-semibold truncate">{album.naam}</p>
                <p className="text-xs text-gray-500">
                  {album.hoofdmap ? "Hoofdmap: alle foto's en albums" : datumTekst(album.gemaakt)}
                </p>
              </div>
            </a>
            <button
              onClick={() => kiesFotos(album)}
              disabled={!!upload}
              className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              <span className="material-icons-round text-base">add_photo_alternate</span>
              {upload?.albumId === album.id ? 'Bezig…' : 'Toevoegen'}
            </button>
          </div>
        ))}
      </main>
    </div>
  );
};
