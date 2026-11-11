/** Expo configuration for Hush Garden. One screen codebase builds the web app, the Android app and the iPhone app. */
export default {
  expo: {
    name: "Hush Garden",
    slug: "hush-garden",
    version: "0.1.0",
    orientation: "default",
    userInterfaceStyle: "light",
    scheme: "jaces-hushgarden",
    icon: "./assets/icon.png",
    android: {
      package: "com.jaces.hushgarden",
      versionCode: 1,
      adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#dff3ea" },
      permissions: ["android.permission.ACCESS_COARSE_LOCATION", "android.permission.VIBRATE"],
      allowBackup: false,
    },
    ios: {
      bundleIdentifier: "com.jaces.hushgarden",
      supportsTablet: true,
      infoPlist: { NSLocationWhenInUseUsageDescription: "Shows the name of your city above your character in the public garden." },
    },
    web: { bundler: "metro", output: "single", name: "Hush Garden", backgroundColor: "#dff3ea", favicon: "./assets/icon.png" },
    plugins: [
      "expo-secure-store",
      ["expo-location", { locationWhenInUsePermission: "Shows the name of your city above your character in the public garden." }],
      [
        // Background playback: iOS background audio mode and the Android media playback foreground service.
        "react-native-audio-api",
        {
          iosBackgroundMode: true,
          androidForegroundService: true,
          androidFSTypes: ["mediaPlayback"],
          androidPermissions: ["android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK", "android.permission.POST_NOTIFICATIONS"],
        },
      ],
      "./plugins/with-short-cmake-path.cjs",
    ],
  },
};
