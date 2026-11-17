/**
 * Web bottom banner slot for Google AdSense.
 * Renders nothing until EXPO_PUBLIC_ADSENSE_CLIENT and EXPO_PUBLIC_ADSENSE_SLOT are configured.
 */
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { colors } from "../ui";

const CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT?.trim() || "";
const SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT?.trim() || "";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdBanner({ visible = true }: { visible?: boolean }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!visible || !CLIENT || !SLOT || typeof document === "undefined") return;
    const scriptId = "hg-adsense-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
      document.head.appendChild(script);
    }
    if (!pushed.current) {
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // AdSense script not ready yet or blocked by client.
      }
    }
  }, [visible]);

  if (!visible || !CLIENT || !SLOT) return null;

  return (
    <View
      testID="ad-banner"
      style={{
        minHeight: 60,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.panel,
        borderTopWidth: 2,
        borderTopColor: colors.panelEdge,
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", maxWidth: 728, height: 60 }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </View>
  );
}
