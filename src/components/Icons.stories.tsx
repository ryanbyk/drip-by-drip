import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlarmClock,
  AppIcon,
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
  ProgressDots,
  RotateCcw,
  Settings2,
  Share,
  Sun,
  WaterDrop,
  X,
} from "./Icons";

const GLYPHS = [
  ["Alarm clock", AlarmClock],
  ["Arrow up right", ArrowUpRight],
  ["Bell", Bell],
  ["Book check", BookCheck],
  ["Book open", BookOpen],
  ["Bookmark", Bookmark],
  ["Calendar", Calendar],
  ["Calendar days", CalendarDays],
  ["Check", Check],
  ["Chevron down", ChevronDown],
  ["Chevron left", ChevronLeft],
  ["Chevron right", ChevronRight],
  ["Question", CircleQuestionMark],
  ["Cloud off", CloudOff],
  ["Corner down right", CornerDownRight],
  ["Droplet", Droplet],
  ["External link", ExternalLink],
  ["Heart handshake", HeartHandshake],
  ["Keyboard", Keyboard],
  ["Layers", Layers],
  ["List checks", ListChecks],
  ["Map pin", MapPin],
  ["Minus", Minus],
  ["Moon star", MoonStar],
  ["Notebook", NotebookPen],
  ["Pencil", Pencil],
  ["Pen line", PenLine],
  ["Plus", Plus],
  ["Rotate", RotateCcw],
  ["Settings", Settings2],
  ["Share", Share],
  ["Sun", Sun],
  ["Close", X],
] as const;

const meta = {
  title: "UI/Icons",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaterDropGlyph: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-16)", color: "var(--accent)" }}>
      <WaterDrop size={16} />
      <WaterDrop size={24} />
      <WaterDrop size={32} />
      <WaterDrop size={48} />
    </div>
  ),
};

export const AppMark: Story = {
  render: () => (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-16)" }}>
      <AppIcon size={38} />
      <AppIcon size={64} />
    </div>
  ),
};

export const Progress: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
      <ProgressDots active={0} />
      <ProgressDots active={1} />
      <ProgressDots active={2} />
      <ProgressDots active={3} />
    </div>
  ),
};

export const Lucide: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-16)", color: "var(--accent)" }}>
      {GLYPHS.map(([label, Icon]) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)", color: "var(--ink)" }}>
          <Icon size={22} aria-hidden="true" />
          <span style={{ color: "var(--muted)", fontSize: 12, textAlign: "center" }}>{label}</span>
        </div>
      ))}
    </div>
  ),
};
