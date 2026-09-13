import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./hooks/use-theme";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="9router-ui-theme">
      <App />
      <Toaster position="top-right" />
    </ThemeProvider>
  </React.StrictMode>
);
