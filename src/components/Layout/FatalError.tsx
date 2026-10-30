// libs
import { Component, JSX, ReactNode } from "react";

interface FatalErrorProps {
    error: Error;
}

export const FatalError = ({ error }: FatalErrorProps): JSX.Element => (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-red-400/10 border border-red-400/30 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-red-400">Something went wrong</p>
            <p className="text-xs text-muted">
                The app hit an unexpected error and can't continue. Reloading the page will start it
                again.
            </p>
            <p className="text-xs text-muted/70 font-mono break-words">{error.message}</p>
            <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
            >
                Reload
            </button>
        </div>
    </div>
);

interface FatalErrorBoundaryProps {
    children: ReactNode;
}

interface FatalErrorBoundaryState {
    error: Error | null;
}

// Rendering failed, so the UI is in an unknown state: treat it like a contract violation.
export class FatalErrorBoundary extends Component<
    FatalErrorBoundaryProps,
    FatalErrorBoundaryState
> {
    state: FatalErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: unknown): FatalErrorBoundaryState {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    render(): ReactNode {
        return this.state.error ? <FatalError error={this.state.error} /> : this.props.children;
    }
}
