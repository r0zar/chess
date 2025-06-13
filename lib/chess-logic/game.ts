// This is a placeholder for a chess library like chess.js or a custom implementation.
// A full chess engine is very complex.
// For a real project, consider using a well-tested library like `chess.js`.
// npm install chess.js @types/chess.js

import { Chess, type Square as ChessJsSquare, type PieceSymbol as ChessJsPieceSymbol } from "chess.js"
import type { ChessGame, FenString, GameState, Move, Piece, PlayerColor, Square, PieceSymbol } from "./types"

// Adapter to use chess.js with our types
export class ChessJsAdapter implements ChessGame {
  private game: Chess

  constructor(fen?: FenString) {
    this.game = new Chess(fen)
  }

  loadFen(fen: FenString): boolean {
    try {
      this.game = new Chess(fen)
      return true
    } catch (e) {
      return false
    }
  }

  getFen(): FenString {
    return this.game.fen()
  }

  makeMove(moveInput: { from: Square; to: Square; promotion?: PieceSymbol }): Move | null {
    try {
      const chessJsMove = this.game.move({
        from: moveInput.from as ChessJsSquare,
        to: moveInput.to as ChessJsSquare,
        promotion: moveInput.promotion as ChessJsPieceSymbol | undefined,
      })

      if (!chessJsMove) return null

      // Adapt chess.js move to our Move type
      const move: Move = {
        from: chessJsMove.from as Square,
        to: chessJsMove.to as Square,
        piece: chessJsMove.piece as PieceSymbol,
        color: chessJsMove.color === "w" ? "w" : "b",
        flags: chessJsMove.flags,
        san: chessJsMove.san,
        promotion: chessJsMove.promotion as PieceSymbol | undefined,
        captured: chessJsMove.captured as PieceSymbol | undefined,
      }
      return move
    } catch (e) {
      // chess.js throws an error for illegal moves
      console.error("Illegal move:", e)
      return null
    }
  }

  getPossibleMoves(square: Square): Move[] {
    const moves = this.game.moves({ square: square as ChessJsSquare, verbose: true })
    return moves.map((m) => ({
      from: m.from as Square,
      to: m.to as Square,
      piece: m.piece as PieceSymbol,
      color: m.color === "w" ? "w" : "b",
      flags: m.flags,
      san: m.san,
      promotion: m.promotion as PieceSymbol | undefined,
      captured: m.captured as PieceSymbol | undefined,
    }))
  }

  isCheck(): boolean {
    return this.game.isCheck()
  }

  isCheckmate(): boolean {
    return this.game.isCheckmate()
  }

  isStalemate(): boolean {
    return this.game.isStalemate()
  }

  isDraw(): boolean {
    return this.game.isDraw()
  }

  isGameOver(): boolean {
    return this.game.isGameOver()
  }

  getBoard(): Piece[][] {
    return this.game
      .board()
      .map((row) =>
        row.map((p) =>
          p ? { type: p.type as PieceSymbol, color: (p.color === "w" ? "w" : "b") as PlayerColor } : null,
        ),
      ) as Piece[][] // Type assertion needed due to nulls
  }

  getTurn(): PlayerColor {
    return this.game.turn() === "w" ? "w" : "b"
  }

  getHistory(): Move[] {
    // chess.js history is just SAN strings, need verbose for full move objects
    const verboseHistory = this.game.history({ verbose: true })
    return verboseHistory.map((m) => ({
      from: m.from as Square,
      to: m.to as Square,
      piece: m.piece as PieceSymbol,
      color: m.color === "w" ? "w" : "b",
      flags: m.flags,
      san: m.san,
      promotion: m.promotion as PieceSymbol | undefined,
      captured: m.captured as PieceSymbol | undefined,
    }))
  }

  getStatus(): GameState["status"] {
    if (this.game.isCheckmate()) return "checkmate"
    if (this.game.isStalemate()) return "stalemate"
    if (this.game.isThreefoldRepetition()) return "draw_repetition"
    if (this.game.isInsufficientMaterial()) return "draw_insufficient_material"
    if (
      this.game.isDraw() &&
      !this.game.isStalemate() &&
      !this.game.isThreefoldRepetition() &&
      !this.game.isInsufficientMaterial()
    ) {
      // This could be 50-move rule or other draw conditions chess.js handles
      return "draw_50moves" // Or a more generic 'draw'
    }
    return "ongoing"
  }

  getWinner(): PlayerColor | undefined {
    if (!this.game.isGameOver() || this.isDraw()) return undefined
    // If game is over and not a draw, the winner is the one whose turn it ISN'T
    return this.game.turn() === "b" ? "w" : "b" // If it's black's turn and checkmate, white won.
  }
}
