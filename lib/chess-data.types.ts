// Types for data stored in Redis

export type GameStatus =
  | "pending"
  | "ongoing"
  | "checkmate_white_wins"
  | "checkmate_black_wins"
  | "stalemate"
  | "draw_repetition"
  | "draw_50_moves"
  | "draw_insufficient_material"
  | "aborted"
  | "resigned_black"
  | "resigned_white"

export type PlayerColorIdentity = "white" | "black"
export type PieceTypeIdentity = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king"

/**
 * Represents a user, identified by a unique ID stored in a session cookie.
 * Can optionally be linked to a Stacks wallet address.
 */
export interface UserData {
  id: string // Unique User ID (from session cookie)
  stxAddress?: string | null
  createdAt: number
  lastSeenAt: number
}

export interface GameData {
  id: string
  createdAt: number
  updatedAt: number
  // Foreign keys to the UserData model
  playerWhiteId?: string | null
  playerBlackId?: string | null
  currentFen: string
  initialFen: string
  status: GameStatus
  winner?: PlayerColorIdentity | null
}

export interface MoveData {
  gameId: string
  moveNumber: number
  playerId: string // The session ID of the user who made the move
  playerColor: PlayerColorIdentity
  piece: PieceTypeIdentity
  fromSquare: string
  toSquare: string
  promotion?: PieceTypeIdentity | null
  isCapture?: boolean | null // Retained for quick checks, but capturedPiece is more specific
  capturedPiece?: PieceTypeIdentity | null // Added to store the type of captured piece
  moveFlags?: string | null // Added to store original chess.js flags
  isCheck?: boolean | null
  isCheckmate?: boolean | null
  isStalemate?: boolean | null
  san?: string | null
  fenBeforeMove: string
  fenAfterMove: string
  timestamp: number
}
