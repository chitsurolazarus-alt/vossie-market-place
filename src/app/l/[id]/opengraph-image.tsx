import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { priceLabel, publicImageUrl } from "@/lib/format";

export const runtime = "nodejs";
export const alt = "HustleHub listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card for WhatsApp / Instagram previews. Uses the anon key, so only publicly
// visible listings (approved seller, not hidden, not deleted) get a photo and details.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "HustleHub";
  let price = "Student hustles. Nationwide.";
  let seller = "Eduvos Incubation Hub";
  let photo: string | null = null;

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("browse_listings")
      .select("title,pricing_mode,price_zar,price_is_from,business_name,cover_path").eq("id", id).maybeSingle();
    if (data) {
      title = data.title ?? title;
      price = priceLabel({ pricing_mode: data.pricing_mode ?? "cash", price_zar: data.price_zar, price_is_from: !!data.price_is_from });
      seller = data.business_name ?? seller;
      if (data.cover_path) {
        const res = await fetch(publicImageUrl(data.cover_path));
        if (res.ok) {
          // Satori can't decode WebP, so convert the cover to PNG first.
          const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(630, 630, { fit: "cover" }).png().toBuffer();
          photo = `data:image/png;base64,${png.toString("base64")}`;
        }
      }
    }
  } catch {
    // fall through to the branded card
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#16305E", color: "#fff" }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={630} height={630} style={{ width: 630, height: 630, objectFit: "cover" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ width: 96, height: 8, background: "#CFAE7E", marginBottom: 28 }} />
            <div style={{ fontSize: photo ? 52 : 72, fontWeight: 700, lineHeight: 1.1 }}>{title.slice(0, 70)}</div>
            <div style={{ fontSize: 44, color: "#CFAE7E", marginTop: 24, fontWeight: 700 }}>{price}</div>
            <div style={{ fontSize: 30, marginTop: 12, color: "#dbe3f3" }}>{seller}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>HustleHub</div>
            <div style={{ fontSize: 24, color: "#dbe3f3" }}>Student hustles. Nationwide.</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
