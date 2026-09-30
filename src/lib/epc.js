// EPC-QR (SEPA-overschrijving, "BCD"-formaat v002) die bank-apps en Payconiq kunnen scannen.
// De Belgische gestructureerde mededeling (+++123/4567/89012+++) gaat in het vrije mededelingsveld;
// dat is hoe de meeste Belgische bank-apps ze herkennen.

export const normaliseerIban = iban => String(iban || '').replace(/\s+/g, '').toUpperCase();

export const formatIban = iban => normaliseerIban(iban).replace(/(.{4})/g, '$1 ').trim();

export function epcPayload({ naam, iban, bic = '', bedrag, mededeling }) {
  const regels = [
    'BCD',
    '002',
    '1',
    'SCT',
    String(bic || '').trim(),
    String(naam || '').trim().slice(0, 70),
    normaliseerIban(iban),
    `EUR${Number(bedrag).toFixed(2)}`,
    '', // purpose
    '', // gestructureerde referentie volgens ISO 11649 (RF…): niet gebruikt
    String(mededeling || '').slice(0, 140),
  ];
  return regels.join('\n');
}
