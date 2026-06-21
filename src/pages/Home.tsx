import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router';
import { Dna, Target, BarChart3, Shield, ArrowRight, Clock, CheckCircle2, Zap } from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];

// Particle network canvas
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = 60;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
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

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-40"
      style={{ pointerEvents: 'none' }}
    />
  );
}

// Animated counter
function Counter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
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

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Status badge
function PulseBadge({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-bio-teal animate-pulse' : 'bg-text-muted'}`} />
      <span className={active ? 'text-bio-teal' : 'text-text-muted'}>{label}</span>
    </span>
  );
}

export default function Home() {
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true });

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center hero-mesh overflow-hidden">
        <ParticleCanvas />
        <div className="glow-teal absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOut }}
          >
            <div className="flex items-center gap-3 mb-6">
              <PulseBadge label="LIVE · HIV PROTEASE DISCOVERY" active />
              <span className="section-label">Day 1 of 30</span>
            </div>

            <h1 className="font-headline text-5xl md:text-7xl font-bold text-text-primary leading-tight mb-6">
              Autonomous<br />
              <span className="text-bio-teal">Drug Discovery</span><br />
              for HIV Protease
            </h1>

            <p className="font-body text-lg text-text-secondary max-w-2xl mb-10 leading-relaxed">
              notus.is runs four parallel discovery tracks continuously, generating and verifying
              small molecule HIV protease inhibitor candidates against a growing citation-verified
              knowledge graph. The day-30 finding is a peer-reviewable scientific document.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/findings"
                className="inline-flex items-center gap-2 bg-bio-teal text-deep-space font-headline font-semibold px-6 py-3 rounded-lg hover:bg-bio-teal/90 transition-colors"
              >
                View Findings <ArrowRight size={16} />
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 border border-slate-700 text-text-secondary font-body px-6 py-3 rounded-lg hover:border-bio-teal/30 hover:text-text-primary transition-colors"
              >
                Methodology
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Stats */}
      <section ref={statsRef} className="py-20 border-t border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={statsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: easeOut }}
            className="text-center mb-12"
          >
            <span className="section-label">LIVE METRICS</span>
            <h2 className="font-headline text-3xl font-bold text-text-primary mt-2">
              Discovery Engine Status
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Dna, label: 'Corpus Records', value: 39, suffix: '', color: 'text-bio-teal' },
              { icon: Target, label: 'Candidates Evaluated', value: 0, suffix: '', color: 'text-bio-cyan' },
              { icon: Shield, label: 'Verified Records', value: 0, suffix: '', color: 'text-bio-violet' },
              { icon: BarChart3, label: 'Convergence Candidates', value: 0, suffix: '', color: 'text-bio-amber' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center card-shine"
              >
                <stat.icon size={24} className={`${stat.color} mx-auto mb-3`} />
                <div className={`font-headline text-3xl font-bold ${stat.color} mb-1`}>
                  <Counter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="font-body text-sm text-text-muted">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Four Tracks */}
      <section className="py-20 bg-midnight/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="section-label">DISCOVERY ARCHITECTURE</span>
            <h2 className="font-headline text-3xl font-bold text-text-primary mt-2">
              Four Parallel Tracks
            </h2>
            <p className="font-body text-text-secondary mt-3 max-w-xl mx-auto">
              Each track seeds from a different data source, ensuring structural diversity.
              Molecules appearing in multiple tracks are convergence candidates.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                track: 'A',
                name: 'ChEMBL Top Actives',
                desc: 'Seeds from the highest-activity ChEMBL bioassay records. Explores hydroxyethylamine scaffold modifications.',
                status: 'active',
                color: 'border-bio-teal/40 bg-bio-teal/5',
                badge: 'text-bio-teal',
              },
              {
                track: 'B',
                name: 'PDB Co-Crystal Ligands',
                desc: 'Seeds from experimentally validated PDB co-crystal structures. Structure-guided modifications of P2/P2\' groups.',
                status: 'active',
                color: 'border-bio-cyan/40 bg-bio-cyan/5',
                badge: 'text-bio-cyan',
              },
              {
                track: 'C',
                name: 'BindingDB Curated',
                desc: 'Seeds from BindingDB curated HIV protease records. Explores bis-THF and carbamate variants.',
                status: 'active',
                color: 'border-bio-violet/40 bg-bio-violet/5',
                badge: 'text-bio-violet',
              },
              {
                track: 'D',
                name: 'Diverse Scaffolds',
                desc: 'Fragment-based and macrocyclic exploration. Targets novel scaffold families with low Tanimoto similarity to approved drugs.',
                status: 'active',
                color: 'border-bio-amber/40 bg-bio-amber/5',
                badge: 'text-bio-amber',
              },
            ].map((track, i) => (
              <motion.div
                key={track.track}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className={`rounded-xl border p-6 ${track.color}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-mono text-2xl font-bold ${track.badge}`}>
                    Track {track.track}
                  </span>
                  <PulseBadge label={track.status.toUpperCase()} active={track.status === 'active'} />
                </div>
                <h3 className="font-headline text-lg font-semibold text-text-primary mb-2">
                  {track.name}
                </h3>
                <p className="font-body text-sm text-text-secondary leading-relaxed">
                  {track.desc}
                </p>
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
            <h2 className="font-headline text-3xl font-bold text-text-primary mt-2">
              From Corpus to Finding
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                phase: 'Days 1–14',
                icon: Zap,
                title: 'Seeding & Exploration',
                desc: 'Build corpus from public databases. Run micro-loops at citation threshold 0.85. Ensemble grows from 10 models.',
                status: 'current',
              },
              {
                phase: 'Days 15–21',
                icon: Target,
                title: 'Convergence Detection',
                desc: 'Cross-track analysis identifies molecules appearing in 2+ tracks. Citation threshold rises to 0.90. Ensemble at 30+ models.',
                status: 'upcoming',
              },
              {
                phase: 'Days 22–30',
                icon: CheckCircle2,
                title: 'Finding Publication',
                desc: 'Final convergence analysis. Citation threshold 0.92. 4–8 convergent candidates. 15–20 page scientific document published.',
                status: 'upcoming',
              },
            ].map((phase, i) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
                className={`rounded-xl border p-6 ${
                  phase.status === 'current'
                    ? 'border-bio-teal/40 bg-bio-teal/5'
                    : 'border-slate-700 bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <phase.icon
                    size={18}
                    className={phase.status === 'current' ? 'text-bio-teal' : 'text-text-muted'}
                  />
                  <span className="font-mono text-xs text-text-muted">{phase.phase}</span>
                  {phase.status === 'current' && (
                    <span className="ml-auto">
                      <PulseBadge label="NOW" active />
                    </span>
                  )}
                </div>
                <h3 className="font-headline text-base font-semibold text-text-primary mb-2">
                  {phase.title}
                </h3>
                <p className="font-body text-sm text-text-secondary leading-relaxed">
                  {phase.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Dna size={16} className="text-bio-teal" />
            <span className="font-headline font-bold text-text-primary">
              notus<span className="text-bio-teal">.is</span>
            </span>
            <span className="font-mono text-xs text-text-muted ml-2">
              HIV Protease Drug Discovery
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/methodology" className="font-body text-sm text-text-muted hover:text-text-secondary">
              Methodology
            </Link>
            <Link to="/findings" className="font-body text-sm text-text-muted hover:text-text-secondary">
              Findings
            </Link>
            <Link to="/contact" className="font-body text-sm text-text-muted hover:text-text-secondary">
              Contact
            </Link>
          </div>
          <span className="font-mono text-xs text-text-muted">
            © 2026 notus.is · Iceland
          </span>
        </div>
      </footer>
    </main>
  );
}
