// libs
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// components
import App from "./App";
import { FatalError, FatalErrorBoundary } from "./components/Layout/FatalError";

// utils
import { invariant, setViolationHandler } from "./utils/errors/contract";

// styles
import "./index.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
invariant(rootElement, "index.html has a #root element");
const root = ReactDOM.createRoot(rootElement);

// A violation can happen mid-render, so replace the app on the next microtask.
setViolationHandler((violation) =>
    queueMicrotask(() => root.render(<FatalError error={violation} />))
);

root.render(
    <React.StrictMode>
        <FatalErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </FatalErrorBoundary>
    </React.StrictMode>
);
