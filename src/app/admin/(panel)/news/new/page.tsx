import { requirePage } from "@/lib/auth";
import { editorOptions, emptyArticle, newCaps } from "@/lib/admin-data";
import { siteUrl } from "@/lib/db";
import ArticleForm from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add News" };

export default async function NewArticle() {
  const user = await requirePage("articles.create");
  const data = emptyArticle(user);
  const opts = await editorOptions(user, data.stateId, null);
  return (
    <ArticleForm data={data} caps={newCaps(user)} categories={opts.categories} states={opts.states}
      initialDistricts={opts.districts} initialCities={opts.cities} authors={opts.authors} siteUrl={siteUrl()} />
  );
}
