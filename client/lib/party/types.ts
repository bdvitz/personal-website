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

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'ended'

export interface HostViewProps {
  game: any
  room: RoomView
  clockOffset: number
}

export interface PlayerViewProps {
  game: any
  room: RoomView
  you: YouView
  clockOffset: number
  sendInput: (input: PartyInput) => void
}
