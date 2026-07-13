'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type VR360ViewerModalProps = {
  imageUrl: string;
  title: string;
  onClose: () => void;
};

export function VR360ViewerModal({ imageUrl, title, onClose }: VR360ViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [gyroActive, setGyroActive] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // References to pass state to animation loops and event handlers without re-triggering useEffect
  const stateRef = useRef({
    lon: 0,
    lat: 0,
    targetLon: 0,
    targetLat: 0,
    isUserInteracting: false,
    onPointerDownPointerX: 0,
    onPointerDownPointerY: 0,
    onPointerDownLon: 0,
    onPointerDownLat: 0,
    gyroStartLon: 0,
    gyroStartLat: 0,
    gyroStartAlpha: null as number | null,
    gyroStartBeta: null as number | null,
  });

  // Detect mobile device
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobileDevice(isMobile);

    // Hide instructions after 4 seconds
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Three.js Lifecycle
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let width = containerRef.current.clientWidth;
    let height = containerRef.current.clientHeight;

    // 1. Create Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    camera.position.set(0, 0, 0);

    // 2. Create Inverted Sphere Geometry
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    // Invert the geometry on the x-axis so that faces point inward
    geometry.scale(-1, 1, 1);

    // 3. Load Texture with loading states
    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      setLoadingProgress(Math.round((itemsLoaded / itemsTotal) * 100));
    };

    const textureLoader = new THREE.TextureLoader(manager);
    const texture = textureLoader.load(imageUrl, 
      () => {
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading 360 panorama texture:', err);
        setIsLoading(false);
      }
    );
    
    // Set wrapping options
    texture.colorSpace = THREE.SRGBColorSpace;

    // 4. Create Material & Mesh
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 5. Create WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    // 6. Interaction Event Handlers
    const state = stateRef.current;

    const onPointerDown = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      state.isUserInteracting = true;
      state.onPointerDownPointerX = event.clientX;
      state.onPointerDownPointerY = event.clientY;
      state.onPointerDownLon = state.lon;
      state.onPointerDownLat = state.lat;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      if (state.isUserInteracting === true) {
        // Adjust sensitivity
        const factor = camera.fov / 500;
        state.targetLon = (state.onPointerDownPointerX - event.clientX) * factor + state.onPointerDownLon;
        state.targetLat = (event.clientY - state.onPointerDownPointerY) * factor + state.onPointerDownLat;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      state.isUserInteracting = false;
    };

    // Zooming via Wheel
    const onDocumentMouseWheel = (event: WheelEvent) => {
      const fov = camera.fov + event.deltaY * 0.05;
      camera.fov = THREE.MathUtils.clamp(fov, 30, 95);
      camera.updateProjectionMatrix();
    };

    // Touch zooming pinch gesture helper
    let touchStartDist = 0;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && touchStartDist > 0) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const factor = touchStartDist / dist;
        const fov = camera.fov * factor;
        camera.fov = THREE.MathUtils.clamp(fov, 30, 95);
        camera.updateProjectionMatrix();
        touchStartDist = dist;
      }
    };

    const container = containerRef.current;
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onDocumentMouseWheel, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });

    // 7. Resize Event
    const onWindowResize = () => {
      if (!containerRef.current) return;
      width = containerRef.current.clientWidth;
      height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onWindowResize);

    // 8. Animation & Render Loop
    let animationFrameId: number;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth interpolation (lerping)
      state.lon += (state.targetLon - state.lon) * 0.15;
      state.lat += (state.targetLat - state.lat) * 0.15;
      state.lat = Math.max(-85, Math.min(85, state.lat)); // prevent flipping

      // Convert Spherical coordinates to 3D Cartesian coordinates
      const phi = THREE.MathUtils.degToRad(90 - state.lat);
      const theta = THREE.MathUtils.degToRad(state.lon);

      const target = new THREE.Vector3();
      target.x = 500 * Math.sin(phi) * Math.sin(theta);
      target.y = 500 * Math.cos(phi);
      target.z = 500 * Math.sin(phi) * Math.cos(theta);

      camera.lookAt(target);
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup function
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onWindowResize);
      
      if (container) {
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('wheel', onDocumentMouseWheel);
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
      }

      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [imageUrl]);

  // Handle Gyroscope Orientation Logic
  useEffect(() => {
    if (!gyroActive) {
      // Clear values when gyro is disabled
      stateRef.current.gyroStartAlpha = null;
      stateRef.current.gyroStartBeta = null;
      return;
    }

    const state = stateRef.current;
    
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha; // Yaw [0, 360]
      const beta = event.beta;   // Pitch [-180, 180]
      
      if (alpha === null || beta === null) return;

      // On first reading, calibrate and record the relative zero offset
      if (state.gyroStartAlpha === null || state.gyroStartBeta === null) {
        state.gyroStartAlpha = alpha;
        state.gyroStartBeta = beta;
        state.gyroStartLon = state.lon;
        state.gyroStartLat = state.lat;
        return;
      }

      // Calculate orientation changes relative to calibration values
      let deltaAlpha = alpha - state.gyroStartAlpha;
      if (deltaAlpha > 180) deltaAlpha -= 360;
      if (deltaAlpha < -180) deltaAlpha += 360;

      const deltaBeta = beta - state.gyroStartBeta;

      // Map phone rotation:
      // Panning side-to-side (alpha) rotates longitude (lon)
      // Tilting up-and-down (beta) rotates latitude (lat)
      // Multiple scales to tune sensor responsiveness
      state.targetLon = state.gyroStartLon - deltaAlpha * 1.25;
      state.targetLat = state.gyroStartLat + deltaBeta * 1.25;
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [gyroActive]);

  // Request iOS Gyroscope Permission
  const toggleGyro = async () => {
    if (gyroActive) {
      setGyroActive(false);
      return;
    }

    // Check for iOS 13+ device orientation permissions
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (
      typeof window !== 'undefined' &&
      typeof DeviceOrientation !== 'undefined' &&
      typeof DeviceOrientation.requestPermission === 'function'
    ) {
      try {
        const permissionState = await DeviceOrientation.requestPermission();
        if (permissionState === 'granted') {
          setGyroActive(true);
        } else {
          alert('Motion sensor permission was denied. Falling back to drag controls.');
        }
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        alert('Could not enable motion controls on this device.');
      }
    } else {
      // Non-iOS device or permission not required
      setGyroActive(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black overflow-hidden select-none">
      
      {/* 3D Render Canvas Container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* ── Header Overlay (Title + Sub) ── */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] max-w-[calc(100%-120px)]">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">{title}</h2>
        <p className="text-xs text-white/50 mt-1 uppercase tracking-wider font-semibold">360° Spherical Environment</p>
      </div>

      {/* ── Close Button ── */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-20 w-11 h-11 rounded-full bg-black/40 border border-white/10 hover:bg-black/80 hover:border-white/20 transition-all flex items-center justify-center text-white cursor-pointer active:scale-95 shadow-lg backdrop-blur-md"
        aria-label="Close VR viewer"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* ── Loader overlay ── */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a041a] text-white">
          <div className="w-12 h-12 rounded-full border-4 border-white/5 border-t-teal-500 animate-spin mb-4" />
          <p className="text-sm font-semibold tracking-wide text-white/80">Loading Spherical Texture...</p>
          {loadingProgress > 0 && (
            <p className="text-xs text-teal-400/80 font-medium mt-1">{loadingProgress}%</p>
          )}
        </div>
      )}

      {/* ── Interactive instructions overlay ── */}
      {showInstructions && !isLoading && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] bg-black/50 backdrop-blur-md px-5 py-3 rounded-full border border-white/10 text-center animate-fade-in-out">
          <p className="text-xs text-white/90 font-medium flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Drag to pan around. Pinch to zoom.
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </p>
        </div>
      )}

      {/* ── Floating Controls Bar (Bottom Center) ── */}
      {!isLoading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-4 items-center px-4 py-2.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-2xl">
          
          {/* Zoom In / Zoom Out Controls */}
          <div className="flex items-center gap-1 border-r border-white/10 pr-3">
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return;
                // Programmatic simulation of mouse wheel zoom-in
                const container = containerRef.current;
                if (container) {
                  container.dispatchEvent(new WheelEvent('wheel', { deltaY: -150 }));
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
              title="Zoom In"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => {
                const container = containerRef.current;
                if (container) {
                  container.dispatchEvent(new WheelEvent('wheel', { deltaY: 150 }));
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 active:scale-90 transition-all cursor-pointer"
              title="Zoom Out"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Gyroscope toggle (visible on mobile, shown as optional on desktop fallback) */}
          {(isMobileDevice || typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) && (
            <button
              onClick={toggleGyro}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all duration-300 cursor-pointer active:scale-95 ${
                gyroActive 
                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.3)]' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={gyroActive ? 'animate-pulse' : ''}>
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              {gyroActive ? 'Motion Control Active' : 'Enable Motion Control'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
