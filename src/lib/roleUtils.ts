import { User } from '../types';

/**
 * Checks if a user has administrative or team-specific permissions.
 * This helper centralizes the logic to handle role name variations (e.g., 'team_drank' vs 'team drank').
 */
export const hasRole = (user: User | null | undefined, roleName: 'admin' | 'drank' | 'sfeerbeheer' | 'hoofdleiding'): boolean => {
  if (!user) return false;

  const roles = user.roles || [];
  const normalizedRoles = roles.map((r: string) => r.toLowerCase());
  
  // Hoofdleiding and Admins always have access to everything
  const isHead = normalizedRoles.includes('hoofdleiding') || 
                  user.rol === 'admin' || 
                  user.rol === 'godmode';

  if (isHead) return true;

  switch (roleName) {
    case 'hoofdleiding':
    case 'admin':
      return isHead;
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

/**
 * Specifically checks if a user is part of the 'Hoofdleiding'.
 * Used for sensitive operations like modifying roles or deactivating accounts.
 */
export const isHoofdleiding = (user: User | null | undefined): boolean => {
  if (!user) return false;
  const roles = user.roles || [];
  const normalizedRoles = roles.map((r: string) => r.toLowerCase());
  return normalizedRoles.includes('hoofdleiding') || user.rol === 'admin' || user.rol === 'godmode';
};
