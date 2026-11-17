const { withAndroidManifest, withDangerousMod, withMainApplication } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const SERVICE_NAME = ".FloatingBubbleService";
const PERMISSION = "android.permission.SYSTEM_ALERT_WINDOW";
const KOTLIN_FILES = [
  "FloatingBubbleService.kt",
  "FloatingBubbleModule.kt",
  "FloatingBubblePackage.kt",
];

module.exports = function withFloatingBubble(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const hasPerm = manifest["uses-permission"].some((item) => item.$?.["android:name"] === PERMISSION);
    if (!hasPerm) {
      manifest["uses-permission"].push({ $: { "android:name": PERMISSION } });
    }

    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service || [];
      const hasService = app.service.some((item) => item.$?.["android:name"] === SERVICE_NAME);
      if (!hasService) {
        app.service.push({
          $: {
            "android:name": SERVICE_NAME,
            "android:enabled": "true",
            "android:exported": "false",
            "android:foregroundServiceType": "mediaPlayback",
          },
        });
      }
    }
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes("FloatingBubblePackage()")) {
      const marker = "PackageList(this).packages.apply {";
      if (contents.includes(marker)) {
        contents = contents.replace(marker, `${marker}\n              add(FloatingBubblePackage())`);
      }
    }
    mod.modResults.contents = contents;
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    async (mod) => {
      const srcDir = path.join(mod.modRequest.projectRoot, "plugins", "android");
      const dstDir = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "java", "com", "jaces", "hushgarden");
      fs.mkdirSync(dstDir, { recursive: true });
      for (const file of KOTLIN_FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
      }
      return mod;
    },
  ]);

  return config;
};
