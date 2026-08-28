import Link from "next/link";

export default function TenderNotFound() {
  return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 14, color: "var(--color-fg2)", marginBottom: 12 }}>
        Tender tidak ditemukan.
      </div>
      <Link href="/tenders" style={{ fontSize: 13 }}>
        &larr; Kembali ke tabel
      </Link>
    </div>
  );
}
