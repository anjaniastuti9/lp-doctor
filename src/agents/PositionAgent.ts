// PositionAgent
// Reads the prescription, parses a DexScreener URL or chain/pair pair,
// fetches the live pool state, and computes the patient's vitals
// (price ratio over the chosen window, liquidity, volume).

import type { DexPair, Finding, Prescription, Vitals, Window } from './types'

const PAIR_URL = (chain: string, addr: string) =>
  `https://api.dexscreener.com/latest/dex/pairs/${chain}/${addr}`

const SEARCH_URL = (q: string) =>
  `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`

interface DexScreenerResp {
  pair?: DexPair
  pairs?: DexPair[]
}

function parsePairUrl(input: string): { chain: string; address: string } | null {
  const trimmed = input.trim()
  // Full URL: https://dexscreener.com/{chain}/{address}
  const m = trimmed.match(/dexscreener\.com\/([a-z0-9-]+)\/([a-zA-Z0-9]+)/i)
  if (m) return { chain: m[1].toLowerCase(), address: m[2] }
  // chain/address shorthand
  const s = trimmed.match(/^([a-z0-9-]+)\/([a-zA-Z0-9]+)$/i)
  if (s) return { chain: s[1].toLowerCase(), address: s[2] }
  return null
}

export interface PositionResult {
  pair: DexPair
  vitals: Vitals
  finding: Finding
}

export class PositionAgent {
  static label = 'PositionAgent'

  async run(rx: Prescription, signal?: AbortSignal): Promise<PositionResult> {
    const parsed = parsePairUrl(rx.pairUrl)
    let pair: DexPair | undefined

    if (parsed) {
      const res = await fetch(PAIR_URL(parsed.chain, parsed.address), { signal })
      if (!res.ok) {
        throw new Error(`PositionAgent: pair lookup failed (${res.status})`)
      }
      const data = (await res.json()) as DexScreenerResp
      pair = data.pair ?? data.pairs?.[0]
    } else {
      // Treat input as a search query
      const res = await fetch(SEARCH_URL(rx.pairUrl), { signal })
      if (!res.ok) {
        throw new Error(`PositionAgent: search failed (${res.status})`)
      }
      const data = (await res.json()) as DexScreenerResp
      // Pick the most-liquid match.
      const sorted = [...(data.pairs ?? [])].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
      )
      pair = sorted[0]
    }

    if (!pair) {
      throw new Error('PositionAgent: no matching pair found on DexScreener.')
    }

    const priceNow = parseFloat(pair.priceUsd ?? '0')
    if (!Number.isFinite(priceNow) || priceNow <= 0) {
      throw new Error('PositionAgent: pair has no USD price.')
    }

    const window: Window = rx.window
    const changePct = pair.priceChange?.[window] ?? 0
    const priceEntry = priceNow / (1 + changePct / 100)
    const priceRatio = priceEntry > 0 ? priceNow / priceEntry : 1

    const liquidityUsd = pair.liquidity?.usd ?? 0
    const volumeWindow = pair.volume?.[window] ?? 0

    const vitals: Vitals = {
      priceNow,
      priceEntry,
      priceRatio,
      liquidityUsd,
      volumeWindow,
    }

    const direction = changePct === 0 ? 'flat' : changePct > 0 ? 'up' : 'down'
    const finding: Finding = {
      agent: PositionAgent.label,
      severity: liquidityUsd < 25_000 ? 'warn' : 'neutral',
      headline: `Patient identified: ${pair.baseToken.symbol}/${pair.quoteToken.symbol} on ${pair.dexId}`,
      detail:
        liquidityUsd < 25_000
          ? `Pool liquidity is only $${Math.round(liquidityUsd).toLocaleString()} — small positions move price meaningfully.`
          : `Pool holds $${Math.round(liquidityUsd).toLocaleString()} of liquidity. Price is ${direction} ${Math.abs(changePct).toFixed(2)}% over the last ${window === 'h1' ? '1h' : window === 'h6' ? '6h' : '24h'}.`,
    }

    return { pair, vitals, finding }
  }
}
