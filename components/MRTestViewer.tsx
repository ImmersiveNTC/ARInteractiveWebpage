'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PATH } from '../lib/assetTypes';

const CABINET_GLB_URL = `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`;
const FLOOR_Y = -1.15;

export function MRTestViewer() {
  const [isPlaced, setIsPlaced] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [hasAnimations, setHasAnimations] = useState(false);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [needsMotionTap, setNeedsMotionTap] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Three.js scene refs
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const reticleGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<THREE.AnimationAction[]>([]);

  // Mutable interaction state accessed inside requestAnimationFrame & touch handlers
  const stateRef = useRef({
    isPlaced: false,
    gyroReceived: false,
    alpha: null as number | null,
    beta: null as number | null,
    gamma: null as number | null,
    targetPos: new THREE.Vector3(0, FLOOR_Y, -2.2),
    currentPos: new THREE.Vector3(0, FLOOR_Y, -2.2),
    modelYaw: 0,
    modelScale: 1,
    isDragging: false,
    pointerDownX: 0,
    pointerDownY: 0,
    movedDuringTap: false,
    twoFingerActive: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartAngle: 0,
    pinchStartYaw: 0,
  });

  useEffect(() => {
    stateRef.current.isPlaced = isPlaced;
  }, [isPlaced]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Auto-start rear camera on mount
  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.warn('Rear camera access error:', err);
      }
    };

    initCamera();

    // Check if iOS requires a tap for DeviceOrientation permission (when page is opened directly)
    const timer = window.setTimeout(() => {
      if (cancelled || stateRef.current.gyroReceived) return;
      const DeviceOrientation = (
        window as unknown as {
          DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
        }
      ).DeviceOrientationEvent;
      if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
        setNeedsMotionTap(true);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const requestMotionOnTap = async () => {
    const DeviceOrientation = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
      try {
        await DeviceOrientation.requestPermission();
      } catch {
        // Ignore if denied
      }
    }
    setNeedsMotionTap(false);
  };

  // Toggle Play / Pause animation
  const toggleAnimation = () => {
    if (actionsRef.current.length === 0) return;
    const nextState = !animPlaying;
    actionsRef.current.forEach(action => {
      action.paused = !nextState;
      if (nextState && !action.isRunning()) {
        action.play();
      }
    });
    setAnimPlaying(nextState);
  };

  // Three.js Scene + Reticle Pointer + Floor Placement & Gesture Controls
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.05, 100);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Studio lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.55));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.1);
    dirLight1.position.set(4, 8, 5);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0x90b4ff, 0.9);
    dirLight2.position.set(-4, 2, -3);
    scene.add(dirLight2);

    // Apple Quick Look / MR style floor circle pointer
    const reticleGroup = new THREE.Group();
    const outerRingGeo = new THREE.RingGeometry(0.32, 0.36, 64);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    reticleGroup.add(new THREE.Mesh(outerRingGeo, outerRingMat));

    const innerFillGeo = new THREE.CircleGeometry(0.31, 64);
    innerFillGeo.rotateX(-Math.PI / 2);
    const innerFillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.16,
    });
    reticleGroup.add(new THREE.Mesh(innerFillGeo, innerFillMat));

    const dotGeo = new THREE.CircleGeometry(0.045, 32);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    reticleGroup.add(new THREE.Mesh(dotGeo, dotMat));

    reticleGroup.position.copy(stateRef.current.currentPos);
    scene.add(reticleGroup);
    reticleGroupRef.current = reticleGroup;

    // Model Group (hidden until user taps screen to place on the circle pointer)
    const modelGroup = new THREE.Group();
    modelGroup.position.copy(stateRef.current.currentPos);
    modelGroup.visible = false;
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Load Metering Cabinet GLB paused at frame 0
    const loader = new GLTFLoader();
    loader.load(
      CABINET_GLB_URL,
      gltf => {
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const normScale = 1.15 / maxDim;

        // Bottom-align model to stand on the floor circle pointer
        root.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
        root.scale.setScalar(normScale);
        modelGroup.add(root);

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;
          actionsRef.current = gltf.animations.map(clip => {
            const action = mixer.clipAction(clip);
            action.reset();
            action.play();
            action.paused = true;
            return action;
          });
          // Evaluate first frame (t = 0) while paused
          mixer.update(0);
          setHasAnimations(true);
          setAnimPlaying(false);
        }

        setModelLoading(false);
      },
      undefined,
      err => {
        console.error('Error loading Metering Cabinet GLB:', err);
        setModelLoading(false);
      }
    );

    // Gyroscope orientation listener
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      stateRef.current.gyroReceived = true;
      stateRef.current.alpha = e.alpha;
      stateRef.current.beta = e.beta;
      stateRef.current.gamma = e.gamma;
    };
    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    // Raycast helper onto horizontal floor plane (Y = FLOOR_Y)
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
    const hitVec = new THREE.Vector3();

    const projectScreenPointToFloor = (clientX: number, clientY: number, out: THREE.Vector3): boolean => {
      const rect = container.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const dir = raycaster.ray.direction;
      if (dir.y < -0.04) {
        const hit = raycaster.ray.intersectPlane(floorPlane, hitVec);
        if (hit) {
          const dist = Math.hypot(hit.x, hit.z);
          if (dist > 7.5) {
            const s = 7.5 / dist;
            hit.x *= s;
            hit.z *= s;
          } else if (dist < 0.75) {
            const s = 0.75 / Math.max(dist, 0.001);
            hit.x *= s;
            hit.z *= s;
          }
          out.set(hit.x, FLOOR_Y, hit.z);
          return true;
        }
      }

      const currentDist = Math.hypot(
        stateRef.current.currentPos.x,
        stateRef.current.currentPos.z
      );
      const d = THREE.MathUtils.clamp(currentDist || 2.2, 1.2, 4.5);
      const horiz = new THREE.Vector3(dir.x, 0, dir.z);
      if (horiz.lengthSq() > 0.0001) {
        horiz.normalize();
        out.set(horiz.x * d, FLOOR_Y, horiz.z * d);
        return true;
      }
      return false;
    };

    // 1-finger touch: tap to place when scanning; slide on floor once placed
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || stateRef.current.twoFingerActive) return;
      stateRef.current.isDragging = true;
      stateRef.current.pointerDownX = e.clientX;
      stateRef.current.pointerDownY = e.clientY;
      stateRef.current.movedDuringTap = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!e.isPrimary || !stateRef.current.isDragging || stateRef.current.twoFingerActive) return;
      if (
        Math.hypot(
          e.clientX - stateRef.current.pointerDownX,
          e.clientY - stateRef.current.pointerDownY
        ) > 8
      ) {
        stateRef.current.movedDuringTap = true;
      }

      if (stateRef.current.isPlaced) {
        // 1-finger drag slides the placed model along the floor
        projectScreenPointToFloor(e.clientX, e.clientY, stateRef.current.targetPos);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasTap = !stateRef.current.movedDuringTap && !stateRef.current.twoFingerActive;
      stateRef.current.isDragging = false;

      // Tap anywhere on screen while scanning places the model at the circle pointer
      if (!stateRef.current.isPlaced && wasTap) {
        stateRef.current.currentPos.copy(stateRef.current.targetPos);
        stateRef.current.modelYaw = Math.atan2(
          -stateRef.current.currentPos.x,
          -stateRef.current.currentPos.z
        );
        stateRef.current.isPlaced = true;
        if (modelGroupRef.current) {
          modelGroupRef.current.visible = true;
        }
        setIsPlaced(true);
      }
    };

    // 2-finger pinch (scale) & 2-finger twist (rotate around Y-axis)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        stateRef.current.twoFingerActive = true;
        stateRef.current.isDragging = false;
        stateRef.current.movedDuringTap = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        stateRef.current.pinchStartDist = Math.hypot(dx, dy);
        stateRef.current.pinchStartScale = stateRef.current.modelScale;
        stateRef.current.pinchStartAngle = Math.atan2(dy, dx);
        stateRef.current.pinchStartYaw = stateRef.current.modelYaw;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && stateRef.current.pinchStartDist > 0) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / stateRef.current.pinchStartDist;
        stateRef.current.modelScale = THREE.MathUtils.clamp(
          stateRef.current.pinchStartScale * factor,
          0.25,
          3.5
        );

        const angle = Math.atan2(dy, dx);
        const deltaAngle = angle - stateRef.current.pinchStartAngle;
        stateRef.current.modelYaw = stateRef.current.pinchStartYaw - deltaAngle;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        stateRef.current.twoFingerActive = false;
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    const worldAlignment = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );

    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      const state = stateRef.current;

      // 1. Update camera orientation from phone gyroscope
      if (state.alpha !== null && state.beta !== null && state.gamma !== null) {
        const alphaRad = THREE.MathUtils.degToRad(state.alpha);
        const betaRad = THREE.MathUtils.degToRad(state.beta);
        const gammaRad = THREE.MathUtils.degToRad(state.gamma);

        const deviceEuler = new THREE.Euler(betaRad, alphaRad, -gammaRad, 'YXZ');
        const deviceQuaternion = new THREE.Quaternion().setFromEuler(deviceEuler);

        const win = window as Window & { orientation?: number };
        const screenAngle =
          typeof win.orientation === 'number'
            ? win.orientation
            : win.screen?.orientation?.angle || 0;
        const screenQuaternion = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -THREE.MathUtils.degToRad(screenAngle)
        );

        camera.quaternion
          .copy(deviceQuaternion)
          .multiply(worldAlignment)
          .multiply(screenQuaternion);
      }

      // 2. While scanning (!isPlaced), project the screen center onto the floor for the circle pointer
      if (!state.isPlaced) {
        const rect = container.getBoundingClientRect();
        projectScreenPointToFloor(
          rect.left + rect.width / 2,
          rect.top + rect.height * 0.56,
          state.targetPos
        );
      }

      // 3. Smoothly interpolate floor position
      state.currentPos.lerp(state.targetPos, 0.25);

      if (modelGroupRef.current) {
        modelGroupRef.current.visible = state.isPlaced;
        modelGroupRef.current.position.copy(state.currentPos);
        modelGroupRef.current.scale.setScalar(state.modelScale);
        modelGroupRef.current.rotation.set(0, state.modelYaw, 0);
      }

      if (reticleGroupRef.current) {
        reticleGroupRef.current.position.set(
          state.currentPos.x,
          FLOOR_Y + 0.005,
          state.currentPos.z
        );
        // Show the circle pointer before placement, and subtly while sliding the object on the floor
        reticleGroupRef.current.visible = !state.isPlaced || state.isDragging;
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      window.removeEventListener('deviceorientation', onDeviceOrientation, true);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-dvh bg-black text-white font-sans overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Full-Screen Rear Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Full-Screen Transparent Three.js GLB Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10" />

      {/* Top-Left Back Button */}
      <header
        className="absolute top-5 left-5 z-30 pointer-events-auto"
        onPointerDown={e => e.stopPropagation()}
      >
        <Link
          href="/ARs"
          onClick={stopCameraStream}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/85 hover:text-white text-xs font-medium transition-colors shrink-0 backdrop-blur-md shadow-lg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Static AR
        </Link>
      </header>

      {/* Subtle Placement Prompt while Scanning */}
      {!isPlaced && !modelLoading && !needsMotionTap && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white/90 text-xs font-medium text-center whitespace-nowrap shadow-lg">
          Aim circle at floor • Tap screen to place
        </div>
      )}

      {/* One-time iOS Motion Permission Overlay (only if page was loaded directly without prior tap gesture) */}
      {needsMotionTap && (
        <div
          onClick={requestMotionOnTap}
          onPointerDown={e => e.stopPropagation()}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-xs cursor-pointer"
        >
          <div className="px-6 py-3.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-md text-white text-sm font-semibold shadow-2xl">
            Tap anywhere to start AR tracking
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {modelLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
          <div className="w-10 h-10 rounded-full border-4 border-white/15 border-t-white animate-spin" />
        </div>
      )}

      {/* Bottom-Left Icon-Only Play / Pause Button */}
      {isPlaced && hasAnimations && !modelLoading && (
        <button
          type="button"
          onClick={toggleAnimation}
          onPointerDown={e => e.stopPropagation()}
          aria-label={animPlaying ? 'Pause animation' : 'Play animation'}
          className="absolute bottom-7 left-6 z-30 w-12 h-12 rounded-full bg-black/55 hover:bg-black/75 border border-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-2xl active:scale-95 transition-all cursor-pointer"
        >
          {animPlaying ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="translate-x-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
