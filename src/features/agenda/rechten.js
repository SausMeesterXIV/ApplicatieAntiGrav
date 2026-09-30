import { hasRecht, isHoofdleiding } from '../../lib/roleUtils';

// Zelfde regels als de RLS op events (migratie 20261001001400):
// iedereen maakt items; aanpassen: maker + agenda_beheren (Sfeerbeheer, hoofdleiding); verwijderen: maker + hoofdleiding.

export const magEventAanpassen = (user, event) =>
  !!user && (event.createdBy === user.id || hasRecht(user, 'agenda_beheren'));

export const magEventVerwijderen = (user, event) => !!user && (event.createdBy === user.id || isHoofdleiding(user));
