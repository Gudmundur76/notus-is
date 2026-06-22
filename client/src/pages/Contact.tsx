import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Send, Github, Globe, FlaskConical } from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

const reasons = [
  { id: "research", label: "Research Collaboration" },
  { id: "commercial", label: "Commercial Licensing" },
  { id: "alvotech", label: "Biosimilar / Analytical Similarity" },
  { id: "grant", label: "Grant / Horizon Europe" },
  { id: "other", label: "Other" },
];

export default function Contact() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5% 0px" });
  const [submitted, setSubmitted] = useState(false);
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div ref={ref} className="bg-deep-space min-h-screen">
      {/* Hero */}
      <section className="relative py-24 lg:py-32 hero-mesh">
        <div className="mx-auto max-w-[1280px] container-padding">
          <motion.span
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className="section-label"
          >
            {'// CONTACT'}
          </motion.span>
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="mt-4"
            style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-2px" }}
          >
            Get in <span style={{ color: "#10B981" }}>Touch</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
            className="mt-4 max-w-[560px]"
            style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", lineHeight: 1.7 }}
          >
            For research collaboration, commercial licensing, biosimilar analytical similarity work, or Horizon Europe grant discussions. Iceland-based. EEA-eligible.
          </motion.p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16 lg:py-24" style={{ backgroundColor: "#0D1425" }}>
        <div className="mx-auto max-w-[1280px] container-padding">
          <div className="grid lg:grid-cols-[1fr_400px] gap-12">
            {/* Form */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, ease: easeOutExpo }}
            >
              {submitted ? (
                <div
                  className="rounded-2xl p-10 text-center"
                  style={{ border: "1px solid rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.06)" }}
                >
                  <div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
                  >
                    <FlaskConical size={28} style={{ color: "#10B981" }} />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 24, fontWeight: 700, color: "#F0F4F8", marginBottom: 8 }}>
                    Message Received
                  </h3>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#94A3B8", lineHeight: 1.7 }}>
                    We will respond within 2 business days. If your inquiry is time-sensitive, reference the day-30 finding document in your message.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {[
                      { id: "name", label: "Name", type: "text", placeholder: "Your name" },
                      { id: "org", label: "Organisation", type: "text", placeholder: "Company or institution" },
                    ].map((field) => (
                      <div key={field.id}>
                        <label
                          htmlFor={field.id}
                          style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "#94A3B8", display: "block", marginBottom: 8 }}
                        >
                          {field.label}
                        </label>
                        <input
                          id={field.id}
                          type={field.type}
                          placeholder={field.placeholder}
                          required
                          className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                          style={{
                            backgroundColor: "#141E33",
                            border: "1px solid #1E2D47",
                            fontFamily: "var(--font-body)",
                            fontSize: 14,
                            color: "#F0F4F8",
                          }}
                          onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "#10B981"; }}
                          onBlur={(e) => { (e.target as HTMLElement).style.borderColor = "#1E2D47"; }}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label
                      style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "#94A3B8", display: "block", marginBottom: 8 }}
                    >
                      Reason for contact
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {reasons.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReason(r.id)}
                          className="rounded-full px-4 py-2 transition-all"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: 13,
                            backgroundColor: reason === r.id ? "#10B981" : "#1E2D47",
                            color: reason === r.id ? "#0A0F1C" : "#94A3B8",
                            border: reason === r.id ? "1px solid #10B981" : "1px solid #1E2D47",
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "#94A3B8", display: "block", marginBottom: 8 }}
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={6}
                      placeholder="Describe your interest or question..."
                      required
                      className="w-full rounded-xl px-4 py-3 outline-none transition-all resize-none"
                      style={{
                        backgroundColor: "#141E33",
                        border: "1px solid #1E2D47",
                        fontFamily: "var(--font-body)",
                        fontSize: 14,
                        color: "#F0F4F8",
                      }}
                      onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "#10B981"; }}
                      onBlur={(e) => { (e.target as HTMLElement).style.borderColor = "#1E2D47"; }}
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full justify-center">
                    <Send size={16} /> Send Message
                  </button>
                </form>
              )}
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.15, ease: easeOutExpo }}
              className="space-y-6"
            >
              <div className="stat-card">
                <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "#F0F4F8", marginBottom: 12 }}>
                  Open Source
                </h3>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6, marginBottom: 12 }}>
                  All engine code is open source on GitHub. The day-30 finding will be published under CC BY 4.0.
                </p>
                <a
                  href="https://github.com/Gudmundur76/asi-evolve-discovery-engine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#10B981" }}
                >
                  <Github size={14} /> Gudmundur76/asi-evolve-discovery-engine
                </a>
              </div>

              <div className="stat-card">
                <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "#F0F4F8", marginBottom: 12 }}>
                  Verification Backend
                </h3>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6, marginBottom: 12 }}>
                  All findings are verified via citation.manus.space — the ttruthdesk-platform production endpoint with 6,044 claims and an 8-stage pipeline.
                </p>
                <a
                  href="https://citation.manus.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#06B6D4" }}
                >
                  <Globe size={14} /> citation.manus.space
                </a>
              </div>

              <div className="stat-card">
                <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "#F0F4F8", marginBottom: 12 }}>
                  Iceland · EEA Eligible
                </h3>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>
                  Incorporated in Iceland. EEA-eligible for Horizon Europe applications. Alvotech collaboration discussions welcome.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
