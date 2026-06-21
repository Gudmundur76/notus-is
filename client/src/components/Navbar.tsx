import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Dna } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/findings", label: "Findings" },
  { href: "/methodology", label: "Methodology" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[oklch(0.14_0.015_260/0.95)] backdrop-blur-md border-b border-[oklch(0.22_0.012_260)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.72_0.17_162/0.1)] border border-[oklch(0.72_0.17_162/0.3)] flex items-center justify-center group-hover:bg-[oklch(0.72_0.17_162/0.2)] transition-colors">
            <Dna size={16} className="text-[oklch(0.72_0.17_162)]" />
          </div>
          <span className="font-bold text-lg text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
            notus<span className="text-[oklch(0.72_0.17_162)]">.is</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                location === link.href
                  ? "text-[oklch(0.72_0.17_162)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/Gudmundur76/notus-is"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-[oklch(0.72_0.17_162)] border border-[oklch(0.72_0.17_162/0.3)] rounded-lg px-4 py-1.5 hover:bg-[oklch(0.72_0.17_162/0.1)] transition-colors"
          >
            Day 30 Report →
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[oklch(0.14_0.015_260)] border-b border-[oklch(0.22_0.012_260)]"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm ${
                    location === link.href
                      ? "text-[oklch(0.72_0.17_162)]"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
