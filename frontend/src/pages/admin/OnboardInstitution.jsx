import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import Button from "../../components/Button";

const NAV = [
  { to: "/admin", label: "Institutions" },
  { to: "/admin/onboard", label: "Onboard institution" },
];

const initialForm = {
  name: "",
  shortCode: "",
  country: "",
  website: "",
  contactEmail: "",
  adminFullName: "",
};

export default function OnboardInstitution() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/institutions", form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Onboarding failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <DashboardShell eyebrow="Onboarding complete" title={result.institution.name} navItems={NAV}>
        <div className="max-w-lg rounded-seal border-2 border-status-verified bg-status-verified-tint px-6 py-6">
          <p className="text-status-verified">
            Registered on-chain and ready to issue certificates.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Short code</dt>
              <dd className="font-mono text-ink">{result.institution.shortCode}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Wallet</dt>
              <dd className="truncate font-mono text-ink">{result.institution.walletAddress}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Staff sign-in email</dt>
              <dd className="text-ink">{result.staffAccount.email}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => { setResult(null); setForm(initialForm); }}>Onboard another</Button>
          <Button variant="secondary" onClick={() => navigate("/admin")}>
            Back to institutions
          </Button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      eyebrow="New institution"
      title="Onboard an institution"
      subtitle="Creates a platform-custodied wallet, registers it on the Polygon Amoy contract, and sets up the institution's first staff account."
      navItems={NAV}
    >
      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <Field label="Institution name" value={form.name} onChange={(v) => update("name", v)} required />
        <Field
          label="Short code"
          value={form.shortCode}
          onChange={(v) => update("shortCode", v.toUpperCase())}
          hint="A unique 3–8 letter code, used inside certificate IDs. e.g. GHI, NTU, RVU."
          required
        />
        <Field label="Country" value={form.country} onChange={(v) => update("country", v)} />
        <Field label="Website" type="url" value={form.website} onChange={(v) => update("website", v)} />
        <Field
          label="Contact email"
          type="email"
          value={form.contactEmail}
          onChange={(v) => update("contactEmail", v)}
          hint="This becomes the first staff account's sign-in email — they'll use Google Sign-In with this exact email to log in. No password is needed."
          required
        />
        <Field
          label="Staff admin name"
          value={form.adminFullName}
          onChange={(v) => update("adminFullName", v)}
          required
        />
        {error && (
          <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Registering on-chain…" : "Onboard institution"}
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
