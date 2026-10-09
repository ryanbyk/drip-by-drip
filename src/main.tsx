import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-400-italic.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "@fontsource/roboto/latin-500.css";
import { App } from "./App";
import { AppProvider } from "./state/AppState";
import { AuthProvider } from "./state/AuthState";
import { PartnerProvider } from "./state/PartnerState";
import "./index.css";

installServiceWorker();

function installServiceWorker(): void {
  let reloaded = false;
  const reloadForUpdate = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  if ("serviceWorker" in navigator) {
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      reloadForUpdate();
    });
  }

  registerSW({
    immediate: true,
    onNeedReload: reloadForUpdate,
    onRegisteredSW(swUrl, registration) {
      if (!swUrl || !registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        void registration.update();
      });
    },
  });
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <PartnerProvider>
          <App />
        </PartnerProvider>
      </AppProvider>
    </AuthProvider>
  </StrictMode>,
);
