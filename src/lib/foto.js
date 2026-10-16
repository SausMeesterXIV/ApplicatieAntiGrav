// Foto's verkleinen vóór het uploaden: een gsm-foto is vaak 4-8 MB, verkleind (max. 2000 px, JPEG) een paar
// honderd kB en nog perfect leesbaar. PDF's en bestanden die niet als afbeelding te laden zijn, blijven ongewijzigd.

export const MAX_FOTO_MB = 10;

export async function verkleinFoto(file, maxZijde = 2000, kwaliteit = 0.82) {
  if (!file || !file.type?.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const schaal = Math.min(1, maxZijde / Math.max(bitmap.width, bitmap.height));
    if (schaal === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * schaal);
    canvas.height = Math.round(bitmap.height * schaal);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', kwaliteit));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // bv. HEIC in een browser die dat niet kan lezen: dan het origineel
  }
}
