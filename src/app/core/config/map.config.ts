import { environment } from '../../../environments/environment';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Color from '@arcgis/core/Color';

export interface MapStyleConfig {
  readonly bufferDistance: number; // meters
  readonly defaultPointSymbol: SimpleMarkerSymbol;
  readonly hoverPointSymbol: SimpleMarkerSymbol;
}

export const MAP_CONFIG: MapStyleConfig = {
  bufferDistance: (environment as any).GIS_BUFFER_DISTANCE ?? 1000,
  defaultPointSymbol: new SimpleMarkerSymbol({
    style: "circle",
    color: new Color(environment.puntos.color_ptos_static),
    size: environment.puntos.pto_size_static,
    outline: new SimpleLineSymbol({
      color: new Color(environment.puntos.color_ptos_outline),
      width: 1,
    }),
  }),
  hoverPointSymbol: new SimpleMarkerSymbol({
    style: "circle",
    color: new Color(environment.puntos.color_ptos_hover),
    size: environment.puntos.pto_size_hover,
    outline: new SimpleLineSymbol({
      color: new Color(environment.puntos.color_ptos_outline),
      width: 2,
    }),
  }),
} as const;
