import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { Copy, ExternalLink } from "../../components/icons";

const NAV = [
  { to: "/admin", label: "Institutions" },
  { to: "/admin/onboard", label: "Onboard institution" },
];

export default function InstitutionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [adminUpdatingId, setAdminUpdatingId] = useState(null);
  const [adminError, setAdminError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    api.get("/audit", { params: { institution: id, limit: 10 } })
      .then((res) => setRecentActivity(res.data.logs))
      .catch(() => setRecentActivity([]));
  }, [id]);

  function load() {
    setLoading(true);
    api
      .get(`/institutions/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load this institution."))
      .finally(() => setLoading(false));
  }

  async function retry() {
    setRetrying(true);
    try {
      const res = await api.post(`/institutions/${id}/retry-onchain`);
      setData((d) => ({ ...d, institution: res.data.institution }));
    } catch (err) {
      setError(err.response?.data?.message || "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  async function removePendingInstitution() {
    if (!window.confirm(`Delete pending institution "${data.institution.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/institutions/${id}`);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function rotateWallet() {
    const confirmed = window.confirm(
      "This institution will get a new wallet for all future certificates. The old wallet will be deactivated and can no longer issue or revoke anything. Certificates already issued are not affected and will still verify correctly. Continue?"
    );
    if (!confirmed) return;

    setRotating(true);
    setWalletError(null);
    try {
      const res = await api.post(`/institutions/${id}/rotate-wallet`);
      setData((d) => ({
        ...d,
        institution: res.data.institution,
        walletBalance: res.data.walletBalance,
      }));
    } catch (err) {
      setWalletError(err.response?.data?.message || "Wallet rotation failed.");
    } finally {
      setRotating(false);
    }
  }

  async function toggleStatus() {
    const isActive = data.institution.status !== "active";
    const res = await api.patch(`/institutions/${id}/status`, { isActive });
    setData((d) => ({ ...d, institution: res.data.institution }));
  }

  async function handleRemoveStaff(userId) {
    if (!window.confirm("Remove this person's staff access to this institution?")) return;
    await api.delete(`/institutions/${id}/staff/${userId}`);
    setData((d) => ({ ...d, staff: d.staff.filter((s) => s._id !== userId) }));
  }

  async function toggleStaffAdmin(staffMember) {
    setAdminUpdatingId(staffMember._id);
    setAdminError(null);
    try {
      const res = await api.patch(`/institutions/${id}/staff/${staffMember._id}/admin`, {
        isAdmin: !staffMember.isAdmin,
      });
      setData((d) => ({
        ...d,
        staff: d.staff.map((staff) =>
          staff._id === staffMember._id
            ? { ...staff, isAdmin: res.data.membership.isAdmin }
            : staff
        ),
      }));
    } catch (err) {
      setAdminError(err.response?.data?.message || "Could not update staff admin status.");
    } finally {
      setAdminUpdatingId(null);
    }
  }

  function copyWallet() {
    navigator.clipboard.writeText(data.institution.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return (
      <DashboardShell title="Institution" navItems={NAV}>
        <p className="text-ink-muted">Loading…</p>
      </DashboardShell>
    );
  }

  if (error && !data) {
    return (
      <DashboardShell title="Institution" navItems={NAV}>
        <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-status-revoked">
          {error}
        </p>
      </DashboardShell>
    );
  }

  const { institution, staff, certificateStats, walletBalance } = data;

  return (
    <DashboardShell
      eyebrow="Platform administration"
      title={institution.name}
      subtitle={institution.shortCode}
      navItems={NAV}
      actions={
        <>
          <StatusBadge status={institution.status} />
          {institution.status === "pending" ? (
            <>
              <Button onClick={retry} disabled={retrying || deleting}>
                {retrying ? "Retrying…" : "Retry on-chain registration"}
              </Button>
              <Button variant="danger" onClick={removePendingInstitution} disabled={retrying || deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </>
          ) : (
            <Button variant={institution.status === "active" ? "danger" : "secondary"} onClick={toggleStatus}>
              {institution.status === "active" ? "Suspend" : "Reactivate"}
            </Button>
          )}
        </>
      }
    >
      {institution.status === "pending" && institution.lastChainError && (
        <p className="mb-6 rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
          Last on-chain attempt failed: {institution.lastChainError}
        </p>
      )}

      {/* Wallet section — address + live balance only, never the private key */}
      <section className="border-t border-border py-6">
        <h2 className="font-display text-lg text-ink">Issuing wallet</h2>
        <p className="mt-1 text-sm text-ink-muted">
          This wallet signs every certificate this institution issues or revokes. The private key is encrypted
          at rest and is never surfaced in the app — if it ever needs to change, rotate to a new wallet rather
          than exporting the existing key.
        </p>
        <dl className="mt-4 max-w-xl divide-y divide-border">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-ink-muted">Address</dt>
            <dd className="flex items-center gap-2 font-mono text-sm text-ink">
              <span className="truncate">{institution.walletAddress}</span>
              <button onClick={copyWallet} className="text-ink-faint hover:text-pine" aria-label="Copy address">
                <Copy size={14} />
              </button>
              {copied && <span className="text-xs text-status-verified">Copied</span>}
              <a
                href={`https://amoy.polygonscan.com/address/${institution.walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink-faint hover:text-pine"
                aria-label="View on explorer"
              >
                <ExternalLink size={14} />
              </a>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-ink-muted">Balance</dt>
            <dd className="font-mono text-sm text-ink">
              {walletBalance !== null ? `${Number(walletBalance).toFixed(4)} POL` : "Unavailable"}
            </dd>
          </div>
        </dl>
        {walletError && (
          <p className="mt-4 max-w-xl rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {walletError}
          </p>
        )}
        {institution.walletRotationWarning && (
          <p className="mt-4 max-w-xl rounded border border-status-pending/30 bg-status-pending-tint px-4 py-3 text-sm text-status-pending">
            {institution.walletRotationWarning}
          </p>
        )}
        <Button variant="secondary" size="sm" className="mt-4" onClick={rotateWallet} disabled={rotating}>
          {rotating ? "Rotating wallet…" : "Rotate wallet"}
        </Button>
        {institution.previousWallets?.length > 0 && (
          <div className="mt-6 max-w-xl">
            <h3 className="text-sm font-medium text-ink">Previous wallets</h3>
            <ul className="mt-2 space-y-2 text-sm text-ink-muted">
              {institution.previousWallets.map((wallet) => (
                <li key={`${wallet.address}-${wallet.retiredAt}`} className="font-mono">
                  {wallet.address} <span className="font-body">(retired {new Date(wallet.retiredAt).toLocaleDateString()})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Certificate inventory */}
      <section className="border-t border-border py-6">
        <h2 className="font-display text-lg text-ink">Certificate inventory</h2>
        <div className="mt-4 grid max-w-xl grid-cols-3 gap-4">
          <StatBlock label="Total issued" value={certificateStats.total} />
          <StatBlock label="Active" value={certificateStats.active} tone="verified" />
          <StatBlock label="Revoked" value={certificateStats.revoked} tone="revoked" />
        </div>
      </section>

      {/* Staff roster */}
      <section className="border-t border-border py-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Staff</h2>
          <span className="text-sm text-ink-muted">{staff.length} account{staff.length === 1 ? "" : "s"}</span>
        </div>

        {adminError && (
          <p className="mt-3 rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {adminError}
          </p>
        )}

        {staff.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No staff accounts yet besides the original registrar.</p>
        ) : (
          <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Admin</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((s) => (
                  <tr key={s._id}>
                    <td className="py-2.5 text-ink">{s.fullName}</td>
                    <td className="py-2.5 text-ink-muted">{s.email}</td>
                    <td className="py-2.5">
                      <StatusBadge status={s.isActive ? "active" : "suspended"} />
                    </td>
                    <td className="py-2.5">
                      {s.isAdmin && (
                        <span className="rounded-full bg-status-verified-tint px-2 py-0.5 text-xs text-status-verified">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => toggleStaffAdmin(s)}
                          disabled={adminUpdatingId === s._id}
                          className="text-sm font-medium text-pine hover:text-amber disabled:text-ink-faint"
                        >
                          {adminUpdatingId === s._id ? "Saving…" : s.isAdmin ? "Demote" : "Make admin"}
                        </button>
                        <button
                          onClick={() => handleRemoveStaff(s._id)}
                          className="text-sm font-medium text-status-revoked hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-t border-border py-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg text-ink">Recent activity</h2>
          <Link to={`/admin/audit?institution=${id}`} className="text-sm font-medium text-pine hover:text-amber">View audit log</Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No recent activity recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recentActivity.map((entry) => (
              <li key={entry._id} className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-ink">{entry.action} <span className="text-ink-muted">— {entry.targetLabel || "—"}</span></span>
                <span className="shrink-0 text-ink-faint">{new Date(entry.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/admin" className="mt-6 inline-block text-sm font-medium text-pine hover:text-amber">
        ← Back to all institutions
      </Link>
    </DashboardShell>
  );
}

function StatBlock({ label, value, tone }) {
  const toneClass = tone === "verified" ? "text-status-verified" : tone === "revoked" ? "text-status-revoked" : "text-ink";
  return (
    <div className="rounded bg-paper-raised px-4 py-3">
      <div className={`font-display text-2xl ${toneClass}`}>{value ?? 0}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  );
}
