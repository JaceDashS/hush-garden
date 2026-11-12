import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ApiError } from "../api/types";
import type { TextKey } from "../domain/text";
import { useLanguage, useT } from "../i18n";
import { T } from "../ui";
import type { GoogleButtonProps } from "./GoogleButton";

interface GoogleIdentity {
  initialize(options: { client_id: string; nonce: string; auto_select: boolean; callback: (result: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let scriptReady: Promise<GoogleIdentity> | undefined;

/** Loads Google Identity Services once; a failed load can be retried by the next mount. */
function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  scriptReady ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      scriptReady = undefined;
      script.remove();
      reject(new Error("GOOGLE_SCRIPT_FAILED"));
    };
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google?.accounts.id ? resolve(window.google.accounts.id) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptReady;
}

const FAILED: TextKey = "google.failed";
const ERRORS: Record<string, TextKey> = {
  GOOGLE_ACCOUNT_CONFLICT: "google.conflict",
  RATE_LIMITED: "login.rateLimited",
  ACCOUNT_SUSPENDED: "google.suspended",
  ACCOUNT_EXPIRED: "google.expired",
};

/** Google's official button. A credential is exchanged for the same account session as password login. */
export function GoogleButton({ client, remember, disabled, onBusyChange, onLoggedIn }: GoogleButtonProps) {
  // On web a View renders a DOM element, which Google renders its button into.
  const host = useRef<HTMLElement | null>(null);
  const latest = useRef({ remember, disabled, onBusyChange, onLoggedIn });
  latest.current = { remember, disabled, onBusyChange, onLoggedIn };
  const [enabled, setEnabled] = useState(false);
  const t = useT();
  const language = useLanguage();
  const [error, setError] = useState<TextKey | "">("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let busy = false;
    const container = host.current;
    async function accept(credential: string) {
      if (!active || busy || latest.current.disabled) return;
      busy = true;
      latest.current.onBusyChange(true);
      setError("");
      try {
        const user = await client.googleLogin(credential, latest.current.remember);
        if (active) await latest.current.onLoggedIn(user);
      } catch (cause) {
        if (active) {
          setError((cause instanceof ApiError && ERRORS[cause.code]) || FAILED);
          setAttempt((n) => n + 1);
        }
      } finally {
        busy = false;
        if (active) latest.current.onBusyChange(false);
      }
    }
    (async () => {
      try {
        const config = await client.googleConfig();
        if (!active) return;
        setEnabled(config.enabled);
        if (!config.enabled || !config.clientId || !container) return;
        const nonce = await client.googleChallenge();
        const identity = await loadGoogle();
        if (!active) return;
        identity.initialize({ client_id: config.clientId, nonce, auto_select: false, callback: ({ credential }) => void accept(credential) });
        container.replaceChildren();
        identity.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          locale: language,
          width: Math.min(320, container.clientWidth || 320),
        });
      } catch {
        if (active) {
          setEnabled(true);
          setError(FAILED);
        }
      }
    })();
    return () => {
      active = false;
    };
    // A new attempt re-renders the button with a fresh one-use nonce.
  }, [client, attempt, language]);

  return (
    <View style={{ gap: 8, display: enabled ? "flex" : "none" }}>
      <View ref={(node) => void (host.current = node as unknown as HTMLElement | null)} style={{ minHeight: 44, alignItems: "center" }} />
      {!!error && (
        <T size={13} tone="danger">{t(error)}</T>
      )}
    </View>
  );
}
