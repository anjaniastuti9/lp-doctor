// DoctorAgent
// Synthesizes every prior finding into a final diagnosis, treatment plan,
// and a plain-English prognosis paragraph. This is the long-chain reasoner —
// deterministic, but reads like a doctor delivering results.

import type {
  CounterfactualReport,
  DexPair,
  Diagnosis,
  DoctorVerdict,
  FeeReport,
  Finding,
  IlReport,
  Prescription,
  Treatment,
  Vitals,
} from './types'

export interface DoctorResult {
  verdict: DoctorVerdict
  finding: Finding
}

export class DoctorAgent {
  static label = 'DoctorAgent'

  run(
    rx: Prescription,
    pair: DexPair,
    vitals: Vitals,
    il: IlReport,
    fees: FeeReport,
    cf: CounterfactualReport,
  ): DoctorResult {
    const totalLp = il.lpValueUsd + fees.userFees
    const netPnlUsd = totalLp - rx.depositUsd
    const vsHodlUsd = totalLp - cf.hodl5050Usd
    const vsBest = totalLp - cf.bestAlternativeUsd

    let diagnosis: Diagnosis
    let treatment: Treatment

    // Health is judged by whether fees cover IL relative to a 50/50 hold.
    // vsHodlUsd > 0 means LP is winning vs the same basket held; that's a
    // green light to stay.
    if (vsHodlUsd > 0 && fees.apyImpliedPct >= 8) {
      diagnosis = 'healthy'
      treatment = 'stay'
    } else if (vsHodlUsd > -rx.depositUsd * 0.02 && fees.apyImpliedPct >= 4) {
      diagnosis = 'watch'
      treatment = 'stay'
    } else if (Math.abs(vitals.priceRatio - 1) > 0.5) {
      // Price has wandered far — wider range or full exit makes sense.
      diagnosis = 'critical'
      treatment = vsBest < -rx.depositUsd * 0.05 ? 'exit' : 'rebalance'
    } else {
      diagnosis = 'critical'
      treatment = fees.apyImpliedPct < 2 ? 'exit' : 'rebalance'
    }

    const direction =
      vitals.priceRatio > 1.001
        ? `up ${((vitals.priceRatio - 1) * 100).toFixed(1)}%`
        : vitals.priceRatio < 0.999
          ? `down ${((1 - vitals.priceRatio) * 100).toFixed(1)}%`
          : 'flat'

    let prognosis: string
    if (diagnosis === 'healthy') {
      prognosis = `Position is in good shape. Over the ${rx.window === 'h1' ? 'last hour' : rx.window === 'h6' ? 'last 6 hours' : 'last 24 hours'} ${pair.baseToken.symbol} moved ${direction}, generating $${fees.userFees.toFixed(2)} in fees on a $${rx.depositUsd.toFixed(0)} hypothetical deposit (~${fees.apyImpliedPct.toFixed(0)}% APY pace) — comfortably outpacing $${Math.abs(il.ilUsd).toFixed(2)} of impermanent loss. Recommendation: stay in.`
    } else if (diagnosis === 'watch') {
      prognosis = `Position is borderline. Fees ($${fees.userFees.toFixed(2)}, ~${fees.apyImpliedPct.toFixed(0)}% APY) are close to covering $${Math.abs(il.ilUsd).toFixed(2)} of IL, but margin is thin. Hold, but reassess if ${pair.baseToken.symbol} keeps drifting from entry.`
    } else if (treatment === 'exit') {
      prognosis = `Position is unhealthy. ${pair.baseToken.symbol} has moved ${direction} since entry, costing $${Math.abs(il.ilUsd).toFixed(2)} in impermanent loss while fees only generated $${fees.userFees.toFixed(2)}. Holding ${cf.bestAlternativeLabel} would have left $${cf.bestAlternativeUsd.toFixed(2)} on the table. Recommendation: exit and reassess.`
    } else {
      prognosis = `Position is drifting. With price ${direction} from entry, the pool is no longer trading near your range and fee accrual has slowed (~${fees.apyImpliedPct.toFixed(0)}% APY). Consider rebalancing to a tighter range around the current price.`
    }

    const finding: Finding = {
      agent: DoctorAgent.label,
      severity:
        diagnosis === 'healthy' ? 'good' : diagnosis === 'watch' ? 'warn' : 'bad',
      headline:
        diagnosis === 'healthy'
          ? 'Diagnosis: healthy — stay the course'
          : diagnosis === 'watch'
            ? 'Diagnosis: watch — fees and IL are close to balanced'
            : `Diagnosis: critical — recommend ${treatment}`,
      detail: prognosis,
    }

    return {
      verdict: { diagnosis, treatment, netPnlUsd, vsHodlUsd, prognosis },
      finding,
    }
  }
}
