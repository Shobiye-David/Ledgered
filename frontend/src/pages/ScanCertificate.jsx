import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";

const READER_ID = "certificate-qr-reader";

export default function ScanCertificate() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let hasStarted = false;
    const scanner = new Html5Qrcode(READER_ID);

    async function startScanner() {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (cancelled) return;
            try {
              const scannedUrl = new URL(decodedText);
              const match = scannedUrl.pathname.match(/^\/verify\/([^/]+)\/?$/);
              if (!match) throw new Error("unrecognized certificate URL");
              cancelled = true;
              scanner
                .stop()
                .catch(() => {})
                .finally(() => navigate(`/verify/${decodeURIComponent(match[1])}`));
            } catch {
              setError("That QR code is not a recognizable Ledgered certificate link.");
            }
          },
          () => {}
        );

        if (cancelled) {
          // Component was unmounted while start() was still pending (e.g. StrictMode's
          // double-invoke in development). Stop immediately since we now know it's running.
          await scanner.stop().catch(() => {});
          try {
            scanner.clear();
          } catch {
            // ignore
          }
          return;
        }

        hasStarted = true;
      } catch {
        if (!cancelled) {
          setError("Camera access was unavailable. Allow camera access and try again.");
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (hasStarted) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // ignore
            }
          });
      }
      // If start() never actually completed (hasStarted is false), do NOT call stop() here —
      // the pending startScanner() call above will detect `cancelled` once its await resolves
      // and handle cleanup itself. Calling stop() on a scanner that hasn't finished starting
      // is exactly what throws "Cannot stop, scanner is not running or paused."
    };
  }, [navigate]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl text-ink">Scan a certificate</h1>
      <p className="mt-2 text-ink-muted">Point your camera at a Ledgered certificate QR code.</p>

      <div id={READER_ID} className="mt-8 overflow-hidden rounded border border-border bg-paper" />

      {error && (
        <p className="mt-4 rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
          {error}
        </p>
      )}
    </div>
  );
}
