import { AssetItem } from '../lib/assets';
import { GalleryNav, GalleryPageKey } from './GalleryNav';
import { I3DGalleryCard } from './I3DGalleryCard';

type ThreeDGalleryViewProps = {
  activePage: GalleryPageKey;
  title: string;
  subtitle: string;
  baseRoute: '/3Ds' | '/3Di';
  suffixHint: '-3Ds' | '-3Di';
  items: AssetItem[];
};

/** Shared layout for the Static 3D (/3Ds) and Interactive 3D (/3Di) galleries. */
export function ThreeDGalleryView({
  activePage,
  title,
  subtitle,
  baseRoute,
  suffixHint,
  items,
}: ThreeDGalleryViewProps) {
  return (
    <div className="app-page min-h-dvh text-white font-sans flex flex-col">
      <GalleryNav activePage={activePage} />
      <main className="gallery-container px-6 pt-8 pb-16 md:pt-12 md:pb-24 flex-1">
        <header className="mb-8 md:mb-12">
          <h1 className="i3d-header__title">{title}</h1>
          <p className="i3d-header__sub">{subtitle}</p>
        </header>

        {items.length > 0 ? (
          <div className="i3d-gallery">
            {items.map(item => (
              <I3DGalleryCard
                key={item.id}
                id={item.id}
                displayName={item.displayName}
                category={item.category}
                fileName={item.fileName}
                fileUrl={item.fileUrl}
                accentColor={item.accentColor}
                index={item.index}
                href={`${baseRoute}/${item.slug}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-2xl border border-white/10 bg-white/5">
            <h2 className="text-2xl font-medium text-white/70">No Assets Found</h2>
            <p className="mt-4 text-white/40 max-w-md">
              Add 3D files ending with <code className="text-indigo-300">{suffixHint}</code> (.glb, .gltf, .usdz) to the{' '}
              <code className="text-indigo-300">public/3Dassets</code> directory.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
