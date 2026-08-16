import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onError: (error: Error) => void;
};

type State = { failed: boolean };

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="empty-document" aria-label="Document unavailable">
          <div>
            <h1>Note unavailable</h1>
            <p>
              BlockNote could not safely open this stored document. The original
              database value has been preserved and autosave is disabled.
            </p>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
