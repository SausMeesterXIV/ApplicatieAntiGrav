import React, { useEffect } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title with drag handle */
  title?: string;
  /** Max height class, default: max-h-[80vh] */
  maxHeight?: string;
}

/**
 * Bottom-anchored sheet with rounded top corners, safe-area padding,
 * backdrop blur, and slide-up animation.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  maxHeight = 'max-h-[80vh]',
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`relative bg-white dark:bg-[#1e293b] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl ${maxHeight} flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
      >
        {/* Drag Handle + Title */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3" />
          {title && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
              >
                <span className="material-icons-round text-gray-500 text-xl">close</span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
