// src/app/core/config/layer.config.ts
import { environment } from '../../../environments/environment';

/** Minimal description for a GIS layer that the app consumes. */
export interface LayerConfig {
    /** Human‑readable description (used in UI list) */
    readonly description: string;
    /** URL of the ArcGIS / WMS endpoint */
    readonly url: string;
    /** Underlying service type – useful for branching logic */
    readonly type: 'Feature' | 'WMS' | string;
    /** Should the layer be shown in the layer list by default? */
    readonly show: boolean;
    /** Is the layer visible on map load? */
    readonly visible: boolean;
}

/**
 * Centralised list of all map layers.
 * Directly pulled from `environment.urls_layers` – no hard‑coded strings in components.
 */
export const LAYER_CONFIGS: readonly LayerConfig[] = Object.freeze(
    environment.urls_layers.map(l => ({
        description: l.description,
        url: l.url,
        type: l.type,
        show: l.show,
        visible: l.visible,
    }))
);
