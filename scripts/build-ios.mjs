// Generates the iOS project with Expo prebuild and builds an archive on macOS into dist-ios/.
// The generated ios/ folder is owned by this script and recreated on every run.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  console.error("iOS native builds require macOS with Xcode. Use `npx eas build -p ios` from other OSes.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ios = path.join(root, "ios");
const marker = path.join(root, ".expo-native-owned");
if (fs.existsSync(ios) && !fs.existsSync(marker)) {
  throw new Error("Refusing to replace a native directory not created by this script");
}

const env = { ...process.env, CI: "1", NODE_ENV: "production" };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

fs.writeFileSync(marker, "Generated Expo native projects only.\n");
run(process.execPath, ["node_modules/expo/bin/cli", "prebuild", "--platform", "ios", "--clean", "--no-install"]);
run("pod", ["install"], ios);

const out = path.join(root, "dist-ios");
fs.mkdirSync(out, { recursive: true });
const archivePath = path.join(out, "HushGarden.xcarchive");
run(
  "xcodebuild",
  [
    "-workspace",
    "HushGarden.xcworkspace",
    "-scheme",
    "HushGarden",
    "-configuration",
    "Release",
    "-destination",
    "generic/platform=iOS",
    "-archivePath",
    archivePath,
    "archive",
  ],
  ios,
);
console.log("iOS Archive: " + archivePath);
