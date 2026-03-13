import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100 dark:border-red-800">
            <span className="material-icons-round text-5xl text-red-500 dark:text-red-400">warning_amber</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Oeps, er ging iets mis!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[300px] text-sm">
            Een onderdeel van dit scherm kon niet goed worden geladen. Mogelijks door een haperende netwerkverbinding of corrupte data.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
            >
              Ga Terug
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center gap-2 active:scale-95 transition-all"
            >
              <span className="material-icons-round text-sm">refresh</span>
              Herladen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
