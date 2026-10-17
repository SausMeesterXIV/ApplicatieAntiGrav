// Demomodus: kleine hulpfuncties die zowel de testdata als de nep-database gebruiken.

/** Belgische gestructureerde mededeling uit een volgnummer (zelfde als gestructureerde_mededeling in de database) */
export function mededelingVan(nummer) {
  const b = String(nummer % 1e10).padStart(10, '0');
  const c = Number(BigInt(b) % 97n) || 97;
  return `+++${b.slice(0, 3)}/${b.slice(3, 7)}/${b.slice(7)}${String(c).padStart(2, '0')}+++`;
}

export const rond = n => Math.round(n * 100) / 100;
