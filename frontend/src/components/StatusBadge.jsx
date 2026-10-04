import React from "react";
import { CircleCheck, CircleX, Clock } from "./icons";

const CONFIG = {
  active: { label: "Active", icon: CircleCheck, text: "text-status-verified", bg: "bg-status-verified-tint" },
  verified: { label: "Verified", icon: CircleCheck, text: "text-status-verified", bg: "bg-status-verified-tint" },
  revoked: { label: "Revoked", icon: CircleX, text: "text-status-revoked", bg: "bg-status-revoked-tint" },
  pending: { label: "Pending", icon: Clock, text: "text-status-pending", bg: "bg-status-pending-tint" },
  suspended: { label: "Suspended", icon: CircleX, text: "text-status-revoked", bg: "bg-status-revoked-tint" },
};

export default function StatusBadge({ status, label }) {
  const config = CONFIG[status] || CONFIG.pending;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon size={14} strokeWidth={2.25} />
      {label || config.label}
    </span>
  );
}
