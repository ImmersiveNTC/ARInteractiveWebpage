'use client';

/*
 * This product includes the XR Engine software developed by Niantic Spatial, Inc.
 * Copyright © Niantic Spatial, Inc. All rights reserved.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PATH } from '../lib/assetTypes';

const CABINET_GLB_URL = `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`;

type XR8HitTestType = 'FEATURE_POINT' | 'ESTIMATED_SURFACE' | 'DETECTED_SURFACE' | 'UNSPECIFIED';

type XR8HitTestResult = {
  type: XR8HitTestType;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  distance: number;
};

type XR8ThreeScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cameraTexture: THREE.Texture;
};

type XR8PipelineModule = {
  name: string;
  onStart?: (args: { canvas: HTMLCanvasElement; canvasWidth: number; canvasHeight: number }) => void;
  onAttach?: (args: { canvas: HTMLCanvasElement; orientation?: number }) => void;
  onDetach?: () => void;
  onCanvasSizeChange?: (args: { canvas: HTMLCanvasElement; canvasWidth: number; canvasHeight: number }) => void;
  onDeviceOrientationChange?: (args: { orientation: number }) => void;
  onUpdate?: (args: { processCpuResult?: { reality?: { trackingStatus?: string; trackingReason?: string } } }) => void;
  onCameraStatusChange?: (args: { status: string; reason?: string }) => void;
  onException?: (error: unknown) => void;
};

type XR8Global = {
  loadChunk: (chunk: string) => Promise<void>;
  addCameraPipelineModules: (modules: XR8PipelineModule[]) => void;
  clearCameraPipelineModules: () => void;
  run: (config: {
    canvas: HTMLCanvasElement;
    allowedDevices?: string;
    cameraConfig?: { direction?: string };
    webgl2?: boolean;
  }) => void;
  stop: () => void;
  XrConfig: {
    device: () => { ANY: string; MOBILE: string; MOBILE_AND_HEADSETS: string };
    camera: () => { BACK: string; FRONT: string; ANY: string };
  };
  GlTextureRenderer: {
    pipelineModule: () => XR8PipelineModule;
  };
  Threejs: {
    pipelineModule: () => XR8PipelineModule;
    xrScene: () => XR8ThreeScene;
  };
  XrController: {
    pipelineModule: () => XR8PipelineModule;
    configure: (opts: {
      scale?: 'responsive' | 'absolute';
      disableWorldTracking?: boolean;
      enableLighting?: boolean;
    }) => void;
    updateCameraProjectionMatrix: (opts: {
      origin?: { x: number; y: number; z: number };
      facing?: { x: number; y: number; z: number; w: number };
    }) => void;
    hitTest: (x: number, y: number, includedTypes?: XR8HitTestType[]) => XR8HitTestResult[];
    recenter: () => void;
  };
};

type XR8Window = Window & {
  THREE?: typeof THREE;
  XR8?: XR8Global;
};

/** Loads the self-hosted 8th Wall SLAM engine (public/xr/xr.js + xr-slam.js) once. */
function loadXR8Engine(): Promise<XR8Global> {
  const win = window as XR8Window;
  // 8th Wall's Threejs pipeline module requires window.THREE to be assigned before initialization.
  win.THREE = THREE;

  if (win.XR8) {
    const existing = win.XR8;
    if (existing.XrController) return Promise.resolve(existing);
    return existing.loadChunk('slam').then(() => existing);
  }

  return new Promise<XR8Global>((resolve, reject) => {
    let settled = false;

    const finish = async () => {
      if (settled || !win.XR8) return;
      settled = true;
      window.removeEventListener('xrloaded', onXrLoaded);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      try {
        if (!win.XR8.XrController) {
          await win.XR8.loadChunk('slam');
        }
        resolve(win.XR8);
      } catch (err) {
        reject(err);
      }
    };

    const onXrLoaded = () => {
      void finish();
    };

    window.addEventListener('xrloaded', onXrLoaded);

    const pollId = window.setInterval(() => {
      if (win.XR8) void finish();
    }, 100);

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('xrloaded', onXrLoaded);
      window.clearInterval(pollId);
      reject(new Error('Timed out loading 8th Wall SLAM engine.'));
    }, 20000);

    let script = document.querySelector<HTMLScriptElement>('script[data-xr8-engine="true"]');
    if (!script) {
      script = document.createElement('script');
      script.src = `${BASE_PATH}/xr/xr.js`;
      script.async = true;
      script.setAttribute('data-preload-chunks', 'slam');
      script.setAttribute('data-xr8-engine', 'true');
      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener('xrloaded', onXrLoaded);
        window.clearInterval(pollId);
        window.clearTimeout(timeoutId);
        reject(new Error('Failed to load AR SLAM script.'));
      };
      document.head.appendChild(script);
    }
  });
}

export function MRTestViewer() {
  const [isPlaced, setIsPlaced] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [hasAnimations, setHasAnimations] = useState(false);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<THREE.AnimationAction[]>([]);

  // Mutable AR interaction state read inside 8th Wall's onUpdate loop
  const stateRef = useRef({
    isPlaced: false,
    baseSurfaceY: 0,
    heightOffset: 0,
    targetHeightOffset: 0,
    targetPos: new THREE.Vector3(0, 0, -2.0),
    currentPos: new THREE.Vector3(0, 0, -2.0),
    modelYaw: 0,
    modelScale: 1,
    hasValidHit: false,
    // Touch gesture states
    isDragging: false,
    multiTouchLock: false,
    pointerDownX: 0,
    pointerDownY: 0,
    movedDuringTap: false,
    twoFingerActive: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartAngle: 0,
    pinchStartYaw: 0,
    threeFingerActive: false,
    threeFingerStartY: 0,
    threeFingerStartHeight: 0,
  });

  const stopXR8 = useCallback(() => {
    const win = window as XR8Window;
    if (win.XR8) {
      try {
        win.XR8.stop();
        win.XR8.clearCameraPipelineModules();
      } catch {
        // Ignore cleanup errors if XR8 had not fully started
      }
    }
  }, []);

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

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let disposed = false;
    let resizeHandler: (() => void) | null = null;
    let sceneCamera: THREE.PerspectiveCamera | null = null;
    let xr8Instance: XR8Global | null = null;

    // Reset state for clean mount / retry
    const st = stateRef.current;
    st.isPlaced = false;
    st.baseSurfaceY = 0;
    st.heightOffset = 0;
    st.targetHeightOffset = 0;
    st.targetPos.set(0, 0, -2.0);
    st.currentPos.set(0, 0, -2.0);
    st.modelYaw = 0;
    st.modelScale = 1;
    st.hasValidHit = false;
    st.isDragging = false;
    st.multiTouchLock = false;
    st.twoFingerActive = false;
    st.threeFingerActive = false;
    mixerRef.current = null;
    actionsRef.current = [];

    queueMicrotask(() => {
      setIsPlaced(false);
      setEngineReady(false);
      setModelLoading(true);
      setHasAnimations(false);
      setAnimPlaying(false);
      setErrorMessage(null);
    });

    // Raycast + 8th Wall SLAM Hit-Test helper
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitVec = new THREE.Vector3();

    const findWorldPoint = (
      clientX: number,
      clientY: number,
      useSlamHitTest: boolean,
      out: THREE.Vector3
    ): boolean => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      const normX = THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0, 1);
      const normY = THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0, 1);

      // 1. Prefer real 8th Wall SLAM surface hit-test while scanning for placement
      if (useSlamHitTest && xr8Instance?.XrController) {
        try {
          const hits = xr8Instance.XrController.hitTest(normX, normY, [
            'DETECTED_SURFACE',
            'ESTIMATED_SURFACE',
          ]);
          if (hits && hits.length > 0) {
            const best = hits[0];
            out.set(best.position.x, best.position.y, best.position.z);
            return true;
          }
        } catch {
          // Fall back to camera raycast onto the SLAM ground plane
        }
      }

      // 2. Raycast SLAM-tracked camera onto active horizontal surface plane
      if (!sceneCamera) return false;
      const planeY = stateRef.current.baseSurfaceY + stateRef.current.heightOffset;
      groundPlane.constant = -planeY;

      const ndcX = normX * 2 - 1;
      const ndcY = -normY * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), sceneCamera);

      const camX = sceneCamera.position.x;
      const camZ = sceneCamera.position.z;
      const dir = raycaster.ray.direction;

      if (dir.y < -0.04) {
        const hit = raycaster.ray.intersectPlane(groundPlane, hitVec);
        if (hit) {
          let relX = hit.x - camX;
          let relZ = hit.z - camZ;
          const dist = Math.hypot(relX, relZ);
          if (dist > 9.0) {
            const s = 9.0 / dist;
            relX *= s;
            relZ *= s;
          } else if (dist < 0.5) {
            const s = 0.5 / Math.max(dist, 0.001);
            relX *= s;
            relZ *= s;
          }
          out.set(camX + relX, planeY, camZ + relZ);
          return true;
        }
      }

      // Fallback when camera is tilted above horizon
      const currentDist = Math.hypot(
        stateRef.current.currentPos.x - camX,
        stateRef.current.currentPos.z - camZ
      );
      const d = THREE.MathUtils.clamp(currentDist || 2.0, 1.0, 4.5);
      const horiz = new THREE.Vector3(dir.x, 0, dir.z);
      if (horiz.lengthSq() > 0.0001) {
        horiz.normalize();
        out.set(camX + horiz.x * d, planeY, camZ + horiz.z * d);
        return true;
      }
      return false;
    };

    // 1-finger touch: tap anywhere to place when scanning; drag to slide on floor once placed
    const onPointerDown = (e: PointerEvent) => {
      if (
        !e.isPrimary ||
        stateRef.current.multiTouchLock ||
        stateRef.current.twoFingerActive ||
        stateRef.current.threeFingerActive
      ) {
        return;
      }
      stateRef.current.isDragging = true;
      stateRef.current.pointerDownX = e.clientX;
      stateRef.current.pointerDownY = e.clientY;
      stateRef.current.movedDuringTap = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (
        !e.isPrimary ||
        !stateRef.current.isDragging ||
        stateRef.current.multiTouchLock ||
        stateRef.current.twoFingerActive ||
        stateRef.current.threeFingerActive
      ) {
        return;
      }
      if (
        Math.hypot(
          e.clientX - stateRef.current.pointerDownX,
          e.clientY - stateRef.current.pointerDownY
        ) > 8
      ) {
        stateRef.current.movedDuringTap = true;
      }

      if (stateRef.current.isPlaced) {
        // 1-finger drag slides the model smoothly across its anchored horizontal floor plane
        findWorldPoint(e.clientX, e.clientY, false, stateRef.current.targetPos);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasTap =
        !stateRef.current.movedDuringTap &&
        !stateRef.current.multiTouchLock &&
        !stateRef.current.twoFingerActive &&
        !stateRef.current.threeFingerActive;
      stateRef.current.isDragging = false;

      if (!stateRef.current.isPlaced && wasTap && sceneCamera) {
        // Drop and lock the cabinet at the orange circle pointer's SLAM world coordinate
        stateRef.current.currentPos.copy(stateRef.current.targetPos);
        stateRef.current.baseSurfaceY = stateRef.current.currentPos.y;
        stateRef.current.heightOffset = 0;
        stateRef.current.targetHeightOffset = 0;
        stateRef.current.modelYaw = Math.atan2(
          sceneCamera.position.x - stateRef.current.currentPos.x,
          sceneCamera.position.z - stateRef.current.currentPos.z
        );
        stateRef.current.isPlaced = true;
        setIsPlaced(true);
      }
    };

    // Multi-touch: 2-finger pinch (scale) + twist (Y-axis rotation), 3-finger swipe up/down (height)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        stateRef.current.multiTouchLock = true;
        stateRef.current.twoFingerActive = true;
        stateRef.current.threeFingerActive = false;
        stateRef.current.isDragging = false;
        stateRef.current.movedDuringTap = true;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        stateRef.current.pinchStartDist = Math.hypot(dx, dy);
        stateRef.current.pinchStartScale = stateRef.current.modelScale;
        stateRef.current.pinchStartAngle = Math.atan2(dy, dx);
        stateRef.current.pinchStartYaw = stateRef.current.modelYaw;
      } else if (e.touches.length === 3) {
        stateRef.current.multiTouchLock = true;
        stateRef.current.threeFingerActive = true;
        stateRef.current.twoFingerActive = false;
        stateRef.current.isDragging = false;
        stateRef.current.movedDuringTap = true;
        const avgY =
          (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
        stateRef.current.threeFingerStartY = avgY;
        stateRef.current.threeFingerStartHeight = stateRef.current.targetHeightOffset;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 3 && stateRef.current.threeFingerActive) {
        e.preventDefault();
        const avgY =
          (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
        const deltaY = stateRef.current.threeFingerStartY - avgY;
        stateRef.current.targetHeightOffset = THREE.MathUtils.clamp(
          stateRef.current.threeFingerStartHeight + deltaY * 0.0045,
          -2.5,
          2.5
        );
        return;
      }

      if (
        e.touches.length === 2 &&
        stateRef.current.twoFingerActive &&
        stateRef.current.pinchStartDist > 0
      ) {
        e.preventDefault();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / stateRef.current.pinchStartDist;
        stateRef.current.modelScale = THREE.MathUtils.clamp(
          stateRef.current.pinchStartScale * factor,
          0.2,
          4.0
        );

        const angle = Math.atan2(dy, dx);
        const deltaAngle = angle - stateRef.current.pinchStartAngle;
        stateRef.current.modelYaw = stateRef.current.pinchStartYaw - deltaAngle;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 3) stateRef.current.threeFingerActive = false;
      if (e.touches.length < 2) stateRef.current.twoFingerActive = false;
      if (e.touches.length === 0) stateRef.current.multiTouchLock = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Initialize 8th Wall SLAM Engine + Three.js Pipeline
    loadXR8Engine()
      .then(XR8 => {
        if (disposed) return;
        xr8Instance = XR8;

        // Clean any leftover pipeline state from previous visits
        try {
          XR8.stop();
          XR8.clearCameraPipelineModules();
        } catch {
          // Ignore if not previously running
        }

        // Size canvas to fill viewport cleanly at crisp Retina resolution without leaving React's DOM
        const syncCanvasDimensions = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(1, Math.round(window.innerWidth * dpr));
          const h = Math.max(1, Math.round(window.innerHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        };
        syncCanvasDimensions();
        resizeHandler = syncCanvasDimensions;
        window.addEventListener('resize', syncCanvasDimensions);

        const reactSafeCanvasModule: XR8PipelineModule = {
          name: 'react-safe-fullwindow-canvas',
          onAttach: () => syncCanvasDimensions(),
          onCanvasSizeChange: ({ canvas: c }) => {
            // XR8.Threejs calls renderer.setSize(w, h) which writes pixel inline styles; keep CSS 100%
            c.style.width = '100%';
            c.style.height = '100%';
          },
          onDeviceOrientationChange: () => {
            window.requestAnimationFrame(syncCanvasDimensions);
          },
        };

        let modelGroup: THREE.Group | null = null;
        let reticleGroup: THREE.Group | null = null;
        let shadowPlane: THREE.Mesh | null = null;
        let dirLight: THREE.DirectionalLight | null = null;
        const clock = new THREE.Clock();

        const arSceneModule: XR8PipelineModule = {
          name: 'cabinet-slam-scene',
          onCameraStatusChange: ({ status }) => {
            if (disposed) return;
            if (status === 'hasVideo') {
              setEngineReady(true);
            } else if (status === 'failed') {
              setErrorMessage('Camera or motion access was blocked. Tap Retry to allow permissions.');
            }
          },
          onException: err => {
            if (disposed) return;
            console.error('8th Wall XR exception:', err);
            setErrorMessage('Could not start AR SLAM tracking on this device.');
          },
          onStart: ({ canvas: c }) => {
            if (disposed) return;
            c.style.width = '100%';
            c.style.height = '100%';

            const { scene, camera, renderer } = XR8.Threejs.xrScene();
            sceneCamera = camera;

            // Modern Three.js r160 color management & soft ground shadows
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            // Place initial virtual camera at natural standing height (1.4m above y=0 ground plane)
            camera.position.set(0, 1.4, 0);
            XR8.XrController.updateCameraProjectionMatrix({
              origin: camera.position,
              facing: camera.quaternion,
            });

            // Studio + shadow lighting
            scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.5));

            dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
            dirLight.position.set(2.5, 6, 3.5);
            dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 20;
            dirLight.shadow.camera.left = -3;
            dirLight.shadow.camera.right = 3;
            dirLight.shadow.camera.top = 3;
            dirLight.shadow.camera.bottom = -3;
            dirLight.shadow.bias = -0.0005;
            scene.add(dirLight);
            scene.add(dirLight.target);

            const fillLight = new THREE.DirectionalLight(0x90b4ff, 0.75);
            fillLight.position.set(-3, 2, -3);
            scene.add(fillLight);

            // Soft shadow catcher plane directly beneath the cabinet
            const shadowGeo = new THREE.PlaneGeometry(8, 8);
            shadowGeo.rotateX(-Math.PI / 2);
            const shadowMat = new THREE.ShadowMaterial({ opacity: 0.36 });
            shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
            shadowPlane.receiveShadow = true;
            shadowPlane.visible = false;
            scene.add(shadowPlane);

            // Microsoft Power Apps MR orange placer circle
            reticleGroup = new THREE.Group();
            const outerRingGeo = new THREE.RingGeometry(0.32, 0.37, 64);
            outerRingGeo.rotateX(-Math.PI / 2);
            reticleGroup.add(
              new THREE.Mesh(
                outerRingGeo,
                new THREE.MeshBasicMaterial({
                  color: 0xf59e0b,
                  side: THREE.DoubleSide,
                  transparent: true,
                  opacity: 0.92,
                })
              )
            );
            const innerRingGeo = new THREE.RingGeometry(0.15, 0.17, 48);
            innerRingGeo.rotateX(-Math.PI / 2);
            reticleGroup.add(
              new THREE.Mesh(
                innerRingGeo,
                new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  side: THREE.DoubleSide,
                  transparent: true,
                  opacity: 0.78,
                })
              )
            );
            const dotGeo = new THREE.CircleGeometry(0.045, 32);
            dotGeo.rotateX(-Math.PI / 2);
            reticleGroup.add(
              new THREE.Mesh(
                dotGeo,
                new THREE.MeshBasicMaterial({
                  color: 0xf59e0b,
                  side: THREE.DoubleSide,
                })
              )
            );
            reticleGroup.position.set(0, 0.005, -2.0);
            scene.add(reticleGroup);

            // Cabinet Model Group (hidden until user taps screen to drop onto the orange circle)
            modelGroup = new THREE.Group();
            modelGroup.visible = false;
            scene.add(modelGroup);

            // Load Metering Cabinet GLB paused on frame 0
            const loader = new GLTFLoader();
            loader.load(
              CABINET_GLB_URL,
              gltf => {
                if (disposed || !modelGroup) return;
                const root = gltf.scene;
                const box = new THREE.Box3().setFromObject(root);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                const normScale = 1.15 / maxDim;

                // Bottom-align model to rest cleanly on the ground plane
                root.position.set(
                  -center.x * normScale,
                  -box.min.y * normScale,
                  -center.z * normScale
                );
                root.scale.setScalar(normScale);

                root.traverse(obj => {
                  const mesh = obj as THREE.Mesh;
                  if (mesh.isMesh) {
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                  }
                });

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
                if (!disposed) setModelLoading(false);
              }
            );

            setEngineReady(true);
          },
          onUpdate: () => {
            const delta = Math.min(clock.getDelta(), 0.1);
            if (mixerRef.current) {
              mixerRef.current.update(delta);
            }

            const state = stateRef.current;

            // Smooth 3-finger height adjustment
            state.heightOffset += (state.targetHeightOffset - state.heightOffset) * 0.25;
            const activeY = state.baseSurfaceY + state.heightOffset;

            if (!state.isPlaced) {
              // Aim orange floor circle at screen center using real 8th Wall SLAM hit-test + ground plane fallback
              const rect = container.getBoundingClientRect();
              const hit = findWorldPoint(
                rect.left + rect.width * 0.5,
                rect.top + rect.height * 0.56,
                true,
                state.targetPos
              );
              if (hit) {
                if (!state.hasValidHit) {
                  state.currentPos.copy(state.targetPos);
                  state.hasValidHit = true;
                } else {
                  state.currentPos.lerp(state.targetPos, 0.3);
                }
              }
            } else {
              // Once placed, world X/Z only change when user explicitly slides with 1 finger
              if (state.isDragging) {
                state.currentPos.x += (state.targetPos.x - state.currentPos.x) * 0.35;
                state.currentPos.z += (state.targetPos.z - state.currentPos.z) * 0.35;
              }
              state.currentPos.y = activeY;
            }

            if (modelGroup) {
              modelGroup.visible = state.isPlaced;
              modelGroup.position.copy(state.currentPos);
              modelGroup.scale.setScalar(state.modelScale);
              modelGroup.rotation.set(0, state.modelYaw, 0);
            }

            if (shadowPlane && dirLight) {
              shadowPlane.visible = state.isPlaced;
              shadowPlane.position.set(
                state.currentPos.x,
                state.currentPos.y + 0.002,
                state.currentPos.z
              );
              // Keep directional shadow frustum centered on the placed cabinet
              dirLight.position.set(
                state.currentPos.x + 2.5,
                state.currentPos.y + 6.0,
                state.currentPos.z + 3.5
              );
              dirLight.target.position.copy(state.currentPos);
            }

            if (reticleGroup) {
              reticleGroup.position.set(
                state.currentPos.x,
                state.currentPos.y + 0.005,
                state.currentPos.z
              );
              reticleGroup.visible =
                !state.isPlaced || state.isDragging || state.threeFingerActive;
            }
          },
        };

        // Configure 8th Wall 6DoF World Tracking ('responsive' locks immediately on frame 1 regardless of IMU scale delay)
        XR8.XrController.configure({
          scale: 'responsive',
          disableWorldTracking: false,
        });

        XR8.addCameraPipelineModules([
          XR8.GlTextureRenderer.pipelineModule(),
          XR8.Threejs.pipelineModule(),
          XR8.XrController.pipelineModule(),
          reactSafeCanvasModule,
          arSceneModule,
        ]);

        XR8.run({
          canvas,
          allowedDevices: XR8.XrConfig.device().ANY,
          cameraConfig: { direction: XR8.XrConfig.camera().BACK },
        });
      })
      .catch(err => {
        if (disposed) return;
        console.error('Failed to initialize 8th Wall SLAM:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to initialize AR SLAM engine.'
        );
      });

    return () => {
      disposed = true;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      stopXR8();
    };
  }, [retryTick, stopXR8]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-dvh bg-black text-white font-sans overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Full-Screen 8th Wall SLAM + Three.js WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full! h-full! block"
      />

      {/* Top-Left Back Button */}
      <header
        className="absolute top-5 left-5 z-30 pointer-events-auto"
        onPointerDown={e => e.stopPropagation()}
      >
        <Link
          href="/ARs"
          onClick={stopXR8}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/85 hover:text-white text-xs font-medium transition-colors shrink-0 backdrop-blur-md shadow-lg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Static AR
        </Link>
      </header>

      {/* Subtle Placement Prompt while Scanning */}
      {engineReady && !isPlaced && !modelLoading && !errorMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-amber-400/35 text-amber-200 text-xs font-medium text-center whitespace-nowrap shadow-lg">
          Aim circle at floor • Tap screen to place
        </div>
      )}

      {/* Loading Indicator while 8th Wall SLAM & GLB initialize */}
      {(!engineReady || modelLoading) && !errorMessage && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none">
          <div className="w-10 h-10 rounded-full border-4 border-white/15 border-t-amber-400 animate-spin mb-3" />
          <p className="text-xs font-medium text-white/80">
            {!engineReady ? 'Starting AR World Tracking...' : 'Loading 3D Asset...'}
          </p>
        </div>
      )}

      {/* Error / Permission Recovery Overlay */}
      {errorMessage && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md p-6"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl">
            <p className="text-sm text-white/90 mb-5">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setRetryTick(t => t + 1)}
              className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors cursor-pointer"
            >
              Retry AR Camera
            </button>
          </div>
        </div>
      )}

      {/* Bottom-Left Icon-Only Play / Pause Button */}
      {isPlaced && hasAnimations && !modelLoading && !errorMessage && (
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
