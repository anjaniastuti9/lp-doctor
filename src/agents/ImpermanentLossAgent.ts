// ImpermanentLossAgent
// Computes the impermanent-loss signature of the patient's would-be position
// using the standard 50/50 constant-product formula.
//
// IL_pct = 2 * sqrt(r) / (1 + r) - 1     where r = price_now / price_entry
//
// Negative result = loss vs simply holding the same 50/50 basket.

import type { Finding, IlReport, Prescription, Vitals } from './types'

export interface IlResult {
  il: IlReport
  finding: Finding
  curve: { r: number; ilPct: number }[]
}

export class ImpermanentLossAgent {
  static label = 'ImpermanentLossAgent'

  run(rx: Prescription, vitals: Vitals): IlResult {
    const r = vitals.priceRatio
    const ilPct = (2 * Math.sqrt(r)) / (1 + r) - 1 // negative or zero
    const hodl5050Usd = (rx.depositUsd * (1 + r)) / 2
    const lpValueUsd = rx.depositUsd * Math.sqrt(r)
    const ilUsd = lpValueUsd - hodl5050Usd

    // Pre-compute the curve from r=0.4 to r=2.5 for the prognosis chart.
    const curve: { r: number; ilPct: number }[] = []
    for (let i = 0; i <= 40; i++) {
      const sample = 0.4 + (i * (2.5 - 0.4)) / 40
      const il = (2 * Math.sqrt(sample)) / (1 + sample) - 1
      curve.push({ r: sample, ilPct: il })
    }

    let severity: Finding['severity']
    let headline: string
    let detail: string
    const ilPctNumber = ilPct * 100
    if (ilPctNumber > -0.25) {
      severity = 'good'
      headline = 'Negligible impermanent loss'
      detail = `Price barely moved (r=${r.toFixed(3)}). IL is essentially zero (${ilPctNumber.toFixed(2)}%).`
    } else if (ilPctNumber > -2) {
      severity = 'neutral'
      headline = 'Mild impermanent loss'
      detail = `IL ${ilPctNumber.toFixed(2)}% (r=${r.toFixed(3)}). Likely recoverable from fees if volume is healthy.`
    } else if (ilPctNumber > -10) {
      severity = 'warn'
      headline = 'Material impermanent loss'
      detail = `IL ${ilPctNumber.toFixed(2)}% (r=${r.toFixed(3)}). Fees need to outpace this drag for the position to make sense.`
    } else {
      severity = 'bad'
      headline = 'Severe impermanent loss'
      detail = `IL ${ilPctNumber.toFixed(2)}% (r=${r.toFixed(3)}). Price has diverged sharply — most LP positions don't recover this from fees alone.`
    }

    return {
      il: { ilPct, ilUsd, hodl5050Usd, lpValueUsd },
      curve,
      finding: { agent: ImpermanentLossAgent.label, severity, headline, detail },
    }
  }
}
