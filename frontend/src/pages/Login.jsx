import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const REDIRECTS = {
  institution_staff: "/institution",
  student: "/student",
};

export default function Login() {
  const { googleLogin, selectMembership } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [membershipChoice, setMembershipChoice] = useState(null);

  function redirectFor(user) {
    navigate(REDIRECTS[user.activeMembership?.role || user.role] || "/", { replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function initializeGoogleButton() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        if (attempts++ < 50) window.setTimeout(initializeGoogleButton, 100);
        else setError("Google sign-in is unavailable. Please try again later.");
        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError("Google sign-in is not configured yet.");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setLoading(true);
          setError(null);
          try {
            const result = await googleLogin(credential);
            if (result.needsSelection) {
              setMembershipChoice(result);
            } else {
              redirectFor(result);
            }
          } catch (err) {
            setError(err.response?.data?.message || "Google sign-in failed. Please try again.");
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 360,
        text: "signin_with",
      });
    }

    initializeGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [googleLogin, navigate]);

  async function handleMembershipSelection(membership) {
    setLoading(true);
    setError(null);
    try {
      const user = await selectMembership(
        membershipChoice.selectionToken,
        membership.institutionId,
        membership.role
      );
      redirectFor(user);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to select that membership. Please try again.");
      setMembershipChoice(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl text-ink">Sign in</h1>
      <p className="mt-2 text-ink-muted">For institution staff and students.</p>

      <div className="mt-8 space-y-5">
        <div ref={buttonRef} className={loading ? "pointer-events-none opacity-60" : ""} />

        {membershipChoice && (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">Choose how you want to continue:</p>
            {membershipChoice.memberships.map((membership) => (
              <button
                key={`${membership.institutionId}-${membership.role}`}
                type="button"
                disabled={loading}
                onClick={() => handleMembershipSelection(membership)}
                className="block w-full rounded border border-ink/20 px-4 py-3 text-left text-sm hover:bg-ink/5 disabled:opacity-60"
              >
                {membership.institutionName} — {membership.role}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded border border-status-revoked/30 bg-status-revoked-tint px-4 py-3 text-sm text-status-revoked">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
