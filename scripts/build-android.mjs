// Generates the Android project with Expo prebuild and builds a release APK into dist-android/.
// The generated android/ folder is owned by this script and recreated on every run.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const android = path.join(root, "android");
const marker = path.join(root, ".expo-native-owned");
if (fs.existsSync(android) && !fs.existsSync(marker)) throw new Error("Refusing to replace a native directory not created by this script");

const env = { ...process.env, CI: "1", NODE_ENV: "production" };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

fs.writeFileSync(marker, "Generated Expo native projects only.\n");
run(process.execPath, ["node_modules/expo/bin/cli", "prebuild", "--platform", "android", "--clean", "--no-install"]);
const gradle = ["assembleRelease", "--no-daemon", "--console=plain", "-PreactNativeArchitectures=arm64-v8a,x86_64"];
if (process.platform === "win32") run("cmd.exe", ["/d", "/c", "gradlew.bat", ...gradle], android);
else run("./gradlew", gradle, android);

const out = path.join(root, "dist-android");
fs.mkdirSync(out, { recursive: true });
const apk = path.join(out, "hush-garden-android.apk");
fs.copyFileSync(path.join(android, "app/build/outputs/apk/release/app-release.apk"), apk);
console.log("Android APK: " + apk);
