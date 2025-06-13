export type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k"
export type PlayerColor = "w" | "b" // White | Black
export type Square = `${"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"}${"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"}`

export interface Piece {
  type: PieceSymbol
  color: PlayerColor
}

export type BoardRow = (Piece | null)[]
export type Board = BoardRow[] // 8x8 board

export interface Move {
  from: Square
  to: Square
  promotion?: PieceSymbol // For pawn promotion
  piece: PieceSymbol
  color: PlayerColor
  captured?: PieceSymbol
  flags: string // e.g., 'n' (normal), 'c' (capture), 'cp' (capture + promotion), 'k' (kingside castle), etc.
  san: string // Standard Algebraic Notation
}

export interface GameState {
  board: Board
  turn: PlayerColor
  castling: {
    w: { k: boolean; q: boolean } // Kingside, Queenside
    b: { k: boolean; q: boolean }
  }
  enPassantTarget: Square | null
  halfmoveClock: number // For 50-move rule
  fullmoveNumber: number
  status: "ongoing" | "checkmate" | "stalemate" | "draw_repetition" | "draw_50moves" | "draw_insufficient_material"
  winner?: PlayerColor
  history: Move[] // History of moves made
}

// FEN: Forsyth-Edwards Notation string
// Example: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export type FenString = string

export interface ChessGame {
  loadFen(fen: FenString): boolean
  getFen(): FenString
  makeMove(move: { from: Square; to: Square; promotion?: PieceSymbol }): Move | null
  getPossibleMoves(square: Square): Move[]
  isCheck(): boolean
  isCheckmate(): boolean
  isStalemate(): boolean
  isDraw(): boolean // Covers various draw conditions
  isGameOver(): boolean // Add this line
  getBoard(): Board // Get the current board state
  getTurn(): PlayerColor
  getHistory(): Move[]
  getStatus(): GameState["status"]
  getWinner(): PlayerColor | undefined
}
