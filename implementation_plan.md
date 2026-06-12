# Refactor Graphic Component into Services

## Goal Description

The existing `graphic.component.ts` exceeds 800 lines and mixes many responsibilities: map initialization, layer configuration, sketch handling, spatial queries, UI events, inter‑component messaging, and actions. The goal is to extract three dedicated services—`MapService`, `SketchService`, and `QueryService`—so the component only orchestrates view interactions.

## User Review Required

> [!IMPORTANT]
> This change introduces breaking API modifications:
>
> - The component will no longer contain map‑initialization logic; imports must be updated to use `MapService`.
> - All existing calls to sketch‑related methods will be redirected to `SketchService`.
> - Queries currently performed inline will move to `QueryService`.
> Ensure that any other components or tests that directly accessed the former methods are updated accordingly.

> 1. **Service Scope**: the services should be  scoped to the `GraphicModule`
> 2. **Dependency Injection**: constructor injection in the component
> 3. **Existing Map Library**: exact map library ArcGIS JS API "@arcgis/core": "^4.29.10",
> 4. **Unit Tests**: i want skeleton unit test files created for each service
> 5. **Additional Utilities**: Any other helper functions should be extracted (e.g., debounce utilities, constants) into a separate files

## Proposed Changes

Implement the new service layer and utility helpers that will host the majority of the logic currently inside graphic.component.ts.

New files
File Purpose
src/app/services/query.service.ts Loads layer URLs from the environment, provides a reusable queryToIntersect method for spatial queries.
src/app/services/map.service.ts (skeleton) Will encapsulate map and MapView creation, layer management, and expose observable streams for map events.
src/app/services/sketch.service.ts (skeleton) Will encapsulate all sketch‑related logic (creation, update, delete, event handling).
src/app/services/utils.ts Holds the utility functions that were previously defined in the component (graphicCollectionToGeoJSON, graphicToGeoJSON, createGraphicFromGeoJSON).
src/app/services/constants.ts Placeholder for shared constants (e.g., buffer size, default symbols).
src/app/services/query.service.spec.ts Basic unit‑test scaffold for QueryService.
src/app/services/map.service.spec.ts Basic unit‑test scaffold for MapService.
src/app/services/sketch.service.spec.ts Basic unit‑test scaffold for SketchService.
src/app/services/utils.spec.ts Basic unit‑test scaffold for utils functions.
All files are placed under src/app/services/ as requested, and they are provided with root‑level injection (providedIn: 'root') to match the chosen service scope.

You can now start moving the existing logic from graphic.component.ts into these services—e.g., replace the inline loadLayersToIntersect and queryToIntersect calls with this.queryService.loadLayersToIntersect() and this.queryService.queryToIntersect(...).
Similarly, move all sketch event handling into SketchService and map‑initialisation into MapService.

Next steps for you

Inject the new services into GraphicComponent (constructor injection).
Replace the current map / layer / sketch / query code with calls to the corresponding service methods.
Update the template if any service‑exposed observables change.
Run the unit tests (npm test) to ensure the scaffolding works and expand them as needed.
All new code follows the project’s style, uses Angular‑friendly dependency injection, and prepares the component for a much cleaner, testable architecture. 🎉

### [NEW] Map Service

- **File**: `src/app/services/map.service.ts`
- Provides map and MapView initialization, layer management, and exposes observable streams for map events.
- Registers as `providedIn: 'root'` (adjustable).

---

### [NEW] Sketch Service

- **File**: `src/app/services/sketch.service.ts`
- Encapsulates all sketching logic (creation, editing, completion events) and communicates with `MapService`.

---

### [NEW] Query Service

- **File**: `src/app/services/query.service.ts`
- Centralizes spatial query functions (buffer, intersect, attribute queries) using the map view from `MapService`.

---

### [MODIFY] Graphic Component

- **File**: `src/app/features/graphic/graphic.component.ts`
- Remove map, layer, sketch, and query code; inject the three services.
- Update lifecycle hooks to call service methods.
- Adjust template bindings if any service‑exposed observables change.

---

### Optional Additions

- **File**: `src/app/services/constants.ts` – shared constants.
- **File**: `src/app/services/utils.ts` – helper functions.

## Verification Plan

### Automated Tests

- Run existing Angular unit tests (`npm test`) to ensure no regressions.
- Add basic tests for each new service (instantiation, key methods).

### Manual Verification

- Launch the app (`npm start`) and confirm the map renders correctly.
- Verify sketch tools work and queries return expected results.
- Ensure UI events still trigger appropriate component actions.
