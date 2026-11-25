"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { setupAction } from "../login/actions";

export default function SetupForm({ needsToken }: { needsToken: boolean }) {
  const [state, action, pending] = useFormAction(setupAction);
  return (
    <form onSubmit={action} className="form">
      {state?.error ? <div className="alert err" role="alert">{state.error}</div> : null}
      {needsToken ? <label>Setup token<input type="password" name="token" required autoComplete="off" /><small>The SETUP_TOKEN secret set on the server.</small></label> : null}
      <label>Full name<input type="text" name="name" required maxLength={80} /></label>
      <label>Email<input type="email" name="email" required autoComplete="email" /></label>
      <label>Username<input type="text" name="username" required pattern="[a-zA-Z0-9._\-]{3,32}" autoComplete="username" /><small>3–32 letters, numbers, dot, dash or underscore.</small></label>
      <label>Password<input type="password" name="password" required minLength={10} autoComplete="new-password" /><small>At least 10 characters, with letters and numbers.</small></label>
      <label>Confirm password<input type="password" name="confirm" required minLength={10} autoComplete="new-password" /></label>
      <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create Super Admin"}</button>
    </form>
  );
}
