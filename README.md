# notus.is — HIV Protease Discovery Publication Surface

React frontend for the notus.is autonomous HIV protease drug discovery system.

## Pages

- `/` — Home: particle network hero, live stats, 4-track overview, 30-day timeline
- `/findings` — Verified candidates with confidence scores and SMILES
- `/methodology` — Full pipeline documentation
- `/contact` — Contact form (no email addresses exposed)

## Design System

Built on the protein-bank-live design system:
- Colors: bio-teal (#10B981), bio-cyan, bio-violet, bio-amber on deep-space (#0A0F1E)
- Typography: Inter (body), Space Grotesk (headlines), JetBrains Mono (code)
- Components: framer-motion animations, lucide-react icons

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
# Output: dist/
```

## License

MIT
