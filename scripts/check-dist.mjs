import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("dist/manifest.webmanifest", "utf8"));
if (manifest.name !== "Letterbench" || manifest.short_name !== "Letterbench") {
  throw new Error(`Manifest name must be Letterbench, got ${manifest.name} / ${manifest.short_name}`);
}
if (String(manifest.name).includes("Grok") || String(manifest.short_name).includes("Grok")) {
  throw new Error("Manifest still uses the Grok name");
}
for (const field of ["start_url", "scope"]) {
  if (!String(manifest[field]).startsWith("/letterbench/")) {
    throw new Error(`${field} is ${manifest[field]}, expected /letterbench/`);
  }
}
if (manifest.theme_color !== "#1e4d5c") {
  throw new Error(`theme_color is ${manifest.theme_color}`);
}

const html = fs.readFileSync("dist/index.html", "utf8");
const missing = fs.readFileSync("dist/404.html", "utf8");
if (!html.includes("/letterbench/")) throw new Error("index.html is missing the /letterbench/ base");
if (html.includes("/letterbench/letterbench/")) throw new Error("base path was applied twice");
if (!html.includes('data-spa="restore"')) throw new Error("index.html is missing the route restore script");
if (!missing.includes('data-spa="redirect"')) throw new Error("404.html is missing the GitHub Pages redirect");
if (!missing.includes("letterbench-spa-path")) throw new Error("404.html does not preserve the deep link");

const files = fs.readdirSync("dist");
if (!files.some((file) => file === "sw.js" || file.endsWith("sw.js"))) {
  throw new Error(`No service worker in dist: ${files.join(", ")}`);
}
for (const icon of ["icons/icon-192.png", "icons/icon-512.png", "favicon.svg"]) {
  if (!fs.existsSync(`dist/${icon}`)) throw new Error(`Missing ${icon}`);
}

console.log("dist checks passed");
