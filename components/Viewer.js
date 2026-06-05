import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColorManager } from '../js/ColorManager.js';

class ARViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Animation configuration states
    this.keyframesJson = null;
    this.currentFrame = 0;
    this.targetFrame = 0;
    this.playDirection = 1;
    this.isPlaying = false;
    this.currentActionIndex = -1; // -1 represents W (Whole)

    // AR/VR States
    this.isARMode = false;
    this.arStream = null;

    // Three.js instance handles
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mixer = null;
    this.action = null;
    this.modelGroup = null;

    // Material handles for theme updates
    this.placeholderCoreMaterial = null;

    // Animation loop timer parameters
    this.lastTime = 0;
    this.accumulatedTime = 0;
    this.frameDuration = 1 / 30; // Locked 30 FPS step rate

    // Gyroscope tracking bounds
    this.deviceOrientationBound = this.handleDeviceOrientation.bind(this);
    this.headingOffset = undefined;
  }

  connectedCallback() {
    this.render();
    this.init();
    
    // Bind listeners
    window.addEventListener('themechanged', this.onThemeChanged.bind(this));

    // Restore fullscreen state if active (survives orientation/resize layout resets)
    if (sessionStorage.getItem('viewer_fullscreen') === 'true') {
      const container = this.shadowRoot.querySelector('.viewer-container');
      if (container) {
        container.classList.add('fullscreen');
        const btn = this.shadowRoot.getElementById('fullscreenBtn');
        if (btn) btn.setAttribute('title', 'Exit Fullscreen');
      }
    }
  }

  disconnectedCallback() {
    window.removeEventListener('themechanged', this.onThemeChanged.bind(this));
    if (this.arStream) {
      this.arStream.getTracks().forEach(track => track.stop());
    }
  }

  async init() {
    // 1. Fetch animation configurations
    try {
      const response = await fetch('./animation_logic.json');
      this.keyframesJson = await response.json();
    } catch (error) {
      console.warn('Failed to load animation_logic.json. Using fallback logic config.', error);
      this.keyframesJson = {
        "actions_sequence": ["A", "B", "C"],
        "keyframes": {
          "W": 0,
          "A": [1, 10],
          "B": [11, 20],
          "C": [21, 30],
          "W2E": [31, 45]
        }
      };
    }

    // 2. Set starting frame
    this.currentFrame = this.keyframesJson.keyframes.W ?? 0;

    // 3. Setup rendering engine
    this.initThree();

    // 4. Load or generate mesh
    this.loadModel();

    // 5. Bind control button clicks
    this.bindEvents();
  }

  initThree() {
    const container = this.shadowRoot.querySelector('.canvas-wrapper');
    const canvas = this.shadowRoot.getElementById('threeCanvas');

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    // Renderer - Alpha enabled to allow webcam feed background transparency
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // transparent base clear color

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-5, -5, -2);
    this.scene.add(dirLight2);

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 10;
    this.controls.minDistance = 1.5;

    // Handle resizing automatically using ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        this.resizeCanvas(rect.width, rect.height);
      }
    });
    resizeObserver.observe(container);

    // Trigger initial tick
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  resizeCanvas(width, height) {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }
  }

  loadModel() {
    const loader = new GLTFLoader();
    
    loader.load(
      'models/model.gltf',
      (gltf) => this.onModelLoaded(gltf),
      undefined,
      () => {
        // Try GLB secondary option
        loader.load(
          'models/model.glb',
          (gltf) => this.onModelLoaded(gltf),
          undefined,
          () => {
            console.warn('Could not load models/model.gltf or model.glb. Rendering fallback placeholder cube.');
            this.createPlaceholderModel();
          }
        );
      }
    );
  }

  onModelLoaded(gltf) {
    this.modelGroup = gltf.scene;

    // Center model in scene bounding boxes
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.modelGroup.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.add(this.modelGroup);
    this.scene.add(wrapper);
    this.modelGroup = wrapper;

    // Position camera to fit model size
    const maxDim = Math.max(size.x, size.y, size.z);
    this.camera.position.z = maxDim * 1.8 || 4;

    // Initialize animation timeline
    if (gltf.animations && gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.modelGroup);
      this.action = this.mixer.clipAction(gltf.animations[0]);
      this.action.play();
      this.action.paused = true;
      this.setFrame(this.currentFrame);
    } else {
      console.warn('Loaded model contains no animation clips. Registering mock animations.');
      this.createMockAnimationsForLoadedModel();
    }

    this.updateStatusUI();
  }

  createPlaceholderModel() {
    const group = new THREE.Group();

    // 8 cubes in a 2x2x2 layout, cube size = 0.9 (gap of 0.1)
    const cubeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    this.placeholderMaterials = [];

    const themeBaseHex = getComputedStyle(document.documentElement).getPropertyValue('--theme-base-hex').trim() || '#6366f1';
    const baseColor = new THREE.Color(themeBaseHex);

    const offsets = [
      { x: -0.5, y: -0.5, z: -0.5 }, // Cube 0
      { x:  0.5, y: -0.5, z: -0.5 }, // Cube 1
      { x: -0.5, y:  0.5, z: -0.5 }, // Cube 2
      { x:  0.5, y:  0.5, z: -0.5 }, // Cube 3
      { x: -0.5, y: -0.5, z:  0.5 }, // Cube 4
      { x:  0.5, y: -0.5, z:  0.5 }, // Cube 5
      { x: -0.5, y:  0.5, z:  0.5 }, // Cube 6
      { x:  0.5, y:  0.5, z:  0.5 }  // Cube 7
    ];

    offsets.forEach((offset, idx) => {
      // Slight color gradient based on cube position
      const hsl = {};
      baseColor.getHSL(hsl);
      const cubeColor = new THREE.Color().setHSL(
        hsl.h,
        hsl.s,
        Math.max(0.2, Math.min(0.8, hsl.l + (idx - 3.5) * 0.05))
      );

      const cubeMat = new THREE.MeshPhysicalMaterial({
        color: cubeColor,
        roughness: 0.1,
        metalness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.85,
        transmission: 0.3,
        thickness: 0.2
      });

      const mesh = new THREE.Mesh(cubeGeo, cubeMat);
      mesh.name = `Cube_${idx}`;
      mesh.position.set(offset.x, offset.y, offset.z);

      group.add(mesh);
      this.placeholderMaterials.push(cubeMat);
    });

    this.scene.add(group);
    this.modelGroup = group;

    // Set standard camera distance
    this.camera.position.z = 4.5;

    // Generate animation tracks mapping frames 0-45 (1.5 seconds at 30 FPS)
    this.createMockAnimationsForModel();
  }

  createMockAnimationsForModel() {
    const times = [];
    for (let f = 0; f <= 45; f++) {
      times.push(f / 30);
    }

    const offsets = [
      { x: -0.5, y: -0.5, z: -0.5 },
      { x:  0.5, y: -0.5, z: -0.5 },
      { x: -0.5, y:  0.5, z: -0.5 },
      { x:  0.5, y:  0.5, z: -0.5 },
      { x: -0.5, y: -0.5, z:  0.5 },
      { x:  0.5, y: -0.5, z:  0.5 },
      { x: -0.5, y:  0.5, z:  0.5 },
      { x:  0.5, y:  0.5, z:  0.5 }
    ];

    const tracks = [];

    for (let idx = 0; idx < 8; idx++) {
      const defaultPos = offsets[idx];
      const posValues = [];

      for (let f = 0; f <= 45; f++) {
        let s = 1.0;

        if (f === 0) {
          s = 1.0;
        } 
        // Action A [1-10]: Cube 7 slides out
        else if (f >= 1 && f <= 10) {
          if (idx === 7) {
            const phase = (f - 1) / 9;
            s = 1.0 + 1.4 * phase; // moves to 2.4x
          } else {
            s = 1.0;
          }
        } 
        // Action B [11-20]: Cube 7 stays out, Cube 6 slides out
        else if (f >= 11 && f <= 20) {
          if (idx === 7) {
            s = 2.4;
          } else if (idx === 6) {
            const phase = (f - 11) / 9;
            s = 1.0 + 1.4 * phase;
          } else {
            s = 1.0;
          }
        } 
        // Action C [21-30]: Cube 7 & 6 stay out, Cube 5 slides out
        else if (f >= 21 && f <= 30) {
          if (idx === 7 || idx === 6) {
            s = 2.4;
          } else if (idx === 5) {
            const phase = (f - 21) / 9;
            s = 1.0 + 1.4 * phase;
          } else {
            s = 1.0;
          }
        } 
        // Explode W2E [31-45]: All 8 cubes explode radially from center
        else if (f >= 31 && f <= 45) {
          const phase = (f - 31) / 14;
          s = 1.0 + 1.5 * phase; // moves all to 2.5x
        }

        posValues.push(defaultPos.x * s, defaultPos.y * s, defaultPos.z * s);
      }

      const track = new THREE.VectorKeyframeTrack(`Cube_${idx}.position`, times, posValues);
      tracks.push(track);
    }

    const clip = new THREE.AnimationClip('MockAction', 1.5, tracks);

    this.mixer = new THREE.AnimationMixer(this.modelGroup);
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.action.paused = true;
    this.setFrame(this.currentFrame);
  }

  createMockAnimationsForLoadedModel() {
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
    this.mixer = new THREE.AnimationMixer(this.modelGroup);
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.action.paused = true;
    this.setFrame(this.currentFrame);
  }

  onThemeChanged(e) {
    const hex = e.detail.hex;
    if (this.placeholderMaterials && this.placeholderMaterials.length > 0) {
      const baseColor = new THREE.Color(hex);
      this.placeholderMaterials.forEach((mat, idx) => {
        const hsl = {};
        baseColor.getHSL(hsl);
        const cubeColor = new THREE.Color().setHSL(
          hsl.h,
          hsl.s,
          Math.max(0.2, Math.min(0.8, hsl.l + (idx - 3.5) * 0.05))
        );
        mat.color.copy(cubeColor);
      });
    }
  }

  bindEvents() {
    this.shadowRoot.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
    this.shadowRoot.getElementById('arBtn').addEventListener('click', () => this.toggleARMode());
    this.shadowRoot.getElementById('explodeBtn').addEventListener('click', () => this.toggleExplode());
    this.shadowRoot.getElementById('prevBtn').addEventListener('click', () => this.navigateSequence('prev'));
    this.shadowRoot.getElementById('nextBtn').addEventListener('click', () => this.navigateSequence('next'));

    // AR Touch gestures for rotation & scaling
    const canvas = this.shadowRoot.getElementById('threeCanvas');
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartDist = 0;
    let initialScale = 1;
    let initialModelRotY = 0;
    let initialModelRotX = 0;
    let initialModelPosX = 0;
    let initialModelPosY = 0;
    let initialModelPosZ = 0;
    let touchStartMidX = 0;
    let touchStartMidY = 0;

    canvas.addEventListener('touchstart', (e) => {
      if (!this.isARMode || !this.modelGroup) return;

      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialModelRotY = this.modelGroup.rotation.y;
        initialModelRotX = this.modelGroup.rotation.x;
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = this.modelGroup.scale.x;
        
        // Midpoint of the two fingers for translation
        touchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        initialModelPosX = this.modelGroup.position.x;
        initialModelPosY = this.modelGroup.position.y;
        initialModelPosZ = this.modelGroup.position.z;
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.isARMode || !this.modelGroup) return;

      if (e.touches.length === 1 && initialModelRotY !== undefined) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        
        // 1-finger horizontal drag spins the model on its Y axis
        this.modelGroup.rotation.y = initialModelRotY + deltaX * 0.01;
        // 1-finger vertical drag tilts the model on its X axis (clamped for stability)
        this.modelGroup.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, initialModelRotX + deltaY * 0.01));
        
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        // 2-finger pinch scales the model size
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist;
        const newScale = Math.max(0.1, Math.min(6, initialScale * factor));
        this.modelGroup.scale.set(newScale, newScale, newScale);

        // 2-finger drag translates the model in screen X & Y space
        const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        const deltaMidX = currentMidX - touchStartMidX;
        const deltaMidY = currentMidY - touchStartMidY;
        
        this.modelGroup.position.x = initialModelPosX + deltaMidX * 0.006;
        this.modelGroup.position.y = initialModelPosY - deltaMidY * 0.006; // Invert Y coordinate
      }
    });
  }

  toggleFullscreen() {
    if (this.isPlaying) return; // interlock lock

    const container = this.shadowRoot.querySelector('.viewer-container');
    const isCurrentlyFullscreen = container.classList.contains('fullscreen');

    if (isCurrentlyFullscreen) {
      container.classList.remove('fullscreen');
      sessionStorage.setItem('viewer_fullscreen', 'false');
      this.shadowRoot.getElementById('fullscreenBtn').setAttribute('title', 'Enter Fullscreen');
    } else {
      container.classList.add('fullscreen');
      sessionStorage.setItem('viewer_fullscreen', 'true');
      this.shadowRoot.getElementById('fullscreenBtn').setAttribute('title', 'Exit Fullscreen');
    }

    // Trigger canvas scale recalculation after CSS layout updates
    setTimeout(() => {
      const rect = container.getBoundingClientRect();
      this.resizeCanvas(rect.width, rect.height);
    }, 50);
  }

  async toggleARMode() {
    if (this.isPlaying) return; // interlock lock

    const video = this.shadowRoot.getElementById('arVideo');
    const container = this.shadowRoot.querySelector('.viewer-container');

    if (this.isARMode) {
      // Exit AR Mode completely (go back to VR Mode)
      this.exitFallbackAR(video, container);
    } else {
      // Enter Webcam & Gyroscope In-Browser AR Mode by default
      await this.runFallbackAR(video, container);
    }
  }

  async runFallbackAR(video, container) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      let orientationGranted = false;
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permissionState = await DeviceOrientationEvent.requestPermission();
          if (permissionState === 'granted') {
            orientationGranted = true;
          } else {
            alert('Gyroscope tracking permission denied. The 3D model will remain stationary in screen space.');
          }
        } catch (err) {
          console.error('Orientation permission error:', err);
        }
      } else {
        orientationGranted = true;
      }

      if (orientationGranted) {
        this.headingOffset = undefined;
        window.addEventListener('deviceorientation', this.deviceOrientationBound);
      }

      if (this.controls) {
        this.controls.enabled = false;
      }
      this.camera.position.set(0, 0, 0);
      this.camera.quaternion.set(0, 0, 0, 1);

      if (this.modelGroup) {
        this.modelGroup.position.set(0, -0.6, -2.5);
        this.modelGroup.rotation.set(0, 0, 0);
        this.modelGroup.scale.set(1, 1, 1);
        this.modelGroup.visible = true;
      }

      this.arStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      
      // Explicitly trigger play to prevent freeze/black-screen on iOS Chrome & Safari
      video.play().catch(e => console.warn("Video stream play failed:", e));
      
      this.isARMode = true;
      container.classList.add('ar-mode');
      this.shadowRoot.getElementById('modeText').textContent = 'AR MODE';
      this.updateStatusUI();
    } catch (err) {
      console.error('Camera access failed:', err);
      alert('Camera access is required for AR mode.');
    }
  }

  exitFallbackAR(video, container) {
    this.isARMode = false;
    container.classList.remove('ar-mode');

    if (this.arStream) {
      this.arStream.getTracks().forEach(track => track.stop());
      this.arStream = null;
    }
    video.srcObject = null;
    video.style.display = 'none';

    window.removeEventListener('deviceorientation', this.deviceOrientationBound);
    this.headingOffset = undefined;

    if (this.controls) {
      this.controls.enabled = true;
      this.controls.target.set(0, 0, 0);
    }
    this.camera.position.set(0, 0, 4);
    this.camera.quaternion.set(0, 0, 0, 1);
    
    if (this.modelGroup) {
      this.modelGroup.position.set(0, 0, 0);
      this.modelGroup.rotation.set(0, 0, 0);
      this.modelGroup.scale.set(1, 1, 1);
      this.modelGroup.visible = true;
    }

    this.shadowRoot.getElementById('modeText').textContent = 'VR MODE';
    this.updateStatusUI();
  }

  handleDeviceOrientation(event) {
    if (!this.isARMode) return;

    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
    const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

    let orient = 0;
    if (window.screen && window.screen.orientation) {
      orient = THREE.MathUtils.degToRad(window.screen.orientation.angle);
    } else if (typeof window.orientation !== 'undefined') {
      orient = THREE.MathUtils.degToRad(window.orientation);
    }

    if (this.headingOffset === undefined) {
      this.headingOffset = alpha;
    }

    const adjustedAlpha = alpha - this.headingOffset;

    // YXZ order matching device coordinates
    const euler = new THREE.Euler(beta, adjustedAlpha, -gamma, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler);

    // Camera facing adjustment (Lie flat vs vertical)
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    q.multiply(q1);

    // Screen rotation adjustment
    const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient);
    q.multiply(q0);

    // Set camera rotation
    this.camera.quaternion.copy(q);
  }

  navigateSequence(direction) {
    if (this.isPlaying || !this.keyframesJson) return; // interlock locks input

    const seq = this.keyframesJson.actions_sequence;
    if (!seq || seq.length === 0) return;

    // Loop through action indices forward or backward
    if (direction === 'next') {
      this.currentActionIndex = (this.currentActionIndex + 1) % seq.length;
    } else {
      if (this.currentActionIndex <= 0) {
        this.currentActionIndex = seq.length - 1; // loop backward
      } else {
        this.currentActionIndex = this.currentActionIndex - 1;
      }
    }

    const chosenAction = seq[this.currentActionIndex];
    const range = this.keyframesJson.keyframes[chosenAction];

    if (range && range.length === 2) {
      const [startFrame, endFrame] = range;
      
      // Instantly position timeline to start frame to avoid visual jump
      this.setFrame(startFrame);

      // Trigger 30fps animation play
      this.targetFrame = endFrame;
      this.playDirection = 1;
      this.isPlaying = true;
    }
  }

  toggleExplode() {
    if (this.isPlaying || !this.keyframesJson) return; // interlock locks input

    const range = this.keyframesJson.keyframes.W2E;
    if (!range || range.length !== 2) return;

    const [startFrame, endFrame] = range;

    if (this.currentFrame === startFrame) {
      // play forward
      this.targetFrame = endFrame;
      this.playDirection = 1;
      this.isPlaying = true;
    } else if (this.currentFrame === endFrame) {
      // play backward
      this.targetFrame = startFrame;
      this.playDirection = -1;
      this.isPlaying = true;
    } else if (this.currentFrame > startFrame && this.currentFrame < endFrame) {
      // play toward farthest endpoint
      const distToStart = this.currentFrame - startFrame;
      const distToEnd = endFrame - this.currentFrame;

      if (distToStart > distToEnd) {
        this.targetFrame = startFrame;
        this.playDirection = -1;
      } else {
        this.targetFrame = endFrame;
        this.playDirection = 1;
      }
      this.isPlaying = true;
    } else {
      // lower than start frame: jump to W2E start and play to end
      this.setFrame(startFrame);
      this.targetFrame = endFrame;
      this.playDirection = 1;
      this.isPlaying = true;
    }
  }

  setFrame(frameNumber) {
    if (this.action && this.mixer) {
      this.action.paused = false;
      this.action.time = frameNumber / 30;
      this.mixer.update(0);
      this.currentFrame = frameNumber;
    }
    this.updateStatusUI();
  }

  tick(now) {
    // 1. WebXR plane hit-test (surface detection)
    if (this.isARMode && this.renderer.xr.enabled && this.renderer.xr.isPresenting) {
      const frame = this.renderer.xr.getFrame();
      if (frame) {
        const referenceSpace = this.renderer.xr.getReferenceSpace();
        const session = this.renderer.xr.getSession();

        if (this.hitTestSourceRequested === false) {
          session.requestReferenceSpace('viewer').then((viewerSpace) => {
            session.requestHitTestSource({ space: viewerSpace }).then((source) => {
              this.hitTestSource = source;
            });
          });
          session.addEventListener('end', () => {
            this.hitTestSourceRequested = false;
            this.hitTestSource = null;
          });
          this.hitTestSourceRequested = true;
        }

        if (this.hitTestSource) {
          const hitTestResults = frame.getHitTestResults(this.hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace);
            
            if (this.reticle) {
              this.reticle.visible = true;
              this.reticle.matrix.fromArray(pose.transform.matrix);
            }
          } else {
            if (this.reticle) this.reticle.visible = false;
          }
        }
      }
    }

    // Calculate frame durations since last loop
    let delta = (now - this.lastTime) / 1000;
    if (isNaN(delta)) delta = 0;
    if (delta > 0.1) delta = 0.1; // clamp spikes
    this.lastTime = now;

    if (this.isPlaying) {
      this.accumulatedTime += delta;
      
      while (this.accumulatedTime >= this.frameDuration) {
        this.accumulatedTime -= this.frameDuration;

        // Step frame increment/decrement
        this.currentFrame += this.playDirection;

        let reached = false;
        if (this.playDirection === 1 && this.currentFrame >= this.targetFrame) {
          this.currentFrame = this.targetFrame;
          reached = true;
        } else if (this.playDirection === -1 && this.currentFrame <= this.targetFrame) {
          this.currentFrame = this.targetFrame;
          reached = true;
        }

        // Apply timeline seek
        if (this.action && this.mixer) {
          this.action.paused = false;
          this.action.time = this.currentFrame / 30;
          this.mixer.update(0);
        }

        this.updateStatusUI();

        if (reached) {
          this.isPlaying = false;
          this.accumulatedTime = 0; // flush remaining ticks
          break;
        }
      }
    }

    // Refresh controls / view
    if (this.controls && !this.isARMode) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateStatusUI() {
    const actionText = this.shadowRoot.getElementById('actionText');
    const frameText = this.shadowRoot.getElementById('frameText');

    if (frameText) {
      frameText.textContent = `Frame: ${this.currentFrame}`;
    }

    if (actionText && this.keyframesJson) {
      let activeText = 'Whole (W)';
      
      if (this.currentFrame === 0) {
        activeText = 'Whole (W)';
      } else if (this.currentFrame >= 31 && this.currentFrame <= 45) {
        activeText = `Explode W2E (${this.currentFrame})`;
      } else if (this.currentActionIndex !== -1) {
        const seq = this.keyframesJson.actions_sequence;
        const currentAction = seq[this.currentActionIndex];
        const range = this.keyframesJson.keyframes[currentAction];
        
        if (this.currentFrame >= range[0] && this.currentFrame <= range[1]) {
          activeText = `Action ${currentAction} (${range[0]}-${range[1]})`;
        }
      } else {
        // Find match
        let found = false;
        for (let key in this.keyframesJson.keyframes) {
          if (key === 'W' || key === 'W2E') continue;
          const range = this.keyframesJson.keyframes[key];
          if (this.currentFrame >= range[0] && this.currentFrame <= range[1]) {
            activeText = `Action ${key} (${range[0]}-${range[1]})`;
            found = true;
            break;
          }
        }
        if (!found) activeText = `Frame scrub (${this.currentFrame})`;
      }
      
      actionText.textContent = activeText;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
        }
        
        .viewer-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 16px;
          overflow: hidden;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .viewer-container.ar-mode {
          background: transparent !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 0 50px rgba(0, 0, 0, 0.8) !important;
        }
        
        .canvas-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
        }
        
        #threeCanvas {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
        
        #arVideo {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          pointer-events: none;
          display: none;
        }
        
        /* Sidebar overlays */
        .controls-sidebar {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 10;
        }
        
        .btn {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(15, 15, 15, 0.6);
          color: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
          padding: 0;
          outline: none;
        }
        
        .btn:hover {
          background: hsla(var(--theme-base-raw), 0.4);
          border-color: var(--theme-accent);
          color: #ffffff;
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 6px 20px rgba(var(--theme-base-raw), 0.4);
        }
        
        .btn:active {
          transform: scale(0.95);
        }
        
        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          padding-top: 8px;
        }
        
        /* Lower info card HUD overlay */
        .info-overlay {
          position: absolute;
          bottom: 20px;
          left: 20px;
          z-index: 10;
          background: rgba(10, 10, 10, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          pointer-events: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
        
        .info-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        
        .info-label {
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
          font-size: 0.65rem;
          font-weight: 600;
        }
        
        .info-value {
          color: #ffffff;
        }
        
        .badge {
          background: var(--theme-base);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: 0 0 10px rgba(var(--theme-base-raw), 0.3);
        }
        
        /* Fullscreen overrides */
        .viewer-container.fullscreen {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          aspect-ratio: auto !important;
          border-radius: 0 !important;
          border: none !important;
          z-index: 9999 !important;
        }
        
        @media (max-width: 768px) {
          .viewer-container {
            aspect-ratio: 4 / 3; /* make slightly taller on mobile viewports */
          }
          .btn {
            width: 40px;
            height: 40px;
          }
          .controls-sidebar {
            right: 12px;
            gap: 8px;
          }
          .info-overlay {
            bottom: 12px;
            left: 12px;
            padding: 6px 12px;
          }
        }
      </style>
      
      <div class="viewer-container glass-panel">
        <video id="arVideo" autoplay playsinline muted></video>
        
        <div class="canvas-wrapper">
          <canvas id="threeCanvas"></canvas>
        </div>
        
        <div class="controls-sidebar">
          <!-- Fullscreen Toggle -->
          <button class="btn" id="fullscreenBtn" title="Toggle Fullscreen">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          
          <!-- AR/VR Toggle -->
          <button class="btn" id="arBtn" title="Toggle AR Mode">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
          
          <!-- Explode Toggle -->
          <button class="btn" id="explodeBtn" title="Toggle Explode (W2E)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </button>
          
          <div class="nav-group">
            <!-- Prev Action -->
            <button class="btn" id="prevBtn" title="Previous Sequence Action">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            
            <!-- Next Action -->
            <button class="btn" id="nextBtn" title="Next Sequence Action">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="info-overlay">
          <div class="info-row">
            <span class="info-label">Mode:</span>
            <span class="badge" id="modeText">VR MODE</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sequence:</span>
            <span class="info-value" id="actionText">Loading...</span>
          </div>
          <div class="info-row">
            <span class="info-label">Timeline:</span>
            <span class="info-value" id="frameText">Frame: 0</span>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ar-viewer', ARViewer);
export default ARViewer;
