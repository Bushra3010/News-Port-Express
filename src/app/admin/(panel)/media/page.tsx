import { can, requirePage } from "@/lib/auth";
import { MediaBrowser } from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media Library" };

export default async function MediaPage() {
  const user = await requirePage("media.upload");
  return (
    <>
      <div className="head"><div><h1>Media Library</h1><p>Every uploaded image and video, reusable in any article. Click a file to edit its alt text, title and description{can(user, "media.manage") ? " or delete it" : ""}.</p></div></div>
      <div className="card"><MediaBrowser canManageAll={can(user, "media.manage")} userId={user.id} /></div>
    </>
  );
}
