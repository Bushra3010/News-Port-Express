"use client";

import Link from "next/link";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /permission/i.test(error.message);
  return (
    <div className="card form" style={{ maxWidth: 620 }}>
      <h1>{forbidden ? "Access denied" : "Something went wrong"}</h1>
      <p>{forbidden ? "Your role does not have permission to open this page. Ask a Super Admin if you need access." : "The page could not be loaded. Try again; if it keeps happening, note the time and tell your administrator."}</p>
      {error.digest ? <p className="hint">Reference: {error.digest}</p> : null}
      <div className="row"><button className="btn" onClick={reset}>Try again</button><Link className="btn ghost" href="/admin">Dashboard</Link></div>
    </div>
  );
}
