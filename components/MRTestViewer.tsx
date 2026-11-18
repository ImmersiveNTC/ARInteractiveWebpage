'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_PATH } from '../lib/assetTypes';

const CABINET_GLB_URL = `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`;
const FLOOR_Y = -1.15;

// Offscreen optical-flow grid dimensions for 6DoF ground translation tracking
const FLOW_W = 80;
const FLOW_H = 60;

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

  // Mutable interaction & 6DoF tracking state accessed inside requestAnimationFrame
  const stateRef = useRef({
    isPlaced: false,
    gyroReceived: false,
    alpha: null as number | null,
    beta: null as number | null,
    gamma: null as number | null,
    // 6DoF camera world position & velocity
    camPos: new THREE.Vector3(0, 0, 0),
    camVel: new THREE.Vector3(0, 0, 0),
    prevCamQuat: new THREE.Quaternion(),
    hasPrevQuat: false,
    // IMU linear acceleration (world-aligned & motion energy gate)
    imuAccelLocal: new THREE.Vector3(0, 0, 0),
    imuMotionEnergy: 0,
    lastImuTimestamp: 0,
    // Placed model transform
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

    // Check if iOS requires a tap for DeviceOrientation / DeviceMotion permission
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
    const win = window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
    };
    if (win.DeviceOrientationEvent && typeof win.DeviceOrientationEvent.requestPermission === 'function') {
      try {
        await win.DeviceOrientationEvent.requestPermission();
      } catch {
        // Ignore if denied
      }
    }
    if (win.DeviceMotionEvent && typeof win.DeviceMotionEvent.requestPermission === 'function') {
      try {
        await win.DeviceMotionEvent.requestPermission();
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

  // Three.js Scene + 6DoF Optical-Flow/IMU Ground Tracker + Floor Placement
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

    // Offscreen 2D canvas for real-time ground optical flow (6DoF translation tracking)
    const flowCanvas = document.createElement('canvas');
    flowCanvas.width = FLOW_W;
    flowCanvas.height = FLOW_H;
    const flowCtx = flowCanvas.getContext('2d', { willReadFrequently: true });
    let prevGray: Uint8Array | null = null;
    const currGray = new Uint8Array(FLOW_W * FLOW_H);

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

    // Gyroscope orientation listener (3DoF rotation)
    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      stateRef.current.gyroReceived = true;
      stateRef.current.alpha = e.alpha;
      stateRef.current.beta = e.beta;
      stateRef.current.gamma = e.gamma;
    };
    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    // Accelerometer listener (6DoF motion energy gate + linear translation assist)
    const onDeviceMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const ax = acc.x;
      const ay = acc.y;
      const az = acc.z;
      const mag = Math.hypot(ax, ay, az);
      const st = stateRef.current;
      // Exponential moving average of linear acceleration energy to detect walking vs standing still
      st.imuMotionEnergy = st.imuMotionEnergy * 0.82 + mag * 0.18;
      st.imuAccelLocal.set(ax, ay, az);
      st.lastImuTimestamp = performance.now();
    };
    window.addEventListener('devicemotion', onDeviceMotion, true);

    // Raycast helper onto horizontal floor plane (Y = FLOOR_Y), relative to current 6DoF camera position
    const raycaster = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
    const hitVec = new THREE.Vector3();

    const projectScreenPointToFloor = (clientX: number, clientY: number, out: THREE.Vector3): boolean => {
      const rect = container.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const camX = camera.position.x;
      const camZ = camera.position.z;
      const dir = raycaster.ray.direction;

      if (dir.y < -0.04) {
        const hit = raycaster.ray.intersectPlane(floorPlane, hitVec);
        if (hit) {
          let relX = hit.x - camX;
          let relZ = hit.z - camZ;
          const dist = Math.hypot(relX, relZ);
          if (dist > 7.5) {
            const s = 7.5 / dist;
            relX *= s;
            relZ *= s;
          } else if (dist < 0.65) {
            const s = 0.65 / Math.max(dist, 0.001);
            relX *= s;
            relZ *= s;
          }
          out.set(camX + relX, FLOOR_Y, camZ + relZ);
          return true;
        }
      }

      const currentDist = Math.hypot(
        stateRef.current.currentPos.x - camX,
        stateRef.current.currentPos.z - camZ
      );
      const d = THREE.MathUtils.clamp(currentDist || 2.2, 1.1, 4.5);
      const horiz = new THREE.Vector3(dir.x, 0, dir.z);
      if (horiz.lengthSq() > 0.0001) {
        horiz.normalize();
        out.set(camX + horiz.x * d, FLOOR_Y, camZ + horiz.z * d);
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
          camera.position.x - stateRef.current.currentPos.x,
          camera.position.z - stateRef.current.currentPos.z
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

    // Sample points in the lower half of the 80x60 frame (where floor/ground texture appears)
    const patchCenters: Array<{ x: number; y: number }> = [
      { x: 20, y: 30 }, { x: 40, y: 30 }, { x: 60, y: 30 },
      { x: 16, y: 38 }, { x: 32, y: 38 }, { x: 48, y: 38 }, { x: 64, y: 38 },
      { x: 20, y: 46 }, { x: 40, y: 46 }, { x: 60, y: 46 },
      { x: 26, y: 52 }, { x: 54, y: 52 },
    ];

    const medianOf = (arr: number[]): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
    };

    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.1);
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

      // 2. 6DoF Ground Translation Tracking (Rotation-Compensated Optical Flow + IMU Motion Gate)
      const video = videoRef.current;
      if (
        flowCtx &&
        video &&
        video.readyState >= 2 &&
        !video.paused &&
        state.hasPrevQuat
      ) {
        flowCtx.drawImage(video, 0, 0, FLOW_W, FLOW_H);
        const imgData = flowCtx.getImageData(0, 0, FLOW_W, FLOW_H).data;
        for (let i = 0, p = 0; i < imgData.length; i += 4, p++) {
          currGray[p] = (imgData[i] * 77 + imgData[i + 1] * 150 + imgData[i + 2] * 29) >> 8;
        }

        if (prevGray) {
          // Compute camera angular change in camera-local frame between last frame and current frame
          const deltaQuat = state.prevCamQuat.clone().invert().multiply(camera.quaternion);
          const rotEuler = new THREE.Euler().setFromQuaternion(deltaQuat, 'YXZ');

          // Focal lengths in 80x60 pixel units (vertical FOV = 65 deg)
          const fy = (FLOW_H * 0.5) / Math.tan(THREE.MathUtils.degToRad(65 * 0.5));
          const fx = (FLOW_W * 0.5) / (Math.tan(THREE.MathUtils.degToRad(65 * 0.5)) * camera.aspect);

          // Expected pixel shift caused purely by phone rotation
          const rotShiftX = rotEuler.y * fx;
          const rotShiftY = rotEuler.x * fy;
          const baseSearchX = Math.round(THREE.MathUtils.clamp(rotShiftX, -7, 7));
          const baseSearchY = Math.round(THREE.MathUtils.clamp(rotShiftY, -7, 7));

          const residualDxList: number[] = [];
          const residualDyList: number[] = [];

          // Block-matching optical flow around rotation-predicted offset
          for (let k = 0; k < patchCenters.length; k++) {
            const cx = patchCenters[k].x;
            const cy = patchCenters[k].y;

            // Check block texture contrast so flat regions don't add noise
            let minL = 255;
            let maxL = 0;
            for (let py = -2; py <= 2; py++) {
              const row = (cy + py) * FLOW_W + cx;
              for (let px = -2; px <= 2; px++) {
                const v = prevGray[row + px];
                if (v < minL) minL = v;
                if (v > maxL) maxL = v;
              }
            }
            if (maxL - minL < 14) continue;

            let bestSad = 1e9;
            let bestDx = baseSearchX;
            let bestDy = baseSearchY;

            for (let dy = baseSearchY - 4; dy <= baseSearchY + 4; dy++) {
              const ny = cy + dy;
              if (ny < 3 || ny >= FLOW_H - 3) continue;
              for (let dx = baseSearchX - 4; dx <= baseSearchX + 4; dx++) {
                const nx = cx + dx;
                if (nx < 3 || nx >= FLOW_W - 3) continue;

                let sad = 0;
                for (let py = -2; py <= 2; py++) {
                  const r1 = (cy + py) * FLOW_W + cx;
                  const r2 = (ny + py) * FLOW_W + nx;
                  for (let px = -2; px <= 2; px++) {
                    sad += Math.abs(prevGray[r1 + px] - currGray[r2 + px]);
                  }
                }
                if (sad < bestSad) {
                  bestSad = sad;
                  bestDx = dx;
                  bestDy = dy;
                }
              }
            }

            if (bestSad < 25 * 28) {
              residualDxList.push(bestDx - rotShiftX);
              residualDyList.push(bestDy - rotShiftY);
            }
          }

          if (residualDxList.length >= 3) {
            const transPxX = medianOf(residualDxList);
            const transPxY = medianOf(residualDyList);

            // Gate translation: requires either physical walking energy on IMU OR strong coherent visual flow
            const imuRecent = performance.now() - state.lastImuTimestamp < 500;
            const isMovingPhysically = !imuRecent || state.imuMotionEnergy > 0.12 || Math.hypot(transPxX, transPxY) > 0.85;

            if (isMovingPhysically && Math.hypot(transPxX, transPxY) > 0.22) {
              // Convert camera forward/right vectors onto the horizontal floor plane
              const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
              const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

              const horizForward = new THREE.Vector3(camForward.x, 0, camForward.z);
              if (horizForward.lengthSq() > 0.0001) horizForward.normalize();
              const horizRight = new THREE.Vector3(camRight.x, 0, camRight.z);
              if (horizRight.lengthSq() > 0.0001) horizRight.normalize();

              // Estimate ground distance seen by lower-middle of camera to scale pixels -> meters
              const sinPitch = Math.max(0.25, Math.min(0.95, -camForward.y));
              const groundDist = Math.abs(FLOOR_Y) / sinPitch;
              const metersPerPxY = (groundDist / fy) * 1.15;
              const metersPerPxX = (groundDist / fx) * 1.05;

              // Walking forward pushes floor pixels downward (+transPxY -> +horizForward)
              // Walking right pushes floor pixels left (-transPxX -> +horizRight)
              const stepForward = THREE.MathUtils.clamp(transPxY * metersPerPxY, -0.14, 0.14);
              const stepRight = THREE.MathUtils.clamp(-transPxX * metersPerPxX, -0.14, 0.14);

              state.camVel
                .addScaledVector(horizForward, stepForward * 0.55)
                .addScaledVector(horizRight, stepRight * 0.55);
            }
          }
        } else {
          prevGray = new Uint8Array(FLOW_W * FLOW_H);
        }

        prevGray.set(currGray);
      }

      // Apply smoothed camera translation velocity with quick friction so it stops immediately when you stop walking
      state.camPos.add(state.camVel);
      state.camVel.multiplyScalar(0.52);
      camera.position.set(state.camPos.x, 0, state.camPos.z);

      state.prevCamQuat.copy(camera.quaternion);
      state.hasPrevQuat = true;

      // 3. While scanning (!isPlaced), project the screen center onto the floor for the circle pointer
      if (!state.isPlaced) {
        const rect = container.getBoundingClientRect();
        projectScreenPointToFloor(
          rect.left + rect.width / 2,
          rect.top + rect.height * 0.56,
          state.targetPos
        );
      }

      // 4. Smoothly interpolate floor position
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
      window.removeEventListener('devicemotion', onDeviceMotion, true);
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
