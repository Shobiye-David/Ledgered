import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { Search, Building2, GraduationCap, ScrollText, ArrowRight } from "../components/icons";
import { QrCode } from "lucide-react";

export default function Landing() {
  const [certificateId, setCertificateId] = useState("");
  const navigate = useNavigate();

  function handleVerify(e) {
    e.preventDefault();
    if (!certificateId.trim()) return;
    navigate(`/verify/${certificateId.trim()}`);
  }

  return (
    <div>
      {/* Hero: the verification input IS the product's first impression */}
      <section className="border-b border-border bg-paper-raised">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl leading-tight text-ink sm:text-5xl">
            One record, checked against the chain, not a claim you have to trust.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">
            Ledgered anchors every certificate an institution issues to a public blockchain record. Anyone
            holding a certificate ID can confirm it here in seconds.
          </p>

          <form onSubmit={handleVerify} className="mx-auto mt-10 flex max-w-xl items-center gap-2">
            <div className="flex h-14 flex-1 items-center gap-3 rounded border border-border-strong bg-paper px-4 focus-within:border-pine">
              <Search size={18} className="shrink-0 text-ink-faint" />
              <input
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value)}
                placeholder="Paste a certificate ID, e.g. 0x7a3f…"
                className="h-full w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-faint placeholder:font-body"
              />
              <button
                type="button"
                onClick={() => navigate("/scan")}
                className="shrink-0 text-ink-faint transition-colors hover:text-pine"
                aria-label="Scan a certificate QR code"
                title="Scan a certificate QR code"
              >
                <QrCode size={20} />
              </button>
            </div>
            <Button type="submit" size="lg" className="shrink-0">
              Verify
            </Button>
          </form>
          <p className="mt-3 text-sm text-ink-faint">
            Certificate IDs are printed on the credential itself, or in the email a student receives.
          </p>
        </div>
      </section>

      {/* Three roles, quiet region shift via background, not card borders */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl text-ink">Built for every party in a credential's life</h2>
        <div className="mt-10 grid gap-12 md:grid-cols-3">
          <RoleBlock
            icon={Building2}
            title="Institutions"
            description="Issue certificates in batches or one at a time, keep a searchable record of everything you've awarded, and revoke instantly if a record needs correcting."
            cta="Institution sign in"
            to="/login"
          />
          <RoleBlock
            icon={GraduationCap}
            title="Students"
            description="See every credential issued to you in one place, with the certificate ID and chain reference ready to share with anyone who needs to check it."
            cta="Student sign in"
            to="/login"
          />
          <RoleBlock
            icon={ScrollText}
            title="Employers & verifiers"
            description="No account needed. Enter a certificate ID and get an authoritative answer: authentic and active, or revoked, straight from the chain."
            cta="Verify a certificate"
            to="/verify"
          />
        </div>
      </section>

      {/* How it works - genuinely sequential, so numbering is earned here */}
      <section className="border-t border-border bg-pine text-paper">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl text-paper">How a certificate gets anchored</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            <Step
              number="1"
              title="An institution issues it"
              description="Staff enter the student, program, and award date. Ledgered computes a hash of the record and writes it to the Polygon Amoy contract from the institution's own wallet."
            />
            <Step
              number="2"
              title="A record is kept off-chain"
              description="The full certificate detail lives in Ledgered's database, linked to the on-chain entry by its certificate ID and transaction hash."
            />
            <Step
              number="3"
              title="Anyone can check it"
              description="A verifier's lookup recomputes the hash and reads the contract directly, so the answer never depends on trusting Ledgered's database alone."
            />
          </ol>
        </div>
      </section>
    </div>
  );
}

function RoleBlock({ icon: Icon, title, description, cta, to }) {
  const navigate = useNavigate();
  return (
    <div>
      <Icon size={28} strokeWidth={1.75} className="text-amber" />
      <h3 className="mt-4 font-display text-xl text-ink">{title}</h3>
      <p className="mt-2 text-ink-muted">{description}</p>
      <button
        onClick={() => navigate(to)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-pine transition-colors hover:text-amber"
      >
        {cta}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <li className="list-none">
      <span className="font-display text-3xl text-amber-light">{number}</span>
      <h3 className="mt-3 text-lg text-paper">{title}</h3>
      <p className="mt-2 text-paper/70">{description}</p>
    </li>
  );
}
