import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

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
    ],
  };
});
