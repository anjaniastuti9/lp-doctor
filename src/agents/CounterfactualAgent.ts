// CounterfactualAgent
// Asks: "What if the patient had just held something simpler?"
// Computes three counterfactuals — 50/50 hold, 100% base, 100% quote (often a
// stablecoin so it stays roughly flat).

import type {
  CounterfactualReport,
  DexPair,
  Finding,
  Prescription,
  Vitals,
} from './types'

const STABLE_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'TUSD',
  'FDUSD',
  'USDP',
  'PYUSD',
  'USDS',
  'LUSD',
])

export interface CounterfactualResult {
  cf: CounterfactualReport
  finding: Finding
}

export class CounterfactualAgent {
  static label = 'CounterfactualAgent'

  run(rx: Prescription, pair: DexPair, vitals: Vitals): CounterfactualResult {
    const r = vitals.priceRatio
    const D = rx.depositUsd

    const hodl5050Usd = (D * (1 + r)) / 2
    const hodlAllBaseUsd = D * r
    // Quote is usually a stablecoin or another major. If it's a known stable,
    // assume roughly flat (still $D). Otherwise we can't measure quote
    // independently from this endpoint, so we model it as flat.
    const quoteIsStable = STABLE_SYMBOLS.has(pair.quoteToken.symbol.toUpperCase())
    const hodlAllQuoteUsd = D

    const candidates: { label: string; usd: number }[] = [
      { label: '50/50 HODL', usd: hodl5050Usd },
      { label: `100% ${pair.baseToken.symbol}`, usd: hodlAllBaseUsd },
      {
        label: quoteIsStable
          ? `100% ${pair.quoteToken.symbol} (cash)`
          : `100% ${pair.quoteToken.symbol}`,
        usd: hodlAllQuoteUsd,
      },
    ]
    const best = candidates.reduce((a, b) => (b.usd > a.usd ? b : a))

    const headlineWinner =
      best.label === '50/50 HODL'
        ? 'A balanced HODL was the best alternative'
        : `Holding ${best.label} would have been the best alternative`
    const detail = `If the patient had simply held: 50/50 → $${hodl5050Usd.toFixed(2)} · 100% ${pair.baseToken.symbol} → $${hodlAllBaseUsd.toFixed(2)} · 100% ${pair.quoteToken.symbol} → $${hodlAllQuoteUsd.toFixed(2)}.`

    return {
      cf: {
        hodl5050Usd,
        hodlAllBaseUsd,
        hodlAllQuoteUsd,
        bestAlternativeLabel: best.label,
        bestAlternativeUsd: best.usd,
      },
      finding: {
        agent: CounterfactualAgent.label,
        severity: 'neutral',
        headline: headlineWinner,
        detail,
      },
    }
  }
}
