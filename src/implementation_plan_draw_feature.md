# Implement Polygon and Polyline Drawing in DrawComponent

Enable the user to create and edit polygon and polyline drawings on the map using `@arcgis/core`. This will be built into the `DrawComponent` which is controlled by the `enableDrawTool` feature flag.

## User Review Required

> [!NOTE]
> Since the project already has a `GraphicComponent` which initializes its own `Sketch` widget (restricted to points), the new `DrawComponent` will create its own independent `GraphicsLayer` and a separate `Sketch` widget focused on drawing lines and polygons. We will mount this Sketch widget inside the View's UI (e.g. at the `top-right` or inside an Expand widget).

## Proposed Changes

We will pass the map and view subjects from the `AppComponent` into the `DrawComponent` to allow access to the active map view.

---

### GIS Component

#### [MODIFY] [app.component.html](file:///c:/Users/wacuna/Documents/angular/Componente_gis/src/app/app.component.html)
Pass `mapSubject` and `viewSubject` to `<app-draw>` and ensure they are loaded before initialization:
```html
<app-draw *ngIf="featureFlags.enableDrawTool && mapSubject && viewSubject" [mapSubject]="mapSubject" [viewSubject]="viewSubject"></app-draw>
```

#### [MODIFY] [draw.component.ts](file:///c:/Users/wacuna/Documents/angular/Componente_gis/src/app/features/draw/draw.component.ts)
Implement the drawing logic using `@arcgis/core`:
- Add inputs: `mapSubject` and `viewSubject`.
- Instantiate a new `GraphicsLayer` for drawing and add it to the `Map`.
- Instantiate `Sketch` from `@arcgis/core` with `availableCreateTools: ['polyline', 'polygon']`.
- Wrap the Sketch widget in an `Expand` panel and add it to the view's UI at `top-right`.
- Hook into Sketch lifecycle events (`create`, `update`, `delete`) and communicate drawing states/features back to the parent application using `MessageService` (e.g., `DRAW_CREATED`, `DRAW_UPDATED`, `DRAW_DELETED`).
- Implement clean up on component destruction (`ngOnDestroy`) to remove the graphics layer and destroy widgets.

## Verification Plan

### Automated/Manual Verification
1. We will verify the project builds cleanly:
   ```powershell
   npx ng build --configuration=development
   ```
2. Once deployed or run locally, verifying:
   - The draw panel appears if `enableDrawTool` is `true`.
   - The user can select polygon or polyline tools, draw on the map, edit existing shapes, and delete them.
   - Appropriate events are logged/sent via the postMessage mechanism.
