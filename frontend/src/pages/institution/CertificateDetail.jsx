import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { ExternalLink, Copy } from "../../components/icons";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const NAV = [
  { to: "/institution", label: "Certificates" },
  { to: "/institution/issue", label: "Issue new" },
];

const CREDENTIAL_TYPES = [
  { value: "degree", label: "Degree" },
  { value: "hnd", label: "HND (Higher National Diploma)" },
  { value: "ond", label: "OND (Ordinary National Diploma)" },
  { value: "diploma", label: "Diploma" },
  { value: "certificate", label: "Certificate" },
  { value: "transcript", label: "Transcript" },
];

const CLASSIFICATION_OPTIONS = {
  degree: ["First Class", "Second Class Upper", "Second Class Lower", "Third Class", "Pass"],
  hnd: ["Distinction", "Upper Credit", "Lower Credit", "Pass"],
  ond: ["Distinction", "Upper Credit", "Lower Credit", "Pass"],
};

const emptyReissueForm = {
  studentName: "",
  studentReference: "",
  studentEmail: "",
  program: "",
  credentialType: "degree",
  awardDate: "",
  classification: "",
  certificateFile: null,
};

export default function CertificateDetail() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRevoke, setShowRevoke] = useState(false);
  const [reason, setReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [showReissue, setShowReissue] = useState(false);
  const [reissueForm, setReissueForm] = useState(emptyReissueForm);
  const [reissuing, setReissuing] = useState(false);
  const [reissueClassificationManual, setReissueClassificationManual] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificateId]);

  function load() {
    setLoading(true);
    api
      .get(`/certificates/${certificateId}`)
      .then((res) => setCertificate(res.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load this record."))
      .finally(() => setLoading(false));
  }

  async function handleRevoke(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setRevoking(true);
    try {
      const res = await api.post(`/certificates/${certificateId}/revoke`, { reason });
      setCertificate(res.data);
      setShowRevoke(false);
    } catch (err) {
      setError(err.response?.data?.message || "Revocation failed.");
    } finally {
      setRevoking(false);
    }
  }

  function openReissueForm() {
    const credentialType = certificate.credentialType || "degree";
    const classification = certificate.classification || "";
    setReissueForm({
      studentName: certificate.studentName || "",
      studentReference: certificate.studentReference || "",
      studentEmail: certificate.studentEmail || "",
      program: certificate.program || "",
      credentialType,
      awardDate: certificate.awardDate ? certificate.awardDate.slice(0, 10) : "",
      classification,
      certificateFile: null,
    });
    setReissueClassificationManual(Boolean(
      CLASSIFICATION_OPTIONS[credentialType]
      && classification
      && !CLASSIFICATION_OPTIONS[credentialType].includes(classification)
    ));
    setShowReissue(true);
    setError(null);
  }

  function updateReissue(field, value) {
    setReissueForm((form) => ({ ...form, [field]: value }));
  }

  function updateReissueCredentialType(credentialType) {
    setReissueForm((form) => {
      const options = CLASSIFICATION_OPTIONS[credentialType];
      const classification = options?.includes(form.classification) ? form.classification : "";
      return { ...form, credentialType, classification };
    });
    setReissueClassificationManual(false);
  }

  async function handleReissue(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reissueForm.studentEmail.trim())) {
      setError("Enter a valid student email address.");
      return;
    }
    if (!reissueForm.certificateFile) {
      setError("Attach the corrected certificate as a PDF, PNG, or JPEG file.");
      return;
    }

    setReissuing(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(reissueForm).forEach(([field, value]) => {
        if (value !== null && value !== undefined) formData.append(field, value);
      });
      const res = await api.post(`/certificates/${certificateId}/reissue`, formData);
      navigate(`/institution/certificates/${res.data.certificateId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Correction reissue failed.");
    } finally {
      setReissuing(false);
    }
  }

  const supersedesLink = getCertificateLinkId(certificate?.supersedes);
  const supersededByLink = getCertificateLinkId(certificate?.supersededBy);

  if (loading) {
    return (
      <DashboardShell title="Certificate record" navItems={NAV}>
        <p className="text-ink-muted">Loading…</p>
      </DashboardShell>
    );
  }

  if (error && !certificate) {
    return (
      <DashboardShell title="Certificate record" navItems={NAV}>
        <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-status-revoked">
          {error}
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow={certificate.institution?.name}
      title={certificate.studentName}
      subtitle={certificate.program}
      navItems={NAV}
      actions={
        <>
          <StatusBadge status={certificate.status} />
          {certificate.status === "active" && (
            <Button variant="danger" onClick={() => setShowRevoke(true)}>
              Revoke
            </Button>
          )}
          {certificate.status === "revoked" && !certificate.supersededBy && (
            <Button onClick={openReissueForm}>Reissue as correction</Button>
          )}
        </>
      }
    >
      {error && certificate && (
        <p className="mb-6 rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-status-revoked">
          {error}
        </p>
      )}

      {(supersedesLink || supersededByLink) && (
        <div className="mb-6 max-w-xl space-y-3">
          {supersedesLink && (
            <p className="rounded border border-status-pending/30 bg-status-pending-tint px-4 py-3 text-sm text-ink">
              This certificate corrects a previous one —{" "}
              <Link className="font-medium text-pine hover:text-amber" to={`/institution/certificates/${supersedesLink}`}>
                view original
              </Link>
            </p>
          )}
          {supersededByLink && (
            <p className="rounded border border-status-verified/30 bg-status-verified-tint px-4 py-3 text-sm text-ink">
              This certificate has been superseded by a corrected version —{" "}
              <Link className="font-medium text-pine hover:text-amber" to={`/institution/certificates/${supersededByLink}`}>
                view latest
              </Link>
            </p>
          )}
        </div>
      )}

      <dl className="max-w-xl divide-y divide-border border-t border-border">
        <Row label="Student reference" value={certificate.studentReference} />
        <Row label="Student email" value={certificate.studentEmail || "—"} />
        <Row label="Credential type" value={capitalize(certificate.credentialType)} />
        {certificate.classification && <Row label="Classification" value={certificate.classification} />}
        <Row
          label="Awarded"
          value={new Date(certificate.awardDate).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />
        {certificate.issuedBy && <Row label="Issued by" value={formatUser(certificate.issuedBy)} />}
        <Row label="Certificate ID" value={certificate.certificateId} mono copyable />
        <Row label="Issuance transaction" mono value={certificate.issueTxHash} link={`https://amoy.polygonscan.com/tx/${certificate.issueTxHash}`} />
        {certificate.revokeTxHash && (
          <Row label="Revocation transaction" mono value={certificate.revokeTxHash} link={`https://amoy.polygonscan.com/tx/${certificate.revokeTxHash}`} />
        )}
        {certificate.revokedAt && (
          <Row
            label="Revoked"
            value={new Date(certificate.revokedAt).toLocaleString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        )}
        {certificate.revokedBy && <Row label="Revoked by" value={formatUser(certificate.revokedBy)} />}
        {certificate.revokedReason && <Row label="Revocation reason" value={certificate.revokedReason} />}
      </dl>

      <Link
        to={`/verify/${certificate.certificateId}`}
        className="mt-6 inline-block text-sm font-medium text-pine hover:text-amber"
      >
        View public verification page →
      </Link>

      <div className="mt-8 flex flex-wrap items-center gap-5 rounded border border-border bg-paper p-4">
        <img
          src={`${API_BASE_URL}/certificates/${encodeURIComponent(certificate.certificateId)}/qrcode`}
          alt="Certificate QR code"
          className="h-36 w-36"
        />
        <p className="max-w-xs text-sm text-ink-muted">
          Scan or print this QR code to open the public verification page.
        </p>
      </div>

      {showRevoke && (
        <div className="mt-8 max-w-lg rounded border border-status-revoked/30 bg-status-revoked-tint px-6 py-6">
          <h3 className="font-display text-lg text-status-revoked">Revoke this certificate</h3>
          <p className="mt-1 text-sm text-ink-muted">
            This writes a permanent revocation to the chain. Anyone verifying this certificate afterward will
            see it as revoked, along with the reason below.
          </p>
          <form onSubmit={handleRevoke} className="mt-4 space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for revocation (e.g. issued in error, credential rescinded)"
              rows={3}
              className="w-full rounded border border-border-strong bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-pine"
              required
            />
            <div className="flex gap-3">
              <Button type="submit" variant="danger" disabled={revoking}>
                {revoking ? "Revoking…" : "Confirm revocation"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowRevoke(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {showReissue && (
        <div className="mt-8 max-w-lg rounded border border-border bg-paper px-6 py-6">
          <h3 className="font-display text-lg text-ink">Reissue as correction</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Create a corrected certificate linked to this revoked record.
          </p>
          <form onSubmit={handleReissue} className="mt-5 space-y-5">
            <Field label="Student name" value={reissueForm.studentName} onChange={(v) => updateReissue("studentName", v)} required />
            <Field label="Student reference" value={reissueForm.studentReference} onChange={(v) => updateReissue("studentReference", v)} required />
            <Field label="Student email" type="email" value={reissueForm.studentEmail} onChange={(v) => updateReissue("studentEmail", v)} required />
            <Field label="Program" value={reissueForm.program} onChange={(v) => updateReissue("program", v)} required />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Credential type</span>
              <select
                value={reissueForm.credentialType}
                onChange={(e) => updateReissueCredentialType(e.target.value)}
                className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm outline-none focus:border-pine"
              >
                {CREDENTIAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <Field label="Award date" type="date" value={reissueForm.awardDate} onChange={(v) => updateReissue("awardDate", v)} required />
            {CLASSIFICATION_OPTIONS[reissueForm.credentialType] && !reissueClassificationManual ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Classification</span>
                <select
                  value={reissueForm.classification}
                  onChange={(e) => {
                    if (e.target.value === "__other__") {
                      updateReissue("classification", "");
                      setReissueClassificationManual(true);
                    } else {
                      updateReissue("classification", e.target.value);
                    }
                  }}
                  className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm outline-none focus:border-pine"
                >
                  <option value="">Select classification (optional)</option>
                  {CLASSIFICATION_OPTIONS[reissueForm.credentialType].map((classification) => (
                    <option key={classification} value={classification}>{classification}</option>
                  ))}
                  <option value="__other__">Other (type manually)</option>
                </select>
              </label>
            ) : (
              <Field label="Classification" value={reissueForm.classification} onChange={(v) => updateReissue("classification", v)} />
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Corrected certificate document</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
                onChange={(e) => updateReissue("certificateFile", e.target.files?.[0] || null)}
                className="block w-full rounded border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
              />
            </label>

            <div className="flex gap-3">
              <Button type="submit" disabled={reissuing}>
                {reissuing ? "Anchoring correction…" : "Create corrected certificate"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowReissue(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </DashboardShell>
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
        <span className="max-w-[16rem] truncate sm:max-w-none">{value}</span>
        {copyable && (
          <button onClick={handleCopy} className="text-ink-faint hover:text-pine" aria-label="Copy">
            <Copy size={14} />
            {copied && <span className="ml-1 text-xs text-status-verified">Copied</span>}
          </button>
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-ink-faint hover:text-pine" aria-label="View on explorer">
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

function formatUser(user) {
  if (typeof user === "string") return user;
  return user.fullName ? `${user.fullName}${user.email ? ` (${user.email})` : ""}` : user.email || "—";
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm text-ink outline-none focus:border-pine"
        {...props}
      />
    </label>
  );
}
