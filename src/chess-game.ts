export function chessGameUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host !== 'chess.com') {
    return null
  }

  const live = url.pathname.match(/^\/game\/(live|daily)\/(\d+)\/?$/i)
  const legacy = url.pathname.match(/^\/(live|daily)\/game\/(\d+)\/?$/i)
  const match = live ?? legacy
  if (!match) {
    return null
  }

  const pace = match[1]?.toLowerCase()
  const id = match[2]
  if ((pace !== 'live' && pace !== 'daily') || !id) {
    return null
  }
  return `https://www.chess.com/game/${pace}/${id}`
}

export interface IChessGameRef {
  pace: 'live' | 'daily'
  id: string
  url: string
}

export function chessGameRef(value: string): IChessGameRef | null {
  const url = chessGameUrl(value)
  if (!url) {
    return null
  }
  const match = url.match(/\/game\/(live|daily)\/(\d+)$/)
  const pace = match?.[1]
  const id = match?.[2]
  if ((pace !== 'live' && pace !== 'daily') || !id) {
    return null
  }
  return { pace, id, url }
}
