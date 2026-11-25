import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { userCount } from "@/lib/setup";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if ((await userCount()) === 0) redirect("/admin/setup");
  if (await getCurrentUser()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <div className="auth">
      <div className="box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-np.jpg" alt="NewsPort Express" width={640} height={296} />
        <h1>Admin Panel Sign In</h1>
        <LoginForm next={next ?? ""} />
      </div>
    </div>
  );
}
