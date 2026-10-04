import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import Button from "../../components/Button";

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

const initialForm = {
  studentName: "",
  studentReference: "",
  studentEmail: "",
  program: "",
  credentialType: "degree",
  awardDate: "",
  classification: "",
  certificateFile: null,
};

export default function IssueCertificate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [classificationManual, setClassificationManual] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateCredentialType(credentialType) {
    setForm((form) => {
      const options = CLASSIFICATION_OPTIONS[credentialType];
      const classification = options?.includes(form.classification) ? form.classification : "";
      return { ...form, credentialType, classification };
    });
    setClassificationManual(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.studentEmail.trim())) {
      setError("Enter a valid student email address.");
      return;
    }
    if (!form.certificateFile) {
      setError("Attach the certificate as a PDF, PNG, or JPEG file.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([field, value]) => {
        if (value !== null && value !== undefined) formData.append(field, value);
      });
      const res = await api.post("/certificates", formData);
      setIssued(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Issuance failed. The chain transaction may not have gone through.");
    } finally {
      setSubmitting(false);
    }
  }

  if (issued) {
    return (
      <DashboardShell eyebrow="Issuance complete" title="Certificate anchored to the chain" navItems={NAV}>
        <div className="max-w-lg rounded-seal border-2 border-status-verified bg-status-verified-tint px-6 py-6">
          <p className="text-status-verified">
            Recorded for <strong>{issued.studentName}</strong> and confirmed on Polygon Amoy.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Certificate ID</dt>
              <dd className="font-mono text-ink">{issued.certificateId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Transaction</dt>
              <dd className="truncate font-mono text-ink">{issued.issueTxHash}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => { setIssued(null); setForm(initialForm); setClassificationManual(false); }}>Issue another</Button>
          <Button variant="secondary" onClick={() => navigate("/institution")}>
            Back to registry
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="New record"
      title="Issue a certificate"
      subtitle="This record is hashed and written to the Polygon Amoy contract from your institution's wallet."
      navItems={NAV}
    >
      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <Field label="Student name" value={form.studentName} onChange={(v) => update("studentName", v)} required />
        <Field
          label="Student reference"
          value={form.studentReference}
          onChange={(v) => update("studentReference", v)}
          hint="Registration number, matric number, or ID your institution already uses."
          required
        />
        <Field
          label="Student email"
          type="email"
          value={form.studentEmail}
          onChange={(v) => update("studentEmail", v)}
          hint="The student will use this email to sign in with Google."
          required
        />
        <Field label="Program" value={form.program} onChange={(v) => update("program", v)} required />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Credential type</span>
          <select
            value={form.credentialType}
            onChange={(e) => updateCredentialType(e.target.value)}
            className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm outline-none focus:border-pine"
          >
            {CREDENTIAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Award date"
          type="date"
          value={form.awardDate}
          onChange={(v) => update("awardDate", v)}
          required
        />
        {CLASSIFICATION_OPTIONS[form.credentialType] && !classificationManual ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Classification</span>
            <select
              value={form.classification}
              onChange={(e) => {
                if (e.target.value === "__other__") {
                  update("classification", "");
                  setClassificationManual(true);
                } else {
                  update("classification", e.target.value);
                }
              }}
              className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm outline-none focus:border-pine"
            >
              <option value="">Select classification (optional)</option>
              {CLASSIFICATION_OPTIONS[form.credentialType].map((classification) => (
                <option key={classification} value={classification}>{classification}</option>
              ))}
              <option value="__other__">Other (type manually)</option>
            </select>
            <span className="mt-1 block text-xs text-ink-faint">Optional — e.g. Second Class Upper, Distinction.</span>
          </label>
        ) : (
          <Field
            label="Classification"
            value={form.classification}
            onChange={(v) => update("classification", v)}
            hint="Optional — e.g. Second Class Upper, Distinction."
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Certificate document</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            required
            onChange={(e) => update("certificateFile", e.target.files?.[0] || null)}
            className="block w-full rounded border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Upload the PDF or image that will be anchored to the certificate hash.
          </span>
        </label>

        {error && (
          <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Anchoring to chain…" : "Issue certificate"}
        </Button>
      </form>
    </DashboardShell>
  );
}

function Field({ label, hint, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded border border-border-strong bg-paper px-3.5 text-sm text-ink outline-none focus:border-pine"
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
