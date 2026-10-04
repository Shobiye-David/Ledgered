import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import DashboardShell from "../../components/DashboardShell";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { Plus } from "../../components/icons";

const NAV = [
  { to: "/institution", label: "Certificates" },
  { to: "/institution/issue", label: "Issue new" },
  { to: "/institution/bulk-issue", label: "Bulk issue" },
];

export default function InstitutionDashboard() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffMessage, setStaffMessage] = useState(null);
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/certificates")
      .then((res) => setCertificates(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = certificates.filter((c) =>
    `${c.studentName} ${c.studentReference} ${c.program}`.toLowerCase().includes(query.toLowerCase())
  );

  async function handleAddStaff(e) {
    e.preventDefault();
    setStaffSubmitting(true);
    setStaffMessage(null);

    const institutionId = user?.institution?._id || user?.institution?.id;
    try {
      await api.post(`/institutions/${institutionId}/staff`, { fullName: staffName, email: staffEmail });
      setStaffName("");
      setStaffEmail("");
      setStaffMessage({ type: "success", text: "Staff member added. They can now sign in with Google." });
    } catch (err) {
      setStaffMessage({
        type: "error",
        text: err.response?.data?.message || "Unable to add staff member.",
      });
    } finally {
      setStaffSubmitting(false);
    }
  }

  return (
    <DashboardShell
      eyebrow={user?.institution?.name}
      title="Issued certificates"
      subtitle={`${certificates.length} record${certificates.length === 1 ? "" : "s"} on the registry`}
      navItems={NAV}
      actions={
        <div className="flex flex-wrap gap-3">
          <Button as={Link} to="/institution/bulk-issue" variant="secondary">
            Bulk issue
          </Button>
          <Button as={Link} to="/institution/issue">
            <Plus size={16} />
            Issue certificate
          </Button>
        </div>
      }
    >
      {user?.activeMembership?.isAdmin === true && (
        <section className="mb-8 rounded border border-border bg-paper-raised p-5">
          <h2 className="text-lg text-ink">Add staff member</h2>
          <p className="mt-1 text-sm text-ink-muted">They will sign in with Google using this email address.</p>
          <form onSubmit={handleAddStaff} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Full name</span>
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                required
                className="h-10 w-full rounded border border-border-strong bg-paper px-3 text-sm text-ink outline-none focus:border-pine"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                required
                className="h-10 w-full rounded border border-border-strong bg-paper px-3 text-sm text-ink outline-none focus:border-pine"
              />
            </label>
            <Button type="submit" disabled={staffSubmitting}>
              {staffSubmitting ? "Adding…" : "Add staff"}
            </Button>
          </form>
          {staffMessage && (
            <p
              className={`mt-3 text-sm ${
                staffMessage.type === "success" ? "text-status-verified" : "text-status-revoked"
              }`}
            >
              {staffMessage.text}
            </p>
          )}
        </section>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by student, reference, or program"
        className="mb-6 h-10 w-full max-w-sm rounded border border-border-strong bg-paper px-3.5 text-sm outline-none focus:border-pine"
      />

      {loading ? (
        <p className="text-ink-muted">Loading records…</p>
      ) : filtered.length === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="pb-3 font-medium">Student</th>
                <th className="pb-3 font-medium">Program</th>
                <th className="pb-3 font-medium">Awarded</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((cert) => (
                <tr key={cert.certificateId}>
                  <td className="py-3.5">
                    <div className="text-ink">{cert.studentName}</div>
                    <div className="text-xs text-ink-faint">{cert.studentReference}</div>
                  </td>
                  <td className="py-3.5 text-ink-muted">{cert.program}</td>
                  <td className="py-3.5 text-ink-muted">
                    {new Date(cert.awardDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="py-3.5">
                    <StatusBadge status={cert.status} />
                  </td>
                  <td className="py-3.5 text-right">
                    <Link
                      to={`/institution/certificates/${cert.certificateId}`}
                      className="text-sm font-medium text-pine hover:text-amber"
                    >
                      View record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

function EmptyState({ hasQuery }) {
  return (
    <div className="rounded border border-dashed border-border-strong px-6 py-14 text-center">
      <p className="text-ink-muted">
        {hasQuery ? "No certificates match that search." : "Nothing issued yet. Your first certificate starts the registry."}
      </p>
      {!hasQuery && (
        <Button as={Link} to="/institution/issue" variant="secondary" className="mt-4">
          Issue your first certificate
        </Button>
      )}
    </div>
  );
}
