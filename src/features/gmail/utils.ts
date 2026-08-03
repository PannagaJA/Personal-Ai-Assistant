import type { GmailMessage } from "./types";

export function decodeBase64Url(input: string): string {
  try {
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    try {
      return atob(input.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return input;
    }
  }
}

export function encodeBase64Url(input: string): string {
  const base64 = btoa(
    encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function extractHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  if (!headers) return "";
  const match = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

export function extractSenderName(fromHeader: string): string {
  if (!fromHeader) return "Unknown Sender";
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<.*>$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fromHeader.replace(/<.*>/, "").trim() || fromHeader;
}

export function formatEmailDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function parseMessagePayload(item: any): { bodyText: string; bodyHtml: string; attachments: any[] } {
  let bodyText = "";
  let bodyHtml = "";
  const attachments: any[] = [];

  function walkParts(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data && !bodyText) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data && !bodyHtml) {
        bodyHtml = decodeBase64Url(part.body.data);
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size ?? 0,
        });
      }

      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  if (item.payload) {
    if (item.payload.mimeType === "text/plain" && item.payload.body?.data) {
      bodyText = decodeBase64Url(item.payload.body.data);
    } else if (item.payload.mimeType === "text/html" && item.payload.body?.data) {
      bodyHtml = decodeBase64Url(item.payload.body.data);
    }

    if (item.payload.parts) {
      walkParts(item.payload.parts);
    }
  }

  if (!bodyText && item.snippet) {
    bodyText = item.snippet;
  }

  return { bodyText, bodyHtml, attachments };
}
