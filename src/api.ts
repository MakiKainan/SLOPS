export type Style = "regular" | "bold" | "italic" | "bold-italic";
export type Shape = "square" | "circle";

export interface FontFamily {
  family: string;
  category: string | null;
  styles: Style[];
}

export interface Preset {
  name: string;
  foreground: string;
  background: string;
}

export interface RenderPayload {
  text: string;
  family: string;
  style: Style;
  foreground: string;
  background: string;
  shape: Shape;
  guide: boolean;
  size: 512 | 1024;
}

export type RenderResult =
  | { ok: true; png_base64: string; warning: string | null }
  | { ok: false; status: number; code: string; message: string };

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export async function postRender(payload: RenderPayload, timeoutMs: number): Promise<RenderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({ error: "Invalid JSON response", code: "internal" }));
    if (res.ok) return { ok: true, png_base64: json.png_base64, warning: json.warning || null };
    return { ok: false, status: res.status, code: json.code || "internal", message: json.error || "Server error" };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { ok: false, status: 408, code: "timeout", message: "Request timed out" };
    }
    return { ok: false, status: 0, code: "network", message: (e as Error).message || "Network request failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function b64ToBlobUrl(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
}

export interface ErrorInfo {
  headline: string;
  fix: string;
  retry: boolean;
}

/** Turn a backend error code + message into visitor-facing copy. */
export function mapError(code: string, detail = ""): ErrorInfo {
  if (code === "cannot_render") {
    if (/glyph|character|missing|lacks/i.test(detail)) {
      return { headline: "This font can't draw part of your text", fix: "Pick another font, or remove the unusual character.", retry: false };
    }
    if (/colou?r/i.test(detail)) {
      return { headline: "This color preset is broken", fix: "Pick another color and tell the booth staff.", retry: false };
    }
    if (/blank|empty/i.test(detail)) {
      return { headline: "Your text is empty", fix: "Type at least one letter.", retry: false };
    }
    return { headline: "Can't make this sticker", fix: "Change the text or pick another font.", retry: false };
  }
  if (code === "style_unavailable") {
    return { headline: "That style isn't available", fix: "Pick one of the listed styles.", retry: false };
  }
  if (code === "font_not_found" || code === "font_file_missing") {
    return { headline: "Font file missing", fix: "Pick another font and tell the booth staff.", retry: false };
  }
  if (code === "invalid_request") {
    return { headline: "The app sent a bad request", fix: "Reload the page (Ctrl+R / ⌘R).", retry: false };
  }
  if (code === "internal") {
    return { headline: "The sticker engine crashed", fix: "Try again; if it repeats, restart the booth.", retry: true };
  }
  if (code === "network" || code === "starting_up") {
    return { headline: "Can't reach the sticker engine", fix: `Nothing answered at ${location.host}. Is the booth server running?`, retry: true };
  }
  if (code === "timeout") {
    return { headline: "The sticker engine is taking too long", fix: "Try again in a moment.", retry: true };
  }
  return { headline: "Can't make this sticker", fix: "Check your settings or try another font.", retry: true };
}
