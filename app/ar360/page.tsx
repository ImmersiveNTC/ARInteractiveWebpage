import fs from 'fs';
import path from 'path';
import { VR360Gallery } from './VR360Gallery';

export const metadata = {
  title: "AR 360 Gallery",
  description: "Experience immersive 360-degree spherical environments. Tap any panorama to step inside directly from your device.",
};

/* ─── Display Name & Category Mapping ──────────────────────────────────────── */

function toDisplayName(filename: string): string {
  const raw = filename.replace(/\.[^/.]+$/, ''); // strip extension
  let name = raw
    .replace(/_/g, ' ')           // underscores → spaces
    .replace(/\b360\b/gi, '')     // remove standalone "360"
    .replace(/\s{2,}/g, ' ')      // collapse double-spaces
    .trim();

  // Title-case
  name = name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return name || raw;
}

function toCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('workshop') || lower.includes('factory') || lower.includes('plant')) return 'Industrial';
  if (lower.includes('office') || lower.includes('room') || lower.includes('interior')) return 'Interior';
  if (lower.includes('outdoor') || lower.includes('street') || lower.includes('park') || lower.includes('nature')) return 'Outdoor';
  if (lower.includes('exhibition') || lower.includes('museum') || lower.includes('gallery')) return 'Exhibition';
  return '360° Panorama';
}

/* ─── Accent Palette (Teal & Cyan & Sky tones) ────────────────────────────── */

const ACCENT_PALETTE = [
  'rgba(45, 212, 191, 0.85)',   // teal
  'rgba(6, 182, 212, 0.85)',    // cyan
  'rgba(14, 165, 233, 0.85)',   // sky
  'rgba(20, 184, 166, 0.8)',    // light teal
  'rgba(34, 211, 238, 0.85)',   // bright cyan
  'rgba(56, 189, 248, 0.8)',    // light sky
];

/* ─── Page Component ─────────────────────────────────────────────────────── */

export default function AR360Page() {
  const assetsDir = path.join(process.cwd(), 'public/VR360Assets');
  let files: string[] = [];
  try {
    if (fs.existsSync(assetsDir)) {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm'];
      files = fs
        .readdirSync(assetsDir)
        .filter(f => !f.startsWith('.') && validExtensions.includes(path.extname(f).toLowerCase()));
      
      // Sort: video files first, then alphabetically
      files.sort((a, b) => {
        const aExt = path.extname(a).toLowerCase();
        const bExt = path.extname(b).toLowerCase();
        const aIsVideo = ['.mp4', '.mov', '.webm'].includes(aExt);
        const bIsVideo = ['.mp4', '.mov', '.webm'].includes(bExt);
        
        if (aIsVideo && !bIsVideo) return -1;
        if (!aIsVideo && bIsVideo) return 1;
        return a.localeCompare(b);
      });
    }
  } catch (error) {
    console.error('Error reading VR360Assets directory:', error);
  }

  const items = files.map((file, idx) => {
    const ext = path.extname(file).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
    
    return {
      id: `vr360-asset-${idx}`,
      displayName: toDisplayName(file),
      category: isVideo ? '360° Video' : toCategory(file),
      fileName: file,
      fileUrl: `/ARInteractiveWebpage/VR360Assets/${file}`,
      accentColor: ACCENT_PALETTE[idx % ACCENT_PALETTE.length],
      index: idx,
      isVideo,
    };
  });

  return <VR360Gallery items={items} />;
}
