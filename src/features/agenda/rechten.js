import { hasRecht, isHoofdleiding } from '../../lib/roleUtils';

// Zelfde regels als de RLS op events (migraties 20261001001400 en 20261001004000):
// maken: agenda_beheren (Sfeerbeheer, hoofdleiding); aanpassen: maker + agenda_beheren; verwijderen: maker + hoofdleiding.

export const magEventMaken = user => hasRecht(user, 'agenda_beheren');

export const magEventAanpassen = (user, event) =>
  !!user && (event.createdBy === user.id || hasRecht(user, 'agenda_beheren'));

export const magEventVerwijderen = (user, event) => !!user && (event.createdBy === user.id || isHoofdleiding(user));
