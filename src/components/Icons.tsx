import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5h4v5" /></Icon>
)
export const PillIcon = (p: IconProps) => (
  <Icon {...p}><rect x="2.8" y="8.2" width="18.4" height="7.6" rx="3.8" transform="rotate(-45 12 12)" /><path d="m8.8 8.8 6.4 6.4" /></Icon>
)
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /><path d="m17 3 .6 1.4L19 5l-1.4.6L17 7l-.6-1.4L15 5l1.4-.6Z" /></Icon>
)
export const CheckListIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3.5 6.5 1.5 1.5 3-3" /><path d="m3.5 13.5 1.5 1.5 3-3" /><path d="M11 6.5h9.5M11 13.5h9.5M11 19.5h9.5" /></Icon>
)
export const DumbbellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></Icon>
)
export const GridIcon = (p: IconProps) => (
  <Icon {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></Icon>
)
export const ChevronLeft = (p: IconProps) => <Icon {...p}><path d="m15 5-7 7 7 7" /></Icon>
export const ChevronRight = (p: IconProps) => <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>
)
export const LockIcon = (p: IconProps) => (
  <Icon {...p}><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>
)
export const CloudIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.6 4.5 4.5 0 0 0 7 18.5Z" /></Icon>
)
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></Icon>
export const UploadIcon = (p: IconProps) => <Icon {...p}><path d="M12 15.5V4.5M7 9l5-5 5 5M5 20h14" /></Icon>
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></Icon>
)
export const GearIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Icon>
)
export const HabitIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></Icon>
)
export const WalletIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7.5h14.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 18.5Z" /><path d="M4 7.5 15.5 4v3.5" /><circle cx="16.3" cy="13.8" r="1.1" fill="currentColor" stroke="none" /></Icon>
)
export const BookIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2Z" /><path d="M5 18a2 2 0 0 1 2-2h11.5M9 8.5h5.5" /></Icon>
)
export const ArchiveIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="4" width="17" height="4.5" rx="1.2" /><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4" /></Icon>
)
export const WifiOffIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 3l18 18M8.6 13.4a5 5 0 0 1 6.5-.5M5.3 10.2a9.5 9.5 0 0 1 3.4-2M12 7a9.5 9.5 0 0 1 6.7 3.2M12 18.5h.01" /></Icon>
)
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.2-3.4-6.5-4.5-10.5-2 1.6-3 3.6-3 5.5-1-.6-1.8-1.6-2-2.8C7.2 8.6 5.5 11 5.5 14.5A6.5 6.5 0 0 0 12 21Z" /></Icon>
)
