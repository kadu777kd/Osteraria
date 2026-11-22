import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary capturou erro:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF6F0] px-6 py-12 text-[#2A1E17]">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#2A1E17]/10 p-8 text-center shadow-sm">
            <h1 className="font-display text-3xl font-semibold mb-3">Osteria del Nonno</h1>
            <p className="text-sm text-[#6C5B4F] mb-6 leading-relaxed">
              Não foi possível carregar uma parte da página. Recarregue para tentar novamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg bg-[#A64B2A] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
