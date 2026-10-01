// Foutmeldingen van Supabase Auth (Engels) omzetten naar duidelijke Nederlandse tekst.
// Inloggen geeft bewust dezelfde melding voor een onbestaand adres en een fout wachtwoord.

const VERTALINGEN = [
  [/invalid_credentials|invalid login credentials/i, 'E-mailadres of wachtwoord klopt niet.'],
  [
    /email_not_confirmed|email not confirmed/i,
    'Bevestig eerst je e-mailadres via de link in je mailbox (kijk ook in spam).',
  ],
  [
    /user_already_exists|already registered|already been registered/i,
    "Er bestaat al een account met dit e-mailadres. Log in of kies 'Wachtwoord vergeten'.",
  ],
  [
    /weak_password|password should be at least|password.*(short|characters)/i,
    'Kies een wachtwoord van minstens 8 tekens.',
  ],
  [/same_password|should be different from the old/i, 'Kies een ander wachtwoord dan je huidige.'],
  [
    /rate.?limit|too many requests|over_.*_rate_limit|for security purposes/i,
    'Te veel pogingen na elkaar. Wacht even en probeer opnieuw.',
  ],
  [/database error saving new user|ksa-aalter/i, 'Registreren kan enkel met een @ksa-aalter.be-adres.'],
  [/email.*invalid|invalid.*email|validation_failed/i, 'Dat e-mailadres is niet geldig.'],
  [/otp_expired|expired|invalid.*token|token.*invalid/i, 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.'],
  [/failed to fetch|network|load failed/i, 'Geen verbinding. Controleer je internet en probeer opnieuw.'],
];

/** Nederlandse foutmelding voor een fout van supabase.auth (of een standaardtekst). */
export function authFout(fout, standaard = 'Er ging iets mis. Probeer opnieuw.') {
  const tekst = `${fout?.code || ''} ${fout?.error_code || ''} ${fout?.message || fout || ''}`;
  if (fout?.status === 429) return VERTALINGEN.find(([p]) => p.test('rate limit'))[1];
  return VERTALINGEN.find(([patroon]) => patroon.test(tekst))?.[1] || standaard;
}
