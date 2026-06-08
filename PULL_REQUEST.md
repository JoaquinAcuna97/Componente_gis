# Pull Request Documentation: Drawing & Search Features and Feature Flags

This document summarizes the changes introduced in the `feature/feature-flags` branch, detailing the new feature flags, the drawing and search widgets, and related bug fixes.

---

## 1. Feature Flags Overview

We introduced two environment-level feature flags to control the loading of the new tools without altering the main component layout templates (`app.component.html`).

| Feature Flag | Configuration Property | Description |
| :--- | :--- | :--- |
| **Drawing Tool** | `enableDrawTool` | Enables polygon and polyline sketching tools inside an Expand panel at the top-right of the map view. |
| **Search Feature** | `enableSearchFeature` | Enables a search widget at the top-left of the map view to search within loaded map layers and query layers. |

### Environment Configuration Example

In `src/environments/environment.development.ts`:
```typescript
export const environment = {
    // ... other settings
    
    // Enable/disable drawing tool (lines and polygons)
    enableDrawTool: true,

    // Enable/disable layer search feature
    enableSearchFeature: true
};
```

---

## 2. Implemented Features

### Drawing Tool (Lines & Polygons)
* **Widget Integration**: Creates a separate `GraphicsLayer` and `Sketch` widget specifically configured with `availableCreateTools: ['polyline', 'polygon']`.
* **State Synchronization**: Hooks into the Sketch widget's lifecycle events to post structured GeoJSON messages back to the parent application using the `MessageService`:
  * `DRAW_CREATED` — Fired when a line or polygon is completed.
  * `DRAW_UPDATED` — Fired when a line or polygon is modified/moved.
  * `DRAW_DELETED` — Fired when a sketch is deleted.
* **Component Cleanup**: Automatically destroys the Sketch widget and removes the `GraphicsLayer` during `ngOnDestroy` to prevent memory leaks.

### Layer Search Feature
* **Widget Integration**: Adds an ArcGIS `Search` widget wrapped in a collapsible `Expand` panel at `top-left`.
* **Selected Layer & Multi-Source Search**:
  * Automatically creates search sources for query-only layers (*Departamentos*, *Padrones*, and *Seccionales Policiales*) mapping their specific search fields (e.g. `NOMBRE`, `PADRON`, `SECCION`).
  * Dynamically discovers and builds search sources for any `FeatureLayer` currently added to the map (e.g. *Calles*), automatically identifying text and object identifier fields.
  * Listens to map layer collection changes to register new layers as search sources dynamically.
  * Supports selecting a specific layer source to search on, or searching across all sources simultaneously.

---

## 3. Bug Fixes

### TypeScript Geometry Null Check Fix
* Fixed strict null-check compiler errors (`TS18049`) inside `graphicToGeoJSON` and `graphicCollectionToGeoJSON` helpers.
* Modified the code to safely use the optional chaining operator (`graphic.geometry?.toJSON()`) and fallback to `null` to comply with strict type definitions while maintaining GeoJSON format standards.
