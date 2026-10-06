import {
  AlarmClock,
  ArrowUpRight,
  Bell,
  BookCheck,
  BookOpen,
  Bookmark,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  CloudOff,
  CornerDownRight,
  Droplet,
  ExternalLink,
  HeartHandshake,
  Keyboard,
  Layers,
  ListChecks,
  MapPin,
  Minus,
  MoonStar,
  NotebookPen,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Settings2,
  Share,
  Sun,
  SunMoon,
  X,
} from "lucide-react";

/** Material Symbols Rounded `water_drop`, weight 300, filled. */
export function WaterDrop({ size = 24 }: { size?: number }) {
  return (
    <span className="water-drop" style={{ fontSize: size }} aria-hidden="true">
      water_drop
    </span>
  );
}

/** App icon: accent rounded square, cream `water_drop` at 20/38 of the tile. */
export function AppIcon({ size = 38 }: { size?: number }) {
  const radius = (size * 10) / 38;
  const glyph = (size * 20) / 38;
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: radius }} aria-hidden="true">
      <WaterDrop size={glyph} />
    </span>
  );
}

export function ProgressDots({ active }: { active: 0 | 1 | 2 | 3 }) {
  return (
    <div className="progress" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <i key={index} className={index === active ? "is-active" : undefined} />
      ))}
    </div>
  );
}

export {
  AlarmClock,
  ArrowUpRight,
  Bell,
  BookCheck,
  BookOpen,
  Bookmark,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  CloudOff,
  CornerDownRight,
  Droplet,
  ExternalLink,
  HeartHandshake,
  Keyboard,
  Layers,
  ListChecks,
  MapPin,
  Minus,
  MoonStar,
  NotebookPen,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Settings2,
  Share,
  Sun,
  SunMoon,
  X,
};
