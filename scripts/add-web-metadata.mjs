import { readFile, writeFile } from "node:fs/promises";

const index = new URL("../dist/index.html", import.meta.url);
const source = await readFile(index, "utf8");
if (!/<title>.*?<\/title>/s.test(source) || !source.includes("</body>")) throw new Error("Unexpected Expo HTML");
const head = "<title>Hush Garden | Spatial masking noise and nearby chat</title>\n    <meta name=\"description\" content=\"Explore an online garden with position-dependent masking noise, private speakers and nearby chat.\" />\n    <link rel=\"canonical\" href=\"https://hush-garden.jace-s.com/\" />\n    <meta property=\"og:type\" content=\"website\" />\n    <meta property=\"og:title\" content=\"Hush Garden | Spatial masking noise and nearby chat\" />\n    <meta property=\"og:description\" content=\"Explore an online garden with position-dependent masking noise, private speakers and nearby chat.\" />\n    <meta property=\"og:url\" content=\"https://hush-garden.jace-s.com/\" />\n    <meta property=\"og:image\" content=\"https://hush-garden.jace-s.com/favicon.ico\" />";
const fallback = "<noscript><main><h1>Hush Garden</h1><p>Explore an online garden with position-dependent masking noise, private speakers and nearby chat.</p><a href=\"https://jace-s.com/en/apps/hush-garden\">Read the app guide</a></main></noscript>";
await writeFile(index, source.replace(/<title>.*?<\/title>/s, () => head).replace("</body>", () => fallback + "</body>"));
