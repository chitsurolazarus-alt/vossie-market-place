"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost, savePost } from "@/app/actions/hub";
import { btnDanger, field } from "@/components/admin/useAct";
import { hubCoverUrl } from "@/lib/format";
import { compressListingImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

export type PostValues = {
  id: string | null; kind: "tip" | "event" | "office_hours"; title: string; body: string; coverPath: string | null; campusId: string | null;
  eventAt: string; venue: string; capacity: string; published: boolean;
};

/** Staff-only form to publish tips, events and office hours. Body supports a small markdown subset. */
export default function PostForm({ initial, campuses, userId }: { initial: PostValues; campuses: { id: string; name: string }[]; userId: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyImage, setBusyImage] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof PostValues>(k: K, val: PostValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setBusyImage(true);
    try {
      const blob = await compressListingImage(file);
      const path = `${userId}/${crypto.randomUUID()}.webp`;
      const { error: err } = await createClient().storage.from("hub-covers").upload(path, blob, { contentType: "image/webp" });
      if (err) throw new Error("Upload failed. Try a smaller photo.");
      set("coverPath", path);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't use that photo"); }
    finally { setBusyImage(false); }
  };

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await savePost({
        id: v.id, kind: v.kind, title: v.title, body: v.body, coverPath: v.coverPath, campusId: v.campusId,
        eventAt: v.kind === "tip" || !v.eventAt ? null : `${v.eventAt}:00+02:00`, // South African time, no DST
        venue: v.kind === "tip" ? null : v.venue.trim() || null, capacity: v.kind === "event" && v.capacity ? Number(v.capacity) : null, published: v.published,
      });
      if (!r.ok) { setError(r.error); return; }
      router.push(`/growth/${r.id}`); router.refresh();
    });
  };
  const remove = () => start(async () => { if (!v.id) return; const r = await deletePost(v.id); if (!r.ok) { setError(r.error); return; } router.push("/growth"); router.refresh(); });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div>
        <label htmlFor="kind" className="font-semibold text-navy">Type</label>
        <select id="kind" value={v.kind} onChange={(e) => set("kind", e.target.value as PostValues["kind"])} className={`${field} mt-1`}>
          <option value="tip">Tip or article</option><option value="event">Incubation Hub event</option><option value="office_hours">Mentor office hours</option>
        </select>
      </div>
      <div>
        <label htmlFor="title" className="font-semibold text-navy">Title</label>
        <input id="title" value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} className={`${field} mt-1`} required />
      </div>
      <div>
        <label htmlFor="body" className="font-semibold text-navy">Body <span className="font-normal text-muted">({v.body.length}/4000)</span></label>
        <p id="md-hint" className="text-sm text-muted">Markdown subset: <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- bullets</code>, <code>1. numbers</code>, <code>[link](https://…)</code>.</p>
        <textarea id="body" value={v.body} maxLength={4000} rows={8} onChange={(e) => set("body", e.target.value)} aria-describedby="md-hint" className={`${field} mt-1 font-mono text-sm`} />
      </div>
      {v.kind !== "tip" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="eventAt" className="font-semibold text-navy">{v.kind === "event" ? "Date and time" : "First session (optional)"}</label>
            <input id="eventAt" type="datetime-local" value={v.eventAt} onChange={(e) => set("eventAt", e.target.value)} required={v.kind === "event"} className={`${field} mt-1`} />
          </div>
          <div>
            <label htmlFor="venue" className="font-semibold text-navy">Venue</label>
            <input id="venue" value={v.venue} maxLength={120} onChange={(e) => set("venue", e.target.value)} className={`${field} mt-1`} />
          </div>
          {v.kind === "event" && (
            <div>
              <label htmlFor="capacity" className="font-semibold text-navy">Capacity <span className="font-normal text-muted">(optional)</span></label>
              <input id="capacity" type="number" min={1} value={v.capacity} onChange={(e) => set("capacity", e.target.value)} className={`${field} mt-1`} />
            </div>
          )}
        </div>
      )}
      <div>
        <label htmlFor="campus" className="font-semibold text-navy">Campus</label>
        <select id="campus" value={v.campusId ?? ""} onChange={(e) => set("campusId", e.target.value || null)} className={`${field} mt-1`}>
          <option value="">All campuses</option>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cover" className="font-semibold text-navy">Cover image <span className="font-normal text-muted">(optional, compressed for you)</span></label>
        <input id="cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} className="mt-1 block w-full min-h-11 text-base" />
        {busyImage && <p className="mt-1 text-sm text-muted">Processing photo…</p>}
        {v.coverPath && (
          <div className="mt-2 flex items-center gap-3">
            <Image src={hubCoverUrl(v.coverPath)} alt="Cover preview" width={160} height={90} className="h-[90px] w-40 rounded-lg object-cover" />
            <button type="button" onClick={() => set("coverPath", null)} className="min-h-11 px-2 text-sm font-semibold text-red-800 underline">Remove</button>
          </div>
        )}
      </div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} className="h-5 w-5" /><span className="text-ink">Published (untick to keep it as a draft)</span></label>
      {error && <p role="alert" className="rounded-lg border-l-4 border-red-800 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || busyImage} className="inline-flex min-h-12 items-center rounded-lg bg-navy px-6 font-semibold text-white hover:bg-royal disabled:opacity-60">{pending ? "Saving…" : v.id ? "Save changes" : "Publish"}</button>
        {v.id && <button type="button" disabled={pending} onClick={remove} className={btnDanger}>Delete post</button>}
      </div>
    </form>
  );
}
