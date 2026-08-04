import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleChatPost } from "../src/routes/api/chat";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

    // Read raw body stream from Vercel Node request
    const buffers: Uint8Array[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const bodyText = Buffer.concat(buffers).toString("utf-8");

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
    console.error("[Vercel API Error /api/chat]:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
