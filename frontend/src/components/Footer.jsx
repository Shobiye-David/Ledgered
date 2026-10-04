import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-ink-muted">
        <p>Ledgered is a credential registry. Certificate records are anchored on Polygon Amoy.</p>
        <p className="mt-1">© {new Date().getFullYear()} Ledgered. Not affiliated with any single institution.</p>
      </div>
    </footer>
  );
}
