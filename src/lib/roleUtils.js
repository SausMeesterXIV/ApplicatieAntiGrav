export const hasRole = (user, roleName) => {
  if (!user) return false;

  const primaryRole = (user.rol || '').toLowerCase();
  const extraRoles = (user.roles || []).map(r => r.toLowerCase());

  // Godmode heeft overal toegang
  if (primaryRole === 'godmode' || extraRoles.includes('godmode')) return true;

  // Normaliseer de check (bijv. 'team_drank' en 'drank' naar 'drank')
  const check = roleName.toLowerCase();

  // Helper om te kijken of een rol aanwezig is in de lijst of het hoofdveld
  const matches = r => {
    if (primaryRole === r) return true;
    if (extraRoles.includes(r)) return true;
    // Check ook variaties met underscores (team_drank vs team drank)
    if (primaryRole.replace('_', ' ') === r.replace('_', ' ')) return true;
    return false;
  };

  // Hoofdleiding / Admin checks
  if (check === 'hoofdleiding' || check === 'admin') {
    return matches('hoofdleiding') || matches('admin') || primaryRole === 'admin';
  }

  // Specifieke team checks
  if (check === 'drank') return matches('drank') || matches('team_drank') || matches('team drank');
  if (check === 'financiën') return matches('financiën') || matches('financien');

  // Algemene check voor de rest
  return matches(check);
};

export const isHoofdleiding = user => {
  return hasRole(user, 'hoofdleiding');
};

// Helper om te checken of een user rechten heeft (hoofdleiding en godmode hebben altijd true)
export const hasAccess = (user, requiredRole) => {
  if (!user) return false;
  const mainRol = String(user.rol || '').toLowerCase();
  if (mainRol === 'hoofdleiding' || mainRol === 'godmode') return true;

  const req = requiredRole.toLowerCase();
  if (mainRol.includes(req)) return true;

  // Check ook in de array van extra rollen
  if (user.roles && user.roles.some(r => String(r).toLowerCase().includes(req))) return true;

  return false;
};
