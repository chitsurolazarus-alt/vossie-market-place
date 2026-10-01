import { notFound } from "next/navigation";
import { z } from "zod";
import PostForm from "@/components/growth/PostForm";
import { getReference } from "@/lib/browse";
import { toLocalInput } from "@/lib/format";
import { getHubPost } from "@/lib/hub";
import { requireStaff } from "@/lib/roles";

export const metadata = { title: "Edit Hub post", robots: { index: false } };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, profile } = await requireStaff(`/growth/${id}/edit`);
  const post = await getHubPost(id);
  if (!post || (profile.role !== "admin" && post.author_id !== user.id)) notFound();
  const ref = await getReference();
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-navy">Edit Hub post</h1>
      <div className="mt-6">
        <PostForm userId={user.id} campuses={ref.campuses}
          initial={{ id: post.id, kind: post.kind as "tip", title: post.title, body: post.body, coverPath: post.cover_path, campusId: post.campus_id,
            eventAt: toLocalInput(post.event_at), venue: post.venue ?? "", capacity: post.capacity ? String(post.capacity) : "", published: post.published }} />
      </div>
    </section>
  );
}
