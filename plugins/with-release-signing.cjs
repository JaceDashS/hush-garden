const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_SIGNING_GUARD = [
  "    def hasReleaseSigning = [",
  '        "ANDROID_KEYSTORE_PATH",',
  '        "ANDROID_KEYSTORE_PASSWORD",',
  '        "ANDROID_KEY_ALIAS",',
  '        "ANDROID_KEY_PASSWORD",',
  "    ].every { System.getenv(it)?.trim() }",
].join("\n");

const RELEASE_SIGNING_CONFIG = [
  "        release {",
  "            if (hasReleaseSigning) {",
  '                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))',
  '                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")',
  '                keyAlias System.getenv("ANDROID_KEY_ALIAS")',
  '                keyPassword System.getenv("ANDROID_KEY_PASSWORD")',
  "            }",
  "        }",
].join("\n");

/**
 * Configure Android release signing from environment variables when all four
 * ANDROID_KEYSTORE_* / ANDROID_KEY_* variables are set, falling back to debug
 * signing for unconfigured local or CI test builds.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes("hasReleaseSigning")) {
      return config;
    }

    const signingConfigsMarker = "    signingConfigs {";
    if (!contents.includes(signingConfigsMarker)) {
      throw new Error("Cannot locate signingConfigs block in android/app/build.gradle");
    }
    contents = contents.replace(
      signingConfigsMarker,
      `${RELEASE_SIGNING_GUARD}\n${signingConfigsMarker}\n${RELEASE_SIGNING_CONFIG}`,
    );

    const releaseBlockPattern = /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBlockPattern.test(contents)) {
      throw new Error("Cannot locate release signingConfig in android/app/build.gradle");
    }
    contents = contents.replace(
      releaseBlockPattern,
      "$1signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug",
    );

    config.modResults.contents = contents;
    return config;
  });
};
