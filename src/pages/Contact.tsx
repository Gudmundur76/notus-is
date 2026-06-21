import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2 } from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', org: '', message: '', interest: 'research' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission handled by Formspree or similar
    setSent(true);
  };

  return (
    <main className="pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="mb-10"
        >
          <span className="section-label">CONTACT</span>
          <h1 className="font-headline text-4xl font-bold text-text-primary mt-2 mb-4">
            Get in Touch
          </h1>
          <p className="font-body text-text-secondary leading-relaxed">
            Whether you are a researcher, a pharmaceutical company, or interested in 
            the technology behind notus.is, we welcome your inquiry.
          </p>
        </motion.div>

        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-bio-teal/30 bg-bio-teal/5 p-8 text-center"
          >
            <CheckCircle2 size={40} className="text-bio-teal mx-auto mb-4" />
            <h3 className="font-headline text-xl font-semibold text-text-primary mb-2">Message Received</h3>
            <p className="font-body text-text-secondary text-sm">
              We will respond within 2 business days.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="font-mono text-xs text-text-muted block mb-1.5">NAME *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 font-body text-sm text-text-primary focus:outline-none focus:border-bio-teal/50 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="font-mono text-xs text-text-muted block mb-1.5">ORGANISATION</label>
                <input
                  value={form.org}
                  onChange={(e) => setForm({ ...form, org: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 font-body text-sm text-text-primary focus:outline-none focus:border-bio-teal/50 transition-colors"
                  placeholder="Company or institution"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-text-muted block mb-1.5">AREA OF INTEREST *</label>
              <select
                required
                value={form.interest}
                onChange={(e) => setForm({ ...form, interest: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 font-body text-sm text-text-primary focus:outline-none focus:border-bio-teal/50 transition-colors"
              >
                <option value="research">Research collaboration</option>
                <option value="data">Data access / licensing</option>
                <option value="commercial">Commercial partnership</option>
                <option value="biosimilar">Biosimilar / biologics</option>
                <option value="grant">Grant / funding</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-xs text-text-muted block mb-1.5">MESSAGE *</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 font-body text-sm text-text-primary focus:outline-none focus:border-bio-teal/50 transition-colors resize-none"
                placeholder="Tell us about your interest in notus.is..."
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-bio-teal text-deep-space font-headline font-semibold px-6 py-3 rounded-lg hover:bg-bio-teal/90 transition-colors"
            >
              Send Message <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
