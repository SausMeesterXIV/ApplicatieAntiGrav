// Foto's in de Google Drive van KSA (edge function drive-fotos).
// De foto zelf gaat rechtstreeks van de gsm naar Google; Supabase start enkel de upload.
import { supabase } from './supabase';

async function roep(body) {
  const { data, error } = await supabase.functions.invoke('drive-fotos', { body });
  if (error) {
    let bericht = null;
    try {
      bericht = (await error.context.json()).error;
    } catch {
      // geen JSON-antwoord (bv. functie nog niet gedeployed)
    }
    throw new Error(bericht || "Foto's zijn nog niet beschikbaar (koppeling met Google Drive ontbreekt).");
  }
  return data;
}

/** Albums = mappen in de fotomap van KSA, nieuwste eerst: [{ id, naam, link, gemaakt }] */
export async function fetchAlbums() {
  return (await roep({ actie: 'albums' })).albums || [];
}

export async function maakAlbum(naam) {
  return (await roep({ actie: 'album-maken', naam })).album;
}

/** Eén foto of video uploaden naar een album. onVoortgang(0..1) */
export async function uploadFoto(albumId, file, onVoortgang) {
  const { uploadUrl } = await roep({
    actie: 'upload-starten',
    albumId,
    naam: file.name,
    type: file.type || 'image/jpeg',
    grootte: file.size,
  });

  // XMLHttpRequest i.p.v. fetch: enkel zo krijgen we de voortgang van de upload
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
    xhr.upload.onprogress = e => e.lengthComputable && onVoortgang?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload van ${file.name} mislukt`));
    xhr.onerror = () => reject(new Error(`Upload van ${file.name} mislukt (verbinding?)`));
    xhr.send(file);
  });
}
