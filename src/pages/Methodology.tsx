import { motion } from 'framer-motion';
import { Database, Cpu, Shield, BarChart3, GitBranch, Layers } from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];

const steps = [
  {
    icon: Database,
    title: 'Seed Corpus',
    subtitle: 'ChEMBL · PDB · BindingDB',
    body: `The system begins with 39 manually curated HIV protease inhibitor records drawn from three public databases. 
    Each record includes a verified SMILES string, experimental pIC₅₀ value, source database, and confidence score. 
    PDB co-crystal structures carry the highest confidence (0.99) as they represent direct experimental validation.`,
    color: 'text-bio-teal',
    border: 'border-bio-teal/30',
  },
  {
    icon: Cpu,
    title: 'Dynamic Ensemble',
    subtitle: 'Random Forest + Gradient Boosting',
    body: `A dynamic ensemble of 10–80 models (auto-scaled: +5 models per 50 new records) scores each candidate. 
    All models use Morgan fingerprints (2048-bit, radius 2). Candidates pass only when ensemble standard deviation 
    ≤ 0.3 pIC₅₀ (consensus threshold). This prevents overconfident predictions on novel scaffolds.`,
    color: 'text-bio-cyan',
    border: 'border-bio-cyan/30',
  },
  {
    icon: GitBranch,
    title: '4-Track Micro-Loops',
    subtitle: '200 candidates per cycle · 30–45 seconds',
    body: `Four parallel tracks generate 50 candidates each per cycle using scaffold-aware mutation. 
    Track A explores ChEMBL top actives, Track B uses PDB co-crystal ligands, Track C explores BindingDB 
    curated records, and Track D explores novel scaffolds. Each track maintains its own seed pool, 
    growing as verified records are added.`,
    color: 'text-bio-violet',
    border: 'border-bio-violet/30',
  },
  {
    icon: Shield,
    title: 'Citation Verification',
    subtitle: 'citation.is knowledge graph',
    body: `Every consensus candidate is submitted to the citation.is verification engine. 
    Verification checks pharmacophore features against known HIV PI patterns, cross-references 
    the knowledge graph for similar verified molecules, and validates pIC₅₀ against known 
    activity ranges. Progressive threshold: 0.85 (days 1–14) → 0.90 (days 15–21) → 0.92 (days 22–30).`,
    color: 'text-bio-amber',
    border: 'border-bio-amber/30',
  },
  {
    icon: Layers,
    title: 'ASI-Evolve Integration',
    subtitle: 'Cognition Store · UCB1 Sampler',
    body: `The ASI-Evolve Cognition Store accumulates domain knowledge and cycle lessons. 
    The UCB1 sampler (Upper Confidence Bound) balances exploration of novel scaffolds against 
    exploitation of high-confidence regions. After each cycle, the Analyzer agent writes a 
    structured lesson to the store, improving subsequent cycle decisions.`,
    color: 'text-bio-teal',
    border: 'border-bio-teal/30',
  },
  {
    icon: BarChart3,
    title: 'Convergence Analysis',
    subtitle: 'Cross-track consensus from day 7',
    body: `From day 7, the system identifies molecules appearing in 2 or more tracks. 
    These convergence candidates represent the highest-confidence discoveries — independently 
    found by different exploration strategies. At day 30, the top 4–8 convergence candidates 
    form the basis of the scientific finding document.`,
    color: 'text-bio-cyan',
    border: 'border-bio-cyan/30',
  },
];

export default function Methodology() {
  return (
    <main className="pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="mb-12"
        >
          <span className="section-label">METHODOLOGY</span>
          <h1 className="font-headline text-4xl font-bold text-text-primary mt-2 mb-4">
            How notus.is Works
          </h1>
          <p className="font-body text-text-secondary max-w-2xl leading-relaxed">
            notus.is is an autonomous drug discovery system built on three principles: 
            citation-verified knowledge, ensemble consensus scoring, and cross-track convergence. 
            Every finding is reproducible and grounded in public scientific literature.
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div className="space-y-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: easeOut }}
              className={`rounded-xl border ${step.border} bg-slate-800/30 p-6`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg border ${step.border} flex items-center justify-center shrink-0 mt-0.5`}>
                  <step.icon size={18} className={step.color} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-headline text-lg font-semibold text-text-primary">{step.title}</h3>
                    <span className="font-mono text-xs text-text-muted">{step.subtitle}</span>
                  </div>
                  <p className="font-body text-sm text-text-secondary leading-relaxed">{step.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Data sources */}
        <div className="mt-12 rounded-xl border border-slate-700 p-6">
          <h3 className="font-headline text-lg font-semibold text-text-primary mb-4">Data Sources</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: 'ChEMBL', desc: 'Bioactivity database. Target: CHEMBL4523 (HIV-1 protease). IC₅₀ assay data.', url: 'https://www.ebi.ac.uk/chembl/' },
              { name: 'RCSB PDB', desc: 'Protein Data Bank. Co-crystal structures: 1HXB, 1HSG, 2IEN, 2AQU, 1HXW.', url: 'https://www.rcsb.org/' },
              { name: 'BindingDB', desc: 'Binding affinity database. Curated HIV protease inhibitor records.', url: 'https://www.bindingdb.org/' },
            ].map((src) => (
              <div key={src.name} className="rounded-lg border border-slate-700 p-4">
                <a href={src.url} target="_blank" rel="noopener noreferrer"
                  className="font-headline text-sm font-semibold text-bio-teal hover:underline">
                  {src.name} ↗
                </a>
                <p className="font-body text-xs text-text-muted mt-1 leading-relaxed">{src.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reproducibility */}
        <div className="mt-6 rounded-xl border border-slate-700 p-6">
          <h3 className="font-headline text-lg font-semibold text-text-primary mb-2">Reproducibility</h3>
          <p className="font-body text-sm text-text-secondary leading-relaxed">
            All code is available on GitHub. The seed corpus, ensemble models, and cycle logs 
            are committed after each run. The day-30 finding document will include all SMILES strings, 
            pIC₅₀ values, confidence scores, and the full citation trail for each candidate.
            Data is licensed CC BY 4.0.
          </p>
        </div>
      </div>
    </main>
  );
}
