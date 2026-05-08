# LP Doctor

> A multi-agent diagnostic for DEX liquidity positions — narrated like a medical report.

LP Doctor takes a DEX pair, a hypothetical deposit size, and a time window, then runs a sequential five-agent pipeline that measures impermanent loss, projects fee yield, builds counterfactuals against three "would-have-held-instead" scenarios, and finally writes up a treatment plan. No LLM calls — every agent is deterministic — so the same prescription always produces the same diagnosis.

**Live demo:** _see the deployed preview URL in the PR description_

## Why this exists

LP positions are sold as "passive income" but quietly bleed value to impermanent loss whenever price diverges from entry. Most LP dashboards show a number; nobody walks the user through *why* the position is healthy or sick. LP Doctor frames the position as a patient — vitals, specialist findings, prognosis curve, doctor's note — so the trader walks away with an actionable answer (stay / rebalance / exit) instead of just data.

## The pipeline

```
Prescription           ┌───────────────┐
  pair URL    ─────────▶│ PositionAgent │  fetch pool, derive r = price_now / price_entry
  deposit              └───────┬───────┘
  window                       ▼
                       ┌──────────────────────┐
                       │ ImpermanentLossAgent │  IL = 2·√r/(1+r) − 1
                       └──────────┬───────────┘
                                  ▼
                       ┌──────────────────┐
                       │ FeeYieldAgent    │  user share × pool fees, extrapolated APY
                       └──────────┬───────┘
                                  ▼
                       ┌─────────────────────┐
                       │ CounterfactualAgent │  50/50, 100% base, 100% quote alternatives
                       └──────────┬──────────┘
                                  ▼
                       ┌──────────────┐
                       │ DoctorAgent  │  diagnosis + treatment + prognosis paragraph
                       └──────────────┘
```

| Agent | Responsibility |
| --- | --- |
| `PositionAgent` | Parses a DexScreener URL or chain/address, fetches the live pool, normalises into a typed `DexPair`, derives the current vs window-entry price ratio. |
| `ImpermanentLossAgent` | Applies the constant-product IL formula and pre-computes a continuous prognosis curve from r=0.4 to r=2.5 for the chart. |
| `FeeYieldAgent` | Estimates the patient's share of the pool, multiplies by gross window fees at the DEX's standard tier, extrapolates an annualised pace. |
| `CounterfactualAgent` | Calculates three alternatives — 50/50 hold, 100% base, 100% quote — and picks the best one. |
| `DoctorAgent` | The long-chain reasoner. Takes every prior finding, weighs them deterministically, emits a `healthy / watch / critical` diagnosis with a `stay / rebalance / exit` treatment and a one-paragraph prognosis. |

## Stack

- React + Vite + TypeScript
- Tailwind CSS, lucide-react icons
- Recharts (prognosis curve)
- DexScreener public API (no key required)

## Repo layout

```
src/
├── agents/
│   ├── types.ts                  # shared contracts between agents
│   ├── PositionAgent.ts          # fetch + parse the patient
│   ├── ImpermanentLossAgent.ts   # IL math + prognosis curve
│   ├── FeeYieldAgent.ts          # share-of-pool fee projection
│   ├── CounterfactualAgent.ts    # 50/50, 100% base, 100% quote
│   ├── DoctorAgent.ts            # final synthesis (long-chain reasoner)
│   └── Pipeline.ts               # sequential orchestrator
├── App.tsx                       # form + pipeline trace + report
└── main.tsx
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

## Caveats

- Implied APY is a linear extrapolation from the chosen window — real LP yield is volatile and direction-dependent.
- DEX fee tiers are best-guess defaults per protocol. Override with `feeRatePct` on the prescription if you know the exact tier.
- Quote-token counterfactual assumes a flat USD value (true for stablecoins, approximate for ETH/SOL pairs).
- Educational tool only — not financial advice.
