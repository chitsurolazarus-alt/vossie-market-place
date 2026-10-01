import PostForm from "@/components/growth/PostForm";
import { getReference } from "@/lib/browse";
import { requireStaff } from "@/lib/roles";

export const metadata = { title: "New Hub post", robots: { index: false } };

export default async function NewPost() {
  const { user } = await requireStaff("/growth/new");
  const ref = await getReference();
  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-navy">New Hub post</h1>
      <div className="mt-6">
        <PostForm userId={user.id} campuses={ref.campuses}
          initial={{ id: null, kind: "tip", title: "", body: "", coverPath: null, campusId: null, eventAt: "", venue: "", capacity: "", published: true }} />
      </div>
    </section>
  );
}
