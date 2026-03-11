import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title shown at the top of the modal */
  title?: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Max width class, default: max-w-md */
  maxWidth?: string;
}

/**
 * Centered modal overlay with backdrop blur, safe-area bottom padding,
 * and click-outside-to-close behavior.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  maxWidth = 'max-w-md',
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={`bg-white dark:bg-[#1e293b] w-full ${maxWidth} rounded-3xl relative z-10 shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200`}
      >
        {title && (
          <div className="p-6 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h2>
              {subtitle && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="material-icons-round text-gray-500 text-lg">close</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * iOS-style bottom sheet that slides up from the bottom.
 * Includes safe-area padding and backdrop.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
}) => {
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="relative bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-t-[2.5rem] shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 ease-out flex flex-col pt-4"
        style={{ maxHeight: '92vh' }}
      >
        {/* Handle */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 shrink-0" />
        
        <div className="px-6 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{title}</h2>
              {subtitle && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors"
            >
              <span className="material-icons-round">close</span>
            </button>
          </div>
          <div className="overflow-y-auto no-scrollbar pb-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
