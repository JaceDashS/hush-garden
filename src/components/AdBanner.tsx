/**
 * Native (Android / iOS) bottom adaptive banner powered by Google AdMob.
 * Falls back to Google's official test banner ID until EXPO_PUBLIC_ADMOB_*_BANNER_ID is set.
 */
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import mobileAds, { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { colors } from "../ui";

let initialized = false;

function bannerUnitId(): string {
  const custom =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
  return custom?.trim() || TestIds.ADAPTIVE_BANNER;
}

export function AdBanner({ visible = true }: { visible?: boolean }) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initialized || Platform.OS === "web") return;
    initialized = true;
    void mobileAds().initialize().catch(() => undefined);
  }, []);

  if (!visible || failed || Platform.OS === "web") return null;

  return (
    <View
      testID="ad-banner"
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.panel,
        borderTopWidth: 2,
        borderTopColor: colors.panelEdge,
        paddingBottom: insets.bottom,
      }}
    >
      <BannerAd
        unitId={bannerUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
