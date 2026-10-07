"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import Icon from "@/components/Icon";
import { Button, inputCls } from "@/components/ui";

type Opt = { slug: string; name: string };
type Values = { category: string; campus: string; kind: string; mode: string; min: string; max: string; avail: boolean; q: string; sort: string };

/** Filters live in the URL: a plain GET form. Bottom sheet on mobile, sidebar on desktop. */
export default function BrowseFilters({ v, categories, campuses, activeCount, clearHref }: {
  v: Values; categories: Opt[]; campuses: Opt[]; activeCount: number; clearHref: string;
}) {
  const [open, setOpen] = useState(false);
  const firstRef = useRef<HTMLSelectElement>(null);
  // Drag the handle down to dismiss (sheet pattern adapted from a 21st.dev bottom sheet, without the animation library).
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-navy px-4 font-semibold text-navy transition-transform active:scale-[.98] md:hidden">
        <Icon name="filter" size="md" />Filters{activeCount > 0 && <span className="rounded-full bg-navy px-2 text-sm text-white">{activeCount}</span>}
      </button>

      <div className={open ? "fixed inset-0 z-50 flex items-end bg-navy/60 md:static md:z-auto md:block md:bg-transparent" : "hidden md:block"}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? "Filter listings" : undefined}
          style={open && dy ? { transform: `translateY(${dy}px)` } : undefined}
          className={open ? "max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl" : ""}>
          <div aria-hidden="true" className="-mt-2 mb-2 flex h-6 cursor-grab touch-none justify-center md:hidden"
            onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (startY.current !== null) setDy(Math.max(0, e.clientY - startY.current)); }}
            onPointerUp={() => { if (dy > 100) setOpen(false); startY.current = null; setDy(0); }}
            onPointerCancel={() => { startY.current = null; setDy(0); }}>
            <span className="mt-2 h-1.5 w-10 rounded-full bg-navy/30" />
          </div>
          <div className="mb-3 flex items-center justify-between md:hidden">
            <h2 className="font-display text-xl font-bold text-navy">Filters</h2>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 font-semibold text-royal underline">Close</button>
          </div>
          <form action="/browse" method="get" className="space-y-4">
            {v.q && <input type="hidden" name="q" value={v.q} />}
            {v.sort && <input type="hidden" name="sort" value={v.sort} />}
            <Select label="Category" name="category" value={v.category} innerRef={firstRef} options={categories} any="All categories" />
            <Select label="Campus" name="campus" value={v.campus} options={campuses} any="All campuses" />
            <Select label="Type" name="kind" value={v.kind} options={[{ slug: "product", name: "Products" }, { slug: "service", name: "Services" }]} any="Products and services" />
            <Select label="Payment" name="mode" value={v.mode}
              options={[{ slug: "cash", name: "Accepts cash" }, { slug: "swap", name: "Accepts swaps" }, { slug: "both", name: "Cash or swap" }]} any="Any payment" />
            <fieldset>
              <legend className="font-semibold text-navy">Price (rand)</legend>
              <div className="mt-1 flex items-center gap-2">
                <label className="sr-only" htmlFor="f-min">Minimum price</label>
                <input id="f-min" name="min" type="number" inputMode="numeric" min={0} placeholder="Min" defaultValue={v.min} className={inputCls} />
                <span aria-hidden="true">to</span>
                <label className="sr-only" htmlFor="f-max">Maximum price</label>
                <input id="f-max" name="max" type="number" inputMode="numeric" min={0} placeholder="Max" defaultValue={v.max} className={inputCls} />
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3">
              {/* checkbox first: when ticked the first avail value is "1" */}
              <input type="checkbox" name="avail" value="1" defaultChecked={v.avail} className="h-5 w-5" />
              Available only
            </label>
            <input type="hidden" name="avail" value="0" />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Show results</Button>
              <a href={clearHref} className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-navy px-4 font-semibold text-navy hover:bg-mist">Clear</a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Select({ label, name, value, options, any, innerRef }: {
  label: string; name: string; value: string; options: Opt[]; any: string; innerRef?: Ref<HTMLSelectElement>;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="font-semibold text-navy">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value} ref={innerRef} className={`${inputCls} mt-1`}>
        <option value="">{any}</option>
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
      </select>
    </div>
  );
}
