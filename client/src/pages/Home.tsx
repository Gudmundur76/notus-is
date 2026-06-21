import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { Dna, Target, BarChart3, Shield, ArrowRight, CheckCircle2, Zap } from "lucide-react";

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TEAL = "oklch(0.72 0.17 162)";
const CYAN = "oklch(0.70 0.15 200)";
const VIOLET = "oklch(0.60 0.22 290)";
const AMBER = "oklch(0.78 0.17 80)";

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1 });
    }
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(16, 185, 129, 0.5)";
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40" style={{ pointerEvents: "none" }} />;
}

function Counter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);
  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function PulseBadge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "animate-pulse" : ""}`}
        style={{ backgroundColor: active ? TEAL : "oklch(0.60 0.010 260)" }} />
      <span style={{ color: active ? TEAL : "oklch(0.60 0.010 260)" }}>{label}</span>
    </span>
  );
}

export default function Home() {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true });

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden hero-mesh">
        <ParticleCanvas />
        <div className="glow-teal absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: easeOut }}>
            <div className="flex items-center gap-3 mb-6">
              <PulseBadge label="LIVE · HIV PROTEASE DISCOVERY" active />
              <span className="section-label">Day 1 of 30</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight mb-6" style={{ fontFamily: "var(--font-headline)" }}>
              Autonomous<br />
              <span style={{ color: TEAL }}>Drug Discovery</span><br />
              for HIV Protease
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
              notus.is runs four parallel discovery tracks continuously, generating and verifying
              small molecule HIV protease inhibitor candidates against a growing citation-verified
              knowledge graph. The day-30 finding is a peer-reviewable scientific document.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/findings" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-lg transition-colors"
                style={{ backgroundColor: TEAL, color: "oklch(0.12 0.015 260)", fontFamily: "var(--font-headline)" }}>
                View Findings <ArrowRight size={16} />
              </Link>
              <Link href="/methodology" className="inline-flex items-center gap-2 border px-6 py-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                style={{ borderColor: "oklch(0.22 0.012 260)" }}>
                Methodology
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Stats */}
      <section ref={statsRef} className="py-20 border-t" style={{ borderColor: "oklch(0.22 0.012 260 / 0.5)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={statsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, ease: easeOut }} className="text-center mb-12">
            <span className="section-label">LIVE METRICS</span>
            <h2 className="text-3xl font-bold text-foreground mt-2" style={{ fontFamily: "var(--font-headline)" }}>Discovery Engine Status</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Dna, label: "Corpus Records", value: 44, color: TEAL },
              { icon: Target, label: "Candidates Evaluated", value: 150, color: CYAN },
              { icon: Shield, label: "Verified Records", value: 5, color: VIOLET },
              { icon: BarChart3, label: "Convergence Candidates", value: 0, color: AMBER },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={statsInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className="rounded-xl border p-6 text-center card-shine" style={{ borderColor: "oklch(0.22 0.012 260)" }}>
                <stat.icon size={24} className="mx-auto mb-3" style={{ color: stat.color }} />
                <div className="text-3xl font-bold mb-1" style={{ color: stat.color, fontFamily: "var(--font-headline)" }}>
                  <Counter target={stat.value} />
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Four Tracks */}
      <section className="py-20" style={{ backgroundColor: "oklch(0.14 0.015 260 / 0.3)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="section-label">DISCOVERY ARCHITECTURE</span>
            <h2 className="text-3xl font-bold text-foreground mt-2" style={{ fontFamily: "var(--font-headline)" }}>Four Parallel Tracks</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Each track seeds from a different data source, ensuring structural diversity. Molecules appearing in multiple tracks are convergence candidates.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { track: "A", name: "ChEMBL Top Actives", desc: "Seeds from the highest-activity ChEMBL bioassay records. Explores hydroxyethylamine scaffold modifications.", color: TEAL },
              { track: "B", name: "PDB Co-Crystal Ligands", desc: "Seeds from experimentally validated PDB co-crystal structures. Structure-guided modifications of P2/P2′ groups.", color: CYAN },
              { track: "C", name: "BindingDB Curated", desc: "Seeds from BindingDB curated HIV protease records. Explores bis-THF and carbamate variants.", color: VIOLET },
              { track: "D", name: "Diverse Scaffolds", desc: "Fragment-based and macrocyclic exploration. Targets novel scaffold families with low Tanimoto similarity to approved drugs.", color: AMBER },
            ].map((track, i) => (
              <motion.div key={track.track} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className="rounded-xl border p-6" style={{ borderColor: `${track.color.replace(")", " / 0.4)")}`, backgroundColor: `${track.color.replace(")", " / 0.05)")}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-2xl font-bold" style={{ color: track.color }}>Track {track.track}</span>
                  <PulseBadge label="ACTIVE" active />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: "var(--font-headline)" }}>{track.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{track.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="section-label">30-DAY TIMELINE</span>
            <h2 className="text-3xl font-bold text-foreground mt-2" style={{ fontFamily: "var(--font-headline)" }}>From Corpus to Finding</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { phase: "Days 1–14", icon: Zap, title: "Seeding & Exploration", desc: "Build corpus from public databases. Run micro-loops at citation threshold 0.85. Ensemble grows from 10 models.", current: true },
              { phase: "Days 15–21", icon: Target, title: "Convergence Detection", desc: "Cross-track analysis identifies molecules appearing in 2+ tracks. Citation threshold rises to 0.90. Ensemble at 30+ models.", current: false },
              { phase: "Days 22–30", icon: CheckCircle2, title: "Finding Publication", desc: "Final convergence analysis. Citation threshold 0.92. 4–8 convergent candidates. 15–20 page scientific document published.", current: false },
            ].map((phase, i) => (
              <motion.div key={phase.phase} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className="rounded-xl border p-6"
                style={phase.current
                  ? { borderColor: `${TEAL.replace(")", " / 0.4)")}`, backgroundColor: `${TEAL.replace(")", " / 0.05)")}` }
                  : { borderColor: "oklch(0.22 0.012 260)", backgroundColor: "oklch(0.14 0.015 260 / 0.3)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <phase.icon size={18} style={{ color: phase.current ? TEAL : "oklch(0.60 0.010 260)" }} />
                  <span className="font-mono text-xs text-muted-foreground">{phase.phase}</span>
                  {phase.current && <span className="ml-auto"><PulseBadge label="NOW" active /></span>}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2" style={{ fontFamily: "var(--font-headline)" }}>{phase.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{phase.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12" style={{ borderColor: "oklch(0.22 0.012 260 / 0.5)" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Dna size={16} style={{ color: TEAL }} />
            <span className="font-bold text-foreground" style={{ fontFamily: "var(--font-headline)" }}>
              notus<span style={{ color: TEAL }}>.is</span>
            </span>
            <span className="text-muted-foreground text-sm">HIV Protease Drug Discovery</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/methodology" className="hover:text-foreground transition-colors">Methodology</Link>
            <Link href="/findings" className="hover:text-foreground transition-colors">Findings</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="text-xs text-muted-foreground font-mono">© 2026 notus.is · Iceland</div>
        </div>
      </footer>
    </main>
  );
}
