import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { GoogleOneTapSignIn, GoogleSignInButton, isCancelledResponse, isSuccessResponse } from "react-native-nitro-google-signin";
import type { HushClient } from "../api/client";
import type { User } from "../api/types";
import { colors } from "../ui";
import { ApiError } from "../api/types";
import { useT } from "../i18n";
import type { TextKey } from "../domain/text";
import { signInWithNativeGoogle } from "./nativeGoogleFlow";

export interface GoogleButtonProps { client: HushClient; remember: boolean; disabled: boolean; onBusyChange: (busy: boolean) => void; onLoggedIn: (user: User) => Promise<void>; }

const provider = {
  checkPlayServices: () => GoogleOneTapSignIn.checkPlayServices(),
  configure: (options: { webClientId: string; nonce: string; autoSelectOnSignIn: boolean }) => GoogleOneTapSignIn.configure(options),
  async pickAccount(): Promise<string | null> {
    const response = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (isCancelledResponse(response)) return null;
    if (!isSuccessResponse(response) || !response.data.idToken) throw new Error("GOOGLE_TOKEN_MISSING");
    return response.data.idToken;
  },
};

/** Official native button opens Android Credential Manager and uses the same platform account after server verification. */
export function GoogleButton({ client, remember, disabled, onBusyChange, onLoggedIn }: GoogleButtonProps) {
  const t = useT();
  const latest = useRef({ remember, disabled, onBusyChange, onLoggedIn });
  latest.current = { remember, disabled, onBusyChange, onLoggedIn };
  const mounted = useRef(true);
  const working = useRef(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<TextKey | "">("");
  useEffect(() => {
    mounted.current = true;
    void client.googleConfig().then(config => { if (mounted.current) setEnabled(config.enabled); }).catch(() => undefined);
    return () => { mounted.current = false; };
  }, [client]);
  const press = async () => {
    if (working.current || latest.current.disabled) return;
    working.current = true;
    latest.current.onBusyChange(true);
    setError("");
    try {
      const user = await signInWithNativeGoogle(client, provider, latest.current.remember, () => mounted.current);
      if (user && mounted.current) await latest.current.onLoggedIn(user);
    } catch (cause) {
      const errors: Record<string, TextKey> = {
        GOOGLE_ACCOUNT_CONFLICT: "google.conflict", RATE_LIMITED: "login.rateLimited",
        ACCOUNT_SUSPENDED: "google.suspended", ACCOUNT_EXPIRED: "google.expired",
      };
      if (mounted.current) setError(cause instanceof ApiError ? errors[cause.code] || "google.failed" : "google.failed");
    } finally {
      working.current = false;
      if (mounted.current) latest.current.onBusyChange(false);
    }
  };
  if (!enabled || Platform.OS !== "android") return null;
  return <View style={{ gap: 8, alignItems: "center" }}>
    <GoogleSignInButton signInBehavior="none" onPress={press} disabled={disabled} size="standard" colorScheme="light" style={{ width: "100%", maxWidth: 320, height: 44 }} accessibilityLabel={t("google.continue")} testID="native-google-login" />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{t(error)}</Text>}
  </View>;
}
