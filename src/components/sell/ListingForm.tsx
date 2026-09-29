"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveListing } from "@/app/actions/listing";
import { Alert, Button, ButtonLink, Field, describe, inputCls } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { compressListingImage } from "@/lib/image";
import { listingSchema, issuesToErrors, type FieldErrors } from "@/lib/validation";
import type { Option } from "./SellerForm";

type Img = { path: string; url: string; alt: string };
export type ListingInitial = {
  id: string; kind: "product" | "service"; title: string; description: string; categoryId: string; tags: string[];
  pricingMode: "cash" | "swap" | "both"; priceZar: number | null; priceIsFrom: boolean; swapFor: string;
  availability: "available" | "sold_out" | "paused"; pickupPointId: string | null; deliveredOnCampus: boolean; images: Img[];
};

const cardBtn = (on: boolean) => `flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border-2 px-3 text-center font-semibold ${on ? "border-royal bg-blue-50 text-navy" : "border-navy/20 text-ink"}`;

function TagInput({ tags, onChange, error }: { tags: string[]; onChange: (t: string[]) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<string[]>([]);
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await createClient().from("tags").select("name").ilike("name", `${term.replace(/[%_]/g, "")}%`).limit(6);
      setSugg((data ?? []).map((d) => d.name).filter((n) => !tags.includes(n)));
    }, 200);
    return () => clearTimeout(t);
  }, [q, tags]);

  const add = (raw: string) => {
    const name = raw.trim().toLowerCase().replace(/,/g, "");
    if (name.length >= 2 && name.length <= 30 && !tags.includes(name) && tags.length < 5) onChange([...tags, name]);
    setQ(""); setSugg([]);
  };

  return (
    <Field label="Tags" htmlFor="tag-input" error={error} counter={`${tags.length}/5`} hint="Up to 5 words that help buyers find you, e.g. braids, lunch, logo.">
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {tags.map((t) => (
          <span key={t} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-mist pl-3 text-sm font-medium text-navy">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-navy/10" aria-label={`Remove tag ${t}`}>×</button>
          </span>
        ))}
      </div>
      <input id="tag-input" className={inputCls} value={q} disabled={tags.length >= 5} maxLength={30} autoComplete="off"
        onChange={(e) => setQ(e.target.value)} placeholder={tags.length >= 5 ? "Tag limit reached" : "Type a tag and press Enter"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(q); } }}
        aria-describedby={describe("tag-input", error, true)} />
      {q.trim().length >= 2 && sugg.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tag suggestions">
          {sugg.map((s) => <li key={s}><button type="button" onClick={() => add(s)} className="min-h-11 rounded-full border border-royal px-4 text-sm font-medium text-royal hover:bg-blue-50">+ {s}</button></li>)}
        </ul>
      )}
    </Field>
  );
}

function ImageManager({ userId, listingId, images, onChange, title, error }: {
  userId: string; listingId: string; images: Img[]; onChange: (i: Img[]) => void; title: string; error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const latest = useRef(images);
  useEffect(() => { latest.current = images; });

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const room = 5 - latest.current.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setMsg(`Only ${room} more photo${room === 1 ? "" : "s"} fit. The rest were skipped.`);
    for (const f of chosen) {
      try {
        const blob = await compressListingImage(f);
        const path = `${userId}/${listingId}/${crypto.randomUUID()}.webp`;
        const { error: e } = await supabase.storage.from("listing-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (e) throw new Error("Upload failed. Check your connection.");
        const url = supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl;
        onChange([...latest.current, { path, url, alt: "" }]);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Couldn't add that photo");
      }
    }
    setBusy(false);
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images]; const [it] = next.splice(from, 1); next.splice(to, 0, it); onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-navy" id="photos-label">Photos</p>
        <span className="text-sm text-muted">{images.length}/5</span>
      </div>
      <p className="text-sm text-muted">The first photo is your cover. Drag to reorder, or use the arrow buttons. We shrink photos and strip location data automatically.</p>
      <ul className="grid gap-3 sm:grid-cols-2" aria-labelledby="photos-label">
        {images.map((img, i) => (
          <li key={img.path} draggable onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; }}
            className="rounded-xl border border-navy/20 p-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || title || "Listing photo"} className="aspect-square w-full rounded-lg object-cover" />
              {i === 0 && <span className="absolute left-2 top-2 rounded bg-sand px-2 py-0.5 text-xs font-bold text-navy">Cover</span>}
            </div>
            <label className="mt-2 block text-sm font-medium text-navy" htmlFor={`alt-${i}`}>Describe this photo</label>
            <input id={`alt-${i}`} className={inputCls} value={img.alt} maxLength={200} placeholder={title || "e.g. Chicken kota with atchar"}
              onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="min-h-11 flex-1 rounded-lg border border-navy/30 font-medium disabled:opacity-40" aria-label={`Move photo ${i + 1} earlier`}>←</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="min-h-11 flex-1 rounded-lg border border-navy/30 font-medium disabled:opacity-40" aria-label={`Move photo ${i + 1} later`}>→</button>
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="min-h-11 flex-1 rounded-lg border border-red-800 font-medium text-red-800" aria-label={`Remove photo ${i + 1}`}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {images.length < 5 && (
        <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border-2 border-navy px-5 font-semibold text-navy hover:bg-mist focus-within:outline focus-within:outline-2">
          {busy ? "Processing…" : images.length ? "Add more photos" : "Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-labelledby="photos-label" disabled={busy} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      {(msg || error) && <Alert>{msg ?? error}</Alert>}
    </div>
  );
}

export default function ListingForm({ userId, categories, pickupPoints, initial, isEdit }: {
  userId: string; categories: Option[]; pickupPoints: Option[]; initial: ListingInitial; isEdit: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [price, setPrice] = useState(initial.priceZar === null ? "" : String(initial.priceZar));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<ListingInitial>) => { setF((x) => ({ ...x, ...p })); setErrors((e) => { const n = { ...e }; Object.keys(p).forEach((k) => delete n[k]); return n; }); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...f,
      priceZar: f.pricingMode === "swap" || price.trim() === "" ? null : Number(price),
      images: f.images.map((i) => ({ path: i.path, alt: (i.alt || f.title).trim() })),
    };
    const parsed = listingSchema.safeParse(payload);
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error.issues);
      setErrors(errs); setFormError("Please fix the highlighted fields.");
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }
    start(async () => {
      const r = await saveListing(payload);
      if (r.ok) { router.push("/sell/listings"); router.refresh(); return; }
      setFormError(r.error);
      if (r.fieldErrors) setErrors(r.fieldErrors);
    });
  };

  const showPrice = f.pricingMode !== "swap";
  const showSwap = f.pricingMode !== "cash";

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <fieldset>
        <legend className="font-semibold text-navy">What are you listing?</legend>
        <div className="mt-2 flex gap-2">
          {(["product", "service"] as const).map((k) => (
            <label key={k} className={cardBtn(f.kind === k)}>
              <input type="radio" name="kind" className="sr-only" checked={f.kind === k} onChange={() => set({ kind: k, deliveredOnCampus: k === "service" })} />
              {k === "product" ? "Product" : "Service"}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Title" htmlFor="title" error={errors.title} counter={`${f.title.length}/70`}>
        <input id="title" className={inputCls} value={f.title} maxLength={70} onChange={(e) => set({ title: e.target.value })}
          aria-invalid={!!errors.title} aria-describedby={describe("title", errors.title)} />
      </Field>
      <Field label="Description" htmlFor="description" error={errors.description} counter={`${f.description.length}/1000`} hint="What's included, sizes, how long it takes. Line breaks are kept.">
        <textarea id="description" rows={6} className={inputCls} value={f.description} maxLength={1000} onChange={(e) => set({ description: e.target.value })}
          aria-invalid={!!errors.description} aria-describedby={describe("description", errors.description, true)} />
      </Field>
      <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
        <select id="categoryId" className={inputCls} value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-invalid={!!errors.categoryId}>
          <option value="">Choose a category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <TagInput tags={f.tags} onChange={(tags) => set({ tags })} error={errors.tags} />

      <fieldset>
        <legend className="font-semibold text-navy">How do you want to be paid?</legend>
        <div className="mt-2 flex gap-2">
          {([["cash", "Cash"], ["swap", "Swap"], ["both", "Cash or swap"]] as const).map(([v, l]) => (
            <label key={v} className={cardBtn(f.pricingMode === v)}>
              <input type="radio" name="pricingMode" className="sr-only" checked={f.pricingMode === v} onChange={() => set({ pricingMode: v })} />{l}
            </label>
          ))}
        </div>
      </fieldset>
      {showPrice && (
        <div className="space-y-3">
          <Field label="Price (rand)" htmlFor="priceZar" error={errors.priceZar}>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-navy" aria-hidden="true">R</span>
              <input id="priceZar" type="number" inputMode="numeric" min={0} step={1} className={inputCls} value={price}
                onChange={(e) => { setPrice(e.target.value); setErrors((x) => ({ ...x, priceZar: "" })); }}
                aria-invalid={!!errors.priceZar} aria-describedby={describe("priceZar", errors.priceZar)} />
            </div>
          </Field>
          {f.kind === "service" && (
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" className="h-5 w-5" checked={f.priceIsFrom} onChange={(e) => set({ priceIsFrom: e.target.checked })} />
              Show as a &ldquo;from&rdquo; price (final price depends on the job)
            </label>
          )}
        </div>
      )}
      {showSwap && (
        <Field label="What I'd swap for" htmlFor="swapFor" error={errors.swapFor} counter={`${f.swapFor.length}/200`} hint="e.g. a logo design, 1GB data, laptop help.">
          <input id="swapFor" className={inputCls} value={f.swapFor} maxLength={200} onChange={(e) => set({ swapFor: e.target.value })}
            aria-invalid={!!errors.swapFor} aria-describedby={describe("swapFor", errors.swapFor, true)} />
        </Field>
      )}

      <ImageManager userId={userId} listingId={f.id} images={f.images} title={f.title} error={errors.images}
        onChange={(images) => set({ images })} />

      <Field label={f.kind === "product" ? "Handover pickup point" : "Pickup point (optional)"} htmlFor="pickupPointId" error={errors.pickupPointId}
        hint="Chosen from your approved campus pickup points.">
        <select id="pickupPointId" className={inputCls} value={f.pickupPointId ?? ""} onChange={(e) => set({ pickupPointId: e.target.value || null })} aria-invalid={!!errors.pickupPointId}>
          <option value="">{f.kind === "product" ? "Choose a pickup point" : "None"}</option>
          {pickupPoints.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      {f.kind === "service" && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={f.deliveredOnCampus} onChange={(e) => set({ deliveredOnCampus: e.target.checked })} />
          Delivered on campus or online
        </label>
      )}

      <Field label="Availability" htmlFor="availability">
        <select id="availability" className={inputCls} value={f.availability} onChange={(e) => set({ availability: e.target.value as ListingInitial["availability"] })}>
          <option value="available">Available</option>
          <option value="sold_out">Sold out</option>
          <option value="paused">Paused (not taking orders for now)</option>
        </select>
      </Field>

      {formError && <Alert>{formError}</Alert>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <ButtonLink href="/sell/listings" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : isEdit ? "Save changes" : "Publish listing"}</Button>
      </div>
    </form>
  );
}
