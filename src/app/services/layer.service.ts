import { Injectable } from '@angular/core';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import { Subject } from 'rxjs';
import type * as __esri from '@arcgis/core';

@Injectable({
  providedIn: 'root'
})
export class LayerService {
  private layerSubject = new Subject<__esri.Layer>();
  layerObservable$ = this.layerSubject.asObservable();
  private graphicLayer: GraphicsLayer;

  constructor() {
    this.graphicLayer = new GraphicsLayer({ listMode: "hide" });
  }

  addLayer(layer: __esri.Layer) {
    this.layerSubject.next(layer);
  }

  getGraphicLayer(): GraphicsLayer {
    return this.graphicLayer;
  }
}
