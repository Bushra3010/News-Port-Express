import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { editorOptions, loadArticleForEdit } from "@/lib/admin-data";
import { canView } from "@/lib/permissions";
import { siteUrl } from "@/lib/db";
import { toInt } from "@/lib/util";
import ArticleForm from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit News" };

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const user = await requireUser();
  const id = toInt((await params).id);
  const r = id ? await loadArticleForEdit(id, user) : null;
  if (!r || !canView(user, r.a)) notFound();
  const opts = await editorOptions(user, r.data.stateId, r.data.districtId);
  const { msg } = await searchParams;
  return (
    <ArticleForm key={r.a.id} data={r.data} caps={r.caps} categories={opts.categories} states={opts.states}
      initialDistricts={opts.districts} initialCities={opts.cities} authors={opts.authors} siteUrl={siteUrl()} flash={msg?.slice(0, 200)} />
  );
}
