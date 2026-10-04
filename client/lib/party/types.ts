// Mirrors the JSON sent by server/.../party/RoomService.stateMessage

export type RoomStatus = 'LOBBY' | 'IN_GAME' | 'GAME_OVER'

export interface PartyPlayer {
  id: string
  name: string
  connected: boolean
  score?: number // omitted during private-score games (e.g. colordilemma)
}

export interface RoomView {
  code: string
  status: RoomStatus
  maxPlayers: number
  gameId?: string
  selectedGameId?: string // what "start" will launch; shared by TV and VIP
  gameOptions?: Record<string, number> // lobby options of the selected game, defaults filled in
  vipPlayerId?: string
  players: PartyPlayer[]
  waiting: PartyPlayer[]
}

export interface YouView {
  playerId: string
  name: string
  waiting: boolean
  vip: boolean
  score?: number // your own room total; always sent
}

export interface PartyState {
  serverTime: number
  room: RoomView
  you?: YouView
  // Game-specific payload (hostView or playerView); each game's views know its shape
  game?: any
}

// Standard player inputs, validated server-side in PartyInputs.java
export type PartyInput =
  | { kind: 'choice'; index: number }
  | { kind: 'number'; value: string }
  | { kind: 'target'; playerId: string }
  | { kind: 'strike'; playerId: string; on: boolean } // wanted state, not a toggle, so repeats are harmless
  // Buoyant Battle (grid rows/cols are 0-based)
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'place'; ship: number; row: number; col: number; vertical: boolean }
  | { kind: 'randomize' }
  | { kind: 'confirm'; on: boolean }
  | { kind: 'handoff'; playerId?: string } // omitted = cancel

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'ended'

// Host/VIP game-specific action, sent as control{action} (see PartyGame.onControl)
export type SendControl = (action: Record<string, unknown>) => void

export interface HostViewProps {
  game: any
  room: RoomView
  clockOffset: number
  sendControl: SendControl
}

export interface PlayerViewProps {
  game: any
  room: RoomView
  you: YouView
  clockOffset: number
  sendInput: (input: PartyInput) => void
  sendControl: SendControl // only works for the VIP
}
