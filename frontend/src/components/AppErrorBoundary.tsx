import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected runtime error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FlowPilot] Uncaught application error', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="setup-shell">
        <div className="setup-card">
          <div className="kicker">FLOWPILOT RECOVERY</div>
          <h1>The dashboard hit an unexpected runtime error.</h1>
          <p>
            FlowPilot kept the app shell alive instead of showing a blank screen. Reload to retry the
            live queries or inspect the browser console for details.
          </p>
          <div className="setup-list">
            <div className="setup-step">Reason: <span className="mono">{this.state.message}</span></div>
            <div className="setup-step">Action: reload the workspace to resume live Flow synchronization.</div>
          </div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload dashboard
          </button>
        </div>
      </div>
    );
  }
}
