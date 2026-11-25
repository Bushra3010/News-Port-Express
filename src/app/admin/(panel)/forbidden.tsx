import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="card form" style={{ maxWidth: 620 }}>
      <h1>Access denied</h1>
      <p>Your role does not have permission to open this page. Ask a Super Admin if you need access.</p>
      <div className="row"><Link className="btn" href="/admin">Back to dashboard</Link></div>
    </div>
  );
}
