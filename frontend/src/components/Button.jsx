import React from "react";

const VARIANTS = {
  primary: "bg-amber text-paper hover:bg-amber-dark active:bg-amber-dark disabled:bg-border disabled:text-ink-faint",
  secondary:
    "bg-transparent text-pine border border-pine/30 hover:border-pine hover:bg-pine/5 active:bg-pine/10 disabled:text-ink-faint disabled:border-border",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-ink/5 active:bg-ink/10",
  danger:
    "bg-transparent text-status-revoked border border-status-revoked/40 hover:bg-status-revoked-tint disabled:text-ink-faint disabled:border-border",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export default function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center rounded font-medium transition-colors duration-150 ease-standard disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
