import React from 'react';

export const ChevronBack = ({ onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${className}`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-900 dark:text-white"
      >
        <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};
