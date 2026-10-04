import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import Button from "../../components/Button";

const NAV = [
  { to: "/institution", label: "Certificates" },
  { to: "/institution/issue", label: "Issue new" },
  { to: "/institution/bulk-issue", label: "Bulk issue" },
];

const CSV_TEMPLATE = [
  "studentName,studentReference,studentEmail,program,credentialType,awardDate,classification,fileName",
  "John Adeyemi,RVU-2024-001,john.adeyemi@example.com,Computer Science,degree,2026-07-15,Second Class Upper,RVU-2024-001.pdf",
].join("\n");

export default function BulkIssueCertificates() {
  const [csvFile, setCsvFile] = useState(null);
  const [certificateFiles, setCertificateFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!csvFile) {
      setError("Attach a CSV file before submitting.");
      return;
    }
    if (certificateFiles.length === 0) {
      setError("Attach at least one certificate document.");
      return;
    }

    const formData = new FormData();
    formData.append("csv", csvFile);
    certificateFiles.forEach((file) => formData.append("certificateFiles", file));

    setSubmitting(true);
    setError(null);
    setResults(null);
    try {
      const res = await api.post("/certificates/bulk", formData);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Bulk issuance failed. No certificates were issued.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "certificate-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell
      eyebrow="Batch records"
      title="Bulk issue certificates"
      subtitle="Upload one CSV plus matching certificate documents. Records are issued one at a time to keep chain transactions orderly."
      navItems={NAV}
    >
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <section className="rounded border border-border bg-paper-raised p-5">
          <h2 className="text-lg text-ink">CSV format</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Required columns: studentName, studentReference, studentEmail, program, credentialType, awardDate,
            fileName. Optional column: classification. The fileName value must exactly match one uploaded
            certificate file name.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Use YYYY-MM-DD for awardDate. credentialType must be one of degree, diploma, certificate, or
            transcript. classification is optional.
          </p>
          <Button type="button" variant="secondary" className="mt-4" onClick={downloadCsvTemplate}>
            Download CSV template
          </Button>
        </section>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Student CSV</span>
          <input
            type="file"
            accept=".csv"
            required
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="block w-full rounded border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Certificate documents</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            required
            onChange={(e) => setCertificateFiles(Array.from(e.target.files || []))}
            className="block w-full rounded border border-border-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Select the files named in the CSV fileName column.
          </span>
        </label>

        {submitting && (
          <p className="rounded border border-status-pending/30 bg-status-pending-tint px-4 py-3 text-sm text-ink">
            Processing this batch may take a few minutes. The institution wallet will be topped up automatically
            if more gas is needed before issuing starts.
          </p>
        )}

        {error && (
          <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Issuing batch..." : "Issue batch"}
          </Button>
          <Button as={Link} to="/institution/issue" variant="secondary" size="lg">
            Issue one instead
          </Button>
        </div>
      </form>

      {results && (
        <section className="mt-10">
          <div className="mb-4 rounded border border-border bg-paper p-4">
            <p className="text-sm text-ink">
              {results.succeeded} succeeded, {results.failed} failed, {results.total} total.
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Wallet top-up {results.walletTopUpPerformed ? "was performed before issuance." : "was not needed."}
            </p>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 font-medium">Row</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Certificate ID or error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.results.map((result) => (
                  <tr key={result.row}>
                    <td className="py-3.5 text-ink-muted">{result.row}</td>
                    <td
                      className={`py-3.5 font-medium ${
                        result.status === "success" ? "text-status-verified" : "text-status-revoked"
                      }`}
                    >
                      {result.status}
                    </td>
                    <td className="py-3.5 text-ink">
                      {result.certificateId ? (
                        <Link
                          to={`/institution/certificates/${result.certificateId}`}
                          className="font-mono text-pine hover:text-amber"
                        >
                          {result.certificateId}
                        </Link>
                      ) : (
                        <span>{result.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
