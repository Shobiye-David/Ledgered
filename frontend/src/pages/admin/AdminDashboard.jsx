import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import DashboardShell from "../../components/DashboardShell";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { Plus } from "../../components/icons";

const NAV = [
  { to: "/admin", label: "Institutions" },
  { to: "/admin/onboard", label: "Onboard institution" },
];

export default function AdminDashboard() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [retryError, setRetryError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    api
      .get("/institutions")
      .then((res) => setInstitutions(res.data))
      .finally(() => setLoading(false));
  }

  async function toggleStatus(institution) {
    const isActive = institution.status !== "active";
    const res = await api.patch(`/institutions/${institution._id}/status`, { isActive });
    setInstitutions((list) => list.map((i) => (i._id === institution._id ? res.data.institution : i)));
  }

  async function retry(institution) {
    setRetryingId(institution._id);
    setRetryError(null);
    try {
      const res = await api.post(`/institutions/${institution._id}/retry-onchain`);
      setInstitutions((list) => list.map((i) => (i._id === institution._id ? res.data.institution : i)));
    } catch (err) {
      setRetryError({ id: institution._id, message: err.response?.data?.message || "Retry failed." });
    } finally {
      setRetryingId(null);
    }
  }

  async function removePendingInstitution(institution) {
    if (!window.confirm(`Delete pending institution "${institution.name}"? This cannot be undone.`)) return;
    setDeletingId(institution._id);
    setRetryError(null);
    try {
      await api.delete(`/institutions/${institution._id}`);
      setInstitutions((list) => list.filter((item) => item._id !== institution._id));
    } catch (err) {
      setRetryError({ id: institution._id, message: err.response?.data?.message || "Delete failed." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardShell
      eyebrow="Platform administration"
      title="Institutions on the registry"
      subtitle={`${institutions.length} institution${institutions.length === 1 ? "" : "s"} onboarded`}
      navItems={NAV}
      actions={
        <Button as={Link} to="/admin/onboard">
          <Plus size={16} />
          Onboard institution
        </Button>
      }
    >
      {loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : institutions.length === 0 ? (
        <div className="rounded border border-dashed border-border-strong px-6 py-14 text-center">
          <p className="text-ink-muted">No institutions yet. Onboard the first one to start the registry.</p>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="pb-3 font-medium">Institution</th>
                <th className="pb-3 font-medium">Country</th>
                <th className="pb-3 font-medium">Wallet</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {institutions.map((inst) => (
                <tr key={inst._id}>
                  <td className="py-3.5">
                    <Link to={`/admin/institutions/${inst._id}`} className="text-ink hover:text-amber">
                      {inst.name}
                    </Link>
                    <div className="text-xs text-ink-faint">{inst.shortCode}</div>
                  </td>
                  <td className="py-3.5 text-ink-muted">{inst.country || "—"}</td>
                  <td className="py-3.5 font-mono text-xs text-ink-muted">
                    {inst.walletAddress.slice(0, 8)}…{inst.walletAddress.slice(-6)}
                  </td>
                  <td className="py-3.5">
                    <StatusBadge status={inst.status} />
                    {inst.status === "pending" && inst.lastChainError && (
                      <p className="mt-1 max-w-[16rem] text-xs text-status-revoked">{inst.lastChainError}</p>
                    )}
                    {retryError?.id === inst._id && (
                      <p className="mt-1 max-w-[16rem] text-xs text-status-revoked">{retryError.message}</p>
                    )}
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex justify-end gap-3">
                      {inst.status === "pending" && (
                        <>
                          <button
                            onClick={() => retry(inst)}
                            disabled={retryingId === inst._id || deletingId === inst._id}
                            className="text-sm font-medium text-pine hover:text-amber disabled:text-ink-faint"
                          >
                            {retryingId === inst._id ? "Retrying…" : "Retry"}
                          </button>
                          <button
                            onClick={() => removePendingInstitution(inst)}
                            disabled={retryingId === inst._id || deletingId === inst._id}
                            className="text-sm font-medium text-status-revoked hover:underline disabled:text-ink-faint"
                          >
                            {deletingId === inst._id ? "Deleting…" : "Delete"}
                          </button>
                        </>
                      )}
                      {inst.status !== "pending" && (
                        <button
                          onClick={() => toggleStatus(inst)}
                          className="text-sm font-medium text-pine hover:text-amber"
                        >
                          {inst.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      )}
                    </div>
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
