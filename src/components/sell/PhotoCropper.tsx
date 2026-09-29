"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressSquare, drawSquare, loadBitmap, type Crop } from "@/lib/image";
import { Alert, Button } from "@/components/ui";

const PREVIEW = 240;

export default function PhotoCropper({
  userId, value, onChange, businessName, error,
}: {
  userId: string; value: string; onChange: (url: string) => void; businessName: string; error?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (bmp && ctx) drawSquare(ctx, bmp, crop, PREVIEW);
  }, [bmp, crop]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    try {
      setBmp(await loadBitmap(file));
      setCrop({ zoom: 1, x: 0, y: 0 });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "We couldn't open that photo");
    }
  }

  async function upload() {
    if (!bmp) return;
    setBusy(true); setMsg(null);
    try {
      const blob = await compressSquare(bmp, crop);
      const supabase = createClient();
      const path = `${userId}/profile-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (upErr) throw new Error("Upload failed. Check your connection and try again.");
      onChange(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      setBmp(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="font-semibold text-navy" id="photo-label">Profile or logo photo</p>
      {value && !bmp && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={`${businessName || "Your business"} profile photo`} width={160} height={160} className="h-40 w-40 rounded-xl object-cover" />
      )}
      {bmp ? (
        <div className="space-y-3 rounded-xl border border-navy/20 p-3">
          <canvas ref={canvasRef} width={PREVIEW} height={PREVIEW} className="mx-auto h-60 w-60 max-w-full rounded-lg bg-mist" role="img" aria-label="Square crop preview" />
          {(["zoom", "x", "y"] as const).map((k) => (
            <label key={k} className="block text-sm font-medium text-navy">
              {k === "zoom" ? "Zoom" : k === "x" ? "Move left / right" : "Move up / down"}
              <input type="range" className="mt-1 h-11 w-full" min={k === "zoom" ? 1 : -1} max={k === "zoom" ? 3 : 1} step={0.01}
                value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: Number(e.target.value) })} />
            </label>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Use this photo"}</Button>
            <Button type="button" variant="secondary" onClick={() => setBmp(null)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border-2 border-navy px-5 font-semibold text-navy hover:bg-mist focus-within:outline focus-within:outline-2">
          {value ? "Change photo" : "Choose a photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-labelledby="photo-label" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}
      <p className="text-sm text-muted">We crop to a square, shrink it to under 300 KB and remove hidden location data.</p>
      {(msg || error) && <Alert>{msg ?? error}</Alert>}
    </div>
  );
}
