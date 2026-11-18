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
  usdzUrl: string;
};

const TEST_MODELS: TestModel[] = [
  {
    id: 'metering-cabinet',
    name: 'Metering Cabinet (GLB)',
    glbUrl: `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`,
    usdzUrl: `${BASE_PATH}/ARassets/${encodeURIComponent('Metering Cabinet-ARs.usdz')}`,
  },
  {
    id: 'bike',
    name: 'Bike (GLB)',
    glbUrl: `${BASE_PATH}/3Dassets/${encodeURIComponent('bike-3Di.glb')}`,
    usdzUrl: `${BASE_PATH}/ARassets/${encodeURIComponent('Buster_Drone-ARs.usdz')}`,
  },
];

export function MRTestViewer() {
  const [selectedModel, setSelectedModel] = useState<TestModel>(TEST_MODELS[0]);
  const [mrActive, setMrActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [webXRSupported, setWebXRSupported] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('Ready to start Mixed Reality.');
  const [hasAnimations, setHasAnimations] = useState(false);
  const [animPlaying, setAnimPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scene and interaction refs
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<THREE.AnimationAction[]>([]);

  const interactionRef = useRef({
    gyroEnabled: false,
    alpha: null as number | null,
    beta: null as number | null,
    gamma: null as number | null,
    initialAlpha: null as number | null,
    modelYaw: 0,
    modelPitch: 0,
    modelScale: 1,
    modelDistance: 2.2,
    modelYOffset: -0.45,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    pinchStartDist: 0,
    pinchStartScale: 1,
  });

  // Check native WebXR immersive-ar support
  useEffect(() => {
    const nav = navigator as Navigator & {
      xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
    };
    if (nav.xr && typeof nav.xr.isSessionSupported === 'function') {
      nav.xr
        .isSessionSupported('immersive-ar')
        .then(supported => setWebXRSupported(supported))
        .catch(() => setWebXRSupported(false));
    } else {
      queueMicrotask(() => setWebXRSupported(false));
    }
  }, []);

  // Load Google <model-viewer> script once for testing its WebXR / Quick Look bridge
  useEffect(() => {
    if (document.querySelector('script[data-model-viewer]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
    script.setAttribute('data-model-viewer', 'true');
    document.head.appendChild(script);
  }, []);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start rear camera + iOS gyroscope for browser-native Mixed Reality (Power Apps MR style)
  const startMixedReality = async () => {
    setCameraError(null);
    setStatusMsg('Requesting camera & motion sensors...');

    // 1. Request iOS 13+ DeviceOrientation permission inside user tap gesture
    const DeviceOrientation = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;

    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientation.requestPermission();
        interactionRef.current.gyroEnabled = perm === 'granted';
      } catch {
        interactionRef.current.gyroEnabled = false;
      }
    } else {
      interactionRef.current.gyroEnabled = true;
    }

    // 2. Request Rear Camera stream via WebRTC (stays inside Edge, never blocked by Intune MAM)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      interactionRef.current.initialAlpha = null;
      setMrActive(true);
      setStatusMsg('Mixed Reality active — drag to rotate, pinch to scale, or tap Place Here.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not access rear camera.';
      setCameraError(message);
      setStatusMsg('Camera access failed — rendering in 3D preview mode.');
      setMrActive(true);
    }
  };

  const exitMixedReality = () => {
    stopCameraStream();
    setMrActive(false);
    setStatusMsg('Exited Mixed Reality.');
  };

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

  // Place / Re-center model in front of current camera gaze
  const placeInFrontOfCamera = () => {
    const camera = cameraRef.current;
    const modelGroup = modelGroupRef.current;
    if (!camera || !modelGroup) return;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    const dist = interactionRef.current.modelDistance;
    modelGroup.position.set(
      forward.x * dist,
      interactionRef.current.modelYOffset,
      forward.z * dist
    );
    modelGroup.lookAt(0, interactionRef.current.modelYOffset, 0);
    interactionRef.current.modelYaw = modelGroup.rotation.y;
    setStatusMsg('Model anchored in front of camera.');
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

  // Launch Native WebXR session if browser supports immersive-ar
  const launchNativeWebXR = async () => {
    const nav = navigator as Navigator & {
      xr?: { requestSession?: (mode: string, opts?: object) => Promise<XRSession> };
    };
    if (!nav.xr?.requestSession || !rendererRef.current) {
      setStatusMsg('Native WebXR immersive-ar is not enabled in this browser. Use Edge MR Camera mode above.');
      return;
    }
    try {
      const session = await nav.xr.requestSession('immersive-ar', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hit-test'],
      });
      rendererRef.current.xr.enabled = true;
      await rendererRef.current.xr.setSession(session);
      setStatusMsg('Native WebXR session started.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebXR launch failed';
      setStatusMsg(`WebXR error: ${msg}`);
    }
  };

  // Three.js Scene + GLB Loader + Gyroscope & Touch Controls
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.05, 100);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Lighting matching Power Apps MR studio light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(3, 6, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b4ff, 0.8);
    dirLight2.position.set(-4, -2, -3);
    scene.add(dirLight2);

    // Power Apps MR style floor placement ring / reticle
    const ringGeo = new THREE.RingGeometry(0.32, 0.38, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.position.set(0, interactionRef.current.modelYOffset - 0.55, -interactionRef.current.modelDistance);
    scene.add(reticle);
    reticleRef.current = reticle;

    const modelGroup = new THREE.Group();
    modelGroup.position.set(0, interactionRef.current.modelYOffset, -interactionRef.current.modelDistance);
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Load selected GLB
    queueMicrotask(() => {
      setModelLoading(true);
      setHasAnimations(false);
      setAnimPlaying(false);
    });

    const loader = new GLTFLoader();
    loader.load(
      selectedModel.glbUrl,
      gltf => {
        // Clear previous children
        while (modelGroup.children.length > 0) {
          modelGroup.remove(modelGroup.children[0]);
        }

        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const normScale = 1.25 / maxDim;

        root.position.sub(center);
        root.scale.setScalar(normScale);
        modelGroup.add(root);

        interactionRef.current.modelScale = 1;
        interactionRef.current.modelYaw = 0;
        interactionRef.current.modelPitch = 0;

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
        setStatusMsg('Failed to load GLB model.');
      }
    );

    // Device orientation listener
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      if (interactionRef.current.initialAlpha === null) {
        interactionRef.current.initialAlpha = e.alpha;
      }
      interactionRef.current.alpha = e.alpha - (interactionRef.current.initialAlpha ?? 0);
      interactionRef.current.beta = e.beta;
      interactionRef.current.gamma = e.gamma;
    };
    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    // Touch & pointer gestures (1-finger rotate, 2-finger pinch scale)
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      interactionRef.current.isDragging = true;
      interactionRef.current.lastX = e.clientX;
      interactionRef.current.lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!e.isPrimary || !interactionRef.current.isDragging) return;
      const dx = e.clientX - interactionRef.current.lastX;
      const dy = e.clientY - interactionRef.current.lastY;
      interactionRef.current.lastX = e.clientX;
      interactionRef.current.lastY = e.clientY;

      interactionRef.current.modelYaw += dx * 0.01;
      interactionRef.current.modelPitch = THREE.MathUtils.clamp(
        interactionRef.current.modelPitch + dy * 0.006,
        -0.6,
        0.6
      );
    };

    const onPointerUp = () => {
      interactionRef.current.isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        interactionRef.current.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        interactionRef.current.pinchStartDist = Math.hypot(dx, dy);
        interactionRef.current.pinchStartScale = interactionRef.current.modelScale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && interactionRef.current.pinchStartDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / interactionRef.current.pinchStartDist;
        interactionRef.current.modelScale = THREE.MathUtils.clamp(
          interactionRef.current.pinchStartScale * factor,
          0.3,
          3.5
        );
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

      const state = interactionRef.current;
      if (
        state.gyroEnabled &&
        state.alpha !== null &&
        state.beta !== null &&
        state.gamma !== null
      ) {
        const alphaRad = THREE.MathUtils.degToRad(state.alpha);
        const betaRad = THREE.MathUtils.degToRad(state.beta);
        const gammaRad = THREE.MathUtils.degToRad(state.gamma);

        const deviceEuler = new THREE.Euler(betaRad, alphaRad, -gammaRad, 'YXZ');
        const deviceQuat = new THREE.Quaternion().setFromEuler(deviceEuler);

        const win = window as Window & { orientation?: number };
        const screenAngle =
          typeof win.orientation === 'number'
            ? win.orientation
            : win.screen?.orientation?.angle || 0;
        const screenQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          -THREE.MathUtils.degToRad(screenAngle)
        );

        camera.quaternion.copy(deviceQuat).multiply(worldAlignment).multiply(screenQuat);
      }

      if (modelGroupRef.current) {
        modelGroupRef.current.scale.setScalar(state.modelScale);
        modelGroupRef.current.rotation.y = state.modelYaw;
        modelGroupRef.current.rotation.x = state.modelPitch;
      }

      if (reticleRef.current && modelGroupRef.current) {
        reticleRef.current.position.x = modelGroupRef.current.position.x;
        reticleRef.current.position.z = modelGroupRef.current.position.z;
        reticleRef.current.scale.setScalar(state.modelScale);
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
  }, [selectedModel]);

  return (
    <div className="app-page min-h-dvh text-white font-sans flex flex-col">
      {/* Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 border-b border-white/10 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/ARs"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/85 hover:text-white text-xs font-medium transition-colors shrink-0"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Static AR
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
              Microsoft Edge / Power Apps MR Test
            </p>
            <h1 className="text-base md:text-lg font-bold text-white truncate">
              Mixed Reality GLB Viewer
            </h1>
          </div>
        </div>

        {/* Model Switcher */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/10">
          {TEST_MODELS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedModel(m)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                selectedModel.id === m.id
                  ? 'bg-amber-500 text-black'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {m.id === 'metering-cabinet' ? 'Cabinet' : 'Bike'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Mixed Reality Viewport */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 max-w-7xl w-full mx-auto p-4 min-h-0">
        {/* Live Camera + 3D GLB Overlay Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[62dvh] rounded-3xl overflow-hidden border border-white/15 bg-[#120924] shadow-2xl select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Rear Camera Feed (WebRTC - works inside Intune-managed Edge) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              mrActive && !cameraError ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Transparent Three.js GLB Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-10" />

          {/* Loading Spinner */}
          {modelLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-amber-400 animate-spin mb-3" />
              <p className="text-xs font-semibold text-white/80">Loading {selectedModel.name}...</p>
            </div>
          )}

          {/* Top Status Pill */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white/90 truncate">
              {statusMsg}
            </span>
          </div>

          {/* Bottom Mixed Reality Controls */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-center gap-2.5">
            {!mrActive ? (
              <button
                type="button"
                onClick={startMixedReality}
                className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-xl flex items-center gap-2 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                View in Mixed Reality (Camera AR)
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={placeInFrontOfCamera}
                  className="px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs shadow-lg cursor-pointer"
                >
                  Place Here
                </button>
                {hasAnimations && (
                  <button
                    type="button"
                    onClick={toggleAnimation}
                    className="px-4 py-2.5 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 text-white font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
                  >
                    {animPlaying ? 'Pause Animation' : 'Play Animation'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    interactionRef.current.modelScale = 1;
                    interactionRef.current.modelYaw = 0;
                    interactionRef.current.modelPitch = 0;
                  }}
                  className="px-4 py-2.5 rounded-full bg-black/65 hover:bg-black/80 border border-white/20 text-white font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
                >
                  Reset Size
                </button>
                <button
                  type="button"
                  onClick={exitMixedReality}
                  className="px-4 py-2.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white font-semibold text-xs shadow-lg backdrop-blur-md cursor-pointer"
                >
                  Exit MR
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right / Bottom Test Panel for Other Microsoft / WebXR Modes */}
        <aside className="w-full lg:w-80 rounded-3xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">
              Additional MR / AR Mode Tests
            </h2>
            <p className="text-xs text-white/60">
              Test which AR pipelines your managed iPhone allows inside Microsoft Edge:
            </p>
          </div>

          {/* 1. Native WebXR immersive-ar test */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-white">1. Native WebXR (immersive-ar)</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                webXRSupported ? 'bg-teal-500/20 text-teal-300' : 'bg-white/10 text-white/50'
              }`}>
                {webXRSupported === null ? 'Checking...' : webXRSupported ? 'Supported' : 'Not detected'}
              </span>
            </div>
            <button
              type="button"
              onClick={launchNativeWebXR}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Test WebXR Session
            </button>
          </div>

          {/* 2. <model-viewer> GLB/USDZ AR bridge */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-xs font-semibold text-white mb-1">
              2. Model-Viewer AR Bridge (GLB + USDZ)
            </p>
            <p className="text-[11px] text-white/55 mb-2">
              Tap the cube icon inside the box below to test Model-Viewer&apos;s built-in AR launcher:
            </p>
            <div
              className="w-full h-40 rounded-xl overflow-hidden bg-black/40 border border-white/10"
              dangerouslySetInnerHTML={{
                __html: `<model-viewer src="${selectedModel.glbUrl}" ios-src="${selectedModel.usdzUrl}" ar ar-modes="webxr scene-viewer quick-look" camera-controls style="width:100%;height:100%;background-color:transparent;"></model-viewer>`,
              }}
            />
          </div>

          {/* 3. Microsoft Power Apps ms-apps:// protocol test */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-xs font-semibold text-white mb-1">
              3. Power Apps Managed App Handoff
            </p>
            <p className="text-[11px] text-white/55 mb-2">
              Tests if Intune allows Edge to open the managed Power Apps mobile app (`ms-apps://`):
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = 'ms-apps://';
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/35 text-xs font-semibold text-indigo-200 transition-colors cursor-pointer"
            >
              Test Open Power Apps (ms-apps://)
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
