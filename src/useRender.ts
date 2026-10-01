import { useCallback, useEffect, useRef, useState } from "react";
import { b64ToBlobUrl, postRender, type RenderPayload, type RenderResult } from "./api";

export type Rendered = RenderResult & { blobUrl?: string };

const TEXT_DEBOUNCE_MS = 180;
const CACHE_MAX = 32;
const BUSY_DELAY_MS = 300;

const keyOf = (p: RenderPayload) => JSON.stringify(p);

/**
 * Live preview renderer: debounces typing, keeps at most one request in flight,
 * and caches the last 32 results (blob URLs revoked on eviction).
 */
export function useRender(payload: RenderPayload | null) {
  const [result, setResult] = useState<Rendered | null>(null);
  const [busy, setBusy] = useState(false);

  const cache = useRef(new Map<string, Rendered>());
  const latest = useRef(payload);
  const shownUrl = useRef<string | undefined>(undefined);
  const inflight = useRef(false);
  const prevText = useRef<string | null>(null);
  latest.current = payload;

  const show = useCallback((r: Rendered) => {
    shownUrl.current = r.blobUrl;
    setResult(r);
  }, []);

  const pump = useCallback(async () => {
    const p = latest.current;
    if (!p) return;
    const k = keyOf(p);
    const hit = cache.current.get(k);
    if (hit) {
      cache.current.delete(k); // bump LRU position
      cache.current.set(k, hit);
      show(hit);
      return;
    }
    if (inflight.current) return; // the in-flight request re-pumps when it lands
    inflight.current = true;
    const busyTimer = setTimeout(() => setBusy(true), BUSY_DELAY_MS);

    const r: Rendered = await postRender(p, 15000);
    if (r.ok) r.blobUrl = b64ToBlobUrl(r.png_base64);
    if (r.ok || r.status === 422) {
      if (cache.current.size >= CACHE_MAX) {
        const [oldKey, old] = cache.current.entries().next().value!;
        if (old.blobUrl && old.blobUrl !== shownUrl.current) URL.revokeObjectURL(old.blobUrl);
        cache.current.delete(oldKey);
      }
      cache.current.set(k, r);
    }

    inflight.current = false;
    clearTimeout(busyTimer);
    setBusy(false);

    if (latest.current && keyOf(latest.current) === k) show(r);
    else pump();
  }, [show]);

  const key = payload ? keyOf(payload) : null;
  useEffect(() => {
    if (!payload) return;
    const typing = prevText.current !== null && prevText.current !== `${payload.text}\n${payload.text2 ?? ""}`;
    prevText.current = `${payload.text}\n${payload.text2 ?? ""}`;
    const t = setTimeout(pump, typing ? TEXT_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pump]);

  const retry = useCallback(() => {
    if (latest.current) cache.current.delete(keyOf(latest.current));
    pump();
  }, [pump]);

  return { result, busy, retry };
}
