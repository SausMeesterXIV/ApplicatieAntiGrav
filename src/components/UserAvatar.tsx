import React from 'react';

interface UserAvatarProps {
  user?: any;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'md', className = '' }) => {
  const name = user?.naam || user?.name || 'Onbekend';
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = user?.avatar_url || user?.avatar;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-20 w-20 text-xl'
  };

  if (avatarUrl && avatarUrl !== '' && !avatarUrl.includes('pravatar.cc')) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 dark:border-gray-700 ${className}`}
        onError={(e) => {
          // Als de afbeelding faalt te laden, verander het in een initialen-div
          (e.target as HTMLImageElement).style.display = 'none';
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `${sizeClasses[size]} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold ${className}`;
            fallback.innerText = initial;
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold border border-gray-200 dark:border-gray-700 ${className}`}>
      {initial}
    </div>
  );
};

