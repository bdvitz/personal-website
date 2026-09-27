import type { SVGProps } from 'react'

// Lucide has no balloon icon; this matches lucide's 24px outline style so it can be used the same way
export default function Balloon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 16c-3.3 0-6-3-6-6.6C6 5.9 8.7 3 12 3s6 2.9 6 6.4C18 13 15.3 16 12 16z" />
      <path d="M10.8 17.8h2.4L12 16z" />
      <path d="M12 17.8c0 1.4-1.6 1.9-1.6 3.2" />
      <path d="M9.2 8.2a3 3 0 0 1 1.8-2.2" />
    </svg>
  )
}
