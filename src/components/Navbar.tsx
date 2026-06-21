import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Dna } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/findings', label: 'Findings' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-midnight/95 backdrop-blur-md border-b border-slate-700/50' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-bio-teal/10 border border-bio-teal/30 flex items-center justify-center group-hover:bg-bio-teal/20 transition-colors">
            <Dna size={16} className="text-bio-teal" />
          </div>
          <span className="font-headline font-bold text-lg text-text-primary">
            notus<span className="text-bio-teal">.is</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm font-body transition-colors ${
                location.pathname === link.href
                  ? 'text-bio-teal'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/Gudmundur76/notus-is"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-bio-teal border border-bio-teal/30 rounded-lg px-4 py-1.5 hover:bg-bio-teal/10 transition-colors"
          >
            Day 30 Report →
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-text-secondary hover:text-text-primary"
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
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-midnight border-b border-slate-700/50"
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-sm font-body ${
                    location.pathname === link.href ? 'text-bio-teal' : 'text-text-secondary'
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
