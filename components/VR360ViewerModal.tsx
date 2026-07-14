'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type VR360ViewerModalProps = {
  imageUrl: string;
  title: string;
  initialGyroActive: boolean;
  onClose: () => void;
  isVideo?: boolean;
};

export function VR360ViewerModal({ imageUrl, title, initialGyroActive, onClose, isVideo = false }: VR360ViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [gyroActive, setGyroActive] = useState(initialGyroActive);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setGyroActive(initialGyroActive);
  }, [initialGyroActive]);

  // Sync state with video element
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.warn(err));
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleDurationChange);

    // Sync initial states
    setIsPlaying(!video.paused);
    setIsMuted(video.muted);
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleDurationChange);
    };
  }, [isVideo, imageUrl]);

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
    gyroAlpha: null as number | null,
    gyroBeta: null as number | null,
    gyroGamma: null as number | null,
    lastScreenAngle: typeof window !== 'undefined' ? (window.orientation || window.screen?.orientation?.angle || 0) : 0,
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

    // 3. Load Texture with loading states (Video vs Image)
    let texture: THREE.Texture;
    let videoElement: HTMLVideoElement | null = null;

    if (isVideo && videoRef.current) {
      videoElement = videoRef.current;
      texture = new THREE.VideoTexture(videoElement);
      setIsLoading(false);
      videoElement.play().catch(err => {
        console.warn('Autoplay failed/blocked by browser, requiring user interaction:', err);
      });
    } else {
      const manager = new THREE.LoadingManager();
      manager.onProgress = (url, itemsLoaded, itemsTotal) => {
        setLoadingProgress(Math.round((itemsLoaded / itemsTotal) * 100));
      };

      const textureLoader = new THREE.TextureLoader(manager);
      texture = textureLoader.load(imageUrl, 
        () => {
          setIsLoading(false);
        },
        undefined,
        (err) => {
          console.error('Error loading 360 panorama texture:', err);
          setIsLoading(false);
        }
      );
    }
    
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
        state.targetLon = (event.clientX - state.onPointerDownPointerX) * factor + state.onPointerDownLon;
        state.targetLat = (state.onPointerDownPointerY - event.clientY) * factor + state.onPointerDownLat;
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      state.isUserInteracting = false;
    };

    // Zooming via Wheel
    const onDocumentMouseWheel = (event: WheelEvent) => {
      const fov = camera.fov + event.deltaY * 0.05;
      camera.fov = THREE.MathUtils.clamp(fov, 15, 120);
      camera.updateProjectionMatrix();
    };

    // Touch zooming pinch gesture helper
    let touchStartDist = 0;
    
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault(); // Prevent browser viewport zooming
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault(); // Prevent browser viewport zooming
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (touchStartDist === 0) {
          touchStartDist = dist;
          return;
        }

        const factor = touchStartDist / dist;
        const fov = camera.fov * factor;
        camera.fov = THREE.MathUtils.clamp(fov, 15, 120);
        camera.updateProjectionMatrix();
        touchStartDist = dist;
      }
    };

    const onTouchEnd = () => {
      touchStartDist = 0;
    };

    const container = containerRef.current;
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onDocumentMouseWheel, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

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

      if (gyroActive && state.gyroAlpha !== null && state.gyroBeta !== null && state.gyroGamma !== null) {
        // 1. Convert absolute phone orientation angles to radians
        const alphaRad = THREE.MathUtils.degToRad(state.gyroAlpha);
        const betaRad = THREE.MathUtils.degToRad(state.gyroBeta);
        const gammaRad = THREE.MathUtils.degToRad(state.gyroGamma);

        // 2. Create device quaternion with order 'YXZ' (yaw, pitch, roll)
        const deviceEuler = new THREE.Euler(betaRad, alphaRad, -gammaRad, 'YXZ');
        const deviceQuaternion = new THREE.Quaternion().setFromEuler(deviceEuler);

        // 3. Compensate for screen orientation
        let screenAngle = 0;
        if (typeof window !== 'undefined') {
          const win = window as any;
          if ('orientation' in win) {
            screenAngle = win.orientation || 0;
          } else if (win.screen && win.screen.orientation) {
            screenAngle = win.screen.orientation.angle || 0;
          }
        }

        // Detect screen angle change directly in the render loop to calibrate drag offset
        if (state.lastScreenAngle !== screenAngle) {
          const Q_old = camera.quaternion.clone();
          
          state.lastScreenAngle = screenAngle;
          
          const screenOrientationRadNew = THREE.MathUtils.degToRad(screenAngle);
          const screenQuaternionNew = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            -screenOrientationRadNew
          );
          
          const phoneQuaternionNew = deviceQuaternion.clone()
            .multiply(screenQuaternionNew)
            .multiply(worldAlignment);
            
          const Q_drag_new = Q_old.clone().multiply(phoneQuaternionNew.clone().invert());
          const euler = new THREE.Euler().setFromQuaternion(Q_drag_new, 'YXZ');
          
          state.lon = THREE.MathUtils.radToDeg(euler.y);
          state.targetLon = state.lon;
        }

        const screenOrientationRad = THREE.MathUtils.degToRad(screenAngle);
        const screenQuaternion = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -screenOrientationRad
        );

        // 4. Align coordinate systems (Z-axis offset vs Y-axis in Three.js)
        const worldAlignment = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          -Math.PI / 2
        );

        // Combine base phone sensors rotation in standard Three.js order: Device * Screen * WorldAlignment
        const phoneQuaternion = deviceQuaternion.clone()
          .multiply(screenQuaternion)
          .multiply(worldAlignment);

        // 5. Apply horizontal swipe/drag offset to allow turning around
        state.lon += (state.targetLon - state.lon) * 0.15;
        const dragQuaternion = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(state.lon)
        );

        // Set absolute rotation to camera
        camera.quaternion.copy(dragQuaternion).multiply(phoneQuaternion);

      } else {
        // Smooth Euler touch drag pan
        state.lon += (state.targetLon - state.lon) * 0.15;
        state.lat += (state.targetLat - state.lat) * 0.15;
        state.lat = Math.max(-85, Math.min(85, state.lat)); // prevent flipping at poles

        const phi = THREE.MathUtils.degToRad(90 - state.lat);
        const theta = THREE.MathUtils.degToRad(state.lon);

        const target = new THREE.Vector3();
        target.x = 500 * Math.sin(phi) * Math.sin(theta);
        target.y = 500 * Math.cos(phi);
        target.z = 500 * Math.sin(phi) * Math.cos(theta);

        camera.lookAt(target);
      }

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
        container.removeEventListener('touchend', onTouchEnd);
        container.removeEventListener('touchcancel', onTouchEnd);
      }

      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (videoElement) {
        videoElement.pause();
      }
    };
  }, [imageUrl, isVideo]);

  // Handle Gyroscope Orientation Logic
  useEffect(() => {
    if (!gyroActive) {
      stateRef.current.gyroAlpha = null;
      stateRef.current.gyroBeta = null;
      stateRef.current.gyroGamma = null;
      return;
    }

    const state = stateRef.current;
    
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // Feed raw orientations to render thread
      state.gyroAlpha = event.alpha;
      state.gyroBeta = event.beta;
      state.gyroGamma = event.gamma;
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [gyroActive]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black overflow-hidden select-none">
      
      {/* Hidden Video element for Three.js VideoTexture */}
      {isVideo && (
        <video 
          ref={videoRef}
          src={imageUrl}
          loop
          playsInline
          muted={isMuted}
          className="hidden"
        />
      )}

      {/* 3D Render Canvas Container */}
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
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

      {/* ── Sleek Playback Controller for 360 Video ── */}
      {isVideo && !isLoading && (
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-lg bg-black/60 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl backdrop-blur-md select-none transition-all duration-300"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline and duration */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs font-mono text-white/70 w-10 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 outline-none hover:bg-white/20 transition-all"
            />
            <span className="text-xs font-mono text-white/70 w-10">{formatTime(duration)}</span>
          </div>

          {/* Buttons row */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button 
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-teal-500 hover:bg-teal-400 transition-colors flex items-center justify-center text-black cursor-pointer shadow-lg active:scale-95"
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Mute/Unmute */}
              <button 
                onClick={toggleMute}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center text-white cursor-pointer active:scale-95"
              >
                {isMuted ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Status / File Indicator */}
            <div className="text-[10px] font-semibold uppercase tracking-widest text-teal-400/80 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              Video Mode
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
