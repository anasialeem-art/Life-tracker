import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

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
export const ChevronDown = (p: IconProps) => <Icon {...p}><path d="m5 9 7 7 7-7" /></Icon>
export const ChevronUp = (p: IconProps) => <Icon {...p}><path d="m5 15 7-7 7 7" /></Icon>
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>
)
export const LockIcon = (p: IconProps) => (
  <Icon {...p}><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>
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
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4.2-3.4-6.5-4.5-10.5-2 1.6-3 3.6-3 5.5-1-.6-1.8-1.6-2-2.8C7.2 8.6 5.5 11 5.5 14.5A6.5 6.5 0 0 0 12 21Z" /></Icon>
)
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.5 6.5l.8 12.1a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.1" /></Icon>
)
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></Icon>
)
export const DotsIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></Icon>
)
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
export const MosqueIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3.5c-.9 1.2-3.5 2.4-3.5 5h7c0-2.6-2.6-3.8-3.5-5Z" /><path d="M7 20.5V12a5 5 0 0 1 10 0v8.5" /><path d="M3.5 20.5v-9M3.5 11.5l1-2 1 2v9M20.5 20.5v-9M20.5 11.5l-1-2-1 2v9M2.5 20.5h19M10.5 20.5v-3.5a1.5 1.5 0 0 1 3 0v3.5" /></Icon>
)
export const CompassIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></Icon>
)
export const QuranIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 6.5c-2-1.5-4.8-2-8-1.5v13c3.2-.5 6 0 8 1.5 2-1.5 4.8-2 8-1.5V5c-3.2-.5-6 0-8 1.5Z" /><path d="M12 6.5v13" /></Icon>
)
export const ExternalIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></Icon>
)
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></Icon>
export const FlagIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5.5 21V4.5M5.5 4.5h11l-2 4 2 4h-11" /></Icon>
)
export const RepeatIcon = (p: IconProps) => (
  <Icon {...p}><path d="M17 3.5 20 6.5l-3 3" /><path d="M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3" /><path d="M20 12.5v1a4 4 0 0 1-4 4H4" /></Icon>
)
export const NoteIcon = (p: IconProps) => <Icon {...p}><path d="M5 6.5h14M5 12h14M5 17.5h8" /></Icon>
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8.5 9a5 5 0 0 1 7 0l-2.3 2.6a1.6 1.6 0 0 0-2.4 0Z" /></Icon>
)
export const LocationIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></Icon>
)
export const UndoIcon = (p: IconProps) => <Icon {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>
export const SunIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Icon>
)
export const SunriseIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7.5 16.5a4.5 4.5 0 0 1 9 0M2.5 20h19M12 3.5V9M9 6.5l3-3 3 3M4.5 12.5l1.4 1M19.5 12.5l-1.4 1" /></Icon>
)
export const SunsetIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7.5 16.5a4.5 4.5 0 0 1 9 0M2.5 20h19M12 3.5V9M9 6l3 3 3-3M4.5 12.5l1.4 1M19.5 12.5l-1.4 1" /></Icon>
)
export const StarIcon = (p: IconProps) => (
  <Icon {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></Icon>
)
export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Icon>
export const ListIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.5" cy="6.5" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="17.5" r="1" fill="currentColor" /></Icon>
)
export const ChartIcon = (p: IconProps) => <Icon {...p}><path d="M4 20h16M7 16.5v-5M12 16.5V7M17 16.5v-8" /></Icon>
export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0Z" /><path d="M7.5 6H4.5v1.5a3 3 0 0 0 3 3M16.5 6h3v1.5a3 3 0 0 1-3 3M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5Z" /></Icon>
)
export const BookmarkIcon = (p: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = p
  return <Icon {...rest}><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1Z" fill={filled ? 'currentColor' : 'none'} /></Icon>
}
export const GraduationIcon = (p: IconProps) => (
  <Icon {...p}><path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" /><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5.5" /></Icon>
)
export const CakeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20.5h16M5 20.5v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" /><path d="M5 15.5c1.2 1 2.3 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0M12 11.5V8M12 5.5c-.8-.8-.8-1.7 0-2.5.8.8.8 1.7 0 2.5Z" /></Icon>
)
export const CartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 4h2.2l2.2 11h10.4l2-8H6.3" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></Icon>
)
export const MapPinSmallIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 20s-5.5-4.6-5.5-9a5.5 5.5 0 0 1 11 0c0 4.4-5.5 9-5.5 9Z" /><circle cx="12" cy="11" r="2" /></Icon>
)
