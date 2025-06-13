import type { PieceSymbol, PlayerColor } from "./types"
import type { PieceTypeIdentity, PlayerColorIdentity } from "../chess-data.types"

export function pieceSymbolToIdentity(symbol: PieceSymbol | undefined): PieceTypeIdentity | undefined {
  if (!symbol) return undefined
  const map: Record<PieceSymbol, PieceTypeIdentity> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  }
  return map[symbol]
}

export function mapColorToIdentity(color: PlayerColor | undefined): PlayerColorIdentity | undefined {
  if (!color) return undefined
  return color === "w" ? "white" : "black"
}

export function mapIdentityToColor(identity: PlayerColorIdentity | null | undefined): PlayerColor | undefined {
  if (!identity) return undefined
  return identity === "white" ? "w" : "b"
}

/**
 * Removes properties with `undefined` or `null` values from an object.
 * This is useful before calling `kv.hset` which does not support these value types.
 * @param obj The object to clean.
 * @returns A new object with `undefined` and `null` properties removed.
 */
export function cleanKVData<T extends Record<string, any>>(obj: T): T {
  const newObj: Record<string, any> = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
      newObj[key] = obj[key]
    }
  }
  return newObj as T
}

// Add this new mapping function
export function identityToPieceSymbol(identity: PieceTypeIdentity | undefined | null): PieceSymbol | undefined {
  if (!identity) return undefined
  const map: Record<PieceTypeIdentity, PieceSymbol> = {
    pawn: "p",
    knight: "n",
    bishop: "b",
    rook: "r",
    queen: "q",
    king: "k",
  }
  return map[identity]
}
