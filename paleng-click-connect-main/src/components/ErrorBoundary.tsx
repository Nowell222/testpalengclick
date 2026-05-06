import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <AlertTriangle className="w-10 h-10" />
          </div>

          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-4">
            Something went wrong
          </h1>

          <p className="text-slate-600 max-w-md mb-10 leading-relaxed font-serif">
            We encountered an unexpected error. This has been logged, and we're working to fix it.
            In the meantime, you can try reloading the page or returning home.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md">
            <Button
              onClick={this.handleReload}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-semibold gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Page
            </Button>

            <Button
              onClick={this.handleReset}
              variant="outline"
              className="flex-1 border-slate-200 text-slate-600 h-12 rounded-xl font-semibold gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-12 p-6 bg-slate-100 border border-slate-200 rounded-xl text-left w-full max-w-2xl overflow-auto max-h-60">
              <p className="text-xs font-mono text-red-600 whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}

          <p className="mt-12 text-slate-400 text-xs font-serif tracking-widest uppercase">
            Paleng-Click System · San Juan Batangas
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
