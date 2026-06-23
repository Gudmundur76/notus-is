import { useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Zap, Target, Shield, BarChart3, FlaskConical, GitBranch, Clock, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ════════════════════════ HERO ════════════════════════ */
function HeroSection() {
  const words = ["Autonomous", "Drug", "Discovery", "for", "HIV", "Protease"];
  const tealWords = ["Drug", "Discovery"];
  const { data: stats } = trpc.discovery.stats.useQuery(undefined, { refetchInterval: 30000 });
  const { data: loopStatus } = trpc.discovery.loopStatus.useQuery(undefined, { refetchInterval: 10000 });
  return (
    <section className="relative min-h-screen flex items-center hero-mesh overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full animate-glow-pulse"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-[400px] h-[400px] rounded-full animate-glow-pulse"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)", animationDelay: "2s" }}
        />
      </div>

      {/* Particle dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: i % 3 === 0 ? "#10B981" : i % 3 === 1 ? "#06B6D4" : "#8B5CF6",
              opacity: Math.random() * 0.4 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] container-padding py-32">
        {/* Live badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="inline-flex items-center gap-2 mb-8 rounded-full px-4 py-2"
          style={{ border: "1px solid rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.08)" }}
        >
          <div className="live-dot" />
          <span className="section-label" style={{ color: "#10B981" }}>LIVE · HIV PROTEASE DISCOVERY · DAY {stats?.dayNumber ?? 1} OF 30</span>
        </motion.div>

        {/* Headline */}
        <h1
          className="font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(40px, 6vw, 80px)", lineHeight: 1.1, letterSpacing: "-2px" }}
        >
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: easeOutExpo }}
              className="inline-block mr-[0.25em]"
              style={{ color: tealWords.includes(word) ? "#10B981" : "#F0F4F8" }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: easeOutExpo }}
          className="mb-10 max-w-[600px]"
          style={{ fontFamily: "var(--font-body)", fontSize: "clamp(16px, 2vw, 18px)", color: "#94A3B8", lineHeight: 1.7 }}
        >
          notus.is runs four parallel discovery tracks continuously, generating and verifying small molecule HIV protease inhibitor candidates against a growing citation-verified knowledge graph. The day-30 finding is a peer-reviewable scientific document.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.65, ease: easeOutExpo }}
          className="flex flex-wrap gap-4"
        >
          <Link to="/findings" className="btn-primary">
            View Findings <ArrowRight size={16} />
          </Link>
          <Link to="/methodology" className="btn-outline">
            Methodology
          </Link>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: easeOutExpo }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "Corpus Records", value: stats?.corpusSize?.toLocaleString() ?? "44", color: "#10B981" },
            { label: "Candidates Evaluated", value: stats?.totalCandidates?.toLocaleString() ?? "0", color: "#06B6D4" },
            { label: "Best pIC50", value: stats?.bestPic50 && stats.bestPic50 > 0 ? stats.bestPic50.toFixed(2) : "—", color: "#8B5CF6" },
            { label: "Day", value: `${stats?.dayNumber ?? 1} / 30`, color: "#F59E0B" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748B", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ════════════════════════ STATS TICKER ════════════════════════ */
function StatsTicker() {
  const items = [
    "Track A: ChEMBL Top Actives", "Track B: PDB Co-Crystal Ligands", "Track C: BindingDB Curated",
    "Track D: Diverse Scaffolds", "Ensemble: 10 Models", "Citation: citation.manus.space",
    "Corpus: 44 Records", "Day 1 of 30", "Verification: 8-Stage Pipeline", "ASI-Evolve: Active",
  ];
  const doubled = [...items, ...items];
  return (
    <div
      className="overflow-hidden py-4"
      style={{ borderTop: "1px solid #1E2D47", borderBottom: "1px solid #1E2D47", backgroundColor: "#141E33" }}
    >
      <div className="flex animate-ticker whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3 mx-8">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>{item}</span>
            <span style={{ color: "#1E2D47" }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════ 4 TRACKS ════════════════════════ */
function TracksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  const tracks = [
    {
      id: "A", label: "Track A", title: "ChEMBL Top Actives",
      desc: "Seeds from the highest-activity ChEMBL bioassay records. Explores hydroxyethylamine scaffold modifications.",
      color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)",
    },
    {
      id: "B", label: "Track B", title: "PDB Co-Crystal Ligands",
      desc: "Seeds from experimentally validated PDB co-crystal structures. Structure-guided modifications of P2/P2' groups.",
      color: "#06B6D4", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)",
    },
    {
      id: "C", label: "Track C", title: "BindingDB Curated",
      desc: "Seeds from BindingDB curated HIV protease records. Explores bis-THF and carbamate variants.",
      color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)",
    },
    {
      id: "D", label: "Track D", title: "Diverse Scaffolds",
      desc: "Fragment-based and macrocyclic exploration. Targets novel scaffold families with low Tanimoto similarity to approved drugs.",
      color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)",
    },
  ];

  return (
    <section ref={ref} className="py-24 lg:py-32" style={{ backgroundColor: "#0A0F1C" }}>
      <div className="mx-auto max-w-[1280px] container-padding">
        <motion.span
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="section-label"
        >
          {'// DISCOVERY ARCHITECTURE'}
        </motion.span>
        <motion.h2
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          className="mt-4 mb-4"
          style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-1.5px" }}
        >
          Four Parallel <span style={{ color: "#10B981" }}>Tracks</span>
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
          className="mb-12 max-w-[560px]"
          style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "#94A3B8", lineHeight: 1.7 }}
        >
          Each track seeds from a different data source, ensuring structural diversity. Molecules appearing in multiple tracks are convergence candidates.
        </motion.p>

        <div className="grid md:grid-cols-2 gap-6">
          {tracks.map((track, i) => (
            <motion.div
              key={track.id}
              initial={{ y: 30, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i, ease: easeOutExpo }}
              className="step-card"
              style={{ borderColor: track.border, backgroundColor: track.bg }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${track.color}20`, border: `1px solid ${track.border}` }}
                  >
                    <span style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: track.color }}>{track.id}</span>
                  </div>
                  <div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: track.color }}>{track.label}</span>
                    <h3 style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 700, color: "#F0F4F8" }}>{track.title}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="live-dot" style={{ backgroundColor: track.color }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: track.color }}>ACTIVE</span>
                </div>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>{track.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════ PIPELINE STEPS ════════════════════════ */
function PipelineSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

  const steps = [
    { num: "01", icon: FlaskConical, title: "Seed Corpus", desc: "39 curated HIV protease inhibitor records from ChEMBL, PDB, BindingDB. Mean confidence 0.935.", color: "#10B981" },
    { num: "02", icon: GitBranch, title: "4-Track Generation", desc: "50 candidates per track per cycle using scaffold-aware mutation. 200 candidates per cycle total.", color: "#06B6D4" },
    { num: "03", icon: Zap, title: "Ensemble Scoring", desc: "10-model ensemble. Consensus threshold: std ≤ 0.3 pIC₅₀. 138/150 passed in cycle 1.", color: "#8B5CF6" },
    { num: "04", icon: Shield, title: "Citation Verification", desc: "8-stage pipeline via citation.manus.space. PubMed + PDB + UniProt. Progressive confidence threshold.", color: "#F59E0B" },
    { num: "05", icon: Target, title: "Convergence Analysis", desc: "From day 7: cross-track consensus. Molecules in 2+ tracks are priority candidates.", color: "#10B981" },
    { num: "06", icon: BarChart3, title: "Day-30 Publication", desc: "Top 4–8 convergence candidates compiled into a peer-reviewable scientific document. CC BY 4.0.", color: "#06B6D4" },
  ];

  return (
    <section ref={ref} className="py-24 lg:py-32" style={{ backgroundColor: "#0D1425" }}>
      <div className="mx-auto max-w-[1280px] container-padding">
        <motion.span
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="section-label"
        >
          {'// THE PIPELINE'}
        </motion.span>
        <motion.h2
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          className="mt-4 mb-12"
          style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 700, color: "#F0F4F8", letterSpacing: "-1.5px" }}
        >
          From Corpus to <span style={{ color: "#10B981" }}>Finding</span>
        </motion.h2>

        <div className="flex flex-col gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ x: -30, opacity: 0 }}
                animate={isInView ? { x: 0, opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.1 * i, ease: easeOutExpo }}
                className="step-card grid grid-cols-1 lg:grid-cols-[80px_1fr] gap-6 items-start"
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${step.color}15`, border: `1px solid ${step.color}30` }}
                >
                  <Icon size={26} style={{ color: step.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>{step.num}</span>
                    <h3 style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 700, color: "#F0F4F8" }}>{step.title}</h3>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#94A3B8", lineHeight: 1.6, maxWidth: 640 }}>{step.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════ CTA ════════════════════════ */
function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-15% 0px" });
  const words = ["Ready", "to", "Accelerate", "Discovery?"];

  return (
    <section ref={ref} className="relative py-32 lg:py-40 overflow-hidden" style={{ backgroundColor: "#0A0F1C" }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[600px] h-[600px] rounded-full animate-glow-pulse"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)" }}
        />
      </div>
      <div className="relative z-10 mx-auto max-w-[1280px] container-padding text-center">
        <h2
          className="font-bold"
          style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(40px, 6vw, 72px)", letterSpacing: "-2px" }}
        >
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ y: 50, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: i * 0.08, ease: easeOutExpo }}
              className="inline-block mr-[0.3em]"
              style={{ color: word === "Discovery?" ? "#10B981" : "#F0F4F8" }}
            >
              {word}
            </motion.span>
          ))}
        </h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4, ease: easeOutExpo }}
          className="mt-6 mx-auto max-w-[520px]"
          style={{ fontFamily: "var(--font-body)", fontSize: "clamp(15px, 2vw, 18px)", color: "#94A3B8", lineHeight: 1.7 }}
        >
          notus.is is open source and runs autonomously. The day-30 finding document will be published on bioRxiv under CC BY 4.0.
        </motion.p>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6, ease: easeOutExpo }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <a
            href="https://github.com/Gudmundur76/asi-evolve-discovery-engine"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            View on GitHub <ArrowRight size={16} />
          </a>
          <Link to="/contact" className="btn-outline">
            Contact Us
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-12 flex flex-wrap justify-center gap-8"
        >
          {[
            { icon: CheckCircle, text: "Citation-verified" },
            { icon: Clock, text: "Daily micro-loops" },
            { icon: Shield, text: "Open source" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon size={14} style={{ color: "#10B981" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#64748B" }}>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div>
      <HeroSection />
      <StatsTicker />
      <TracksSection />
      <PipelineSection />
      <CTASection />
    </div>
  );
}
