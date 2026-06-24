"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader.js";

type I3DViewerModalProps = {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
};

export function I3DViewerModal({ fileUrl, fileName, onClose }: I3DViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  // Animation states
  const animationState = useRef({
    keyframesJson: {
      "actions_sequence": ["A", "B", "C"],
      "keyframes": {
        "W": 0,
        "A": [1, 10],
        "B": [11, 20],
        "C": [21, 30],
        "W2E": [31, 45]
      }
    },
    currentFrame: 0,
    targetFrame: 0,
    playDirection: 1,
    isPlaying: false,
    currentActionIndex: -1,
  });

  const engineState = useRef<{
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
    modelGroup: THREE.Group | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    lastTime: number;
    accumulatedTime: number;
    frameDuration: number;
  }>({
    mixer: null,
    action: null,
    modelGroup: null,
    camera: null,
    renderer: null,
    lastTime: 0,
    accumulatedTime: 0,
    frameDuration: 1 / 30,
  });

  // Fetch bespoke JSON config if it exists
  const jsonUrl = fileUrl.substring(0, fileUrl.lastIndexOf('.')) + '.json';
  useEffect(() => {
    fetch(jsonUrl)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No JSON found');
      })
      .then((data) => {
        if (data && data.actions_sequence && data.keyframes) {
          animationState.current.keyframesJson = data as any;
          console.log(`Loaded bespoke JSON for ${fileName}`);
        }
      })
      .catch(() => {
        console.log(`No bespoke JSON found for ${fileName}, using default keyframes.`);
      });
  }, [jsonUrl, fileName]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4);
    engineState.current.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0.5);
    engineState.current.renderer = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-5, -5, -2);
    scene.add(dirLight2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 10;
    controls.minDistance = 1.5;

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Load Model
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    const onModelLoaded = (modelScene: THREE.Group, animations?: THREE.AnimationClip[], gltfData?: any) => {
      setLoading(false);
      engineState.current.modelGroup = modelScene;

      // ─── Extract custom JSON config from GLB / glTF ───
      let customConfig: any = null;
      if (gltfData && gltfData.parser && gltfData.parser.json && gltfData.parser.json.extras && gltfData.parser.json.extras.animation_config) {
        customConfig = gltfData.parser.json.extras.animation_config;
      } else if (modelScene.userData && modelScene.userData.animation_config) {
        customConfig = modelScene.userData.animation_config;
      }
      
      // Fallback: search recursively if it was attached to a specific child node
      if (!customConfig) {
        modelScene.traverse((child) => {
          if (!customConfig && child.userData && child.userData.animation_config) {
            customConfig = child.userData.animation_config;
          }
        });
      }

      if (customConfig) {
        try {
          const parsed = typeof customConfig === 'string' ? JSON.parse(customConfig) : customConfig;
          if (parsed && parsed.actions_sequence && parsed.keyframes) {
            animationState.current.keyframesJson = parsed as any;
            console.log(`Loaded built-in animation_config from GLB!`);
          }
        } catch(e) {
          console.error("Failed to parse animation_config from GLB userData", e);
        }
      }
      // ──────────────────────────────────────────────────

      // Center model
      const box = new THREE.Box3().setFromObject(modelScene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      modelScene.position.sub(center);

      const wrapper = new THREE.Group();
      wrapper.add(modelScene);
      scene.add(wrapper);
      engineState.current.modelGroup = wrapper;

      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.z = maxDim * 1.8 || 4;

      // Setup animations
      if (animations && animations.length > 0) {
        engineState.current.mixer = new THREE.AnimationMixer(wrapper);
        engineState.current.action = engineState.current.mixer.clipAction(animations[0]);
        engineState.current.action.play();
        engineState.current.action.paused = true;
        setFrame(0);
      } else {
        createMockAnimations(wrapper);
      }
    };

    if (ext === 'gltf' || ext === 'glb') {
      const loader = new GLTFLoader();
      loader.load(fileUrl, (gltf) => {
        onModelLoaded(gltf.scene, gltf.animations, gltf);
      }, undefined, (e) => {
        console.error(e);
        setLoading(false);
      });
    } else if (ext === 'usdz') {
      const loader = new USDZLoader();
      loader.load(fileUrl, (usdGroup) => {
        // USDZLoader returns a Mesh; cast to Group since onModelLoaded only uses
        // Group-compatible APIs (position, Box3, scene.add, AnimationMixer).
        onModelLoaded(usdGroup as unknown as THREE.Group, (usdGroup as any).animations || []);
      }, undefined, (e) => {
        console.error(e);
        setLoading(false);
      });
    } else {
      // Fallback
      setLoading(false);
    }

    const createMockAnimations = (modelGroup: THREE.Group) => {
      const times = [];
      for (let f = 0; f <= 45; f++) {
        times.push(f / 30);
      }

      const posValues = [];
      const rotValues = [];
      for (let f = 0; f <= 45; f++) {
        if (f >= 1 && f <= 10) {
          const phase = (f - 1) / 9;
          posValues.push(Math.sin(phase * Math.PI * 2) * 0.5, 0, 0);
        } else if (f >= 11 && f <= 20) {
          const phase = (f - 11) / 9;
          posValues.push(0, Math.sin(phase * Math.PI * 2) * 0.5, 0);
        } else if (f >= 21 && f <= 30) {
          const phase = (f - 21) / 9;
          posValues.push(0, 0, Math.sin(phase * Math.PI * 2) * 0.5);
        } else if (f >= 31 && f <= 45) {
          const phase = (f - 31) / 14;
          posValues.push(0, phase * 0.8, 0);
        } else {
          posValues.push(0, 0, 0);
        }

        const angle = (f / 45) * Math.PI * 2;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle * 0.2);
        rotValues.push(q.x, q.y, q.z, q.w);
      }

      const posTrack = new THREE.VectorKeyframeTrack('.position', times, posValues);
      const rotTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, rotValues);

      const clip = new THREE.AnimationClip('MockAction', 1.5, [posTrack, rotTrack]);
      engineState.current.mixer = new THREE.AnimationMixer(modelGroup);
      engineState.current.action = engineState.current.mixer.clipAction(clip);
      engineState.current.action.play();
      engineState.current.action.paused = true;
      setFrame(0);
    };

    const setFrame = (frameNumber: number) => {
      if (engineState.current.action && engineState.current.mixer) {
        engineState.current.action.paused = false;
        engineState.current.mixer.setTime(frameNumber / 30);
        animationState.current.currentFrame = frameNumber;
      }
    };

    // Render loop
    const animate = (time: number) => {
      requestAnimationFrame(animate);
      controls.update();

      const eng = engineState.current;
      const anim = animationState.current;

      let delta = (time - eng.lastTime) / 1000;
      if (isNaN(delta)) delta = 0;
      if (delta > 0.1) delta = 0.1;
      eng.lastTime = time;

      if (anim.isPlaying) {
        eng.accumulatedTime += delta;
        while (eng.accumulatedTime >= eng.frameDuration) {
          eng.accumulatedTime -= eng.frameDuration;
          anim.currentFrame += anim.playDirection;

          if (anim.playDirection === 1 && anim.currentFrame >= anim.targetFrame) {
            anim.currentFrame = anim.targetFrame;
            anim.isPlaying = false;
          } else if (anim.playDirection === -1 && anim.currentFrame <= anim.targetFrame) {
            anim.currentFrame = anim.targetFrame;
            anim.isPlaying = false;
          }

          if (eng.action && eng.mixer) {
            eng.action.paused = false;
            eng.mixer.setTime(anim.currentFrame / 30);
          }
        }
      }

      renderer.render(scene, camera);
    };
    requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      // Wait to dispose controls properly
      controls.dispose();
    };
  }, [fileUrl, fileName]);

  const setFrame = (frameNumber: number) => {
    const eng = engineState.current;
    const anim = animationState.current;
    if (eng.action && eng.mixer) {
      eng.action.paused = false;
      eng.mixer.setTime(frameNumber / 30);
      anim.currentFrame = frameNumber;
    }
  };

  const navigateSequence = (direction: 'prev' | 'next') => {
    const anim = animationState.current;
    if (anim.isPlaying) return;

    const seq = anim.keyframesJson.actions_sequence;
    if (direction === 'next') {
      anim.currentActionIndex = (anim.currentActionIndex + 1) % seq.length;
    } else {
      if (anim.currentActionIndex <= 0) {
        anim.currentActionIndex = seq.length - 1;
      } else {
        anim.currentActionIndex = anim.currentActionIndex - 1;
      }
    }

    const chosenAction = seq[anim.currentActionIndex] as keyof typeof anim.keyframesJson.keyframes;
    const range = anim.keyframesJson.keyframes[chosenAction];

    if (Array.isArray(range) && range.length === 2) {
      const [startFrame, endFrame] = range;
      setFrame(startFrame);
      anim.targetFrame = endFrame;
      anim.playDirection = 1;
      anim.isPlaying = true;
    }
  };

  const toggleExplode = () => {
    const anim = animationState.current;
    if (anim.isPlaying) return;

    const range = anim.keyframesJson.keyframes.W2E;
    const [startFrame, endFrame] = range;

    const atStart = Math.abs(anim.currentFrame - startFrame) < 0.5;
    const atEnd = Math.abs(anim.currentFrame - endFrame) < 0.5;

    if (atStart) {
      anim.targetFrame = endFrame;
      anim.playDirection = 1;
      anim.isPlaying = true;
    } else if (atEnd) {
      anim.targetFrame = startFrame;
      anim.playDirection = -1;
      anim.isPlaying = true;
    } else {
      const distToStart = Math.abs(anim.currentFrame - startFrame);
      const distToEnd = Math.abs(anim.currentFrame - endFrame);
      if (distToStart > distToEnd) {
        anim.targetFrame = startFrame;
        anim.playDirection = -1;
      } else {
        anim.targetFrame = endFrame;
        anim.playDirection = 1;
      }
      anim.isPlaying = true;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10">
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
          <h2 className="text-lg font-medium text-white">{fileName}</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 3D Canvas Container */}
        <div ref={containerRef} className="relative flex-1 w-full h-full bg-black/40">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-full outline-none" />
          
          {/* TEMPORARY SUBTITLE: Show asset name (Delete block to disable) */}
          <div className="absolute bottom-6 left-6 pointer-events-none">
            <span 
              className="text-yellow-400 font-sans font-thin text-sm tracking-widest uppercase"
                style={{ fontWeight: 100 }}
              >
              {fileName.substring(0, fileName.lastIndexOf('.')) || fileName}
            </span>
          </div>

          {/* Controls Overlay */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4">
            <button 
              onClick={toggleExplode}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all shadow-lg backdrop-blur-md"
              title="Toggle Explode"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </button>
            
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
              <button 
                onClick={() => navigateSequence('prev')}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg backdrop-blur-md"
                title="Previous Sequence Action"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button 
                onClick={() => navigateSequence('next')}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg backdrop-blur-md"
                title="Next Sequence Action"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
