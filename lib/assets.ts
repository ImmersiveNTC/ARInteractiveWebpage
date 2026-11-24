import fs from 'fs';
import path from 'path';
import {
  ARSuffix,
  AssetItem,
  AssetSuffix,
  BASE_PATH,
  ThreeDSuffix,
  VR360Suffix,
} from './assetTypes';

export { BASE_PATH };
export type { ARSuffix, AssetItem, AssetSuffix, ThreeDSuffix, VR360Suffix };

const THREE_D_PALETTE = [
  'rgba(138, 86, 255, 0.8)',
  'rgba(66, 245, 255, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(251, 191, 36, 0.75)',
  'rgba(99, 230, 190, 0.8)',
  'rgba(168, 85, 247, 0.8)',
];

const AR_PALETTE = [
  'rgba(251, 146, 60, 0.85)',
  'rgba(245, 158, 11, 0.85)',
  'rgba(234, 88, 12, 0.8)',
  'rgba(253, 186, 116, 0.8)',
  'rgba(239, 68, 68, 0.75)',
  'rgba(252, 211, 77, 0.8)',
];

const VR360_PALETTE = [
  'rgba(45, 212, 191, 0.85)',
  'rgba(6, 182, 212, 0.85)',
  'rgba(14, 165, 233, 0.85)',
  'rgba(20, 184, 166, 0.8)',
  'rgba(34, 211, 238, 0.85)',
  'rgba(56, 189, 248, 0.8)',
];

/** Return filename without extension if it ends with the expected suffix (case-insensitive), else null. */
function matchBaseWithSuffix(filename: string, suffix: AssetSuffix): string | null {
  const base = filename.replace(/\.[^/.]+$/, '');
  if (!base.toLowerCase().endsWith(suffix.toLowerCase())) {
    return null;
  }
  return base.slice(0, -suffix.length);
}

/** Split "Asset Name - Author Name" into the asset name and optional author attribution. */
function splitAuthorAttribution(baseName: string): { assetName: string; authorName: string | null } {
  const parts = baseName.split(/\s+-\s+/);
  if (parts.length < 2) {
    return { assetName: baseName, authorName: null };
  }
  const assetName = parts[0].trim();
  const authorName = parts.slice(1).join(' - ').trim();
  return {
    assetName: assetName || baseName,
    authorName: authorName || null,
  };
}

/** Convert a stripped asset base name (excluding optional " - Author") into a clean lowercase kebab-case URL slug. */
function toSlug(baseName: string): string {
  const { assetName } = splitAuthorAttribution(baseName);
  const slug = assetName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'asset';
}

function toTitleCaseDisplayName(baseName: string, extraStripPattern?: RegExp): string {
  const { assetName, authorName } = splitAuthorAttribution(baseName);
  let name = assetName.replace(/_/g, ' ');
  if (extraStripPattern) {
    name = name.replace(extraStripPattern, '');
  }
  name = name.replace(/\s{2,}/g, ' ').trim();
  const formattedAsset = name
    ? name
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    : assetName;
  return authorName ? `${formattedAsset} - ${authorName}` : formattedAsset;
}

function toARDisplayName(baseName: string): string {
  const { assetName, authorName } = splitAuthorAttribution(baseName);
  const cleanedAsset = assetName.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim() || assetName;
  return authorName ? `${cleanedAsset} - ${authorName}` : cleanedAsset;
}

function toModelCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('engine')) return 'Mechanical';
  if (lower.includes('pump')) return 'Hydraulic';
  if (lower.includes('drone')) return 'Aerial';
  if (lower.includes('bike') || lower.includes('car')) return 'Vehicle';
  if (lower.includes('robot')) return 'Robotics';
  if (lower.includes('arch')) return 'Architecture';
  return '3D Model';
}

function to360Category(filename: string, isVideo: boolean): string {
  if (isVideo) return '360° Video';
  const lower = filename.toLowerCase();
  if (lower.includes('workshop') || lower.includes('factory') || lower.includes('plant')) return 'Industrial';
  if (lower.includes('office') || lower.includes('room') || lower.includes('interior')) return 'Interior';
  if (lower.includes('outdoor') || lower.includes('street') || lower.includes('park') || lower.includes('nature')) return 'Outdoor';
  if (lower.includes('exhibition') || lower.includes('museum') || lower.includes('gallery')) return 'Exhibition';
  return '360° Panorama';
}

/** Strip any matching trailing suffix (case-insensitive) from filename base, or return the raw base. */
function stripOptionalSuffixes(filename: string, suffixes: AssetSuffix[]): string {
  const base = filename.replace(/\.[^/.]+$/, '');
  const lowerBase = base.toLowerCase();
  for (const suffix of suffixes) {
    if (lowerBase.endsWith(suffix.toLowerCase())) {
      return base.slice(0, -suffix.length);
    }
  }
  return base;
}

type ReadAssetsConfig = {
  folder: '3Dassets' | 'ARassets' | '360assets';
  suffix?: AssetSuffix;
  optionalSuffixes?: AssetSuffix[];
  validExtensions: string[];
  palette: string[];
  idPrefix: string;
  formatDisplayName: (baseName: string) => string;
  getCategory: (fileName: string) => string;
  isVideo?: boolean;
};

function readOrderList(assetsDir: string): string[] {
  const orderPath = path.join(assetsDir, 'GalleryTopAssets.json');
  try {
    if (!fs.existsSync(orderPath)) return [];
    const raw = JSON.parse(fs.readFileSync(orderPath, 'utf-8'));
    if (Array.isArray(raw)) {
      return raw.filter((entry): entry is string => typeof entry === 'string');
    }
  } catch (error) {
    console.warn(`Failed to parse ${orderPath}:`, error);
  }
  return [];
}

function readFilteredAssets(config: ReadAssetsConfig): AssetItem[] {
  const assetsDir = path.join(process.cwd(), 'public', config.folder);
  let files: string[] = [];

  try {
    if (fs.existsSync(assetsDir)) {
      const orderList = readOrderList(assetsDir).map(entry => entry.trim().toLowerCase());
      const getOrderIndex = (file: string) => {
        const lowerFile = file.toLowerCase();
        const lowerBase = lowerFile.replace(/\.[^/.]+$/, '');
        const idx = orderList.findIndex(entry => {
          const entryBase = entry.replace(/\.[^/.]+$/, '');
          return entry === lowerFile || entry === lowerBase || entryBase === lowerBase;
        });
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      };

      files = fs
        .readdirSync(assetsDir)
        .filter(file => {
          if (file.startsWith('.')) return false;
          const ext = path.extname(file).toLowerCase();
          if (!config.validExtensions.includes(ext)) return false;
          if (!config.suffix) return true;
          return matchBaseWithSuffix(file, config.suffix) !== null;
        })
        .sort((a, b) => {
          const orderA = getOrderIndex(a);
          const orderB = getOrderIndex(b);
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
        });
    }
  } catch (error) {
    console.error(`Error reading ${config.folder} directory:`, error);
  }

  const usedSlugs = new Map<string, number>();

  return files.map((file, idx) => {
    const baseName = config.suffix
      ? (matchBaseWithSuffix(file, config.suffix) ?? file.replace(/\.[^/.]+$/, ''))
      : stripOptionalSuffixes(file, config.optionalSuffixes ?? []);
    const rawSlug = toSlug(baseName);
    const seen = usedSlugs.get(rawSlug) ?? 0;
    usedSlugs.set(rawSlug, seen + 1);
    const slug = seen === 0 ? rawSlug : `${rawSlug}-${seen + 1}`;

    return {
      id: `${config.idPrefix}-${idx}`,
      slug,
      displayName: config.formatDisplayName(baseName),
      category: config.getCategory(file),
      fileName: file,
      fileUrl: `${BASE_PATH}/${config.folder}/${encodeURIComponent(file)}`,
      accentColor: config.palette[idx % config.palette.length],
      index: idx,
      isVideo: config.isVideo,
    };
  });
}

/** Return static params for Next.js static export, using a fallback placeholder when a gallery is empty. */
export function toStaticSlugParams(items: AssetItem[]): { slug: string }[] {
  if (items.length === 0) {
    return [{ slug: '_empty' }];
  }
  return items.map(item => ({ slug: item.slug }));
}

/** Read and filter 3D assets (-3Ds or -3Di) from public/3Dassets. */
export function get3DAssets(suffix: ThreeDSuffix): AssetItem[] {
  return readFilteredAssets({
    folder: '3Dassets',
    suffix,
    validExtensions: ['.gltf', '.glb', '.usdz'],
    palette: THREE_D_PALETTE,
    idPrefix: suffix === '-3Ds' ? '3ds-asset' : '3di-asset',
    formatDisplayName: base => toTitleCaseDisplayName(base, /\b(3d|printable)\b/gi),
    getCategory: toModelCategory,
  });
}

/** Read and filter AR assets (-ARs or -ARi, .usdz or .reality) from public/ARassets. */
export function getARAssets(suffix: ARSuffix): AssetItem[] {
  return readFilteredAssets({
    folder: 'ARassets',
    suffix,
    validExtensions: ['.usdz', '.reality'],
    palette: AR_PALETTE,
    idPrefix: suffix === '-ARs' ? 'ars-asset' : 'ari-asset',
    formatDisplayName: toARDisplayName,
    getCategory: toModelCategory,
  });
}

/** Read all WebAR .glb/.gltf assets from public/ARassets for the unified Edge/Firefox AR gallery (/ARglb). */
export function getARGlbAssets(): AssetItem[] {
  return readFilteredAssets({
    folder: 'ARassets',
    optionalSuffixes: ['-ARs', '-ARi'],
    validExtensions: ['.glb', '.gltf'],
    palette: AR_PALETTE,
    idPrefix: 'arglb-asset',
    formatDisplayName: toARDisplayName,
    getCategory: toModelCategory,
  });
}

/** Read and filter 360 image/video assets (-360pic or -360vid) from public/360assets. */
export function get360Assets(suffix: VR360Suffix): AssetItem[] {
  const isVideo = suffix === '-360vid';
  return readFilteredAssets({
    folder: '360assets',
    suffix,
    validExtensions: isVideo ? ['.mp4', '.mov', '.webm'] : ['.jpg', '.jpeg', '.png', '.webp'],
    palette: VR360_PALETTE,
    idPrefix: isVideo ? '360vid-asset' : '360pic-asset',
    formatDisplayName: base => toTitleCaseDisplayName(base, /\b360\b/gi),
    getCategory: file => to360Category(file, isVideo),
    isVideo,
  });
}
