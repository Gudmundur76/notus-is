import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Findings", path: "/findings" },
  { label: "Methodology", path: "/methodology" },
  { label: "Contact", path: "/contact" },
];

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "rgba(10, 15, 28, 0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid #1E2D47" : "1px solid transparent",
        }}
      >
        <div className="mx-auto max-w-[1280px] container-padding flex h-16 lg:h-[72px] items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)" }}
            >
              <span style={{ color: "#10B981", fontSize: 14, fontFamily: "var(--font-headline)", fontWeight: 700 }}>N</span>
            </div>
            <span style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700, color: "#F0F4F8" }}>
              notus<span style={{ color: "#10B981" }}>.is</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => {
              const active = location === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? "#10B981" : "#94A3B8",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.target as HTMLElement).style.color = "#F0F4F8"; }}
                  onMouseLeave={(e) => { if (!active) (e.target as HTMLElement).style.color = "#94A3B8"; }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              to="/findings"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-all duration-250"
              style={{
                border: "1px solid #10B981",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 600,
                color: "#10B981",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(16, 185, 129, 0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              Day 30 Report →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 transition-colors"
            style={{ color: "#94A3B8" }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[280px] p-6 lg:hidden"
              style={{ backgroundColor: "#0D1425", borderLeft: "1px solid #1E2D47" }}
            >
              <div className="flex items-center justify-between mb-8">
                <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <span style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700, color: "#F0F4F8" }}>
                    notus<span style={{ color: "#10B981" }}>.is</span>
                  </span>
                </Link>
                <button onClick={() => setMobileOpen(false)} style={{ color: "#94A3B8" }} aria-label="Close menu">
                  <X size={24} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", transition: "color 0.2s" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="mt-8 pt-8" style={{ borderTop: "1px solid #1E2D47" }}>
                <Link
                  to="/findings"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex w-full items-center justify-center rounded-full px-6 py-3"
                  style={{ backgroundColor: "#10B981", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#0A0F1C" }}
                >
                  View Findings
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
