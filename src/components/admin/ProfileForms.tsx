"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { changePassword, updateProfile } from "@/app/admin/(panel)/users/actions";

export default function ProfileForms({ name, phone, bio, mustChange }: { name: string; phone: string; bio: string; mustChange: boolean }) {
  const [pw, pwAction, pwPending] = useFormAction(changePassword);
  const [pr, prAction, prPending] = useFormAction(updateProfile);
  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <form onSubmit={pwAction} className="card form">
        <h2>Change password</h2>
        {pw?.error ? <div className="alert err">{pw.error}</div> : null}
        <label>Current password<input type="password" name="current" required autoComplete="current-password" /></label>
        <label>New password<input type="password" name="next" required minLength={10} autoComplete="new-password" /><small>At least 10 characters, with letters and numbers.</small></label>
        <label>Confirm new password<input type="password" name="confirm" required minLength={10} autoComplete="new-password" /></label>
        <button className="btn" disabled={pwPending}>Change password</button>
        <p className="hint" style={{ margin: 0 }}>This signs you out on all other devices.</p>
      </form>
      {!mustChange ? (
        <form onSubmit={prAction} className="card form">
          <h2>Your details</h2>
          {pr?.error ? <div className="alert err">{pr.error}</div> : null}
          {pr?.ok ? <div className="alert ok">{pr.message}</div> : null}
          <label>Name<input type="text" name="name" defaultValue={name} required maxLength={80} /></label>
          <label>Phone<input type="text" name="phone" defaultValue={phone} maxLength={20} /></label>
          <label>Short bio <small>Shown on your author page</small><textarea name="bio" defaultValue={bio} rows={3} maxLength={600} /></label>
          <button className="btn" disabled={prPending}>Save</button>
        </form>
      ) : null}
    </div>
  );
}
