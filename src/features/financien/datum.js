// Datums in Financiën ('YYYY-MM-DD' of een tijdstip) als korte Belgische tekst.
export const datumKort = d =>
  d
    ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
