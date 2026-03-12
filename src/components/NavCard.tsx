import React from 'react';

interface NavCardProps {
  title: string;
  description?: string;
  icon: string;
  iconColorClass: string; 
  onClick: () => void;
}

export const NavCard: React.FC<NavCardProps> = ({ 
  title, 
  description, 
  icon, 
  iconColorClass, 
  onClick 
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${iconColorClass}`}>
          <span className="material-icons-round">{icon}</span>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white transition-colors">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <span className="material-icons-round text-gray-400 group-hover:translate-x-1 transition-transform">
        chevron_right
      </span>
    </div>
  );
};
