// Drawn playing-card face (no image files): corner rank + suit and a big centre suit, real red/black colours.

export interface CardFace {
  rank: string // A, 2-10, J, Q, K
  suit: string // S, H, D, C
}

const SUITS: Record<string, { symbol: string; name: string; red: boolean }> = {
  S: { symbol: '♠', name: 'Spades', red: false },
  H: { symbol: '♥', name: 'Hearts', red: true },
  D: { symbol: '♦', name: 'Diamonds', red: true },
  C: { symbol: '♣', name: 'Clubs', red: false },
}

const RANK_NAMES: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' }

const SIZES = {
  sm: { box: 'w-20 rounded-lg', corner: 'text-sm', centre: 'text-4xl', pad: 'p-1.5' },
  md: { box: 'w-36 rounded-xl', corner: 'text-xl', centre: 'text-7xl', pad: 'p-2' },
  lg: { box: 'w-full max-w-[18rem] rounded-2xl', corner: 'text-4xl', centre: 'text-[8rem]', pad: 'p-3' },
}

export function cardName({ rank, suit }: CardFace) {
  return `${RANK_NAMES[rank] ?? rank} of ${SUITS[suit]?.name ?? suit}`
}

export default function PlayingCard({ card, size = 'md' }: { card: CardFace; size?: keyof typeof SIZES }) {
  const suit = SUITS[card.suit] ?? { symbol: '?', name: card.suit, red: false }
  const s = SIZES[size]
  const colour = suit.red ? 'text-red-600' : 'text-slate-900'
  const corner = (
    <span className={`flex flex-col items-center font-extrabold leading-none ${s.corner}`}>
      <span>{card.rank}</span>
      <span>{suit.symbol}</span>
    </span>
  )

  return (
    <div
      role="img"
      aria-label={cardName(card)}
      className={`relative mx-auto aspect-[5/7] animate-scale-in select-none border border-slate-300 bg-white shadow-xl ${s.box} ${s.pad} ${colour}`}
    >
      <div className="absolute left-0 top-0 p-[inherit]">{corner}</div>
      <div className="absolute bottom-0 right-0 rotate-180 p-[inherit]">{corner}</div>
      <div className={`flex h-full items-center justify-center leading-none ${s.centre}`}>{suit.symbol}</div>
    </div>
  )
}
