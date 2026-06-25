import fs from 'fs';
import path from 'path';
import { I3DGalleryCard } from '../../components/I3DGalleryCard';

export const metadata = {
  title: "Interactive 3D Gallery",
  description: "Explore a curated collection of interactive 3D models.",
};

/* ─── Display Name & Category Mapping ─────────────────────────────────────── */

/** Strip extension, remove underscores, clean up common prefixes */
function toDisplayName(filename: string): string {
  const raw = filename.replace(/\.[^/.]+$/, ""); // strip extension
  let name = raw
    .replace(/_/g, " ")           // underscores → spaces
    .replace(/\b3d\b/gi, "")      // remove standalone "3d"
    .replace(/\bprintable\b/gi, "")// remove "printable" clutter
    .replace(/\s{2,}/g, " ")      // collapse double-spaces
    .trim();

  // Title-case
  name = name
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return name || raw;
}

/** Infer a short category tag from the filename */
function toCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("engine"))  return "Mechanical";
  if (lower.includes("pump"))    return "Hydraulic";
  if (lower.includes("drone"))   return "Aerial";
  if (lower.includes("bike"))    return "Vehicle";
  if (lower.includes("car"))     return "Vehicle";
  if (lower.includes("robot"))   return "Robotics";
  if (lower.includes("arch"))    return "Architecture";
  return "3D Model";
}

/* ─── Accent Palette ─────────────────────────────────────────────────────── */

const ACCENT_PALETTE = [
  "rgba(138, 86, 255, 0.8)",   // indigo
  "rgba(66, 245, 255, 0.8)",   // teal
  "rgba(236, 72, 153, 0.8)",   // rose
  "rgba(251, 191, 36, 0.75)",  // amber
  "rgba(99, 230, 190, 0.8)",   // mint
  "rgba(168, 85, 247, 0.8)",   // violet
];

/* ─── Page Component ─────────────────────────────────────────────────────── */

export default function I3DPage() {
  // Read assets from public/i3dAssets
  const assetsDir = path.join(process.cwd(), 'public/i3dAssets');
  let files: string[] = [];
  try {
    if (fs.existsSync(assetsDir)) {
      const validExtensions = ['.gltf', '.glb', '.usdz'];
      files = fs.readdirSync(assetsDir).filter(file => {
        if (file.startsWith('.')) return false;
        const ext = path.extname(file).toLowerCase();
        return validExtensions.includes(ext);
      });
    }
  } catch (error) {
    console.error("Error reading i3dAssets directory:", error);
  }

  return (
    <div className="app-page min-h-screen text-white font-sans">
      <main className="mx-auto w-full max-w-7xl px-6 py-24 md:py-32">
        {/* ── Header ── */}
        <header className="mb-20">
          <h1 className="i3d-header__title">
            Interactive 3D Gallery
          </h1>
          <p className="i3d-header__sub">
            Explore interactive 3D models. Click any card to open the viewer.
          </p>
        </header>

        {/* ── Gallery Grid ── */}
        {files.length > 0 ? (
          <div className="i3d-gallery">
            {files.map((file, idx) => (
              <I3DGalleryCard 
                key={idx} 
                id={`asset-${idx}`} 
                displayName={toDisplayName(file)}
                category={toCategory(file)}
                fileName={file}
                fileUrl={`${process.env.NODE_ENV === 'production' ? '/ARInteractiveWebpage' : ''}/i3dAssets/${file}`}
                accentColor={ACCENT_PALETTE[idx % ACCENT_PALETTE.length]}
                index={idx}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <h2 className="text-2xl font-medium text-white/70">No Assets Found</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Please add 3D files (.gltf, .glb, .usdz) to the public/i3dAssets directory.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
