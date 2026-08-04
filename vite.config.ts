import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

function apiChatPlugin(): Plugin {
  return {
    name: "api-chat-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/api/chat") && req.method === "POST") {
          try {
            const { handleChatPost } = await server.ssrLoadModule("/src/routes/api/chat.ts");

            const buffers: Uint8Array[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyText = Buffer.concat(buffers).toString("utf-8");

            const protocol = req.headers["x-forwarded-proto"] || "http";
            const host = req.headers.host || "localhost:5173";
            const fullUrl = `${protocol}://${host}${req.url}`;

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (Array.isArray(value)) {
                value.forEach((v) => headers.append(key, v));
              } else if (value) {
                headers.set(key, value);
              }
            }

            const webReq = new Request(fullUrl, {
              method: "POST",
              headers,
              body: bodyText,
            });

            const webRes: Response = await handleChatPost(webReq);

            res.statusCode = webRes.status;
            webRes.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });

            if (webRes.body) {
              const reader = webRes.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            } else {
              res.end();
            }
          } catch (err: any) {
            console.error("[Vite API Plugin] Error handling /api/chat:", err);
            res.statusCode = 500;
            res.end(err?.message || "Internal Server Error");
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [
      apiChatPlugin(),
      react(),
      tailwindcss(),
      tsconfigPaths(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.ico", "favicon.png", "robots.txt", "icons/*.png"],
        manifest: {
          name: "Jarvis — Personal AI Operating System",
          short_name: "Jarvis",
          description:
            "Your intelligent personal AI operating system. Manage tasks, calendar, email, notes, contacts, follow-ups, and get proactive daily briefings.",
          theme_color: "#6366f1",
          background_color: "#0f1117",
          display: "standalone",
          orientation: "portrait-primary",
          scope: "/",
          start_url: "/dashboard",
          id: "/",
          lang: "en-US",
          categories: ["productivity", "business", "utilities"],
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
            { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          shortcuts: [
            { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
            { name: "Chat", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
            { name: "Notifications", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
            { name: "Planner", url: "/planner", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          ],
        },
        workbox: {
          // Cache strategy: StaleWhileRevalidate for pages, CacheFirst for assets
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "jarvis-google-fonts",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "jarvis-gstatic-fonts",
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Cache app routes with NetworkFirst — fall back to cache offline
              urlPattern: /^\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "jarvis-pages",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
          ],
          // Offline fallback
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /^\/firebase-messaging-sw\.js/],
          // Clean old caches
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        devOptions: {
          // Enable PWA in dev so we can test install prompt without building
          enabled: true,
          type: "module",
        },
      }),
    ],
  };
});
