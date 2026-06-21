import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, BarChart3, Dna, Download, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface Candidate {
  id: string;
  name: string;
  smiles: string;
  pic50: number;
  confidence: number;
  tracks: string[];
  scaffold: string;
  novelty: number;
  day: number;
  verdict: string;
}

// Seed data — will be replaced by live API data
const SEED_CANDIDATES: Candidate[] = [
  {
    id: 'mol_000000',
    name: 'Darunavir (Reference)',
    smiles: 'O=C(N[C@@H](Cc1ccccc1)[C@@H](O)C[C@@H](Cc1ccccc1)NC(=O)OC1COC2CCOC12)c1ccc(N)cc1',
    pic50: 9.5,
    confidence: 0.99,
    tracks: ['C'],
    scaffold: 'bis_thf',
    novelty: 0.0,
    day: 1,
    verdict: 'Strongly Supported',
  },
];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.95
      ? 'text-bio-teal border-bio-teal/30 bg-bio-teal/10'
      : confidence >= 0.85
      ? 'text-bio-cyan border-bio-cyan/30 bg-bio-cyan/10'
      : 'text-bio-amber border-bio-amber/30 bg-bio-amber/10';
  return (
    <span className={`font-mono text-xs border rounded px-2 py-0.5 ${color}`}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

function TrackBadge({ track }: { track: string }) {
  const colors: Record<string, string> = {
    A: 'text-bio-teal bg-bio-teal/10',
    B: 'text-bio-cyan bg-bio-cyan/10',
    C: 'text-bio-violet bg-bio-violet/10',
    D: 'text-bio-amber bg-bio-amber/10',
  };
  return (
    <span className={`font-mono text-xs rounded px-1.5 py-0.5 ${colors[track] || 'text-text-muted bg-slate-700'}`}>
      T{track}
    </span>
  );
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-headline text-sm font-semibold text-text-primary">{candidate.name}</span>
            {candidate.tracks.map((t) => (
              <TrackBadge key={t} track={t} />
            ))}
            <ConfidenceBadge confidence={candidate.confidence} />
          </div>
          <div className="font-mono text-xs text-text-muted truncate">{candidate.smiles.slice(0, 60)}...</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-headline text-lg font-bold text-bio-teal">{candidate.pic50.toFixed(2)}</div>
          <div className="font-mono text-xs text-text-muted">pIC₅₀</div>
        </div>
        <div className="text-text-muted">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 bg-slate-800/30">
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="font-mono text-xs text-text-muted mb-1">SCAFFOLD FAMILY</div>
              <div className="font-body text-sm text-text-primary capitalize">{candidate.scaffold.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="font-mono text-xs text-text-muted mb-1">STRUCTURAL NOVELTY</div>
              <div className="font-body text-sm text-text-primary">{(candidate.novelty * 100).toFixed(0)}% from approved drugs</div>
            </div>
            <div>
              <div className="font-mono text-xs text-text-muted mb-1">CITATION VERDICT</div>
              <div className="font-body text-sm text-bio-teal">{candidate.verdict}</div>
            </div>
          </div>
          <div>
            <div className="font-mono text-xs text-text-muted mb-1">FULL SMILES</div>
            <div className="font-mono text-xs text-text-secondary bg-deep-space rounded p-2 break-all">
              {candidate.smiles}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(candidate.smiles)}/JSON`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-bio-teal hover:underline"
            >
              PubChem lookup <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Findings() {
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');

  const filtered =
    filter === 'all'
      ? SEED_CANDIDATES
      : SEED_CANDIDATES.filter((c) => c.tracks.includes(filter));

  return (
    <main className="pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="mb-12"
        >
          <span className="section-label">DISCOVERY FINDINGS</span>
          <h1 className="font-headline text-4xl font-bold text-text-primary mt-2 mb-4">
            Verified Candidates
          </h1>
          <p className="font-body text-text-secondary max-w-2xl">
            All candidates listed here have passed ensemble consensus scoring (std ≤ 0.3 pIC₅₀)
            and citation verification (confidence ≥ 0.85). The corpus grows with each micro-loop cycle.
          </p>
        </motion.div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Corpus Records', value: 39, icon: Dna, color: 'text-bio-teal' },
            { label: 'Verified Candidates', value: SEED_CANDIDATES.length, icon: Shield, color: 'text-bio-cyan' },
            { label: 'Convergent (2+ tracks)', value: 0, icon: BarChart3, color: 'text-bio-violet' },
            { label: 'Mean Confidence', value: '99%', icon: Shield, color: 'text-bio-amber' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className={`font-headline text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="font-body text-xs text-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Track filter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="font-mono text-xs text-text-muted">Filter by track:</span>
          {(['all', 'A', 'B', 'C', 'D'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`font-mono text-xs px-3 py-1 rounded border transition-colors ${
                filter === t
                  ? 'border-bio-teal text-bio-teal bg-bio-teal/10'
                  : 'border-slate-700 text-text-muted hover:border-slate-600'
              }`}
            >
              {t === 'all' ? 'All' : `Track ${t}`}
            </button>
          ))}

          <button className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-text-muted border border-slate-700 rounded px-3 py-1 hover:border-slate-600">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Candidate list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-text-muted font-body">
              No candidates yet for this track. The engine is running.
            </div>
          ) : (
            filtered.map((c) => <CandidateRow key={c.id} candidate={c} />)
          )}
        </div>

        {/* Day 30 note */}
        <div className="mt-12 rounded-xl border border-bio-teal/20 bg-bio-teal/5 p-6">
          <h3 className="font-headline text-lg font-semibold text-bio-teal mb-2">
            Day 30 Scientific Finding
          </h3>
          <p className="font-body text-sm text-text-secondary leading-relaxed">
            At day 30, the top convergence candidates — molecules appearing in 2 or more tracks
            with confidence ≥ 0.92 — will be compiled into a 15–20 page scientific document
            following IUPAC and JACS formatting standards. The document will be published here
            and submitted to bioRxiv under CC BY 4.0.
          </p>
        </div>
      </div>
    </main>
  );
}
