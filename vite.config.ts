import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/letterbench/";

function githubPagesSpa(): Plugin {
  const restore =
    `<script data-spa="restore">(function(){try{var p=sessionStorage.getItem("letterbench-spa-path");if(!p)return;sessionStorage.removeItem("letterbench-spa-path");if(p!==location.pathname+location.search+location.hash)history.replaceState(null,"",p);}catch(e){}})();</script>`;
  return {
    name: "github-pages-spa",
    apply: "build",
    transformIndexHtml(html) {
      if (html.includes('data-spa="restore"')) return html;
      return html.replace("<head>", `<head>${restore}`);
    },
    writeBundle(options) {
      const dir = options.dir ?? path.resolve("dist");
      const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
      const redirect =
        `<script data-spa="redirect">(function(){var path=location.pathname+location.search+location.hash;var root=${JSON.stringify(base)};if(path===root||path===root.slice(0,-1)||path===root+"index.html")return;try{sessionStorage.setItem("letterbench-spa-path",path);}catch(e){}location.replace(root);})();</script>`;
      const four = html.replace(/<script data-spa="restore">[\s\S]*?<\/script>/, redirect);
      fs.writeFileSync(path.join(dir, "404.html"), four);
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    githubPagesSpa(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Letterbench",
        short_name: "Letterbench",
        description: "English dictation. Listen to a word or sentence, then tap the letters.",
        theme_color: "#1e4d5c",
        background_color: "#f3f0e8",
        display: "standalone",
        id: "/letterbench/",
        start_url: "/letterbench/",
        scope: "/letterbench/",
        lang: "en",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/letterbench/index.html",
        navigateFallbackDenylist: [/^\/letterbench\/assets\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "letterbench-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
