// FeeYieldAgent
// Estimates the dollar fees the patient's deposit would have earned during
// the window, plus a naive annualized projection.

import type { DexPair, FeeReport, Finding, Prescription, Vitals, Window } from './types'

// Default fee tiers per DEX. Conservative starting points; users can override.
const DEX_FEE_TIERS: Record<string, number> = {
  uniswap: 0.3,
  'uniswap-v2': 0.3,
  'uniswap-v3': 0.3,
  pancakeswap: 0.25,
  raydium: 0.25,
  meteora: 0.25,
  pumpswap: 1.0,
  'pump-fun': 1.0,
  orca: 0.3,
  sushiswap: 0.3,
  quickswap: 0.3,
  balancer: 0.3,
  curve: 0.04,
  trader_joe: 0.3,
}

const WINDOW_HOURS: Record<Window, number> = { h1: 1, h6: 6, h24: 24 }

export interface FeeResult {
  fees: FeeReport
  finding: Finding
}

export class FeeYieldAgent {
  static label = 'FeeYieldAgent'

  run(rx: Prescription, pair: DexPair, vitals: Vitals): FeeResult {
    const tier =
      rx.feeRatePct ??
      DEX_FEE_TIERS[pair.dexId.toLowerCase()] ??
      DEX_FEE_TIERS[pair.dexId.toLowerCase().split('-')[0]] ??
      0.3
    const feeRate = tier / 100

    // User's share of the (post-deposit) pool. Add deposit so we don't overstate
    // share if the deposit is large relative to the pool.
    const userShare =
      vitals.liquidityUsd > 0
        ? rx.depositUsd / (vitals.liquidityUsd + rx.depositUsd)
        : 0

    const grossPoolFees = vitals.volumeWindow * feeRate
    const userFees = grossPoolFees * userShare

    const hours = WINDOW_HOURS[rx.window]
    // Simple linear extrapolation. Fee yield is volatile; this is a guideline.
    const apyImpliedPct =
      rx.depositUsd > 0 ? (userFees / rx.depositUsd) * (8760 / hours) * 100 : 0

    let severity: Finding['severity']
    let headline: string
    let detail: string
    if (apyImpliedPct > 30) {
      severity = 'good'
      headline = 'Strong fee yield'
      detail = `Implied APY ~${apyImpliedPct.toFixed(0)}% from $${grossPoolFees.toFixed(0)} pool fees on ${WINDOW_HOURS[rx.window]}h volume of $${Math.round(vitals.volumeWindow).toLocaleString()}. (${tier.toFixed(2)}% fee tier; user share ${(userShare * 100).toFixed(2)}%.)`
    } else if (apyImpliedPct > 8) {
      severity = 'neutral'
      headline = 'Moderate fee yield'
      detail = `Implied APY ~${apyImpliedPct.toFixed(0)}% (user share ${(userShare * 100).toFixed(2)}% of pool).`
    } else if (apyImpliedPct > 1) {
      severity = 'warn'
      headline = 'Thin fee yield'
      detail = `Implied APY ~${apyImpliedPct.toFixed(1)}% — not much trading volume in this window.`
    } else {
      severity = 'bad'
      headline = 'Anaemic fee yield'
      detail = `Implied APY ~${apyImpliedPct.toFixed(1)}% — fees won't cover meaningful price divergence.`
    }

    return {
      fees: {
        feeRatePct: tier,
        userShare,
        grossPoolFees,
        userFees,
        apyImpliedPct,
      },
      finding: { agent: FeeYieldAgent.label, severity, headline, detail },
    }
  }
}
