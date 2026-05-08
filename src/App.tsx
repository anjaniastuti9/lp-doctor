import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  Activity,
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  ExternalLink,
  HeartPulse,
  Loader2,
  Pill,
  RotateCw,
  Sparkles,
  Stethoscope,
  Syringe,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Pipeline, type PipelineProgress } from './agents/Pipeline'
import type {
  DiagnosticReport,
  Finding,
  Prescription,
  Window,
} from './agents/types'

const DEFAULT_RX: Prescription = {
  pairUrl: 'https://dexscreener.com/solana/79byzhpqqghrvf4sdocfarxkyjbljvj8jygyh3zv2d43',
  depositUsd: 5_000,
  window: 'h24',
}

const PRESETS: { label: string; rx: Prescription }[] = [
  {
    label: 'ROFL/SOL · PumpSwap',
    rx: {
      pairUrl: 'https://dexscreener.com/solana/79byzhpqqghrvf4sdocfarxkyjbljvj8jygyh3zv2d43',
      depositUsd: 5_000,
      window: 'h24',
    },
  },
  {
    label: 'WETH/USDC · Uniswap v3 (ETH)',
    rx: {
      pairUrl: 'https://dexscreener.com/ethereum/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
      depositUsd: 10_000,
      window: 'h24',
    },
  },
  {
    label: 'WBNB/BUSD · PancakeSwap',
    rx: {
      pairUrl: 'https://dexscreener.com/bsc/0x58f876857a02d6762e0101bb5c46a8c1ed44dc16',
      depositUsd: 10_000,
      window: 'h24',
    },
  },
]

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(2)}K`
  return `${n < 0 ? '-' : ''}$${abs.toFixed(2)}`
}

function fmtPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(digits)}%`
}

const severityStyle: Record<
  Finding['severity'],
  { dot: string; chip: string; icon: typeof Sparkles }
> = {
  good: { dot: 'bg-emerald-400', chip: 'text-emerald-300', icon: CheckCircle2 },
  neutral: { dot: 'bg-sky-400', chip: 'text-sky-300', icon: Sparkles },
  warn: { dot: 'bg-amber-400', chip: 'text-amber-300', icon: AlertTriangle },
  bad: { dot: 'bg-rose-400', chip: 'text-rose-300', icon: XCircle },
}

function Header() {
  return (
    <header className="px-6 py-6 border-b border-white/5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">
              LP <span className="text-cyan-400">Doctor</span>
            </div>
            <div className="text-xs text-slate-500 -mt-0.5">
              A diagnostic agent for liquidity positions
            </div>
          </div>
        </div>
        <a
          href="https://github.com/anjanipurwanti987/lp-doctor"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
        >
          source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="px-6 pt-12 pb-8">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-5">
          <HeartPulse className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-300 text-xs font-medium">
            5-agent diagnostic pipeline · live DEX data
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
          Your liquidity position,
          <br />
          <span className="bg-gradient-to-r from-cyan-300 to-sky-500 bg-clip-text text-transparent">
            diagnosed.
          </span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Paste a DEX pair, set a hypothetical deposit, and five specialist agents
          will check your impermanent loss, fee yield, and counterfactual returns —
          then write up a treatment plan.
        </p>
      </div>
    </section>
  )
}

function PrescriptionForm({
  rx,
  setRx,
  onRun,
  loading,
}: {
  rx: Prescription
  setRx: (r: Prescription) => void
  onRun: () => void
  loading: boolean
}) {
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 backdrop-blur">
      <div className="flex items-center gap-2 mb-5">
        <Pill className="w-4 h-4 text-cyan-400" />
        <h2 className="text-white font-semibold">Prescription</h2>
        <span className="text-xs text-slate-500">— what should we examine?</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Pair URL or chain/address
          </label>
          <input
            type="text"
            value={rx.pairUrl}
            onChange={(e) => setRx({ ...rx, pairUrl: e.target.value })}
            placeholder="https://dexscreener.com/ethereum/0x..."
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none transition-colors"
          />
          <div className="text-xs text-slate-500 mt-1.5">
            Or paste a token symbol — we'll pick the deepest pool.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Hypothetical deposit (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <input
                type="number"
                min={1}
                value={rx.depositUsd}
                onChange={(e) =>
                  setRx({ ...rx, depositUsd: Math.max(1, Number(e.target.value) || 0) })
                }
                className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 text-white text-sm focus:border-cyan-500/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Time window</label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-950/60 border border-white/10">
              {(['h1', 'h6', 'h24'] as Window[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setRx({ ...rx, window: w })}
                  className={`text-xs py-1.5 rounded-md transition-colors ${
                    rx.window === w
                      ? 'bg-cyan-500/20 text-cyan-200'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {w === 'h1' ? '1h' : w === 'h6' ? '6h' : '24h'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-2">Try a preset:</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setRx(p.rx)}
                className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onRun}
          disabled={loading || !rx.pairUrl.trim()}
          className="w-full mt-2 py-3 rounded-lg font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-500 hover:from-cyan-300 hover:to-sky-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running diagnosis…
            </>
          ) : (
            <>
              <Syringe className="w-4 h-4" />
              Run diagnosis
            </>
          )}
        </button>
      </div>
    </div>
  )
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  PositionAgent: 'Identify the patient — fetch pool state from DexScreener.',
  ImpermanentLossAgent: 'Measure IL using the constant-product formula.',
  FeeYieldAgent: 'Project fee earnings against the user\'s pool share.',
  CounterfactualAgent: 'Compare against 50/50 hold, 100% base, 100% quote.',
  DoctorAgent: 'Synthesize findings into a diagnosis and treatment plan.',
}

function PipelineTrace({
  progress,
  done,
  error,
}: {
  progress: PipelineProgress | null
  done: boolean
  error: string | null
}) {
  const steps = [
    'PositionAgent',
    'ImpermanentLossAgent',
    'FeeYieldAgent',
    'CounterfactualAgent',
    'DoctorAgent',
  ]
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 backdrop-blur">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-cyan-400" />
        <h2 className="text-white font-semibold">Pipeline trace</h2>
        {done && !error && (
          <span className="text-xs text-emerald-400 ml-auto">complete</span>
        )}
        {error && <span className="text-xs text-rose-400 ml-auto">error</span>}
      </div>
      <ol className="space-y-2.5">
        {steps.map((agent, i) => {
          const idx = i + 1
          const active = progress?.step === idx && !done
          const completed =
            done || (progress ? idx < progress.step : false)
          return (
            <li key={agent} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                  completed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-500 border border-white/5'
                }`}
              >
                {completed ? '✓' : idx}
              </span>
              <div className="min-w-0">
                <div
                  className={`text-sm font-medium ${
                    active ? 'text-cyan-200' : completed ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {agent}
                  {active && (
                    <Loader2 className="inline-block ml-2 w-3 h-3 animate-spin text-cyan-300" />
                  )}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  {AGENT_DESCRIPTIONS[agent]}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs text-rose-300 leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

function Vital({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'
  return (
    <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}

function PrognosisChart({
  curve,
  current,
}: {
  curve: { r: number; ilPct: number }[]
  current: number
}) {
  const data = useMemo(
    () => curve.map((c) => ({ r: c.r, il: +(c.ilPct * 100).toFixed(2) })),
    [curve],
  )
  const currentIl =
    data.find((d) => Math.abs(d.r - current) < 0.06)?.il ??
    +((2 * Math.sqrt(current)) / (1 + current) - 1).toFixed(2)
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="ilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="r"
            type="number"
            domain={[0.4, 2.5]}
            tick={{ fill: '#475569', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}×`}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(2,6,23,0.95)',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(v: number) => [`${v}%`, 'IL']}
            labelFormatter={(v: number) => `r = ${v.toFixed(2)}× entry`}
          />
          <Area
            type="monotone"
            dataKey="il"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#ilGrad)"
            isAnimationActive={false}
          />
          <ReferenceLine x={1} stroke="#475569" strokeDasharray="3 3" />
          <ReferenceDot
            x={current}
            y={currentIl}
            r={5}
            fill="#22d3ee"
            stroke="#0f172a"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function Report({ report }: { report: DiagnosticReport }) {
  const [open, setOpen] = useState(true)
  const v = report.verdict
  const diagStyle =
    v.diagnosis === 'healthy'
      ? {
          chip: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          banner: 'from-emerald-500/10 to-emerald-500/0',
          icon: CheckCircle2,
          tone: 'good' as const,
        }
      : v.diagnosis === 'watch'
        ? {
            chip: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
            banner: 'from-amber-500/10 to-amber-500/0',
            icon: AlertTriangle,
            tone: 'neutral' as const,
          }
        : {
            chip: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
            banner: 'from-rose-500/10 to-rose-500/0',
            icon: XCircle,
            tone: 'bad' as const,
          }
  const treatmentLabel =
    v.treatment === 'stay' ? 'Stay in' : v.treatment === 'rebalance' ? 'Rebalance' : 'Exit'
  const Icon = diagStyle.icon

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 backdrop-blur">
      <div className={`-mx-6 -mt-6 px-6 py-5 rounded-t-2xl bg-gradient-to-r ${diagStyle.banner}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {report.pair.info?.imageUrl ? (
              <img
                src={report.pair.info.imageUrl}
                alt=""
                className="w-11 h-11 rounded-xl object-cover bg-slate-800"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
                <Beaker className="w-5 h-5 text-cyan-400" />
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Patient</div>
              <div className="text-white font-bold">
                {report.pair.baseToken.symbol}/{report.pair.quoteToken.symbol}
                <span className="ml-2 text-xs text-slate-500 font-normal capitalize">
                  {report.pair.dexId} · {report.pair.chainId}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full border text-xs font-semibold capitalize ${diagStyle.chip}`}
            >
              <Icon className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
              {v.diagnosis}
            </div>
            <div className="px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold">
              <ClipboardCheck className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
              {treatmentLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Vital
          label="LP value"
          value={fmtUsd(report.il.lpValueUsd)}
          hint={`from $${report.prescription.depositUsd.toLocaleString()} deposit`}
        />
        <Vital
          label="Fees in window"
          value={fmtUsd(report.fees.userFees)}
          hint={`~${report.fees.apyImpliedPct.toFixed(0)}% APY pace`}
          tone={report.fees.apyImpliedPct >= 8 ? 'good' : 'neutral'}
        />
        <Vital
          label="Impermanent loss"
          value={fmtPct(report.il.ilPct)}
          hint={fmtUsd(report.il.ilUsd)}
          tone={report.il.ilPct < -0.02 ? 'bad' : 'neutral'}
        />
        <Vital
          label="Net vs HODL"
          value={fmtUsd(v.vsHodlUsd)}
          hint={`${v.netPnlUsd >= 0 ? 'gain' : 'loss'} ${fmtUsd(v.netPnlUsd)} vs deposit`}
          tone={v.vsHodlUsd >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-slate-950/40 border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-white font-semibold">Prognosis curve</h3>
            </div>
            <div className="text-xs text-slate-500">
              IL across price ratio · current marked
            </div>
          </div>
          <PrognosisChart
            curve={report.prognosisCurve}
            current={report.vitals.priceRatio}
          />
          <div className="text-xs text-slate-500 mt-2 leading-relaxed">
            r = price now / price at entry. The deeper the curve dips, the more value
            an LP loses to the rebalancer vs simply holding. Cyan dot = your position
            right now.
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/40 border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <RotateCw className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-semibold">Counterfactuals</h3>
          </div>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between text-slate-300">
              <span>50/50 HODL</span>
              <span className="font-mono text-white">
                {fmtUsd(report.counterfactual.hodl5050Usd)}
              </span>
            </li>
            <li className="flex items-center justify-between text-slate-300">
              <span>100% {report.pair.baseToken.symbol}</span>
              <span className="font-mono text-white">
                {fmtUsd(report.counterfactual.hodlAllBaseUsd)}
              </span>
            </li>
            <li className="flex items-center justify-between text-slate-300">
              <span>100% {report.pair.quoteToken.symbol}</span>
              <span className="font-mono text-white">
                {fmtUsd(report.counterfactual.hodlAllQuoteUsd)}
              </span>
            </li>
            <li className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
              <span className="text-cyan-300 text-xs font-medium uppercase tracking-wider">
                Best alternative
              </span>
              <span className="font-mono text-cyan-300">
                {fmtUsd(report.counterfactual.bestAlternativeUsd)}
              </span>
            </li>
            <li className="text-xs text-slate-500">
              {report.counterfactual.bestAlternativeLabel}
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {open ? 'Hide specialist findings' : 'Show specialist findings'}
        </button>
        {open && (
          <ol className="mt-4 space-y-3">
            {report.findings.map((f, i) => {
              const s = severityStyle[f.severity]
              const FIcon = s.icon
              return (
                <li
                  key={`${f.agent}-${i}`}
                  className="rounded-xl bg-slate-950/40 border border-white/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <FIcon className={`w-4 h-4 ${s.chip}`} />
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                      {f.agent}
                    </span>
                    <span className={`text-xs font-semibold capitalize ml-auto ${s.chip}`}>
                      {f.severity}
                    </span>
                  </div>
                  <div className="text-white font-medium leading-snug mb-1">
                    {f.headline}
                  </div>
                  <div className="text-sm text-slate-400 leading-relaxed">{f.detail}</div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-1.5">
          <Stethoscope className="w-4 h-4 text-cyan-300" />
          <span className="text-cyan-200 font-semibold">Doctor's note</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{v.prognosis}</p>
      </div>

      <div className="mt-4 text-xs text-slate-500 flex items-center gap-3">
        <Clock className="w-3.5 h-3.5" />
        Diagnosis took {((report.finishedAt - report.startedAt) / 1000).toFixed(2)}s ·
        <a
          href={report.pair.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cyan-300 transition-colors flex items-center gap-1"
        >
          view pair on DexScreener
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

function App() {
  const [rx, setRx] = useState<Prescription>(DEFAULT_RX)
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const pipelineRef = useRef<Pipeline | null>(null)
  if (!pipelineRef.current) pipelineRef.current = new Pipeline()
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    setProgress(null)
    try {
      const r = await pipelineRef.current!.run(rx, {
        signal: ctrl.signal,
        onProgress: (p) => setProgress(p),
      })
      setReport(r)
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [rx])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div
        className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="relative">
        <Header />
        <Hero />
        <main className="px-6 pb-20">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <PrescriptionForm rx={rx} setRx={setRx} onRun={run} loading={loading} />
              <PipelineTrace
                progress={progress}
                done={!loading && report !== null && error === null}
                error={error}
              />
            </div>
            <div className="lg:col-span-3">
              {!report && !loading && !error && (
                <div className="rounded-2xl bg-slate-900/40 border border-dashed border-white/10 p-12 text-center text-slate-500">
                  <Stethoscope className="w-10 h-10 mx-auto mb-4 text-slate-700" />
                  <div className="text-white font-semibold mb-1">Awaiting patient</div>
                  <div className="text-sm">
                    Run a diagnosis to see the medical report.
                  </div>
                </div>
              )}
              {loading && !report && (
                <div className="rounded-2xl bg-slate-900/40 border border-white/5 p-12 text-center">
                  <Loader2 className="w-10 h-10 mx-auto mb-4 text-cyan-400 animate-spin" />
                  <div className="text-white font-semibold mb-1">
                    Five agents working…
                  </div>
                  <div className="text-sm text-slate-400">
                    {progress
                      ? `Step ${progress.step} of ${progress.total} · ${progress.agent}`
                      : 'Calling DexScreener'}
                  </div>
                </div>
              )}
              {report && <Report report={report} />}
            </div>
          </div>
        </main>
        <footer className="px-6 py-8 border-t border-white/5">
          <div className="max-w-6xl mx-auto text-xs text-slate-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              LP Doctor · educational tool, not financial advice. Pool data from
              DexScreener.
            </div>
            <div>5 agents · 0 LLM calls · fully client-side</div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
