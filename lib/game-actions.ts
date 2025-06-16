"use server"

import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { mapIdentityToColor } from "@/lib/chess-logic/mappers"
import type { PlayerColor, FenString, Square, Move, PieceSymbol as LocalPieceSymbol } from "@/lib/chess-logic/types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { cleanKVData, mapColorToIdentity, pieceSymbolToIdentity } from "@/lib/chess-logic/mappers"
import { broadcastPartyKitEvent } from "@/lib/partykit"
import type { GameStatus, MoveData } from "@/lib/chess-data.types"
import { getUserById } from "@/lib/user"
import { identityToPieceSymbol } from "@/lib/chess-logic/mappers"
import type { PlayerColorIdentity, PieceTypeIdentity } from "@/lib/chess-data.types"
import type { PieceSymbol } from "@/lib/chess-logic/types"
import { makeContractCall, broadcastTransaction, standardPrincipalCV, uintCV, fetchNonce, getAddressFromPrivateKey } from '@stacks/transactions';

const CHARISMA_RULEBOOK_CONTRACT = process.env.CHARISMA_RULEBOOK_CONTRACT!;
const CHARISMA_HOT_WALLET_PRIVATE_KEY = process.env.CHARISMA_HOT_WALLET_PRIVATE_KEY!;

// Enhanced EXP calculation based on move type
function calculateMoveEXP(moveResult: any, isCheck: boolean, isCheckmate: boolean): { amount: number, reason: string } {
    let baseEXP = 10;
    let bonusEXP = 0;
    let reasons: string[] = [];

    // Base move EXP
    reasons.push("strategic move");

    // Capture bonus
    if (moveResult.captured) {
        bonusEXP += 2;
        reasons.push("tactical capture");
    }

    // Promotion bonus
    if (moveResult.promotion) {
        bonusEXP += 5;
        reasons.push("pawn promotion");
    }

    // Special piece bonuses
    if (moveResult.piece === 'q') {
        bonusEXP += 1;
        reasons.push("queen maneuver");
    } else if (moveResult.piece === 'k') {
        bonusEXP += 1;
        reasons.push("king move");
    }

    // Check bonus
    if (isCheck && !isCheckmate) {
        bonusEXP += 3;
        reasons.push("check");
    }

    // Checkmate bonus (will be in addition to win bonus)
    if (isCheckmate) {
        bonusEXP += 10;
        reasons.push("checkmate delivery");
    }

    // Castling bonus
    if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
        bonusEXP += 3;
        reasons.push("castling");
    }

    // En passant bonus
    if (moveResult.flags.includes('e')) {
        bonusEXP += 2;
        reasons.push("en passant");
    }

    const totalEXP = baseEXP + bonusEXP;
    const reasonText = reasons.join(" + ");

    return { amount: totalEXP, reason: reasonText };
}

// Enhanced win EXP calculation
function calculateWinEXP(gameStatus: GameStatus, moveCount: number): { amount: number, reason: string } {
    let baseWinEXP = 200;
    let bonusEXP = 0;
    let reasons = ["victory"];

    // Checkmate bonus
    if (gameStatus.includes("checkmate")) {
        bonusEXP += 50;
        reasons.push("checkmate finish");
    }

    // Quick game bonus (under 20 moves)
    if (moveCount < 20) {
        bonusEXP += 30;
        reasons.push("swift victory");
    }
    // Long game bonus (over 50 moves)
    else if (moveCount > 50) {
        bonusEXP += 20;
        reasons.push("endurance victory");
    }

    const totalEXP = baseWinEXP + bonusEXP;
    const reasonText = reasons.join(" + ");

    return { amount: totalEXP, reason: reasonText };
}

export async function makeServerMoveApi({ gameId, from, to, promotion, userId }: {
    gameId: string
    from: Square
    to: Square
    promotion?: LocalPieceSymbol
    userId: string
}): Promise<{
    success: boolean
    newFen?: FenString
    message?: string
    gameStatus?: string
    winner?: PlayerColor
    move?: Move
    expReward?: { amount: number, reason: string }
}> {
    console.log(`[MOVE] Received move for game ${gameId} from ${from} to ${to} by user ${userId}`)
    // Fetch game record
    const gameRecord = await kv.hgetall(`game:${gameId}`) as GameData | null
    if (!gameRecord || !gameRecord.currentFen) {
        return { success: false, message: "Game not found or data incomplete." }
    }

    const game = new ChessJsAdapter(gameRecord.currentFen)
    const currentTurnColor = game.getTurn()
    const expectedUserId = currentTurnColor === "w" ? gameRecord.playerWhiteId : gameRecord.playerBlackId
    if (expectedUserId !== userId) {
        return { success: false, message: "Not your turn or you are not a player in this game." }
    }

    const nonActiveStatuses: GameStatus[] = [
        "checkmate_white_wins",
        "checkmate_black_wins",
        "stalemate",
        "draw_repetition",
        "draw_50_moves",
        "draw_insufficient_material",
        "aborted",
        "resigned_black",
        "resigned_white",
    ]
    if (nonActiveStatuses.includes(gameRecord.status)) {
        return { success: false, message: `Game is not active (status: ${gameRecord.status}).` }
    }

    const fenBeforeMove = gameRecord.currentFen
    const moveResult = game.makeMove({ from, to, promotion })
    if (!moveResult) {
        return { success: false, message: "Invalid move according to game rules." }
    }

    const fenAfterMove = game.getFen()
    const newStatusFromEngine = game.getStatus()
    const gameWinnerFromEngine = game.getWinner()
    const isCheck = game.isCheck()
    const isCheckmate = newStatusFromEngine === "checkmate"

    let newGameStatus: GameStatus = "ongoing"
    if (gameRecord.status === "pending" && gameRecord.playerWhiteId && gameRecord.playerBlackId) {
        newGameStatus = "ongoing"
    }
    if (newStatusFromEngine === "checkmate") {
        newGameStatus = gameWinnerFromEngine === "w" ? "checkmate_white_wins" : "checkmate_black_wins"
    } else if (newStatusFromEngine === "stalemate") {
        newGameStatus = "stalemate"
    } else if (newStatusFromEngine.startsWith("draw_")) {
        newGameStatus = newStatusFromEngine as GameStatus
    }

    const now = Date.now()
    const updatedGameFields: Partial<GameData> = {
        currentFen: fenAfterMove,
        status: newGameStatus,
        winner: mapColorToIdentity(gameWinnerFromEngine),
        updatedAt: now,
    }
    await kv.hset(`game:${gameId}`, cleanKVData(updatedGameFields))
    await kv.zadd("games_by_update_time", { score: now, member: gameId })

    // Get current move count for win EXP calculation
    const movesListKey = `moves:${gameId}`
    const currentMoveCount = await kv.llen(movesListKey)
    const moveNumber = currentMoveCount + 1

    const moveData: MoveData = {
        gameId,
        moveNumber,
        playerId: userId,
        playerColor: mapColorToIdentity(moveResult.color as PlayerColor)!,
        piece: pieceSymbolToIdentity(moveResult.piece)!,
        fromSquare: moveResult.from,
        toSquare: moveResult.to,
        promotion: pieceSymbolToIdentity(moveResult.promotion),
        isCapture: moveResult.flags.includes("c"),
        capturedPiece: pieceSymbolToIdentity(moveResult.captured),
        moveFlags: moveResult.flags,
        isCheck: isCheck,
        isCheckmate: isCheckmate,
        isStalemate: newGameStatus === "stalemate",
        san: moveResult.san,
        fenBeforeMove,
        fenAfterMove,
        timestamp: now,
    }
    await kv.rpush(movesListKey, JSON.stringify(moveData))

    // Calculate and issue EXP reward for the move
    let expReward: { amount: number, reason: string } | undefined;
    const playerUser = await getUserById(userId)
    if (playerUser?.stxAddress) {
        console.log(`[EXP REWARD] Attempting to issue 10 EXP to ${playerUser.stxAddress} for move in game ${gameId}`)
        expReward = calculateMoveEXP(moveResult, isCheck, isCheckmate);
        await issueExpReward({
            stxAddress: playerUser.stxAddress,
            amount: expReward.amount,
            reason: `${expReward.reason} in game ${gameId}`
        })
    }

    // Broadcast enhanced move event to all connected players
    await broadcastPartyKitEvent({
        event: {
            type: 'move',
            data: {
                move: moveResult,
                gameState: {
                    fen: fenAfterMove,
                    status: newGameStatus,
                    winner: gameWinnerFromEngine,
                    turn: game.getTurn()
                },
                playerId: userId,
                expReward: expReward,
                moveEffects: {
                    isCapture: moveResult.captured ? true : false,
                    isPromotion: moveResult.promotion ? true : false,
                    isCheck: isCheck,
                    isCheckmate: isCheckmate,
                    isCastling: moveResult.flags.includes('k') || moveResult.flags.includes('q'),
                    isEnPassant: moveResult.flags.includes('e')
                }
            }
        },
        gameId
    })

    // Handle game end with enhanced win rewards
    if (newGameStatus !== "ongoing" && newGameStatus !== "pending") {
        let endReason = "Game ended"
        let winnerExpReward: { amount: number, reason: string } | undefined;

        if (newGameStatus.includes("checkmate")) {
            endReason = `Checkmate! ${gameWinnerFromEngine === "w" ? "White" : "Black"} wins`
        } else if (newGameStatus === "stalemate") {
            endReason = "Stalemate - Draw"
        } else if (newGameStatus.startsWith("draw_")) {
            endReason = "Draw"
        }

        // Enhanced win EXP reward
        if (gameWinnerFromEngine) {
            const winnerId = gameWinnerFromEngine === "w" ? gameRecord.playerWhiteId : gameRecord.playerBlackId
            if (winnerId) {
                const winnerUser = await getUserById(winnerId)
                if (winnerUser?.stxAddress) {
                    console.log(`[EXP REWARD] Attempting to issue 200 EXP to ${winnerUser.stxAddress} for win in game ${gameId}`)
                    winnerExpReward = calculateWinEXP(newGameStatus, moveNumber);
                    await issueExpReward({
                        stxAddress: winnerUser.stxAddress,
                        amount: winnerExpReward.amount,
                        reason: `${winnerExpReward.reason} in game ${gameId}`
                    })
                }
            }
        }

        await broadcastPartyKitEvent({
            event: {
                type: 'game_ended',
                data: {
                    winner: gameWinnerFromEngine,
                    reason: endReason,
                    status: newGameStatus,
                    winnerExpReward: winnerExpReward,
                    gameStats: {
                        totalMoves: moveNumber,
                        gameType: newGameStatus.includes("checkmate") ? "checkmate" :
                            newGameStatus === "stalemate" ? "stalemate" : "draw"
                    }
                }
            },
            gameId
        })
    }

    return {
        success: true,
        newFen: fenAfterMove,
        move: moveResult,
        gameStatus: newGameStatus,
        winner: gameWinnerFromEngine,
        expReward: expReward,
    }
}

// Enhanced join game with welcome bonus
export async function joinGame({ gameId, userId }: { gameId: string, userId: string }): Promise<{
    assignedColor?: PlayerColor,
    message?: string,
    welcomeBonus?: { amount: number, reason: string }
}> {
    const gameData = await kv.hgetall(`game:${gameId}`) as GameData | null
    if (!gameData || !gameData.currentFen) {
        return { message: "Game not found or data incomplete." }
    }

    let assignedColor: PlayerColor | undefined = undefined
    let welcomeBonus: { amount: number, reason: string } | undefined;
    const updatePayload: Partial<GameData> = {}

    if (gameData.playerWhiteId === userId) {
        assignedColor = "w"
    } else if (gameData.playerBlackId === userId) {
        assignedColor = "b"
    } else if (!gameData.playerWhiteId) {
        updatePayload.playerWhiteId = userId
        assignedColor = "w"
        // Welcome bonus for joining
        const playerUser = await getUserById(userId)
        if (playerUser?.stxAddress) {
            welcomeBonus = { amount: 5, reason: "game participation" };
            await issueExpReward({
                stxAddress: playerUser.stxAddress,
                amount: welcomeBonus.amount,
                reason: `${welcomeBonus.reason} in game ${gameId}`
            })
        }
    } else if (!gameData.playerBlackId) {
        updatePayload.playerBlackId = userId
        assignedColor = "b"
        // Welcome bonus for joining and completing the game setup
        const playerUser = await getUserById(userId)
        if (playerUser?.stxAddress) {
            welcomeBonus = { amount: 5, reason: "game participation" };
            await issueExpReward({
                stxAddress: playerUser.stxAddress,
                amount: welcomeBonus.amount,
                reason: `${welcomeBonus.reason} in game ${gameId}`
            })
        }

        // Game start bonus for both players when game becomes ready
        if (gameData.playerWhiteId) {
            const whiteUser = await getUserById(gameData.playerWhiteId)
            if (whiteUser?.stxAddress) {
                await issueExpReward({
                    stxAddress: whiteUser.stxAddress,
                    amount: 5,
                    reason: `game start bonus in game ${gameId}`
                })
            }
        }
    } else {
        return { message: "Both player slots are filled. You are a spectator." }
    }

    if (Object.keys(updatePayload).length > 0) {
        updatePayload.updatedAt = Date.now()
        await kv.hset(`game:${gameId}`, cleanKVData(updatePayload))
        await kv.zadd("games_by_update_time", { score: updatePayload.updatedAt, member: gameId })
    }

    return { assignedColor, welcomeBonus }
}

// GET GAME STATE: Pure read, never mutates assignment
export async function getGameState({ gameId, userId }: { gameId: string, userId: string }): Promise<{
    gameId: string
    fen: string
    clientPlayerColor?: PlayerColor
    assignedWhiteId?: string | null
    assignedBlackId?: string | null
    currentTurn: PlayerColor
    gameStatus: string
    winner?: PlayerColor
    moveHistory: Move[]
} | { message: string, error?: string, errorName?: string }> {
    try {
        const gameData = await kv.hgetall(`game:${gameId}`) as GameData | null
        if (!gameData || !gameData.currentFen) {
            return { message: "Game not found or data incomplete." }
        }
        let clientPlayerColor: PlayerColor | undefined = undefined
        if (gameData.playerWhiteId === userId) clientPlayerColor = "w"
        else if (gameData.playerBlackId === userId) clientPlayerColor = "b"

        // Enhanced move history logic
        const gameLogic = new ChessJsAdapter(gameData.currentFen)
        const movesListKey = `moves:${gameId}`
        const rawMovesData = await kv.lrange<string | MoveData>(movesListKey, 0, -1)
        const clientMoveHistory: Move[] = rawMovesData
            .map((item) => {
                let dbMove: MoveData
                if (typeof item === "string") {
                    try { dbMove = JSON.parse(item) } catch { return null }
                } else if (typeof item === "object" && item !== null) {
                    dbMove = item as MoveData
                } else { return null }

                if (!dbMove || typeof dbMove.fromSquare !== "string" || typeof dbMove.toSquare !== "string" ||
                    typeof dbMove.playerColor !== "string" || dbMove.playerColor.trim() === "" ||
                    typeof dbMove.piece !== "string" || dbMove.piece.trim() === "") {
                    return null
                }

                let moveColor: PlayerColor | undefined = mapIdentityToColor(dbMove.playerColor as PlayerColorIdentity)
                if (!moveColor && (dbMove.playerColor.toLowerCase() === "w" || dbMove.playerColor.toLowerCase() === "b")) {
                    moveColor = dbMove.playerColor.toLowerCase() as PlayerColor
                }

                let movePiece: PieceSymbol | undefined = identityToPieceSymbol(dbMove.piece as PieceTypeIdentity)
                if (!movePiece && dbMove.piece.length === 1) {
                    const potentialPieceSymbol = dbMove.piece.toLowerCase() as PieceSymbol
                    if (["p", "n", "b", "r", "q", "k"].includes(potentialPieceSymbol)) {
                        movePiece = potentialPieceSymbol
                    }
                }

                if (!moveColor || !movePiece) { return null }

                const flags = dbMove.moveFlags || (() => {
                    let f = "";
                    if (dbMove.isCapture) f += "c";
                    if (dbMove.promotion) f += "p";
                    if (dbMove.san) {
                        if (dbMove.san.includes("x") && !f.includes("c")) f += "c";
                        if (dbMove.san.includes("=") && !f.includes("p")) f += "p";
                        if (dbMove.san === "O-O") return "k";
                        if (dbMove.san === "O-O-O") return "q";
                    }
                    return f || "n"
                })()

                return {
                    from: dbMove.fromSquare as Square,
                    to: dbMove.toSquare as Square,
                    color: moveColor,
                    piece: movePiece,
                    promotion: dbMove.promotion ? identityToPieceSymbol(dbMove.promotion as PieceTypeIdentity) : undefined,
                    captured: dbMove.capturedPiece ? identityToPieceSymbol(dbMove.capturedPiece) : undefined,
                    san: dbMove.san || "N/A",
                    flags: flags
                }
            })
            .filter((move) => move !== null) as Move[]

        return {
            gameId: gameData.id,
            fen: gameData.currentFen,
            clientPlayerColor,
            assignedWhiteId: gameData.playerWhiteId,
            assignedBlackId: gameData.playerBlackId,
            currentTurn: gameLogic.getTurn(),
            gameStatus: gameData.status,
            winner: mapIdentityToColor(gameData.winner),
            moveHistory: clientMoveHistory,
        }
    } catch (error: unknown) {
        let errorMessage = "An unknown error occurred."
        let errorName = "UnknownError"
        if (error instanceof Error) {
            errorMessage = error.message || "Error object did not contain a message."
            errorName = error.name || "Error"
        } else if (typeof error === "string") {
            errorMessage = error
        } else if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
            errorMessage = error.message
            errorName = "name" in error && typeof error.name === "string" ? error.name : "ObjectError"
        } else {
            try { errorMessage = JSON.stringify(error) } catch { errorMessage = "Failed to stringify error object." }
        }
        if (errorMessage === "[object Object]") { errorMessage = "An unspecified object error occurred." }
        return { message: "Internal server error during game state fetch.", error: errorMessage, errorName }
    }
}

// Utility to fetch addresses for both players in a game
export async function getUserAddressesForGame(gameData: GameData): Promise<{ whiteAddress: string | null, blackAddress: string | null }> {
    const [whiteUser, blackUser] = await Promise.all([
        gameData.playerWhiteId ? getUserById(gameData.playerWhiteId) : Promise.resolve(null),
        gameData.playerBlackId ? getUserById(gameData.playerBlackId) : Promise.resolve(null),
    ])
    return {
        whiteAddress: whiteUser?.stxAddress || null,
        blackAddress: blackUser?.stxAddress || null,
    }
}

// Enhanced EXP issuance with better logging
async function issueExpReward({ stxAddress, amount, reason }: { stxAddress: string, amount: number, reason: string }) {
    if (!CHARISMA_RULEBOOK_CONTRACT || !CHARISMA_HOT_WALLET_PRIVATE_KEY) {
        console.error('[EXP REWARD] Missing contract or private key env vars');
        return;
    }

    const [contractAddress, contractName] = CHARISMA_RULEBOOK_CONTRACT.split('.');

    try {
        console.log(`[EXP REWARD] Sending ${amount} EXP to ${stxAddress} for: ${reason}`)
        const txOptions = {
            contractAddress,
            contractName,
            functionName: 'reward',
            functionArgs: [
                uintCV(amount * 1_000_000), // adjust if contract expects micro-units
                standardPrincipalCV(stxAddress),
            ],
            senderKey: CHARISMA_HOT_WALLET_PRIVATE_KEY,
            nonce: await fetchNonce({ address: getAddressFromPrivateKey(CHARISMA_HOT_WALLET_PRIVATE_KEY) })
        };

        const tx = await makeContractCall(txOptions);
        const result = await broadcastTransaction({ transaction: tx });
        const txid = result.txid || result;

        console.log(`[EXP REWARD] Sent ${amount} EXP to ${stxAddress} for ${reason}. TX:`, txid);

        // Enhanced logging to KV
        await kv.rpush('exp_rewards_log', [JSON.stringify({
            stxAddress,
            amount,
            reason,
            txid,
            timestamp: Date.now(),
            type: reason.includes('victory') ? 'win' :
                reason.includes('checkmate') ? 'checkmate' :
                    reason.includes('capture') ? 'capture' :
                        reason.includes('promotion') ? 'promotion' : 'move'
        })])
        console.log(`[EXP REWARD] Successfully logged EXP reward to KV`)
    } catch (err) {
        console.error('[EXP REWARD] Error issuing EXP:', err);
    }
}