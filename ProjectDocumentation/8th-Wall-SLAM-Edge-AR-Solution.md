# Approved Solution: In-Browser 6DoF WebAR Anchoring for Intune-Managed iPhones (Microsoft Edge)

- **Status:** Approved Solution
- **Date Recorded:** 2026-11-20
- **Reference Implementation Commit:** `a64f222` (plus 3-finger elevation fix)
- **Tested Hardware / Browsers:** iPhone 15 & iPhone 15 Pro — Microsoft Edge (Intune MAM Managed), iOS Chrome, iOS Safari
- **Reference Prototype Files:**
  - `components/MRTestViewer.tsx`
  - `app/MRTest/page.tsx`
  - `public/xr/xr.js`, `public/xr/xr-slam.js`, `public/xr/LICENSE`, `public/xr/resources/powered-by.svg`

---

## 1. Problem Context & Constraints

On corporate iPhones managed by **Microsoft Intune App Protection Policies (MAM)** using **Microsoft Edge**:

1. **AR Quick Look (`<a rel="ar">`) fails inside Edge iOS**: Edge runs inside `WKWebView`, which does not route `rel="ar"` or `.usdz` / `.reality` files to Apple's native `QLPreviewController` — it shows a blank preview with a Share button instead.
2. **Handing off to Safari (`x-safari-https://`) is blocked by Intune**: Intune MAM prevents managed Edge from transferring URLs or downloaded files to unmanaged apps (`"Action not allowed: your organization only allows you to transfer its data to other managed apps"`).
3. **WebXR (`navigator.xr` `immersive-ar`) is disabled by Apple on iOS browsers**: Web pages cannot call Apple `ARKit` directly from JavaScript.
4. **Custom JavaScript Gyroscope / Accelerometer / Optical-Flow Trackers Fail on iPhone 15 / 15 Pro**:
   - iOS 16.4+ defaults rear `getUserMedia` streams to a virtual multi-lens camera that switches between Ultra-Wide and Main lenses, shifting FOV unpredictably.
   - Uncalibrated virtual camera FOV causes 3D models to slide across the floor during tilts and pans.
   - Consumer MEMS accelerometer integration drifts quadratically, and naive 2D optical flow jitters on 60Hz/120Hz ProMotion displays running over a 30fps video feed.

---

## 2. Approved Architecture: Self-Hosted 8th Wall 6DoF Visual-Inertial SLAM

To achieve Apple Quick Look–grade world anchoring **100% inside Microsoft Edge** with zero external app handoffs and zero third-party CDN dependencies, we integrated **Niantic / 8th Wall's production C++/WebAssembly 6DoF Visual-Inertial SLAM Engine** (`@8thwall/engine-binary@1.0.0`), self-hosted directly inside this repository's `public/xr/` folder.

### Why This Works
- **True 6DoF Visual-Inertial SLAM (`xr-slam.js`)**: Runs real-time feature-point extraction, bundle adjustment, and surface hit-testing (`XR8.XrController.hitTest`) in WebAssembly, syncing calibrated `camera.projectionMatrix`, `camera.position`, and `camera.quaternion` directly into Three.js on every frame.
- **Automatic iPhone 15 / 15 Pro Lens Calibration**: `xr.js` automatically enumerates iOS 16.4+ cameras and locks onto the calibrated 1× `"Back Camera"`, applies per-device lens intrinsics, and runs the iOS 15.4+ WebGL2 `gl.finish()` frame sync to eliminate camera-to-3D tearing.
- **100% Same-Origin & Intune MAM Safe**: Everything executes inside Edge's browser sandbox using standard `getUserMedia` + WebGL2 + WebAssembly—no data leaves Edge and no external CDN (`jsdelivr`, etc.) is required.
- **Unified iOS Permission Flow**: `xr.js` manages camera, `DeviceOrientationEvent`, and `DeviceMotionEvent` permissions internally (automatically prompting with a tap-to-continue modal if iOS requires a fresh user gesture).

---

## 3. Required Static Assets & Licensing

### Package Installed
```bash
npm install @8thwall/engine-binary
```

### Self-Hosted Runtime Files Copied to `public/xr/`
Only the SLAM chunk and required metadata are copied from `node_modules/@8thwall/engine-binary/dist/` (keeping total static payload to ~6.3 MB instead of bundling unused Face/Semantics models):

| Source (`node_modules/@8thwall/engine-binary/dist/`) | Destination (`public/xr/`) | Size | Purpose |
| :--- | :--- | :--- | :--- |
| `xr.js` | `public/xr/xr.js` | ~1.0 MB | Core 8th Wall WebAR runtime, camera manager, Three.js pipeline |
| `xr-slam.js` | `public/xr/xr-slam.js` | ~5.3 MB | C++/WASM 6DoF Visual-Inertial SLAM & hit-testing chunk |
| `LICENSE` | `public/xr/LICENSE` | ~16 KB | Niantic Spatial XR Engine Binary license |
| `resources/powered-by.svg` | `public/xr/resources/powered-by.svg` | ~6 KB | Attribution graphic referenced by `xr.js` |

### Attribution Requirement
Per the `@8thwall/engine-binary` binary license (free for commercial and non-commercial self-hosted use; no modifying/recompiling the binary), retain the attribution notice in source/HTML:
```text
This product includes the XR Engine software developed by Niantic Spatial, Inc.
Copyright © Niantic Spatial, Inc. All rights reserved.
```

---

## 4. Technical Blueprint to Replicate Across Other AR Pages

Follow these exact implementation rules when replicating this viewer for additional `.glb` models or AR subpages:

### Step 1: Expose `window.THREE` Before Loading `XR8`
8th Wall's `XR8.Threejs.pipelineModule()` looks up `window.THREE` globally:
```ts
(window as Window & { THREE?: typeof THREE }).THREE = THREE;
```

### Step 2: Load `xr.js` as a Classic `<script>` Under `BASE_PATH`
`xr.js` computes its chunk base URL synchronously from `document.currentScript.src` (`new URL('./', document.currentScript.src)`). Always load it as a standard `<script>` (never `type="module"` or inline) with `data-preload-chunks="slam"`:
```ts
const script = document.createElement('script');
script.src = `${BASE_PATH}/xr/xr.js`;
script.async = true;
script.setAttribute('data-preload-chunks', 'slam');
script.setAttribute('data-xr8-engine', 'true');
document.head.appendChild(script);
```
Wait for the `xrloaded` window event (or reuse `window.XR8` if already loaded across Next.js client-side route transitions, ensuring `await XR8.loadChunk('slam')` if `XR8.XrController` is missing).

### Step 3: Configure SLAM & Add Pipeline Modules in Exact Order
```ts
XR8.XrController.configure({
  scale: 'responsive',          // Locks 6DoF immediately on frame 1 without waiting for IMU metric scale convergence
  disableWorldTracking: false,
});

XR8.addCameraPipelineModules([
  XR8.GlTextureRenderer.pipelineModule(), // 1. Draws live rear camera feed into WebGL canvas
  XR8.Threejs.pipelineModule(),           // 2. Syncs SLAM camera pose/intrinsics & renders Three.js scene
  XR8.XrController.pipelineModule(),      // 3. Runs WASM 6DoF Visual-Inertial SLAM
  reactSafeCanvasModule,                  // 4. Keeps Retina canvas sizing without reparenting DOM
  arSceneModule,                          // 5. Loads GLB, runs hit-test, updates animations & gestures
]);

XR8.run({
  canvas,
  allowedDevices: XR8.XrConfig.device().ANY,
  cameraConfig: { direction: XR8.XrConfig.camera().BACK },
});
```

### Step 4: Critical Next.js / React / Three.js r160 Gotchas (Already Solved)
1. **Do NOT use `XR8.FullWindowCanvas.pipelineModule()` in React/Next.js**:
   - `XR8.FullWindowCanvas` calls `document.body.appendChild(canvas)`, moving `<canvas>` out of React's DOM container and causing `NotFoundError` crashes when navigating away.
   - **Solution**: Size `canvas.width = Math.round(window.innerWidth * dpr)` / `canvas.height = Math.round(window.innerHeight * dpr)` (`dpr <= 2`) in a custom `reactSafeCanvasModule`, and enforce `canvas.style.width = '100%'; canvas.style.height = '100%';` (plus Tailwind `w-full! h-full!`) inside `onCanvasSizeChange` so `XR8.Threejs`'s internal `renderer.setSize(w, h)` never zooms the canvas past the viewport.
2. **Three.js `r160` Color Space & Ground Shadows**:
   - Inside `arSceneModule.onStart`:
     - Set `renderer.outputColorSpace = THREE.SRGBColorSpace`, `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `renderer.toneMappingExposure = 1.1`.
     - Enable `renderer.shadowMap.enabled = true` (`PCFSoftShadowMap`) with a `THREE.ShadowMaterial({ opacity: 0.36 })` plane positioned at the ground surface (`baseSurfaceY + 0.002`) so the object casts a grounded real-time shadow (and visibly lifts off its shadow when elevated).
3. **Initial Camera Origin, Scale Multiplier & Hybrid Hit-Test**:
   - In `scale: 'responsive'`, 8th Wall sets its internal world scale multiplier `d = origin.y` (`xr-slam.js`). Using `origin.y = 1.0` (instead of `1.4+`) prevents unnecessary translation amplification, especially when viewing on closer surfaces/desks.
   - Pass tightened depth clipping planes (`cam: { nearClipPlane: 0.08, farClipPlane: 40.0 }`) to `XR8.XrController.updateCameraProjectionMatrix` for improved mobile WebGL depth precision.
   - While scanning (`!isPlaced`), call `XR8.XrController.hitTest(normX, normY, ['DETECTED_SURFACE', 'ESTIMATED_SURFACE'])` first, falling back to raycasting the SLAM-tracked `camera` onto the horizontal ground plane (`y = baseSurfaceY + heightOffset`).
   - Once placed (`isPlaced = true`), lock the model's world `(x, z)` coordinates unless the user explicitly drags with 1 finger.
4. **Adaptive One-Euro 6DoF Pose Stabilizer (iPhone OIS-vs-IMU Hand-Shake Fix)**:
   - On iPhone 15 / 15 Pro, hardware Sensor-Shift OIS stabilizes tiny hand tremors (`4–15 Hz`) out of the `getUserMedia` camera video, while the chassis IMU still reports those micro-tremors to SLAM with ~33ms lower latency than the video frame—causing tiny hand shakes to appear amplified on screen.
   - In `arSceneModule.onUpdate` (which runs after `XR8.Threejs.onUpdate` overwrites the raw camera pose and before `XR8.Threejs.onRender` draws the scene), apply an **Adaptive One-Euro Filter** to both `camera.position` (low cutoff `0.35–0.75 Hz` when still, ramping up with `beta = 8.0` while walking) and `camera.quaternion` (`1.4–2.2 Hz` inside `< 0.15°` micro-tremor knee, ramping up with `beta = 28.0` on intentional pans) plus `sceneCamera.updateMatrixWorld(true)`.
5. **No Competing iOS Permission Prompts**:
   - Do **not** trigger `DeviceOrientationEvent.requestPermission()` or `DeviceMotionEvent.requestPermission()` inside `<Link>` click handlers leading to an 8th Wall page. Let `xr.js` manage all camera and sensor permissions cleanly.
6. **Clean Unmount on Route Change**:
   - Always call `XR8.stop()` and `XR8.clearCameraPipelineModules()` in React's `useEffect` cleanup and on the Back button `onClick` so the camera hardware is released cleanly and revisiting the page works without duplicate pipelines.

---

## 5. Approved UX & Gesture Specification

| State / Gesture | Behavior |
| :--- | :--- |
| **Before Placement (Scanning)** | Displays the Microsoft Power Apps–style orange floor circle pointer (`#f59e0b` outer ring, white inner ring, orange center dot) tracking the floor via SLAM hit-test. |
| **Tap Anywhere on Screen** | Places and anchors the 3D `.glb` model at the orange circle pointer, bottom-aligned to the surface and facing the camera. |
| **1-Finger Drag (Placed)** | Slides the model smoothly across its anchored horizontal floor plane (shows the orange circle while sliding). |
| **2-Finger Pinch In / Out** | Scales the model (`0.2x` – `4.0x`). |
| **2-Finger Twist** | Rotates the model strictly around its vertical **Y-axis** (keeps the model upright). |
| **3-Finger Swipe Up / Down** | Raises or lowers the model's vertical elevation relative to the floor (uses `{ passive: false }` on `touchstart`/`touchmove` to prevent iOS system 3-finger gestures from cancelling touches, scales speed 1:1 with camera depth, keeps ground shadow anchored on the floor, and displays a live elevation readout while adjusting). |
| **Animation Playback** | `.glb` models with animations load **paused on frame 0** (`mixer.update(0)` with `action.paused = true`), controlled by a single circular icon-only **Play / Pause** button in the bottom-left corner once placed. |
| **Navigation** | Top-left rounded pill back button (`Back to Static AR` / respective gallery) matching the site's subpage design system. |
