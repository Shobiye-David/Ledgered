import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Menu, QrCode, X } from "lucide-react";
import { ScrollText, LogOut } from "./icons";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    setMobileMenuOpen(false);
    navigate("/");
  }

  const dashboardPath =
    user?.role === "platform_admin"
      ? "/admin"
      : user?.role === "institution_staff"
      ? "/institution"
      : user?.role === "student"
      ? "/student"
      : null;

  return (
    <header className="bg-pine text-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <ScrollText size={20} strokeWidth={2} className="shrink-0 text-amber-light sm:h-[22px] sm:w-[22px]" />
          <span className="font-display text-base tracking-tight sm:text-lg">Ledgered</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-3 text-sm sm:gap-6">
          <div className="hidden items-center gap-3 sm:flex sm:gap-6">
            <Link to="/verify" className="whitespace-nowrap text-paper/80 transition-colors hover:text-paper">
              Verify a certificate
            </Link>
            <Link to="/scan" className="flex items-center gap-1.5 whitespace-nowrap text-paper/80 transition-colors hover:text-paper">
              <QrCode size={16} />
              Scan QR code
            </Link>

            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {dashboardPath && (
                  <Link
                    to={dashboardPath}
                    className="whitespace-nowrap text-paper/80 transition-colors hover:text-paper"
                  >
                    Dashboard
                  </Link>
                )}
                <span className="hidden text-paper/50 lg:inline">{user.fullName}</span>
                <button
                  onClick={handleLogout}
                  className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="shrink-0 whitespace-nowrap rounded border border-paper/25 px-3 py-2 text-paper transition-colors hover:border-paper/60 sm:px-4"
              >
                Sign in
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded p-2 text-paper/90 transition-colors hover:bg-paper/10 hover:text-paper sm:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-paper/10 px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            <Link to="/verify" className="rounded px-2 py-2.5 text-paper/85 hover:bg-paper/10 hover:text-paper">
              Verify a certificate
            </Link>
            <Link to="/scan" className="flex items-center gap-2 rounded px-2 py-2.5 text-paper/85 hover:bg-paper/10 hover:text-paper">
              <QrCode size={16} />
              Scan QR code
            </Link>
            {user ? (
              <>
                {dashboardPath && (
                  <Link to={dashboardPath} className="rounded px-2 py-2.5 text-paper/85 hover:bg-paper/10 hover:text-paper">
                    Dashboard
                  </Link>
                )}
                <span className="px-2 py-2 text-paper/50">{user.fullName}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded px-2 py-2.5 text-left text-paper/85 hover:bg-paper/10 hover:text-paper"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded px-2 py-2.5 text-paper/85 hover:bg-paper/10 hover:text-paper">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
