// Vercel-functie: houdt het gratis Supabase-project wakker (pauzeert anders na 7 dagen zonder gebruik).
// Wordt dagelijks aangeroepen door de cron in vercel.json. Roept enkel public.ping() aan (geeft de tijd terug).
// Gebruikt de omgevingsvariabelen die de app op Vercel al heeft: VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY.
// Optioneel: zet CRON_SECRET op Vercel, dan kan enkel Vercel's eigen cron deze functie aanroepen.

export default async function handler(req, res) {
  const geheim = process.env.CRON_SECRET;
  if (geheim && req.headers.authorization !== `Bearer ${geheim}`) {
    return res.status(401).json({ ok: false, fout: 'Niet toegestaan' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const sleutel = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !sleutel) {
    return res.status(500).json({ ok: false, fout: 'VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt op Vercel' });
  }

  try {
    const antwoord = await fetch(`${url}/rest/v1/rpc/ping`, {
      method: 'POST',
      headers: { apikey: sleutel, Authorization: `Bearer ${sleutel}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.status(antwoord.ok ? 200 : 502).json({ ok: antwoord.ok, status: antwoord.status, tijd: await antwoord.json() });
  } catch (e) {
    return res.status(502).json({ ok: false, fout: String(e?.message || e) });
  }
}
