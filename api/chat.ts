import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleChatPost } from "../src/routes/api/chat.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "localhost";
    const fullUrl = `${protocol}://${host}${req.url}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    }

    const bodyText = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    const webReq = new Request(fullUrl, {
      method: "POST",
      headers,
      body: bodyText,
    });

    const webRes = await handleChatPost(webReq);

    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const buf = await webRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err: any) {
    console.error("[Vercel Node API Error /api/chat]:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
