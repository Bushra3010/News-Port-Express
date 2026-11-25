"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { useState } from "react";
import { createUser, deleteUser, resetPassword, setActive, updateUser } from "@/app/admin/(panel)/users/actions";
import type { FormState } from "@/lib/forms";

type Opt = { id: number; name: string };
export type UserData = {
  id?: number; name: string; email: string; username: string; roleId: number | null; phone: string; bio: string;
  canPublish: boolean; isActive: boolean; scopeCategories: number[]; scopeStates: number[];
};

function Secret({ state }: { state: FormState }) {
  if (!state?.secret) return null;
  return (
    <div className="alert ok">
      <p style={{ margin: "0 0 8px" }}>{state.message}</p>
      <span className="secret">{state.secret}</span>{" "}
      <button type="button" className="btn ghost sm" onClick={() => navigator.clipboard.writeText(state.secret!)}>Copy</button>
    </div>
  );
}

export default function UserForm({ data, roles, categories, states, isSelf }: {
  data: UserData; roles: (Opt & { key: string; description: string | null })[]; categories: Opt[]; states: Opt[]; isSelf: boolean;
}) {
  const [state, action, pending] = useFormAction(data.id ? updateUser : createUser, null);
  const [reset, resetAction, resetPending] = useFormAction(resetPassword);
  const [act, actAction, actPending] = useFormAction(setActive);
  const [del, delAction, delPending] = useFormAction(deleteUser);
  const [roleId, setRoleId] = useState(data.roleId ?? roles[roles.length - 1]?.id);
  const [generate, setGenerate] = useState(true);
  const roleKey = roles.find((r) => r.id === roleId)?.key;

  if (!data.id && state?.ok && state.secret) {
    return (
      <div className="card form">
        <Secret state={state} />
        <div className="row"><a className="btn" href={`/admin/users/${state.id}`}>Open user</a><a className="btn ghost" href="/admin/users/new">Create another</a><a className="btn ghost" href="/admin/users">Back to users</a></div>
      </div>
    );
  }

  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <form onSubmit={action} className="card form">
        <h2>{data.id ? "Account details" : "New account"}</h2>
        {state?.error ? <div className="alert err">{state.error}</div> : null}
        {state?.ok && !state.secret ? <div className="alert ok">{state.message}</div> : null}
        <input type="hidden" name="id" value={data.id ?? ""} />
        <label>Full name<input type="text" name="name" defaultValue={data.name} required maxLength={80} /></label>
        <div className="grid g2">
          <label>Email<input type="email" name="email" defaultValue={data.email} required maxLength={120} /></label>
          <label>Login ID (username)<input type="text" name="username" defaultValue={data.username} required pattern="[a-zA-Z0-9._\-]{3,32}" /></label>
        </div>
        <label>Role<select name="roleId" value={roleId ?? ""} onChange={(e) => setRoleId(Number(e.target.value))} disabled={isSelf}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select><small>{roles.find((r) => r.id === roleId)?.description}</small></label>
        {isSelf ? <input type="hidden" name="roleId" value={roleId ?? ""} /> : null}
        {roleKey === "editor" || roleKey === "reporter" ? (
          <label className="check"><input type="checkbox" name="canPublish" defaultChecked={data.canPublish} />Allowed to publish directly (skips approval)</label>
        ) : null}
        <div className="grid g2">
          <label>Phone<input type="text" name="phone" defaultValue={data.phone} maxLength={20} /></label>
          <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="isActive" defaultChecked={data.isActive} disabled={isSelf} />Account active</label>
        </div>
        {isSelf ? <input type="hidden" name="isActive" value="on" /> : null}
        <label>Short bio <small>Shown on the author page</small><textarea name="bio" defaultValue={data.bio} rows={2} maxLength={600} /></label>

        {roleKey !== "super_admin" ? (
          <fieldset>
            <legend>Assigned categories &amp; states</legend>
            <p className="hint" style={{ margin: 0 }}>Leave all unticked for full access. When ticked, this user only sees and works on news in these categories/states.</p>
            <div className="grid g2">
              <div className="grid" style={{ gap: 4, maxHeight: 220, overflow: "auto" }}>
                <b>Categories</b>
                {categories.map((c) => <label key={c.id} className="check" style={{ fontWeight: 400 }}><input type="checkbox" name="scopeCategories" value={c.id} defaultChecked={data.scopeCategories.includes(c.id)} />{c.name}</label>)}
              </div>
              <div className="grid" style={{ gap: 4, maxHeight: 220, overflow: "auto" }}>
                <b>States</b>
                {states.map((s) => <label key={s.id} className="check" style={{ fontWeight: 400 }}><input type="checkbox" name="scopeStates" value={s.id} defaultChecked={data.scopeStates.includes(s.id)} />{s.name}</label>)}
              </div>
            </div>
          </fieldset>
        ) : null}

        {!data.id ? (
          <fieldset>
            <legend>Password</legend>
            <label className="check" style={{ fontWeight: 400 }}><input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} />Generate a secure temporary password</label>
            {!generate ? <label>Temporary password<input type="text" name="password" minLength={10} autoComplete="off" /><small>At least 10 characters with letters and numbers.</small></label> : null}
            <p className="hint" style={{ margin: 0 }}>The user must choose their own password the first time they sign in.</p>
          </fieldset>
        ) : null}
        <button className="btn" disabled={pending}>{pending ? "Saving…" : data.id ? "Save changes" : "Create account"}</button>
      </form>

      {data.id && !isSelf ? (
        <div className="grid">
          <form onSubmit={resetAction} className="card form">
            <h2>Reset password</h2>
            <p className="hint" style={{ margin: 0 }}>Creates a new temporary password and signs the user out everywhere.</p>
            <input type="hidden" name="id" value={data.id} />
            {reset?.error ? <div className="alert err">{reset.error}</div> : null}
            <Secret state={reset} />
            <button className="btn ghost" disabled={resetPending} onClick={(e) => { if (!confirm("Reset this user's password?")) e.preventDefault(); }}>Generate new password</button>
          </form>
          <form onSubmit={actAction} className="card form">
            <h2>{data.isActive ? "Deactivate" : "Activate"} account</h2>
            <input type="hidden" name="id" value={data.id} /><input type="hidden" name="active" value={data.isActive ? "0" : "1"} />
            {act?.error ? <div className="alert err">{act.error}</div> : null}
            {act?.ok ? <div className="alert ok">{act.message} Reload to see the change.</div> : null}
            <p className="hint" style={{ margin: 0 }}>{data.isActive ? "A deactivated user cannot sign in. Their articles stay on the site." : "Lets this user sign in again."}</p>
            <button className={`btn ${data.isActive ? "ghost" : "green"}`} disabled={actPending}>{data.isActive ? "Deactivate" : "Activate"}</button>
          </form>
          <form onSubmit={delAction} className="card form">
            <h2>Delete user</h2>
            {del?.error ? <div className="alert err">{del.error}</div> : null}
            <p className="hint" style={{ margin: 0 }}>Permanently removes the account. Their published articles stay, with their name kept as the byline.</p>
            <input type="hidden" name="id" value={data.id} />
            <button className="btn red" disabled={delPending} onClick={(e) => { if (!confirm("Delete this user permanently? This cannot be undone.")) e.preventDefault(); }}>Delete user</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
