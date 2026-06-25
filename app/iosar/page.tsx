import fs from 'fs';
import path from 'path';
import { IOSARGallery } from './IOSARGallery';

export const metadata = {
  title: "AR Gallery",
  description: "View real 3D models in augmented reality on your iPhone. Tap any model to instantly launch AR Quick Look.",
};

/* ─── Display Name & Category Mapping ──────────────────────────────────────── */

function toDisplayName(filename: string): string {
  const raw = filename.replace(/\.[^/.]+$/, '');
  let name = raw
    .replace(/_/g, ' ')
    .replace(/\b3d\b/gi, '')
    .replace(/\bprintable\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  name = name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return name || raw;
}

function toCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('engine'))  return 'Mechanical';
  if (lower.includes('pump'))    return 'Hydraulic';
  if (lower.includes('drone'))   return 'Aerial';
  if (lower.includes('bike'))    return 'Vehicle';
  if (lower.includes('car'))     return 'Vehicle';
  if (lower.includes('robot'))   return 'Robotics';
  if (lower.includes('arch'))    return 'Architecture';
  return '3D Model';
}

/* ─── Accent Palette (amber/orange iOS AR tones) ────────────────────────────── */

const ACCENT_PALETTE = [
  'rgba(251, 146, 60, 0.85)',   // orange
  'rgba(245, 158, 11, 0.85)',   // amber
  'rgba(234, 88, 12, 0.8)',     // deep orange
  'rgba(253, 186, 116, 0.8)',   // peach
  'rgba(239, 68, 68, 0.75)',    // red-orange
  'rgba(252, 211, 77, 0.8)',    // golden
];

/* ─── Page Component ─────────────────────────────────────────────────────── */

export default function IOSARPage() {
  const assetsDir = path.join(process.cwd(), 'public/iOSARAssets');
  let files: string[] = [];
  try {
    if (fs.existsSync(assetsDir)) {
      files = fs
        .readdirSync(assetsDir)
        .filter(f => !f.startsWith('.') && f.toLowerCase().endsWith('.usdz'));
    }
  } catch (error) {
    console.error('Error reading iOSARAssets directory:', error);
  }

  const models = files.map((file, idx) => ({
    id: `ar-asset-${idx}`,
    displayName: toDisplayName(file),
    category: toCategory(file),
    fileName: file,
    fileUrl: `${process.env.NODE_ENV === 'production' ? '/ARInteractiveWebpage' : ''}/iOSARAssets/${file}`,
    accentColor: ACCENT_PALETTE[idx % ACCENT_PALETTE.length],
    index: idx,
  }));

  return <IOSARGallery models={models} />;
}
