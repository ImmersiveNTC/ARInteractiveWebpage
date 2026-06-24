"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type ThreeDCardProps = {
  index: number;
  title: string;
  subtitle: string;
  themeColor: string;
};

export function ThreeDCard({ index, title, subtitle, themeColor }: ThreeDCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation states
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [activeActionLabel, setActiveActionLabel] = useState("Whole (W)");

  // Keyframes configuration (Reused logic from /ar)
  const keyframesConfig = {
    actionsSequence: ["A", "B", "C"],
    keyframes: {
      W: 0,
      A: [1, 10],
      B: [11, 20],
      C: [21, 30],
      W2E: [31, 45],
    },
  };

  // References for animation loop
  const stateRef = useRef({
    currentFrame: 0,
    targetFrame: 0,
    playDirection: 1,
    isPlaying: false,
    currentActionIndex: -1,
  });

  const meshesRef = useRef<THREE.Mesh[]>([]);

  // Update status label based on current frame and action index
  const updateStatusText = (frame: number, actionIdx: number) => {
    setCurrentFrame(frame);
    if (frame === 0) {
      setActiveActionLabel("Whole (W)");
    } else if (frame >= 31 && frame <= 45) {
      setActiveActionLabel(`Explode W2E (${frame})`);
    } else if (actionIdx !== -1) {
      const activeAction = keyframesConfig.actionsSequence[actionIdx];
      const range = keyframesConfig.keyframes[activeAction as "A" | "B" | "C"];
      if (frame >= range[0] && frame <= range[1]) {
        setActiveActionLabel(`Action ${activeAction} (${range[0]}-${range[1]})`);
      } else {
        setActiveActionLabel(`Scrubbing (${frame})`);
      }
    } else {
      // Find match
      let found = false;
      const keys = ["A", "B", "C"] as const;
      for (const key of keys) {
        const range = keyframesConfig.keyframes[key];
        if (frame >= range[0] && frame <= range[1]) {
          setActiveActionLabel(`Action ${key} (${range[0]}-${range[1]})`);
          found = true;
          break;
        }
      }
      if (!found) setActiveActionLabel(`Frame: ${frame}`);
    }
  };

  // Set specific animation frame
  const seekToFrame = (frameNumber: number) => {
    stateRef.current.currentFrame = frameNumber;
    updateStatusText(frameNumber, stateRef.current.currentActionIndex);
    updateMeshAnimations(frameNumber);
  };

  // Mesh animation update logic (Procedural animation generator)
  const updateMeshAnimations = (frame: number) => {
    const meshes = meshesRef.current;
    if (meshes.length === 0) return;

    // Reset default rotations/scales first
    if (frame === 0) {
      meshes.forEach((mesh, idx) => {
        mesh.scale.set(1, 1, 1);
        mesh.rotation.set(0, 0, 0);
        if (index === 0) {
          const offsets = [
            { x: -0.6, y: -0.6, z: -0.6 },
            { x:  0.6, y: -0.6, z: -0.6 },
            { x: -0.6, y:  0.6, z: -0.6 },
            { x:  0.6, y:  0.6, z: -0.6 },
            { x: -0.6, y: -0.6, z:  0.6 },
            { x:  0.6, y: -0.6, z:  0.6 },
            { x: -0.6, y:  0.6, z:  0.6 },
            { x:  0.6, y:  0.6, z:  0.6 }
          ];
          mesh.position.set(offsets[idx].x, offsets[idx].y, offsets[idx].z);
        } else if (index === 1) {
          const angle = (idx / 6) * Math.PI * 2;
          mesh.position.set(Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8);
          mesh.rotation.set(Math.PI / 2, 0, angle);
        } else if (index === 2) {
          mesh.position.set((idx - 2) * 0.55, 0, 0);
        } else if (index === 3) {
          mesh.rotation.set(Math.PI / 3 * (idx + 1), Math.PI / 4 * idx, 0);
        } else if (index === 4) {
          if (idx > 0) {
            const orbIdx = idx - 1;
            const angle = (orbIdx / 4) * Math.PI * 2;
            mesh.position.set(Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9);
          } else {
            mesh.position.set(0, 0, 0);
          }
        }
      });
      return;
    }

    if (index === 0) {
      // 0: Crystalline Grid (8 cubes)
      const offsets = [
        { x: -0.6, y: -0.6, z: -0.6 },
        { x:  0.6, y: -0.6, z: -0.6 },
        { x: -0.6, y:  0.6, z: -0.6 },
        { x:  0.6, y:  0.6, z: -0.6 },
        { x: -0.6, y: -0.6, z:  0.6 },
        { x:  0.6, y: -0.6, z:  0.6 },
        { x: -0.6, y:  0.6, z:  0.6 },
        { x:  0.6, y:  0.6, z:  0.6 }
      ];

      meshes.forEach((mesh, idx) => {
        const defaultPos = offsets[idx];
        let s = 1.0;

        if (frame >= 31 && frame <= 45) {
          const phase = (frame - 31) / 14;
          s = 1.0 + 1.3 * phase;
        } else if (frame >= 1 && frame <= 10) {
          if (idx === 7) {
            const phase = (frame - 1) / 9;
            mesh.rotation.y = phase * Math.PI;
            s = 1.0 + 0.3 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 11 && frame <= 20) {
          if (idx === 6) {
            const phase = (frame - 11) / 9;
            mesh.rotation.x = phase * Math.PI;
            s = 1.0 + 0.3 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 21 && frame <= 30) {
          if (idx === 5) {
            const phase = (frame - 21) / 9;
            mesh.rotation.z = phase * Math.PI;
            s = 1.0 + 0.3 * Math.sin(phase * Math.PI);
          }
        }

        mesh.position.set(defaultPos.x * s, defaultPos.y * s, defaultPos.z * s);
      });
    } else if (index === 1) {
      // 1: Pyramidal Helix (6 cones)
      meshes.forEach((mesh, idx) => {
        const angle = (idx / 6) * Math.PI * 2;
        let radius = 0.8;
        let heightOffset = 0;

        if (frame >= 31 && frame <= 45) {
          const phase = (frame - 31) / 14;
          radius = 0.8 + 1.1 * phase;
        } else if (frame >= 1 && frame <= 10) {
          const phase = (frame - 1) / 9;
          if (idx === 0 || idx === 3) {
            radius = 0.8 + 0.4 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 11 && frame <= 20) {
          const phase = (frame - 11) / 9;
          if (idx === 1 || idx === 4) {
            heightOffset = 0.4 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 21 && frame <= 30) {
          const phase = (frame - 21) / 9;
          mesh.rotation.y = phase * Math.PI * 2;
        }

        mesh.position.set(Math.cos(angle) * radius, heightOffset, Math.sin(angle) * radius);
      });
    } else if (index === 2) {
      // 2: Helix Columns (5 pillars)
      meshes.forEach((mesh, idx) => {
        let height = 0;
        let scaleY = 1.0;

        if (frame >= 31 && frame <= 45) {
          const phase = (frame - 31) / 14;
          mesh.position.z = phase * 1.2;
          scaleY = 1.0 - 0.4 * phase;
        } else if (frame >= 1 && frame <= 10) {
          if (idx === 0 || idx === 4) {
            const phase = (frame - 1) / 9;
            height = 0.5 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 11 && frame <= 20) {
          if (idx === 1 || idx === 3) {
            const phase = (frame - 11) / 9;
            height = -0.5 * Math.sin(phase * Math.PI);
          }
        } else if (frame >= 21 && frame <= 30) {
          if (idx === 2) {
            const phase = (frame - 21) / 9;
            mesh.rotation.y = phase * Math.PI * 2;
          }
        }

        mesh.position.y = height;
        mesh.scale.y = scaleY;
      });
    } else if (index === 3) {
      // 3: Ring Orbiters (3 torus rings)
      meshes.forEach((mesh, idx) => {
        let scale = 1.0;
        if (frame >= 31 && frame <= 45) {
          const phase = (frame - 31) / 14;
          scale = 1.0 + phase * 0.6;
        } else if (frame >= 1 && frame <= 10) {
          if (idx === 0) {
            const phase = (frame - 1) / 9;
            mesh.rotation.z = phase * Math.PI * 2;
          }
        } else if (frame >= 11 && frame <= 20) {
          if (idx === 1) {
            const phase = (frame - 11) / 9;
            mesh.rotation.y = phase * Math.PI * 2;
          }
        } else if (frame >= 21 && frame <= 30) {
          if (idx === 2) {
            const phase = (frame - 21) / 9;
            mesh.rotation.x = phase * Math.PI * 2;
          }
        }

        mesh.scale.set(scale, scale, scale);
      });
    } else if (index === 4) {
      // 4: Quantum Node (1 core, 4 orbiters)
      meshes.forEach((mesh, idx) => {
        if (idx === 0) {
          let coreScale = 1.0;
          if (frame >= 1 && frame <= 10) {
            const phase = (frame - 1) / 9;
            coreScale = 1.0 + 0.25 * Math.sin(phase * Math.PI);
          }
          mesh.scale.set(coreScale, coreScale, coreScale);
        } else {
          const orbIdx = idx - 1;
          const angle = (orbIdx / 4) * Math.PI * 2;
          let radius = 0.9;
          let height = 0;

          if (frame >= 31 && frame <= 45) {
            const phase = (frame - 31) / 14;
            radius = 0.9 + 1.0 * phase;
          } else if (frame >= 11 && frame <= 20) {
            const phase = (frame - 11) / 9;
            const currentAngle = angle + phase * Math.PI;
            mesh.position.set(Math.cos(currentAngle) * radius, 0, Math.sin(currentAngle) * radius);
            return;
          } else if (frame >= 21 && frame <= 30) {
            const phase = (frame - 21) / 9;
            height = 0.3 * Math.sin(phase * Math.PI * 2 + orbIdx * Math.PI / 2);
          }

          mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        }
      });
    }
  };

  // Explode animation toggle (W2E)
  const handleExplode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stateRef.current.isPlaying) return;

    const range = keyframesConfig.keyframes.W2E;
    const [startFrame, endFrame] = range;
    const current = stateRef.current.currentFrame;

    let target = endFrame;
    let direction = 1;

    const atStart = Math.abs(current - startFrame) <= 0.5;
    const atEnd = Math.abs(current - endFrame) <= 0.5;

    if (atStart) {
      target = endFrame;
      direction = 1;
    } else if (atEnd) {
      target = startFrame;
      direction = -1;
    } else {
      const distToStart = Math.abs(current - startFrame);
      const distToEnd = Math.abs(current - endFrame);
      if (distToStart > distToEnd) {
        target = startFrame;
        direction = -1;
      } else {
        target = endFrame;
        direction = 1;
      }
    }

    stateRef.current.targetFrame = target;
    stateRef.current.playDirection = direction;
    stateRef.current.isPlaying = true;
    setIsPlaying(true);
  };

  // Prev / Next Action navigation
  const handleNavigation = (direction: "next" | "prev", e: React.MouseEvent) => {
    e.stopPropagation();
    if (stateRef.current.isPlaying) return;

    const seq = keyframesConfig.actionsSequence;
    let newActionIdx = stateRef.current.currentActionIndex;

    if (direction === "next") {
      newActionIdx = (newActionIdx + 1) % seq.length;
    } else {
      newActionIdx = newActionIdx <= 0 ? seq.length - 1 : newActionIdx - 1;
    }

    stateRef.current.currentActionIndex = newActionIdx;
    setCurrentActionIndex(newActionIdx);

    const chosenAction = seq[newActionIdx];
    const range = keyframesConfig.keyframes[chosenAction as "A" | "B" | "C"];
    const [startFrame, endFrame] = range;

    seekToFrame(startFrame);

    stateRef.current.targetFrame = endFrame;
    stateRef.current.playDirection = 1;
    stateRef.current.isPlaying = true;
    setIsPlaying(true);
  };

  // Set up Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      20
    );
    camera.position.set(0, 0, 4.2);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(themeColor, 0.6);
    dirLight2.position.set(-5, -5, -2);
    scene.add(dirLight2);

    // 5. Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 8;
    controls.minDistance = 1.8;
    controls.enableZoom = false; // Disable zoom to avoid scrolling conflict

    // 6. Generate procedural geometries
    const baseColor = new THREE.Color(themeColor);
    const meshes: THREE.Mesh[] = [];
    const materials: THREE.MeshPhysicalMaterial[] = [];
    const group = new THREE.Group();

    if (index === 0) {
      // 0: Crystalline Grid (8 cubes)
      const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const offsets = [
        { x: -0.6, y: -0.6, z: -0.6 },
        { x:  0.6, y: -0.6, z: -0.6 },
        { x: -0.6, y:  0.6, z: -0.6 },
        { x:  0.6, y:  0.6, z: -0.6 },
        { x: -0.6, y: -0.6, z:  0.6 },
        { x:  0.6, y: -0.6, z:  0.6 },
        { x: -0.6, y:  0.6, z:  0.6 },
        { x:  0.6, y:  0.6, z:  0.6 }
      ];
      offsets.forEach((offset, idx) => {
        const mat = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().multiplyScalar(1 - idx * 0.04),
          roughness: 0.15,
          metalness: 0.1,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.85,
          transmission: 0.1,
          thickness: 0.1
        });
        const mesh = new THREE.Mesh(cubeGeo, mat);
        mesh.position.set(offset.x, offset.y, offset.z);
        group.add(mesh);
        meshes.push(mesh);
        materials.push(mat);
      });
    } else if (index === 1) {
      // 1: Pyramidal Helix (6 cones in a hexagonal ring)
      const coneGeo = new THREE.ConeGeometry(0.3, 0.6, 5);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const mat = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().multiplyScalar(1 - i * 0.06),
          roughness: 0.2,
          metalness: 0.8,
          clearcoat: 0.5,
          transparent: true,
          opacity: 0.9,
        });
        const mesh = new THREE.Mesh(coneGeo, mat);
        mesh.position.set(Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8);
        mesh.rotation.set(Math.PI / 2, 0, angle);
        group.add(mesh);
        meshes.push(mesh);
        materials.push(mat);
      }
    } else if (index === 2) {
      // 2: Helix Columns (5 thin pillars)
      const colGeo = new THREE.BoxGeometry(0.25, 1.1, 0.25);
      for (let i = 0; i < 5; i++) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().multiplyScalar(1 - i * 0.05),
          roughness: 0.25,
          metalness: 0.3,
          clearcoat: 0.8,
          transparent: true,
          opacity: 0.85,
        });
        const mesh = new THREE.Mesh(colGeo, mat);
        mesh.position.set((i - 2) * 0.55, 0, 0);
        group.add(mesh);
        meshes.push(mesh);
        materials.push(mat);
      }
    } else if (index === 3) {
      // 3: Ring Orbiters (3 concentric flat torus rings)
      for (let i = 0; i < 3; i++) {
        const torusGeo = new THREE.TorusGeometry(0.45 + i * 0.25, 0.06, 8, 32);
        const mat = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().multiplyScalar(1 - i * 0.08),
          roughness: 0.1,
          metalness: 0.95,
          transparent: true,
          opacity: 0.85,
          clearcoat: 0.6
        });
        const mesh = new THREE.Mesh(torusGeo, mat);
        mesh.rotation.set(Math.PI / 3 * (i + 1), Math.PI / 4 * i, 0);
        group.add(mesh);
        meshes.push(mesh);
        materials.push(mat);
      }
    } else {
      // 4: Quantum Node (1 big core, 4 orbiters)
      const coreGeo = new THREE.SphereGeometry(0.5, 24, 24);
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.95,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);
      meshes.push(coreMesh);
      materials.push(coreMat);

      const orbGeo = new THREE.SphereGeometry(0.18, 12, 12);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const mat = new THREE.MeshPhysicalMaterial({
          color: baseColor.clone().multiplyScalar(0.75),
          roughness: 0.2,
          metalness: 0.6,
          transparent: true,
          opacity: 0.85,
        });
        const mesh = new THREE.Mesh(orbGeo, mat);
        mesh.position.set(Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9);
        group.add(mesh);
        meshes.push(mesh);
        materials.push(mat);
      }
    }

    scene.add(group);
    meshesRef.current = meshes;

    // Center model group
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);

    // Initial loop parameters
    let lastTime = 0;
    let accumulatedTime = 0;
    const frameDuration = 1 / 30; // locked 30 fps
    let animationFrameId = 0;

    // Render loop
    const tick = (now: number) => {
      let delta = (now - lastTime) / 1000;
      if (isNaN(delta)) delta = 0;
      if (delta > 0.1) delta = 0.1; // clamp spikes
      lastTime = now;

      // Handle 30fps keyframe increments
      if (stateRef.current.isPlaying) {
        accumulatedTime += delta;
        while (accumulatedTime >= frameDuration) {
          accumulatedTime -= frameDuration;

          let nextFrame = stateRef.current.currentFrame + stateRef.current.playDirection;

          let reached = false;
          if (
            stateRef.current.playDirection === 1 &&
            nextFrame >= stateRef.current.targetFrame
          ) {
            nextFrame = stateRef.current.targetFrame;
            reached = true;
          } else if (
            stateRef.current.playDirection === -1 &&
            nextFrame <= stateRef.current.targetFrame
          ) {
            nextFrame = stateRef.current.targetFrame;
            reached = true;
          }
          stateRef.current.currentFrame = nextFrame;

          updateStatusText(
            stateRef.current.currentFrame,
            stateRef.current.currentActionIndex
          );
          updateMeshAnimations(stateRef.current.currentFrame);

          if (reached) {
            stateRef.current.isPlaying = false;
            setIsPlaying(false);
            accumulatedTime = 0;
            break;
          }
        }
      }

      // Add a subtle default spin to the entire group in VR idle mode
      if (!stateRef.current.isPlaying) {
        group.rotation.y += 0.003;
      }

      controls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    // Handle container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
      });
      materials.forEach((mat) => {
        mat.dispose();
      });
    };
  }, [index, themeColor]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-slate-900/40 border border-white/5 hover:border-white/15 shadow-xl hover:shadow-2xl transition-all duration-500 group select-none"
    >
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block z-0" />

      {/* Title & Subtitle Badge (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col pointer-events-none">
        <span className="text-[10px] tracking-[0.15em] uppercase text-white/45 font-bold">
          {subtitle}
        </span>
        <h3 className="text-sm sm:text-base font-semibold text-white/90 leading-tight mt-0.5">
          {title}
        </h3>
      </div>

      {/* Info Status Panel (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/45 backdrop-blur-md border border-white/5 px-3 py-2 rounded-lg pointer-events-none flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/40 uppercase tracking-wider">
          Sequence
        </div>
        <div className="text-[10px] sm:text-xs font-semibold text-white/90 whitespace-nowrap">
          {activeActionLabel}
        </div>
        <div className="text-[9px] font-medium text-white/50 font-mono mt-0.5">
          Frame: {currentFrame}
        </div>
      </div>

      {/* Control Buttons (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {/* Prev Action Button */}
        <button
          onClick={(e) => handleNavigation("prev", e)}
          disabled={isPlaying}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 backdrop-blur-md shadow-md ${
            isPlaying
              ? "bg-black/20 border-white/5 text-white/20 cursor-not-allowed"
              : "bg-black/55 border-white/10 hover:border-white/30 text-white/80 hover:text-white hover:scale-105 active:scale-95"
          }`}
          title="Previous Sequence Action"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Explode Toggle Button */}
        <button
          onClick={handleExplode}
          disabled={isPlaying}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 backdrop-blur-md shadow-md ${
            isPlaying
              ? "bg-black/20 border-white/5 text-white/20 cursor-not-allowed"
              : "bg-black/55 border-white/10 hover:border-white/30 text-white/80 hover:text-white hover:scale-105 active:scale-95"
          }`}
          title="Toggle Explode (W2E)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </button>

        {/* Next Action Button */}
        <button
          onClick={(e) => handleNavigation("next", e)}
          disabled={isPlaying}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 backdrop-blur-md shadow-md ${
            isPlaying
              ? "bg-black/20 border-white/5 text-white/20 cursor-not-allowed"
              : "bg-black/55 border-white/10 hover:border-white/30 text-white/80 hover:text-white hover:scale-105 active:scale-95"
          }`}
          title="Next Sequence Action"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Elegant Inner Glass Shading Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 opacity-70 pointer-events-none z-[1]" />
    </div>
  );
}
