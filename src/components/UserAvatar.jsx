import React from 'react';

export const UserAvatar = ({ user, size = 'md', className = '' }) => {
  const name = user?.naam || user?.name || 'Onbekend';
  // Initialen van voor- en achternaam (bv. "TD"), zoals in de design-update
  const delen = name.trim().split(/\s+/).filter(Boolean);
  const initial = (delen.length > 1 ? delen[0][0] + delen[delen.length - 1][0] : name.slice(0, 1)).toUpperCase();
  const avatarUrl = user?.avatar_url || user?.avatar;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-20 w-20 text-xl',
  };

  if (avatarUrl && avatarUrl !== '' && !avatarUrl.includes('pravatar.cc')) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 dark:border-gray-700 ${className}`}
        onError={e => {
          // Als de afbeelding faalt te laden, verander het in een initialen-div
          e.target.style.display = 'none';
          const parent = e.target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `${sizeClasses[size]} rounded-full bg-inkt dark:bg-white flex items-center justify-center text-white dark:text-inkt font-bold ${className}`;
            fallback.innerText = initial;
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-inkt dark:bg-white flex items-center justify-center text-white dark:text-inkt font-bold ${className}`}
    >
      {initial}
    </div>
  );
};
