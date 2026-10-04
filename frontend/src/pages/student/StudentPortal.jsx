import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import DashboardShell from "../../components/DashboardShell";
import StatusBadge from "../../components/StatusBadge";
import { ScrollText, Copy, ExternalLink } from "../../components/icons";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function StudentPortal() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/certificates")
      .then((res) => setCertificates(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      eyebrow={user?.institution?.name}
      title="Your credentials"
      subtitle={`${certificates.length} certificate${certificates.length === 1 ? "" : "s"} issued to you`}
    >
      {loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : certificates.length === 0 ? (
        <div className="rounded border border-dashed border-border-strong px-6 py-14 text-center">
          <ScrollText size={28} className="mx-auto text-ink-faint" strokeWidth={1.5} />
          <p className="mt-3 text-ink-muted">
            No certificates yet. Once your institution issues one, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <CertificateCard key={cert.certificateId} certificate={cert} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function CertificateCard({ certificate }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(certificate.certificateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-b border-border pb-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">{certificate.program}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {capitalize(certificate.credentialType)} · Awarded{" "}
            {new Date(certificate.awardDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <StatusBadge status={certificate.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-ink-muted hover:text-pine">
          <Copy size={14} />
          <span className="font-mono">{certificate.certificateId.slice(0, 14)}…</span>
          {copied && <span className="text-xs text-status-verified">Copied</span>}
        </button>
        <Link
          to={`/verify/${certificate.certificateId}`}
          className="flex items-center gap-1.5 font-medium text-pine hover:text-amber"
        >
          Public verification page
          <ExternalLink size={13} />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <img
          src={`${API_BASE_URL}/certificates/${encodeURIComponent(certificate.certificateId)}/qrcode`}
          alt="Certificate QR code"
          className="h-28 w-28"
        />
        <span className="text-xs text-ink-muted">Scan to open the public verification page.</span>
      </div>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
