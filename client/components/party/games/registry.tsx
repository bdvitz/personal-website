import type { ComponentType } from 'react'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'
import { WarmupHostView, WarmupPlayerView } from './warmup/WarmupViews'
import { StrikeoutHostView, StrikeoutPlayerView } from './strikeout/StrikeoutViews'
import { ColorDilemmaHostView, ColorDilemmaPlayerView } from './colordilemma/ColorDilemmaViews'
import { MedianMadnessHostView, MedianMadnessPlayerView } from './medianmadness/MedianMadnessViews'
import { CardConundrumHostView, CardConundrumPlayerView } from './cardconundrum/CardConundrumViews'
import { BuoyantBattleHostView, BuoyantBattlePlayerView } from './buoyantbattle/BuoyantBattleViews'

// A lobby choice for a game; keys and values must match GameRegistry.OPTIONS on the server
export interface PartyGameOption {
  key: string
  label: string
  choices: { value: number; label: string }[]
}

export interface PartyGameDefinition {
  name: string
  description: string
  HostView: ComponentType<HostViewProps>
  PlayerView: ComponentType<PlayerViewProps>
  automatic?: boolean // runs on timers only: hide the Next buttons
  options?: PartyGameOption[]
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
  strikeout: {
    name: 'Strikeout',
    description: '60 seconds to hand out 3 strikes to 3 different players. Each strike you end with costs a point.',
    HostView: StrikeoutHostView,
    PlayerView: StrikeoutPlayerView,
    automatic: true,
  },
  medianmadness: {
    name: 'Median Madness',
    description: 'Secretly pick a number from 1 to 100. Duplicates are knocked out, and the closest to the middle wins.',
    HostView: MedianMadnessHostView,
    PlayerView: MedianMadnessPlayerView,
    options: [
      { key: 'timeLimit', label: 'Time limit', choices: [{ value: 30, label: '30s' }, { value: 60, label: '60s' }] },
    ],
  },
  cardconundrum: {
    name: 'Card Conundrum',
    description: 'Grab your pointer! Your group gets a card. Touch it on the table before the others. Last one there is out.',
    HostView: CardConundrumHostView,
    PlayerView: CardConundrumPlayerView,
    automatic: true, // has its own round/elimination buttons
  },
  buoyantbattle: {
    name: 'Buoyant Battle',
    description: 'Team battleship on a 5x5 grid. Elect a leader, hide 3 ships, then trade shots until one fleet sinks.',
    HostView: BuoyantBattleHostView,
    PlayerView: BuoyantBattlePlayerView,
    automatic: true, // runs on timers; has its own close/end/pause buttons
  },
}

// Display order in the game picker
export const GAME_ORDER = ['colordilemma', 'strikeout', 'medianmadness', 'cardconundrum', 'buoyantbattle', 'warmup']
