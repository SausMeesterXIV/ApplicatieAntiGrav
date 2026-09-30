import { useEffect, useState } from 'react';
import * as db from '../../lib/supabaseService';

// Kastickets staan in een privé-bucket: vraag een tijdelijke link aan en geef die door aan children(url).
export const Kasticket = ({ receiptUrl, children }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let actief = true;
    setUrl(null);
    db.kasticketLink(receiptUrl)
      .then(link => actief && setUrl(link))
      .catch(err => console.warn('Kasticket laden mislukt', err));
    return () => {
      actief = false;
    };
  }, [receiptUrl]);

  return url ? children(url) : null;
};
