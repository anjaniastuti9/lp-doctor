// Shared types for the LP Doctor multi-agent diagnostic pipeline.
// Each agent reads the running PatientChart and appends findings.

export interface DexPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceUsd?: string
  priceNative?: string
  txns: {
    m5: { buys: number; sells: number }
    h1: { buys: number; sells: number }
    h6: { buys: number; sells: number }
    h24: { buys: number; sells: number }
  }
  volume: { h24: number; h6: number; h1: number; m5: number }
  priceChange: { m5: number; h1: number; h6: number; h24: number }
  liquidity?: { usd: number; base: number; quote: number }
  fdv?: number
  marketCap?: number
  pairCreatedAt?: number
  info?: {
    imageUrl?: string
    websites?: { url: string; label?: string }[]
    socials?: { url: string; type: string }[]
  }
}

export type Window = 'h1' | 'h6' | 'h24'

export interface Prescription {
  pairUrl: string
  depositUsd: number
  window: Window
  feeRatePct?: number // optional override of DEX default (0.3)
}

// One narrated finding from an agent. The Doctor stitches these together.
export interface Finding {
  agent: string
  severity: 'good' | 'neutral' | 'warn' | 'bad'
  headline: string
  detail: string
}

export interface Vitals {
  priceNow: number
  priceEntry: number
  priceRatio: number // r = now / entry
  liquidityUsd: number
  volumeWindow: number
}

export interface IlReport {
  ilPct: number // negative = loss vs HODL, e.g. -0.0501 = -5.01%
  ilUsd: number // dollar amount of IL relative to HODL_50_50
  hodl5050Usd: number // value if user had just held 50/50 the same allocation
  lpValueUsd: number // current LP position value before fees
}

export interface FeeReport {
  feeRatePct: number
  userShare: number // fraction of pool the user owns
  grossPoolFees: number // total pool fees in window
  userFees: number // dollar fees attributable to user
  apyImpliedPct: number // annualized fee yield extrapolated from window
}

export interface CounterfactualReport {
  hodl5050Usd: number
  hodlAllBaseUsd: number // if held 100% in base token instead
  hodlAllQuoteUsd: number // if held 100% in quote (often a stablecoin)
  bestAlternativeLabel: string
  bestAlternativeUsd: number
}

export type Diagnosis = 'healthy' | 'watch' | 'critical'
export type Treatment = 'stay' | 'rebalance' | 'exit'

export interface DoctorVerdict {
  diagnosis: Diagnosis
  treatment: Treatment
  netPnlUsd: number // (lp + fees) - deposit
  vsHodlUsd: number // (lp + fees) - hodl5050
  prognosis: string // one-paragraph plain-English wrap-up
}

export interface DiagnosticReport {
  prescription: Prescription
  pair: DexPair
  vitals: Vitals
  il: IlReport
  fees: FeeReport
  counterfactual: CounterfactualReport
  verdict: DoctorVerdict
  findings: Finding[]
  prognosisCurve: { r: number; ilPct: number }[] // for the chart
  startedAt: number
  finishedAt: number
}
