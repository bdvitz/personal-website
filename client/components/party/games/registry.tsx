import type { ComponentType } from 'react'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'
import { WarmupHostView, WarmupPlayerView } from './warmup/WarmupViews'
import { MostLikelyHostView, MostLikelyPlayerView } from './mostlikely/MostLikelyViews'
import { ColorDilemmaHostView, ColorDilemmaPlayerView } from './colordilemma/ColorDilemmaViews'

export interface PartyGameDefinition {
  name: string
  description: string
  HostView: ComponentType<HostViewProps>
  PlayerView: ComponentType<PlayerViewProps>
  automatic?: boolean // runs on timers only: hide the Next buttons
}

// Keys must match the server ids in party/game/GameRegistry.java
export const PARTY_GAMES: Record<string, PartyGameDefinition> = {
  colordilemma: {
    name: "Color Dilemma",
    description: 'Paired every round: pick green or red in secret. Trust pays, betrayal pays more. Scores stay private until the end.',
    HostView: ColorDilemmaHostView,
    PlayerView: ColorDilemmaPlayerView,
    automatic: true,
  },
  warmup: {
    name: 'Warm-up',
    description: 'Quick poll plus a guess-the-number round. Good for testing phones.',
    HostView: WarmupHostView,
    PlayerView: WarmupPlayerView,
  },
  mostlikely: {
    name: 'Most Likely To...',
    description: '3 rounds of voting for each other. Practice game for picking another player.',
    HostView: MostLikelyHostView,
    PlayerView: MostLikelyPlayerView,
  },
}

// Display order in the game picker
export const GAME_ORDER = ['colordilemma', 'warmup', 'mostlikely']
