import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2 } from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];
const TEAL = "oklch(0.72 0.17 162)";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", org: "", message: "", interest: "research" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const inputClass = "w-full rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none transition-colors";
  const inputStyle = { backgroundColor: "oklch(0.18 0.015 260)", border: "1px solid oklch(0.22 0.012 260)" };

  return (
    <main className="pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }} className="mb-10">
          <span className="section-label">CONTACT</span>
          <h1 className="text-4xl font-bold text-foreground mt-2 mb-4" style={{ fontFamily: "var(--font-headline)" }}>Get in Touch</h1>
          <p className="text-muted-foreground leading-relaxed">
            Whether you are a researcher, a pharmaceutical company, or interested in the technology behind notus.is, we welcome your inquiry.
          </p>
        </motion.div>

        {sent ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: "oklch(0.72 0.17 162 / 0.3)", backgroundColor: "oklch(0.72 0.17 162 / 0.05)" }}>
            <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: TEAL }} />
            <h3 className="text-xl font-semibold text-foreground mb-2" style={{ fontFamily: "var(--font-headline)" }}>Message Received</h3>
            <p className="text-muted-foreground text-sm">We will respond within 2 business days.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-1.5">NAME *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass} style={inputStyle} placeholder="Your name" />
              </div>
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-1.5">ORGANISATION</label>
                <input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })}
                  className={inputClass} style={inputStyle} placeholder="Company or institution" />
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">AREA OF INTEREST *</label>
              <select required value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })}
                className={inputClass} style={inputStyle}>
                <option value="research">Research collaboration</option>
                <option value="data">Data access / licensing</option>
                <option value="commercial">Commercial partnership</option>
                <option value="biosimilar">Biosimilar / biologics</option>
                <option value="grant">Grant / funding</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1.5">MESSAGE *</label>
              <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={`${inputClass} resize-none`} style={inputStyle}
                placeholder="Tell us about your interest in notus.is..." />
            </div>

            <button type="submit"
              className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-lg transition-colors"
              style={{ backgroundColor: TEAL, color: "oklch(0.12 0.015 260)", fontFamily: "var(--font-headline)" }}>
              Send Message <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
