# Gravity Simulator

Gravity Simulator is a browser-based 2D physics playground built with vanilla HTML, CSS, and JavaScript. You can spawn cube and sphere bodies, tune gravity and size, run or step the simulation, drag objects directly on canvas, and inspect real-time status metrics.

## Highlights

- Canvas-based simulation loop with delta-time integration and requestAnimationFrame.
- Per-object physics model with position, velocity, acceleration, gravity, size, color, and lock state.
- Shape-aware rendering and hit testing for cubes and spheres.
- Object lifecycle workflows: add, select, edit, duplicate, delete, and reset.
- Bulk edit pipeline with replace/add/multiply modes.
- Simulation controls: start, pause, reset, step, time scale, global gravity.
- Visual toggles for collisions, trails, and velocity vectors.
- Performance safeguards: object cap, NaN recovery, broad-phase collision pruning, overload warnings.
- Accessibility and UX support: keyboard shortcuts, ARIA attributes, touch-friendly interactions, and built-in help modal.

## Project Structure

- index.html: Application layout, controls, modal, and semantic structure.
- styles.css: Layout, design tokens, responsive behavior, focus/touch affordances.
- script.js: State store, physics engine, event handling, rendering, and UI synchronization.
- assets/: Static assets (if used).
- devlogs/: Implementation logs for completed milestones.

## How To Run

No build step is required.

1. Open index.html in a modern browser.
2. Interact with controls in the right panel and toolbar.

Optional local server (recommended for a cleaner browser workflow):

```powershell
cd C:\Users\Anup\Documents\gravity-sim
python -m http.server 8000
```

Then open http://localhost:8000.

## Core Controls

### Toolbar

- Start: Run continuous simulation.
- Pause: Stop simulation loop.
- Reset: Stop simulation and clear all objects.
- Step: Advance a single frame.
- Help: Open quick instructions modal.

### Simulation Settings

- Global Gravity (number + slider): Updates gravity for all objects.
- Time Scale: Slows down or speeds up simulation.
- Enable collisions: Turns pairwise collision response on/off.
- Show trails/paths: Toggles trajectory rendering.
- Show velocity vectors: Toggles velocity arrow rendering.

### Object Workflows

- Create Object: Choose shape, size, gravity, and spawn mode.
- Select on canvas: Click/tap object to open selected editor.
- Edit Selected: Change size live.
- Duplicate/Delete: Manage selected object lifecycle.
- Bulk Edit: Apply gravity/size changes to all objects with replace/add/multiply.

## Keyboard Shortcuts

- H: Open help modal.
- N: Select next object.
- Arrow keys: Move selected object.
- Shift + Arrow keys: Move selected object faster.
- Delete or Backspace: Delete selected object.
- Ctrl+D (Cmd+D on macOS): Duplicate selected object.

## Physics + Rendering Notes

- Simulation uses explicit velocity/position integration per frame in advanceSimulationByDelta.
- Gravity applies as direct acceleration on the y-axis.
- Objects respect world bounds and floor damping.
- Collision response uses a broad-phase x-axis sweep before narrow-phase impulse resolution.
- Trails and vectors are optional rendering passes for performance control.

## Current Limitations

- Scene save/load/export/import UI is not exposed yet.
- Automated test runner file is not included in the current workspace.
- Some launch tasks (README screenshots, deployment, final QA) remain outside runtime logic.

## Development Notes

- Keep changes state-driven through simulationStore.update to avoid UI drift.
- Reuse existing helpers for object patching (applyObjectSourcePatch) and recalculation.
- Preserve responsive and accessible behavior when adding controls.
- Run a quick problems check after edits to ensure script/index/styles stay error-free.
