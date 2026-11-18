'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PATH } from '../lib/assetTypes';

type TestModel = {
  id: string;
  name: string;
  glbUrl: string;
};

const TEST_MODELS: TestModel[] = [
  {
    id: 'metering-cabinet',
    name: 'Metering Cabinet',
    glbUrl: `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`,
  },
  {
    id: 'bike',
    name: 'Bike',
    glbUrl: `${BASE_PATH}/3Dassets/${encodeURIComponent('bike-3Di.glb')}`,
  },
];

const FLOOR_Y = -1.15;

export function MRTestViewer() {
  const [selectedModel, setSelectedModel] = useState<TestModel>(TEST_MODELS[0]);
  const [mrActive, setMrActive] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'rotate'>('move');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [hasAnimations, setHasAnimations] = useState(false);
  const [animPlaying, setAnimPlaying] = useState(false);

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

  // Mutable state accessed inside requestAnimationFrame & pointer handlers
  const stateRef = useRef({
    mrActive: false,
    isPlaced: false,
    dragMode: 'move' as 'move' | 'rotate',
    gyroEnabled: false,
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
    lastX: 0,
    lastY: 0,
    movedDuringTap: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartAngle: 0,
    pinchStartYaw: 0,
  });

  useEffect(() => {
    stateRef.current.mrActive = mrActive;
  }, [mrActive]);

  useEffect(() => {
    stateRef.current.isPlaced = isPlaced;
  }, [isPlaced]);

  useEffect(() => {
    stateRef.current.dragMode = dragMode;
  }, [dragMode]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

  // Helper to update material opacity for ghost scanning preview vs placed solid model
  const setModelGhostStyle = useCallback((ghost: boolean) => {
    const group = modelGroupRef.current;
    if (!group) return;
    group.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(mat => {
        if (ghost) {
          mat.transparent = true;
          mat.opacity = 0.62;
        } else {
          mat.opacity = 1;
        }
        mat.needsUpdate = true;
      });
    });
  }, []);

  // Start full-screen Mixed Reality (Rear Camera + Gyroscope + Scanning Mode)
  const startMixedReality = async () => {
    setCameraError(null);

    const DeviceOrientation = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;

    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientation.requestPermission();
        stateRef.current.gyroEnabled = perm === 'granted';
      } catch {
        stateRef.current.gyroEnabled = false;
      }
    } else {
      stateRef.current.gyroEnabled = true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not access rear camera.';
      setCameraError(message);
    }

    setIsPlaced(false);
    stateRef.current.isPlaced = false;
    setModelGhostStyle(true);
    setMrActive(true);
  };

  const confirmPlacement = useCallback(() => {
    setIsPlaced(true);
    stateRef.current.isPlaced = true;
    setModelGhostStyle(false);
  }, [setModelGhostStyle]);

  const enterRescanMode = () => {
    setIsPlaced(false);
    stateRef.current.isPlaced = false;
    setModelGhostStyle(true);
  };

  const toggleAnimation = () => {
    if (actionsRef.current.length === 0) return;
    const nextState = !animPlaying;
    actionsRef.current.forEach(action => {
      if (nextState) {
        action.paused = false;
        action.play();
      } else {
        action.paused = true;
      }
    });
    setAnimPlaying(nextState);
  };

  // Three.js Scene + Floor Raycasting + Gyroscope
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
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(4, 8, 5);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0x90b4ff, 0.9);
    dirLight2.position.set(-4, 2, -3);
    scene.add(dirLight2);

    // Power Apps MR Floor Reticle (outer ring + inner ring + center dot)
    const reticleGroup = new THREE.Group();
    const outerRingGeo = new THREE.RingGeometry(0.38, 0.43, 64);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    reticleGroup.add(new THREE.Mesh(outerRingGeo, outerRingMat));

    const innerRingGeo = new THREE.RingGeometry(0.18, 0.2, 48);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    reticleGroup.add(new THREE.Mesh(innerRingGeo, innerRingMat));

    const dotGeo = new THREE.CircleGeometry(0.05, 32);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
    });
    reticleGroup.add(new THREE.Mesh(dotGeo, dotMat));

    reticleGroup.position.copy(stateRef.current.currentPos);
    scene.add(reticleGroup);
    reticleGroupRef.current = reticleGroup;

    // Model Group (bottom-aligned to floor plane so it stands directly on the reticle)
    const modelGroup = new THREE.Group();
    modelGroup.position.copy(stateRef.current.currentPos);
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    queueMicrotask(() => {
      setModelLoading(true);
      setHasAnimations(false);
      setAnimPlaying(false);
    });

    const loader = new GLTFLoader();
    loader.load(
      selectedModel.glbUrl,
      gltf => {
        while (modelGroup.children.length > 0) {
          modelGroup.remove(modelGroup.children[0]);
        }

        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const normScale = 1.15 / maxDim;

        // Center X and Z, and place the bottom of the bounding box at Y = 0 (on the floor reticle)
        root.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
        root.scale.setScalar(normScale);
        modelGroup.add(root);

        stateRef.current.modelScale = 1;
        setModelGhostStyle(!stateRef.current.isPlaced && stateRef.current.mrActive);

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;
          actionsRef.current = gltf.animations.map(clip => {
            const action = mixer.clipAction(clip);
            action.play();
            return action;
          });
          setHasAnimations(true);
          setAnimPlaying(true);
        } else {
          mixerRef.current = null;
          actionsRef.current = [];
        }

        setModelLoading(false);
      },
      undefined,
      err => {
        console.error('Error loading GLB for MR test:', err);
        setModelLoading(false);
      }
    );

    // Raw DeviceOrientation listener (exact quaternion pipeline from 360 viewer)
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
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
          // Clamp radial distance to [0.8m, 7.5m] so object stays within reachable view
          const dist = Math.hypot(hit.x, hit.z);
          if (dist > 7.5) {
            const scale = 7.5 / dist;
            hit.x *= scale;
            hit.z *= scale;
          } else if (dist < 0.8) {
            const scale = 0.8 / Math.max(dist, 0.001);
            hit.x *= scale;
            hit.z *= scale;
          }
          out.set(hit.x, FLOOR_Y, hit.z);
          return true;
        }
      }

      // Fallback when pointing above horizon: project forward horizontally at current distance
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

    // Pointer & touch handlers
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      stateRef.current.isDragging = true;
      stateRef.current.pointerDownX = e.clientX;
      stateRef.current.pointerDownY = e.clientY;
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;
      stateRef.current.movedDuringTap = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!e.isPrimary || !stateRef.current.isDragging) return;
      const dx = e.clientX - stateRef.current.lastX;
      const dy = e.clientY - stateRef.current.lastY;
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;

      if (
        Math.hypot(
          e.clientX - stateRef.current.pointerDownX,
          e.clientY - stateRef.current.pointerDownY
        ) > 8
      ) {
        stateRef.current.movedDuringTap = true;
      }

      if (!stateRef.current.mrActive) {
        // Preview mode before starting MR: horizontal drag rotates Y only
        stateRef.current.modelYaw += dx * 0.01;
        return;
      }

      if (!stateRef.current.isPlaced) {
        // In scanning mode, dragging aims the floor target directly under the finger
        projectScreenPointToFloor(e.clientX, e.clientY, stateRef.current.targetPos);
        return;
      }

      // In placed mode: either slide across the floor plane OR rotate around vertical Y-axis
      if (stateRef.current.dragMode === 'rotate') {
        stateRef.current.modelYaw += dx * 0.012;
      } else {
        projectScreenPointToFloor(e.clientX, e.clientY, stateRef.current.targetPos);
        // Optional subtle depth adjustment when dragging vertically while looking level
        void dy;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasTap = !stateRef.current.movedDuringTap;
      stateRef.current.isDragging = false;

      // In Scanning Mode, tapping anywhere on the camera view places the object at that spot!
      if (stateRef.current.mrActive && !stateRef.current.isPlaced && wasTap) {
        projectScreenPointToFloor(e.clientX, e.clientY, stateRef.current.targetPos);
        stateRef.current.currentPos.copy(stateRef.current.targetPos);
        confirmPlacement();
      }
    };

    // 2-finger pinch (scale) & 2-finger twist (Y-axis rotation)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
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

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

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

      // 1. Update camera orientation from phone gyroscope (exact 360° viewer math)
      if (
        state.mrActive &&
        state.gyroEnabled &&
        state.alpha !== null &&
        state.beta !== null &&
        state.gamma !== null
      ) {
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

      // 2. While scanning (!isPlaced) and not dragging, raycast screen center onto the floor
      if (state.mrActive && !state.isPlaced && !state.isDragging) {
        const rect = container.getBoundingClientRect();
        projectScreenPointToFloor(
          rect.left + rect.width / 2,
          rect.top + rect.height * 0.56,
          state.targetPos
        );
        // Face the camera while scanning
        state.modelYaw = Math.atan2(-state.currentPos.x, -state.currentPos.z);
      }

      // 3. Smoothly interpolate floor position
      state.currentPos.lerp(state.targetPos, 0.22);

      if (modelGroupRef.current) {
        modelGroupRef.current.position.copy(state.currentPos);
        modelGroupRef.current.scale.setScalar(state.modelScale);
        // Keep model strictly upright on the floor (only Y-axis yaw rotation!)
        modelGroupRef.current.rotation.set(0, state.modelYaw, 0);
      }

      if (reticleGroupRef.current) {
        reticleGroupRef.current.position.set(
          state.currentPos.x,
          FLOOR_Y + 0.005,
          state.currentPos.z
        );
        reticleGroupRef.current.scale.setScalar(state.modelScale);
        // Show reticle while scanning or while dragging to move on the floor
        reticleGroupRef.current.visible =
          !state.mrActive || !state.isPlaced || (state.isDragging && state.dragMode === 'move');
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
      renderer.dispose();
    };
  }, [confirmPlacement, selectedModel, setModelGhostStyle]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-dvh bg-[#0d041a] text-white font-sans overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Full-Screen Rear Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          mrActive && !cameraError ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Full-Screen Transparent Three.js GLB Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10" />

      {/* Center Reticle Aim Prompt while Scanning */}
      {mrActive && !isPlaced && !modelLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-2 rounded-full bg-black/65 backdrop-blur-md border border-amber-400/40 text-amber-200 text-xs font-semibold text-center whitespace-nowrap shadow-lg">
          Move phone to scan floor • Tap anywhere to place
        </div>
      )}

      {mrActive && isPlaced && !modelLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white/85 text-xs font-medium text-center whitespace-nowrap shadow-lg">
          {dragMode === 'move'
            ? '1-finger drag: Slide on floor • 2-finger: Pinch / Twist'
            : '1-finger drag: Rotate • 2-finger: Pinch scale'}
        </div>
      )}

      {/* Top Floating Bar (Consistent Back Button + Model Switcher) */}
      <header
        className="absolute top-5 left-5 right-5 z-30 flex items-center justify-between gap-3 pointer-events-auto"
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

        <div className="flex items-center gap-1 bg-black/55 backdrop-blur-md p-1 rounded-full border border-white/15 shadow-lg">
          {TEST_MODELS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModel(m)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedModel.id === m.id
                  ? 'bg-amber-500 text-black'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              {m.id === 'metering-cabinet' ? 'Cabinet' : 'Bike'}
            </button>
          ))}
        </div>
      </header>

      {/* Loading Spinner */}
      {modelLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="w-11 h-11 rounded-full border-4 border-white/10 border-t-amber-400 animate-spin mb-3" />
          <p className="text-xs font-semibold text-white/85">Loading {selectedModel.name}...</p>
        </div>
      )}

      {/* Bottom Floating Mixed Reality Controls */}
      <div
        className="absolute bottom-7 left-4 right-4 z-30 flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto"
        onPointerDown={e => e.stopPropagation()}
      >
        {!mrActive ? (
          <button
            type="button"
            onClick={startMixedReality}
            className="px-7 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-2xl flex items-center gap-2.5 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Start Mixed Reality Camera
          </button>
        ) : !isPlaced ? (
          <button
            type="button"
            onClick={confirmPlacement}
            className="px-8 py-4 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-2xl flex items-center gap-2 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-black animate-ping" />
            Place Here
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={enterRescanMode}
              className="px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-lg cursor-pointer"
            >
              Re-Scan / Move Spot
            </button>

            <button
              type="button"
              onClick={() => setDragMode(d => (d === 'move' ? 'rotate' : 'move'))}
              className="px-4 py-2.5 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 text-white font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
            >
              {dragMode === 'move' ? 'Mode: Slide on Floor' : 'Mode: Rotate Y'}
            </button>

            {hasAnimations && (
              <button
                type="button"
                onClick={toggleAnimation}
                className="px-4 py-2.5 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 text-white font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
              >
                {animPlaying ? 'Pause Anim' : 'Play Anim'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stateRef.current.modelScale = 1;
              }}
              className="px-3.5 py-2.5 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 text-white/85 font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
            >
              1x Scale
            </button>
          </>
        )}
      </div>
    </div>
  );
}
