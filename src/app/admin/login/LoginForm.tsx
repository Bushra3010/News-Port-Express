"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { loginAction } from "./actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useFormAction(loginAction);
  return (
    <form onSubmit={action} className="form">
      {state?.error ? <div className="alert err" role="alert">{state.error}</div> : null}
      <input type="hidden" name="next" value={next} />
      <label>Login ID (email or username)<input type="text" name="login" autoComplete="username" required autoFocus /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
      <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="hint" style={{ margin: 0, textAlign: "center" }}>Forgot your password? Ask your administrator to reset it.</p>
    </form>
  );
}
