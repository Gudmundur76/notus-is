import { Link } from "wouter";
import { Github } from "lucide-react";

const footerLinks = [
  { label: "Home", path: "/" },
  { label: "Findings", path: "/findings" },
  { label: "Methodology", path: "/methodology" },
  { label: "Contact", path: "/contact" },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #1E2D47", backgroundColor: "#141E33" }}>
      <div className="mx-auto max-w-[1280px] container-padding py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-4">
            <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700, color: "#F0F4F8" }}>
              notus<span style={{ color: "#10B981" }}>.is</span>
            </h3>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>
              Autonomous HIV protease inhibitor discovery. Citation-verified findings. Day-30 scientific publication.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/Gudmundur76/novus-is"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#64748B", transition: "color 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#F0F4F8"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
              >
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "#F0F4F8", marginBottom: 16 }}>
              Navigation
            </h4>
            <ul className="space-y-2">
              {footerLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", transition: "color 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#F0F4F8"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "#F0F4F8", marginBottom: 16 }}>
              About
            </h4>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>
              Built in Iceland. Powered by ASI-Evolve and ttruthdesk-platform. Data licensed CC BY 4.0.
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B", marginTop: 12 }}>
              Apache 2.0 · Built with ASI-Evolve
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid #1E2D47" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#64748B" }}>
            © {new Date().getFullYear()} notus.is · Iceland
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748B" }}>
            Verification: citation.manus.space · Engine: novus-is
          </p>
        </div>
      </div>
    </footer>
  );
}
