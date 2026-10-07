import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches a render-time crash in any one screen and shows a real recoverable-error state
 * instead of a blank white page — "Try again" actually resets this boundary's state (so a
 * crash caused by bad transient state, like a stale URL param, can clear without a full
 * reload), and "Start over" does a full reload for anything that resetting alone won't fix. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Chronoscope crashed inside a screen:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash__panel">
          <p className="eyebrow">Recoverable error</p>
          <h2>Something went wrong on this screen</h2>
          <p className="muted">The rest of Chronoscope — your saved moments, the records themselves — is unaffected. This is a display problem on this one screen, not data loss.</p>
          <p className="crash__detail">{error.message}</p>
          <div className="crash__actions">
            <button type="button" className="option is-on" onClick={() => this.setState({ error: null })}>Try again</button>
            <a className="option" href="/">Start over at Explore</a>
          </div>
        </div>
      </div>
    );
  }
}
