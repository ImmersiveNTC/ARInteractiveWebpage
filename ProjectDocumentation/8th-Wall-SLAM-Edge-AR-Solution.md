# Approved Solution: In-Browser 6DoF WebAR Anchoring for Intune-Managed iPhones (Microsoft Edge)

- **Status:** Approved & Verified on Device
- **Date Recorded:** 2026-11-20
- **Verified Implementation Commits:**
  - `a64f222` — Self-hosted 8th Wall 6DoF Visual-Inertial SLAM integration
  - `2e92a4a` — 3-finger elevation gesture fix & depth-scaled vertical tracking
  - `cd09f96` — Adaptive One-Euro 6DoF pose stabilizer, `origin.y = 1.0` scale fix, and tightened depth clip planes (eliminated hand-shake jitter)
- **Verified Hardware / Browsers:** iPhone 15 & iPhone 15 Pro — Microsoft Edge (Intune MAM Managed), iOS Chrome, iOS Safari
- **Reference Implementation Files:**
  - `components/MRTestViewer.tsx`
  - `app/MRTest/page.tsx`
  - `public/xr/xr.js`, `public/xr/xr-slam.js`, `public/xr/LICENSE`, `public/xr/resources/powered-by.svg`

---

## 1. Problem Context & Enterprise Constraints

On corporate iPhones managed by **Microsoft Intune App Protection Policies (MAM)** using **Microsoft Edge**:

1. **AR Quick Look (`<a rel="ar">`) fails inside Edge iOS**: Edge runs inside `WKWebView`, which does not route `rel="ar"` or `.usdz` / `.reality` files to Apple's native `QLPreviewController` — it opens a blank preview with a Share button instead.
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
  arSceneModule,                          // 5. Loads GLB, stabilizes 6DoF pose, runs hit-test, animations & gestures
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
2. **Three.js `r160` Color Space & Floor-Anchored Ground Shadows**:
   - Inside `arSceneModule.onStart`:
     - Set `renderer.outputColorSpace = THREE.SRGBColorSpace`, `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `renderer.toneMappingExposure = 1.1`.
     - Enable `renderer.shadowMap.enabled = true` (`PCFSoftShadowMap`) with a `THREE.ShadowMaterial({ opacity: 0.36 })` plane pinned to `baseSurfaceY + 0.002` (not `modelGroup.position.y`) so the object visibly lifts off its shadow when elevated with 3 fingers.
3. **Hybrid Placement Hit-Test**:
   - While scanning (`!isPlaced`), call `XR8.XrController.hitTest(normX, normY, ['DETECTED_SURFACE', 'ESTIMATED_SURFACE'])` first, falling back to raycasting the SLAM-tracked `camera` onto the horizontal ground plane (`y = baseSurfaceY + heightOffset`).
   - Once placed (`isPlaced = true`), lock the model's world `(x, z)` coordinates unless the user explicitly drags with 1 finger.
4. **No Competing iOS Permission Prompts**:
   - Do **not** trigger `DeviceOrientationEvent.requestPermission()` or `DeviceMotionEvent.requestPermission()` inside `<Link>` click handlers leading to an 8th Wall page. Let `xr.js` manage all camera and sensor permissions cleanly.
5. **Clean Unmount on Route Change**:
   - Always call `XR8.stop()` and `XR8.clearCameraPipelineModules()` in React's `useEffect` cleanup and on the Back button `onClick` so the camera hardware is released cleanly and revisiting the page works without duplicate pipelines.

---

## 5. Verified Hand-Shake & Jitter Stabilization (Critical for iPhone 15 / 15 Pro)

Even with 8th Wall SLAM active, testing on iPhone 15 and 15 Pro revealed that tiny hand tremors (`~500 µm`) produced noticeable `~5 mm` high-frequency shaking on the 3D object compared to Apple Quick Look. Investigation identified three root causes and the exact verified fix (`cd09f96`):

### Root Causes
1. **8th Wall Responsive Scale Multiplier (`d = origin.y`)**: Inside `xr-slam.js`, `scale: 'responsive'` sets its internal SLAM world scale factor directly to `origin.y`. Initializing `camera.position.set(0, 1.4, 0)` multiplied every camera translation delta by `1.4×` (and up to `3–4×` when pointing at a nearby table/desk).
2. **iPhone OIS vs. Chassis IMU Mismatch**: Native `ARKit` (Quick Look) disables/compensates Optical Image Stabilization (OIS) in hardware. In browser `getUserMedia`, iPhone Sensor-Shift OIS stabilizes `4–15 Hz` hand tremors out of the video background while the chassis IMU still sends 100% of that tremor to SLAM ~33ms earlier than the video frame—causing the 3D object to vibrate against a steady video background.
3. **Default Clip Plane Ratio (`0.01` to `1000`)**: A `100,000:1` near/far ratio reduced mobile WebGL depth precision.

### Verified Stabilization Formula & Parameters
1. **Set `origin.y = 1.0` & Tighten Clip Planes**:
   ```ts
   camera.position.set(0, 1.0, 0); // Keeps internal SLAM scale d = 1.0 (no amplification)
   XR8.XrController.updateCameraProjectionMatrix({
     cam: { nearClipPlane: 0.08, farClipPlane: 40.0 },
     origin: camera.position,
     facing: camera.quaternion,
   });
   ```
   Normalize initial model bounding size to `0.85 / maxDim` so visual framing matches `origin.y = 1.0`.
2. **Adaptive One-Euro 6DoF Pose Filter in `arSceneModule.onUpdate`**:
   Because `XR8.Threejs.onUpdate` overwrites `camera.position` and `camera.quaternion` from SLAM on every frame (and never reads them back into SLAM), applying a One-Euro filter inside `arSceneModule.onUpdate` (between `XR8.Threejs.onUpdate` and `XR8.Threejs.onRender`) removes hand-shake jitter with zero tracking lag during fast motion:

   | Parameter | Position Filter (`camera.position`) | Rotation Filter (`camera.quaternion`) | Purpose |
   | :--- | :--- | :--- | :--- |
   | **Micro-tremor knee** | `< 0.003` (`3 mm`) → `0.35 Hz` | `< 0.0026 rad` (`0.15°`) → `1.4 Hz` | Absorbs OIS-vs-IMU tremor when holding phone still |
   | **Base cutoff (`minCutoff`)** | `0.75 Hz` | `2.2 Hz` | Smooth transition out of stillness |
   | **Speed slope (`beta`)** | `8.0` | `28.0` | Ramps cutoff to `20–60 Hz` on walks/pans (near-zero lag) |
   | **Speed smoothing (`dCutoff`)** | `1.0 Hz` | `1.5 Hz` | Prevents spiky velocity readings from triggering false jumps |
   | **Relocalization snap guard** | `> 0.75` units → snap immediately | `> 0.6 rad` → snap immediately | Prevents slow drift-in after SLAM relocalization |

   Always call `sceneCamera.updateMatrixWorld(true)` after writing the filtered pose so Three.js renders and raycasts with the exact stabilized camera matrix.

---

## 6. Key Engineering Learnings ("What Works" vs "What to Avoid")

| Topic | Avoid (Proven Dead Ends) | Approved Approach (Verified on iPhone 15 / 15 Pro) |
| :--- | :--- | :--- |
| **AR in Intune-Managed Edge** | `x-safari-https://` redirect (blocked by Intune MAM); `<a download>` USDZ (opens blank share page in Edge); custom JS gyro/optical-flow tracking (drifts & jitters). | Self-hosted **8th Wall 6DoF Visual-Inertial SLAM** (`@8thwall/engine-binary`) running `.glb` directly inside Edge WebGL2. |
| **SLAM Scale Mode** | `scale: 'absolute'` without coaching UI (stays stuck in `INITIALIZING` or jumps when metric scale converges); `origin.y > 1.0` in `responsive` mode (amplifies jitter). | `scale: 'responsive'` with `origin.y = 1.0`, `nearClipPlane: 0.08`, `farClipPlane: 40.0`, and Adaptive One-Euro 6DoF filtering. |
| **Canvas Sizing in Next.js** | `XR8.FullWindowCanvas.pipelineModule()` (reparents `<canvas>` to `document.body`, crashing React unmount); leaving `renderer.setSize(w, h)` pixel inline styles uncapped at Retina DPR. | Custom `reactSafeCanvasModule` sizing `canvas.width/height` at `dpr <= 2` while locking `canvas.style.width/height = '100%'`. |
| **3-Finger Elevation on iOS** | `{ passive: true }` on `touchstart` (iOS 3-finger Undo/Redo gesture cancels touch); fixed `deltaY * 0.0045` multiplier (feels sluggish at depth); moving `shadowPlane.y` up with the model. | `{ passive: false }` on `touchstart` & `touchmove` with `e.preventDefault()` for `touches.length >= 2`; lazy init for `touches.length >= 3`; depth-scaled `unitsPerPx`; shadow pinned to `baseSurfaceY`. |
| **iOS Sensor Permissions** | Calling `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()` concurrently or inside `<Link>` click handlers before navigating. | Let `xr.js` manage camera + orientation + motion permissions natively inside the AR page. |

---

## 7. Approved UX & Gesture Specification

| State / Gesture | Behavior |
| :--- | :--- |
| **Before Placement (Scanning)** | Displays the Microsoft Power Apps–style orange floor circle pointer (`#f59e0b` outer ring, white inner ring, orange center dot) tracking the floor via SLAM hit-test. |
| **Tap Anywhere on Screen** | Places and anchors the 3D `.glb` model at the orange circle pointer, bottom-aligned to the surface and facing the camera. |
| **1-Finger Drag (Placed)** | Slides the model smoothly across its anchored horizontal floor plane (shows the orange circle while sliding). |
| **2-Finger Pinch In / Out** | Scales the model (`0.2x` – `4.0x`). |
| **2-Finger Twist** | Rotates the model strictly around its vertical **Y-axis** (keeps the model upright). |
| **3-Finger Swipe Up / Down** | Raises or lowers the model's vertical elevation (`±5.0m`) at 1:1 screen depth speed, keeps the ground shadow anchored on the floor, and shows a live `Elevation ±0.xxm` badge while dragging. |
| **Animation Playback** | `.glb` models with animations load **paused on frame 0** (`mixer.update(0)` with `action.paused = true`), controlled by a single circular icon-only **Play / Pause** button in the bottom-left corner once placed. |
| **Navigation** | Top-left rounded pill back button (`Back to Static AR` / respective gallery) matching the site's subpage design system, with `onTouchStart` and `onPointerDown` `stopPropagation()`. |

---

## 8. Future Guidelines & Rollout Checklist

When rolling this approved viewer out from the `/MRTest` prototype into production AR subpages (`/ARs/[slug]`, `/ARi/[slug]`, or a unified cross-browser AR component):

1. **Browser Routing Strategy**:
   - **iOS Safari & iOS Chrome**: Continue using native **AR Quick Look** (`.usdz` / `.reality`) with the preloading progress bar for native OS-level ARKit + LiDAR.
   - **Microsoft Edge on iOS (Intune-managed), Firefox iOS, & Android**: Launch the **Self-Hosted 8th Wall SLAM Viewer** using the corresponding `.glb` asset (no external app handoff, works inside managed corporate browsers).
   - **Desktop**: Keep the 3D interactive preview + QR code panel.
2. **Asset Pairing & Performance Guidelines**:
   - Keep `.glb` models optimized (ideally `< 5–10 MB`, compressed textures, clean pivot/mesh bounds) so mobile WebGL2 loads quickly alongside the 5.3 MB `xr-slam.js` chunk.
   - Because the SLAM viewer auto-bottom-aligns models (`-box.min.y * normScale`), ensure `.glb` files do not contain stray floating helper nodes below the base mesh.
   - Ensure animated `.glb` models have frame `0` posed cleanly as their default resting state since animations load paused on frame `0`.
3. **Reusable Component Refactoring Guideline**:
   - Extract `MRTestViewer.tsx` into a reusable `WebARSlamViewer` component accepting `{ glbUrl: string; displayName: string; backHref: string; backLabel: string }`.
   - Never instantiate two `XR8` sessions simultaneously; always verify `XR8.stop()` + `XR8.clearCameraPipelineModules()` runs on unmount.
4. **Device QA Checklist Before Releasing Any New AR Page**:
   - [ ] Test on an **Intune-managed iPhone in Microsoft Edge** (verify zero Intune transfer prompts and zero CDN errors).
   - [ ] Verify object stays **firmly anchored** when walking forward, backing up, and walking 180°–360° around it.
   - [ ] Verify **holding the phone still** produces no exaggerated hand-shake jitter (One-Euro filter active).
   - [ ] Verify all 4 gestures: **Tap to place**, **1-finger floor slide**, **2-finger pinch scale + Y-twist**, and **3-finger elevation up/down** (shadow remains on floor).
   - [ ] Verify **Play / Pause icon** starts paused at frame 0 and toggles cleanly without triggering a floor slide.
   - [ ] Verify **Back button** releases the rear camera LED cleanly and re-entering the AR page works on a second visit.
