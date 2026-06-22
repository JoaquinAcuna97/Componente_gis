// src/app/core/config/padron.config.ts

/** Configuration for Padron (cadastral parcels) service */
export const PADRON_CONFIG = Object.freeze({
  /** Base URL for the ArcGIS query endpoint. Centralised so it can be overridden per environment. */
  baseUrl: 'https://mapastest.mgap.gub.uy/arcgis/rest/services/SNIA_Temas/ParcelasCatastrales/MapServer/0/query',

  /** Default polygon symbol for Padron features */
  polygonSymbol: {
    // semi‑transparent orange fill with a solid outline – adjust as needed
    fillColor: [227, 139, 79, 0.4],
    outlineColor: [227, 139, 79, 1],
    outlineWidth: 2,
  },
});
