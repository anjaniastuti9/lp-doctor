// Pipeline
// Sequential five-agent diagnostic flow.
// Position -> ImpermanentLoss -> FeeYield -> Counterfactual -> Doctor

import { CounterfactualAgent } from './CounterfactualAgent'
import { DoctorAgent } from './DoctorAgent'
import { FeeYieldAgent } from './FeeYieldAgent'
import { ImpermanentLossAgent } from './ImpermanentLossAgent'
import { PositionAgent } from './PositionAgent'
import type { DiagnosticReport, Finding, Prescription } from './types'

export interface PipelineProgress {
  step: number
  total: number
  agent: string
}

export interface RunOptions {
  signal?: AbortSignal
  onProgress?: (p: PipelineProgress) => void
}

export class Pipeline {
  private position = new PositionAgent()
  private il = new ImpermanentLossAgent()
  private fees = new FeeYieldAgent()
  private counterfactual = new CounterfactualAgent()
  private doctor = new DoctorAgent()

  async run(rx: Prescription, opts: RunOptions = {}): Promise<DiagnosticReport> {
    const findings: Finding[] = []
    const startedAt = Date.now()

    opts.onProgress?.({ step: 1, total: 5, agent: PositionAgent.label })
    const pos = await this.position.run(rx, opts.signal)
    findings.push(pos.finding)

    opts.onProgress?.({ step: 2, total: 5, agent: ImpermanentLossAgent.label })
    const ilRes = this.il.run(rx, pos.vitals)
    findings.push(ilRes.finding)

    opts.onProgress?.({ step: 3, total: 5, agent: FeeYieldAgent.label })
    const feeRes = this.fees.run(rx, pos.pair, pos.vitals)
    findings.push(feeRes.finding)

    opts.onProgress?.({ step: 4, total: 5, agent: CounterfactualAgent.label })
    const cfRes = this.counterfactual.run(rx, pos.pair, pos.vitals)
    findings.push(cfRes.finding)

    opts.onProgress?.({ step: 5, total: 5, agent: DoctorAgent.label })
    const doc = this.doctor.run(rx, pos.pair, pos.vitals, ilRes.il, feeRes.fees, cfRes.cf)
    findings.push(doc.finding)

    return {
      prescription: rx,
      pair: pos.pair,
      vitals: pos.vitals,
      il: ilRes.il,
      fees: feeRes.fees,
      counterfactual: cfRes.cf,
      verdict: doc.verdict,
      findings,
      prognosisCurve: ilRes.curve,
      startedAt,
      finishedAt: Date.now(),
    }
  }
}
