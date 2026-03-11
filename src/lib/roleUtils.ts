import { User } from '../types';

/**
 * Checks if a user has administrative or team-specific permissions.
 * This helper centralizes the logic to handle role name variations (e.g., 'team_drank' vs 'team drank').
 */
export const hasRole = (user: User | null | undefined, roleName: 'admin' | 'drank' | 'sfeerbeheer'): boolean => {
  if (!user) return false;

  // Global Admin always has access
  if (user.rol === 'admin' || user.rol === 'godmode' || (user.roles || []).includes('Hoofdleiding')) {
    return true;
  }

  const normalizedRoles = (user.roles || []).map((r: string) => r.toLowerCase());

  switch (roleName) {
    case 'admin':
      // Handled above, but explicit check here too
      return false; 
    case 'drank':
      return (
        user.rol === 'team_drank' || 
        user.rol === 'team drank' || 
        normalizedRoles.includes('drank') || 
        normalizedRoles.includes('team drank')
      );
    case 'sfeerbeheer':
      return (
        user.rol === 'sfeerbeheer' || 
        normalizedRoles.includes('sfeerbeheer')
      );
    default:
      return false;
  }
};
