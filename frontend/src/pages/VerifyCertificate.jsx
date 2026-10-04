import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import Button from "../components/Button";
import { Search, ShieldCheck, ShieldX, ShieldQuestion, ExternalLink, Copy } from "../components/icons";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function VerifyCertificate() {
  const { certificateId: routeId } = useParams();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState(routeId || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (routeId) runVerification(routeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  async function runVerification(id) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.get(`/verify/${id}`);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't complete this check. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    navigate(`/verify/${inputValue.trim()}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl text-ink">Verify a certificate</h1>
      <p className="mt-2 text-ink-muted">
        Enter the certificate ID printed on the credential. Ledgered checks it directly against the
        Polygon Amoy contract.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-3 rounded border border-border-strong bg-paper px-4 focus-within:border-pine">
          <Search size={17} className="shrink-0 text-ink-faint" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="0x7a3f4e…"
            className="h-full w-full bg-transparent font-mono text-sm outline-none placeholder:text-ink-faint"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Checking…" : "Verify"}
        </Button>
      </form>

      <Link to="/scan" className="mt-3 inline-block text-sm font-medium text-pine hover:text-amber">
        Or scan a certificate's QR code →
      </Link>

      <div className="mt-10">
        {error && (
          <div className="rounded border border-status-revoked/30 bg-status-revoked-tint px-5 py-4 text-status-revoked">
            {error}
          </div>
        )}

        {result && !result.found && (
          <SealResult
            tone="unknown"
            heading="No matching record"
            body="This certificate ID does not exist in Ledgered's registry. Double-check the ID with the person who presented it."
          />
        )}

        {result?.found && <VerifiedResult result={result} />}
      </div>
    </div>
  );
}

function VerifiedResult({ result }) {
  const { certificate, chain, isAuthentic, isActive } = result;

  if (result.verificationStatus === "document_unavailable") {
    return (
      <SealResult
        tone="unknown"
        heading="Document unavailable"
        body="The certificate record was found, but its stored document could not be downloaded. Authenticity cannot be confirmed right now."
      />
    );
  }

  if (!isAuthentic) {
    return (
      <SealResult
        tone="unknown"
        heading="Record found, but it does not match the chain"
        body="The stored record's hash does not match what's anchored on-chain. Treat this certificate as unverified and contact the issuing institution."
      />
    );
  }

  const tone = isActive ? "verified" : "revoked";
  const supersededByLink = getCertificateLinkId(certificate.supersededBy);

  return (
    <div>
      <SealResult
        tone={tone}
        heading={isActive ? "Authentic and active" : "Authentic, but revoked"}
        body={
          isActive
            ? `Issued by ${certificate.institution.name} and confirmed on Polygon Amoy.`
            : `Issued by ${certificate.institution.name}, then revoked${
                certificate.revokedReason ? `: ${certificate.revokedReason}` : "."
              }`
        }
      />

      {supersededByLink && (
        <p className="mt-6 rounded border border-status-pending/30 bg-status-pending-tint px-5 py-4 text-sm text-ink">
          A corrected version of this certificate exists—{" "}
          <Link className="font-medium text-pine hover:text-amber" to={`/verify/${supersededByLink}`}>
            view current version
          </Link>
        </p>
      )}

      {certificate.documentUrl && (
        <a
          href={certificate.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded border border-border-strong px-4 py-2 text-sm text-ink transition-colors hover:border-pine hover:text-pine"
        >
          View certificate document <ExternalLink size={14} />
        </a>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-5 rounded border border-border bg-paper p-4">
        <img
          src={`${API_BASE_URL}/certificates/${encodeURIComponent(certificate.certificateId)}/qrcode`}
          alt="Certificate QR code"
          className="h-36 w-36"
        />
        <p className="max-w-xs text-sm text-ink-muted">
          Scan this QR code to open the public verification page for this certificate.
        </p>
      </div>

      <dl className="mt-10 divide-y divide-border border-t border-border">
        <Row label="Certificate holder" value={certificate.studentName} />
        <Row label="Program" value={certificate.program} />
        <Row label="Credential type" value={capitalize(certificate.credentialType)} />
        {certificate.classification && <Row label="Classification" value={certificate.classification} />}
        <Row label="Awarded" value={new Date(certificate.awardDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
        <Row label="Issuing institution" value={certificate.institution.name} />
        <Row
          label="Certificate ID"
          value={certificate.certificateId}
          mono
          copyable
        />
        <Row
          label="Issuance transaction"
          value={chain.issueTxHash}
          mono
          link={`https://amoy.polygonscan.com/tx/${chain.issueTxHash}`}
        />
        {chain.revokeTxHash && (
          <Row
            label="Revocation transaction"
            value={chain.revokeTxHash}
            mono
            link={`https://amoy.polygonscan.com/tx/${chain.revokeTxHash}`}
          />
        )}
      </dl>
    </div>
  );
}

function SealResult({ tone, heading, body }) {
  const config = {
    verified: { Icon: ShieldCheck, ring: "border-status-verified", text: "text-status-verified", bg: "bg-status-verified-tint" },
    revoked: { Icon: ShieldX, ring: "border-status-revoked", text: "text-status-revoked", bg: "bg-status-revoked-tint" },
    unknown: { Icon: ShieldQuestion, ring: "border-status-pending", text: "text-status-pending", bg: "bg-status-pending-tint" },
  }[tone];

  const { Icon, ring, text, bg } = config;

  return (
    <div className={`rounded-seal border-2 ${ring} ${bg} px-8 py-10 text-center`}>
      <Icon size={40} strokeWidth={1.75} className={`mx-auto ${text}`} />
      <h2 className={`mt-4 font-display text-2xl ${text}`}>{heading}</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-muted">{body}</p>
    </div>
  );
}

function Row({ label, value, mono, copyable, link }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`flex items-center gap-2 text-right text-sm text-ink ${mono ? "font-mono tabular" : ""}`}>
        <span className="truncate max-w-[16rem] sm:max-w-none">{value}</span>
        {copyable && (
          <button onClick={handleCopy} className="text-ink-faint transition-colors hover:text-pine" aria-label="Copy to clipboard">
            <Copy size={14} />
            {copied && <span className="ml-1 text-xs text-status-verified">Copied</span>}
          </button>
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-ink-faint transition-colors hover:text-pine" aria-label="View on block explorer">
            <ExternalLink size={14} />
          </a>
        )}
      </dd>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getCertificateLinkId(certificateRef) {
  if (!certificateRef) return null;
  return certificateRef.certificateId || certificateRef;
}
