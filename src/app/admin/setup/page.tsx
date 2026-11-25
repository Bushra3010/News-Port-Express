import { redirect } from "next/navigation";
import { setupNeedsToken, userCount } from "@/lib/setup";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "First-time setup" };

export default async function SetupPage() {
  if ((await userCount()) > 0) redirect("/admin/login");
  return (
    <div className="auth">
      <div className="box" style={{ width: "min(480px,100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-np.jpg" alt="NewsPort Express" width={640} height={296} />
        <h1>Create the Super Admin account</h1>
        <p className="hint" style={{ margin: 0 }}>This page works only once. After the first account exists it is switched off, and all other users are created from Admin → Users.</p>
        <SetupForm needsToken={await setupNeedsToken()} />
      </div>
    </div>
  );
}
