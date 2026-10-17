// Tekst uit een PDF halen (in de browser, met pdf.js), als regels van boven naar onder.
// pdf.js is groot, dus we laden het pas als iemand een PDF kiest.

/** Geeft per pagina de regels: stukjes tekst op dezelfde hoogte worden van links naar rechts samengevoegd. */
export async function pdfRegels(file) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const regels = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const inhoud = await (await pdf.getPage(n)).getTextContent();
    const stukken = inhoud.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], tekst: i.str.trim() }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    let huidig = null;
    for (const s of stukken) {
      // Zelfde regel als het hoogteverschil klein is (bv. "EUR" iets hoger naast het bedrag)
      if (huidig && Math.abs(huidig.y - s.y) <= 4) huidig.delen.push(s);
      else regels.push((huidig = { y: s.y, delen: [s] }));
    }
  }
  return regels.map(r => r.delen.sort((a, b) => a.x - b.x).map(d => d.tekst).join(' ').replace(/\s+/g, ' '));
}
