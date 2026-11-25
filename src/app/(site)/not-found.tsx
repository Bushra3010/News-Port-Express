import Link from "next/link";

export default function NotFound() {
  return (
    <section style={{ padding: "60px 0", textAlign: "center" }}>
      <h1 style={{ fontSize: 44, margin: 0, color: "var(--orange)" }}>404</h1>
      <p style={{ fontSize: 18 }}>यह पेज नहीं मिला। हो सकता है खबर हटा दी गई हो या लिंक गलत हो।</p>
      <p><Link href="/" style={{ color: "var(--orange)", fontWeight: 700 }}>होम पेज पर जाएं ›</Link> · <Link href="/latest" style={{ color: "var(--orange)", fontWeight: 700 }}>ताज़ा खबरें ›</Link></p>
    </section>
  );
}
