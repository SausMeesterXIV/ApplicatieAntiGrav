import { supabase } from './supabase';

// Google Sheet voor Drankteam (edge function drank-sheet): enkel lezen, de app is de bron.
/** actie: 'url' (link of null) | 'sync' (Sheet opnieuw vullen) */
export async function drankSheet(actie) {
  const { data, error } = await supabase.functions.invoke('drank-sheet', { body: { actie } });
  if (error) {
    let bericht = null;
    try {
      bericht = (await error.context.json()).error;
    } catch {
      // geen JSON-antwoord (bv. functie nog niet gedeployed)
    }
    throw new Error(bericht || 'De Google Sheet is niet bereikbaar.');
  }
  return data;
}
