import { Component, Input, OnDestroy, OnInit, Inject } from '@angular/core';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Expand from '@arcgis/core/widgets/Expand';
import Point from '@arcgis/core/geometry/Point';
import Sketch from '@arcgis/core/widgets/Sketch'; // Import the 'Sketch' class
import LayerList from '@arcgis/core/widgets/LayerList';
import { MessageService } from '../message.service';

import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import { BehaviorSubject, Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { LayerService } from '../../services/layer.service';
import { PadronService } from '../../services/padron.service';
import { APP_CONFIG_TOKEN, AppConfig } from '../../core/config/app.config';
import { MAP_CONFIG } from '../../core/config/map.config';
import { LAYER_CONFIGS } from '../../core/config/layer.config';

@Component({
  selector: 'app-graphic',
  standalone: true,
  imports: [],
  templateUrl: './graphic.component.html',
  styleUrl: './graphic.component.css'
})


export class GraphicComponent implements OnInit, OnDestroy {
  map: Map;
  view: MapView;
  graphicLayer: GraphicsLayer;
  sketch: Sketch;
  @Input() mapSubject!: BehaviorSubject<Map | null>;
  @Input() viewSubject!: BehaviorSubject<MapView | null>;
  subscriptions: Subscription[] = [];
  private bkExpand_Sketch: Expand;
  private all_graphics: Graphic[] = [];
  private url_sp: string;
  private url_padrones: string;
  private url_deptos: string;
  private url_limiteNacional: string;
  private largeSymbol: SimpleMarkerSymbol; // for point zoom
  private polygonSymbol: SimpleFillSymbol; // for polygon rendering
  private originalSymbol: SimpleMarkerSymbol;
  private isPointFinished = true;
  private optionToSelectMultiplePoints: boolean;
  private graphicInProcess: Graphic | null;
  private onlyCreate = true;


  constructor(
    private messageService: MessageService,
    private padronService: PadronService,
    private layerService: LayerService,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig
  ) {
    this.loadLayersToIntersect();
    // simbología para puntos
    // Definir el símbolo de agrandamiento
    this.largeSymbol = MAP_CONFIG.hoverPointSymbol;
    // Initialize polygon symbol (fallback if not provided in config)
    this.polygonSymbol = (MAP_CONFIG as any).defaultPolygonSymbol || new SimpleFillSymbol({
      color: [227, 139, 79, 0.4], // semi-transparent fill
      outline: { color: [227, 139, 79, 1], width: 2 }
    });
    this.originalSymbol = MAP_CONFIG.defaultPointSymbol;
    this.optionToSelectMultiplePoints = this.appConfig.multiplePointSelection;
  }

  private enableSketchAfterPointCreated() {
    if (this.isPointFinished) {
      this.isPointFinished = false;
      this.changeStateMultipleSelectionSketch(false);
      this.enablePointCreation(false);
    } else {
      this.isPointFinished = true;
      this.changeStateMultipleSelectionSketch(this.optionToSelectMultiplePoints);
      this.enablePointCreation(true);
    }
    this.sketch.visibleElements.settingsMenu = false;
    this.sketch.visibleElements.duplicateButton = false;
    this.sketch.visibleElements.undoRedoMenu = false;
  }

  private changeStateMultipleSelectionSketch(value: boolean): void {
    this.sketch.visibleElements = {
      selectionTools: {
        "rectangle-selection": value, // Deshabilitar Seleccionar por rectángulo
        "lasso-selection": value
      }
    };   // Deshabilitar Seleccionar por lazo
  }


  ngOnInit() {
    const s1 = this.mapSubject.subscribe(map => {
      if (map) {
        this.map = map;
      }
    });

    const s2 = this.viewSubject.subscribe(view => {
      if (view) {
        this.view = view;
        this.setupGraphicsLayer();
        this.setupSketch();
        this.setupLayerList();
        this.setupHoverEffect();
        this.bkExpand_Sketch.visible = false;
      }
    });

    const s3 = this.messageService.mObservable$.subscribe(data => {
      //console.log(data, "data")
      if (data.message === 'ADD_FEATURES') {
        this.addGraphics(data.params);
        //this.zoomToAllFeatures();
      } else if (data.message === 'ZOOM_TO_FEATURE') {
        this.zoomToFeature(data.params.id);
      } else if (data.message === 'DELETE_FEATURES') {
        this.parentDeletingGraphics(data.params.ids);
      } else if (data.message === 'FINISHED_POINT') {
        if (this.graphicInProcess) {
          this.all_graphics.push(this.graphicInProcess);
          this.graphicInProcess = null;
        }
        this.enableSketchAfterPointCreated();
        this.selectAndEditCreatedPoint(null, false);
        this.sketchUpdate();
        if (!this.bkExpand_Sketch.visible) this.bkExpand_Sketch.visible = true;
      } else if (data.message === 'ONLY_VIEW') {
        //Solo visualziación | no hay vuelta atrás
        this.startViewMode();
      } else if (data.message === 'UPDATE_FEATURE') { //Modificar un punto, sólo puede modificar el punto con el id pasado por parámetro
        console.log("PIDEN ACTUALIAR ESTE PUNTO: ", data.params.id); //TODO: Error, me deja crear puntos
        this.cancelCreatePointMode();
        this.enableSketchAfterPointCreated();
        if (data.params && data.params.id) {
          const graph = this.selectGraphicById(data.params.id);
          if (graph) {
            this.graphicInProcess = graph;
            this.graphicInProcess.symbol = this.largeSymbol;
            this.zoomToFeature(data.params.id);
          }
          if (!this.bkExpand_Sketch.visible) this.bkExpand_Sketch.visible = true;
        }
      } else if (data.message === 'FIND_PADRON') {
        console.log(data.params, "params");
        this.handleFindPadron(data.params);

      }
    });

    this.subscriptions.push(s1, s2, s3);
  }
  private selectGraphicById(id: string): Graphic | null {
    if (this.all_graphics.length > 0) {
      const graphic = this.all_graphics.find((g) => g.attributes && g.attributes.id === id);
      return graphic || null;
    }
    else return null;
  }

  private startViewMode(): void {
    if (this.sketch) {
      this.sketch.cancel();
      //this.enablePointCreation(false);
      //this.sketch.visible = false;
      this.sketch.destroy();
      this.bkExpand_Sketch.visible = false;

    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  zoomToFeature(id: string) {
    console.log(id);
    const graphic = this.graphicLayer.graphics.find(g => g.attributes.id == id);
    if (graphic) {
      this.view.goTo({
        target: graphic,
        scale: 1000
      }, { duration: 2000 });
    }
  }

  zoomToAllFeatures() {
    if (this.view && this.graphicLayer) {
      this.view.when(() => {
        this.all_graphics = this.graphicLayer.graphics.toArray();
        if (this.all_graphics.length > 0) {
          let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;

          this.all_graphics.forEach(graphic => {
            const geometry = graphic.geometry;

            if (geometry) {
              if (geometry.type === "point") {
                const point = geometry as Point;
                xmin = Math.min(xmin, point.x);
                ymin = Math.min(ymin, point.y);
                xmax = Math.max(xmax, point.x);
                ymax = Math.max(ymax, point.y);
              } else if (geometry.extent) {
                xmin = Math.min(xmin, geometry.extent.xmin);
                ymin = Math.min(ymin, geometry.extent.ymin);
                xmax = Math.max(xmax, geometry.extent.xmax);
                ymax = Math.max(ymax, geometry.extent.ymax);
              }
            }
          });

          const centerX = (xmin + xmax) / 2;
          const centerY = (ymin + ymax) / 2;
          const extentWidth = xmax - xmin;
          const extentHeight = ymax - ymin;

          const viewWidthInMapUnits = this.view.width * this.view.resolution;
          const viewHeightInMapUnits = this.view.height * this.view.resolution;

          const scaleX = extentWidth / viewWidthInMapUnits;
          const scaleY = extentHeight / viewHeightInMapUnits;

          const scale = Math.max(scaleX, scaleY) * this.view.scale;

          this.view.goTo({
            center: [centerX, centerY],
            scale: scale * 1.2
          }, { duration: 1500 });
        } else {
          console.warn('No hay gráficos en la capa para hacer zoom.');
        }
      });
    }
  }

  setupHoverEffect() {
    let highlightedGraphic: Graphic | null = null;

    this.view.on("pointer-move", (event: any) => {
      this.view.hitTest(event).then((response: any) => {
        if (highlightedGraphic) {
          highlightedGraphic.symbol = this.originalSymbol;
          highlightedGraphic = null;
        }

        if (response.results.length) {
          const graphic = response.results.find((result: any) => {
            return result.graphic && result.graphic.layer === this.graphicLayer;
          })?.graphic;

          if (graphic) {
            graphic.symbol = this.largeSymbol;
            highlightedGraphic = graphic;
          }
        }
      });
    });
    // Escuchar el evento 'pointer-out'
    this.view.on("pointer-leave", () => {
      if (highlightedGraphic) {
        highlightedGraphic.symbol = this.originalSymbol;
        highlightedGraphic = null;
      }
    });
  }

  addGraphics(featureCollection: any) {
    console.log(featureCollection);
    if (featureCollection && featureCollection.features) {
      featureCollection.features.forEach((f: any) => {
        if (f.properties.id != null && f.properties.id != "") {
          // Crear un gráfico a partir de cada feature
          const graphic = createGraphicFromGeoJSON(f, this.originalSymbol);
          // Agregar el gráfico a la capa
          this.graphicLayer.add(graphic);
        }
      });
    }
  }
  addGraphicsPoligon(featureCollection: any) {
    console.log(featureCollection);
    if (featureCollection && Array.isArray(featureCollection.features)) {
      featureCollection.features.forEach((f: any) => {
        const props = f.properties || {};
        const id = props.id ?? f.attributes?.PADRON ?? f.attributes?.CODDEPTO;
        if (f.geometry && f.geometry.type) {
          // Ensure the feature has an id property for later selection
          f.properties = { ...(f.properties || {}), id };
          // Choose appropriate symbol based on geometry type
          let symbol: any = this.originalSymbol;
          if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
            symbol = this.polygonSymbol;
          }
          const graphic = createGraphicFromGeoJSON(f, symbol);
          this.graphicLayer.add(graphic);
        } else {
          console.warn('Skipping feature due to missing geometry or id', f);
        }
      });
      // Zoom to fit all newly added graphics (polygons and points)
      this.zoomToAllFeatures();
    }
  }
  setupGraphicsLayer() {
    this.graphicLayer = this.layerService.getGraphicLayer();
    this.map.add(this.graphicLayer);
  }

  setupSketch() {
    this.sketch = new Sketch({
      view: this.view,
      layer: this.graphicLayer,
      creationMode: 'single', // Solo permite la creación de una geometría a la vez
      defaultUpdateOptions: { tool: 'move' }, // Define la herramienta de edición predeterminada
      availableCreateTools: ['point'], // Especifica que solo se pueden crear puntos
      visibleElements: {
        selectionTools: {
          "rectangle-selection": this.optionToSelectMultiplePoints, // Deshabilitar Seleccionar por rectángulo
          "lasso-selection": this.optionToSelectMultiplePoints // Deshabilitar Seleccionar por lazo
        }
      }
    });
    this.sketch.visibleElements.settingsMenu = false;
    this.sketch.visibleElements.duplicateButton = false;
    this.sketch.visibleElements.undoRedoMenu = false;
    this.sketchCreate();
    this.sketchUpdate();
    this.sketchDelete();
    this.activateCreatePointMode();
    this.bkExpand_Sketch = new Expand({
      view: this.view,
      content: this.sketch,
      expanded: false,
    });

    this.view.ui.add(this.bkExpand_Sketch, 'top-right');
  }

  setupLayerList() {
    const layerList = new LayerList({
      view: this.view
    });
    layerList.collapsed = true;
    const bkExpand = new Expand({
      view: this.view,
      content: layerList,
      expanded: false,
    });
    this.view.ui.add(bkExpand, 'bottom-right');
  }

  private enablePointCreation(value: boolean) {
    this.sketch.visibleElements.createTools = { point: value };
  }

  private selectAndEditCreatedPoint(graphic: Graphic | null, finishSetting: boolean): void {
    if (!finishSetting) {
      if (graphic != null) {
        this.graphicInProcess = graphic;
      }
    } else {
      this.sketch.cancel();
    }
  }
  //Métodos de configuración del Sketch
  private sketchCreate() {
    this.sketch.on('create', async (event) => {
      if (event.state === 'complete') {
        const graphic = event.graphic;
        graphic.symbol = this.originalSymbol;
        const sp = await this.queryToIntersect(this.url_sp, graphic, "SECCION");
        const padron = await this.queryToIntersect(this.url_padrones, graphic, "PADRON");
        const depto = await this.queryToIntersect(this.url_deptos, graphic, "NOMBRE");
        const limiteNacional = await this.queryToIntersect(this.url_limiteNacional, graphic, "OBJECTID");

        graphic.attributes = {
          padron: padron[0],
          departamento: depto[0],
          seccional_policial: sp[0],
          esTerritorioNacional: limiteNacional.length > 0,
          id: uuid()
        };

        const geojson = graphicToGeoJSON(graphic);
        console.log(geojson);
        if (geojson != null) {
          this.messageService.sendMessageToParent('ADD_FEATURE', { "geojson": geojson });
          this.zoomToFeature(graphic.attributes.id);
          this.enableSketchAfterPointCreated();
          this.selectAndEditCreatedPoint(graphic, false);
          console.log(this.graphicInProcess);
        } else {
          console.log("Error en armado de GeoJson: Método UPDATE");
        }
      }
      this.onlyCreate = false;

    });
  }

  private sketchUpdate() {
    this.sketch.on("update", async (event) => {
      if (this.onlyCreate) this.sketch.cancel();
      else if (this.graphicInProcess == null) {
        // Map para almacenar los ids originales asociados a sus gráficos
        if (event.state === 'start') {
          if (event.graphics.length == 1) {
            const graphic = event.graphics[0];
            if (graphic) {
              const id = graphic.attributes?.id;
              if (id) {
                console.log(`Punto seleccionado con id: ${id}`);
                this.messageService.sendMessageToParent('FEATURE_SELECTED', { id: id });
              }
            }
          } else if (event.graphics.length > 1) {
            const idsSelected: string[] = [];
            event.graphics.forEach(g => {
              if (g.attributes?.id) idsSelected.push(g.attributes.id);
            });
            if (idsSelected.length > 0) this.messageService.sendMessageToParent('FEATURES_SELECTED', { id: idsSelected });
          }
        }
        const updatedGraphics: Graphic[] = [];
        console.log(event.graphics.length);
        if (event.toolEventInfo && event.toolEventInfo.type === "move-stop") {
          // Crear un array de promesas para esperar a que todas las consultas se completen
          const updatePromises = event.graphics.map(async (graphic) => {
            console.log("El punto ha sido movido: ", graphic.geometry);
            console.log(graphic);
            const sp = await this.queryToIntersect(this.url_sp, graphic, "SECCION");
            const padron = await this.queryToIntersect(this.url_padrones, graphic, "PADRON");
            const depto = await this.queryToIntersect(this.url_deptos, graphic, "NOMBRE");
            const limiteNacional = await this.queryToIntersect(this.url_limiteNacional, graphic, "OBJECTID");
            // Restaurar los atributos y asignar el id original desde el Map
            graphic.attributes.padron = padron[0];
            graphic.attributes.departamento = depto[0];
            graphic.attributes.seccional_policial = sp[0];
            graphic.attributes.esTerritorioNacional = limiteNacional.length > 0;
            // Agregar el gráfico actualizado al array
            updatedGraphics.push(graphic);
          });
          // Esperar a que todas las promesas se resuelvan
          await Promise.all(updatePromises);
          // Convertir la colección de gráficos a GeoJSON y enviar el mensaje
          const geojson = graphicCollectionToGeoJSON(updatedGraphics);
          console.log(geojson);
          if (geojson != null) this.messageService.sendMessageToParent('UPDATE_FEATURE', { "geojson": geojson });
          else console.log("Error en armado de GeoJson: Método UPDATE")
        }

      } else {
        if (event.state === 'start' && event.graphics.length == 1) {
          const graphic = event.graphics[0];
          if (graphic) {
            const id = graphic.attributes?.id;
            if (id && this.graphicInProcess.attributes.id === id) {
              this.messageService.sendMessageToParent('FEATURE_SELECTED', { id: id });
            } else this.sketch.cancel();
          }
        }
        const updatedGraphics: Graphic[] = [];
        if (event.toolEventInfo && event.toolEventInfo.type === "move-stop") {
          // Crear un array de promesas para esperar a que todas las consultas se completen
          const updatePromises = event.graphics.map(async (graphic) => {
            console.log("El punto ha sido movido: ", graphic.geometry);
            console.log(graphic);
            const sp = await this.queryToIntersect(this.url_sp, graphic, "SECCION");
            const padron = await this.queryToIntersect(this.url_padrones, graphic, "PADRON");
            const depto = await this.queryToIntersect(this.url_deptos, graphic, "NOMBRE");
            const limiteNacional = await this.queryToIntersect(this.url_limiteNacional, graphic, "OBJECTID");
            // Restaurar los atributos y asignar el id original desde el Map
            graphic.attributes.padron = padron[0];
            graphic.attributes.departamento = depto[0];
            graphic.attributes.seccional_policial = sp[0];
            graphic.attributes.esTerritorioNacional = limiteNacional.length > 0;
            // Agregar el gráfico actualizado al array
            updatedGraphics.push(graphic);
          });
          // Esperar a que todas las promesas se resuelvan
          await Promise.all(updatePromises);
          // Convertir la colección de gráficos a GeoJSON y enviar el mensaje
          const geojson = graphicCollectionToGeoJSON(updatedGraphics);
          console.log(geojson);
          if (geojson != null) this.messageService.sendMessageToParent('UPDATE_FEATURE', { "geojson": geojson });
          else console.log("Error en armado de GeoJson: Método UPDATE")
        }
      }
    });

  }

  private sketchDelete() {
    // existing delete handling
  }

  // New method to handle FIND_PADRON request
  private handleFindPadron(params: string[]): void {
    // Parse input strings like "L-2514"
    const map: Record<string, string[]> = {};
    params.forEach(p => {
      const parts = p.split('-');
      if (parts.length === 2) {
        const dept = parts[0];
        const pad = parts[1];
        if (!map[dept]) {
          map[dept] = [];
        }
        map[dept].push(pad);
      }
    });
    // Call service to fetch geometries
    this.padronService.fetchPadronGeometries(map).subscribe(featureCollection => {
      if (featureCollection) {
        // Add graphics to map
        this.addGraphicsPoligon(featureCollection);
        // Notify parent with results
        this.messageService.sendMessageToParent('PADRON_FOUND', { results: featureCollection.features });
      }
    }, error => {
      console.error('Error fetching padron geometries', error);
    });
  }

  private activateCreatePointMode() {
    this.sketch.create('point');
  }
  private cancelCreatePointMode() {
    this.sketch.cancel();
  }
  //Método para Padre
  private parentDeletingGraphics(ids: string[]) {
    if (ids.length > 0) {
      const deletedIds: string[] = [];
      ids.forEach(id => {
        const graphic = this.graphicLayer.graphics.find(g => g.attributes.id == id);
        if (graphic) {
          this.graphicLayer.remove(graphic);
          console.log('${id} eliminado');
          deletedIds.push(id);
        } else {
          console.log('No se encontró punto con el id: ${id}');
        }
      });
      console.log("Puntos eliminados con ids: ", deletedIds);
      this.messageService.sendMessageToParent('DELETE_FEATURE', { "ids": deletedIds });
    } else {
      console.log("No ids para borrar");
    }
  }
  //Método para cargar capas que intersectan puntos
  private loadLayersToIntersect() {
    LAYER_CONFIGS.forEach(l => {
      switch (l.description) {
        case 'Departamentos':
          this.url_deptos = l.url;
          break;
        case 'Limite Nacional':
          this.url_limiteNacional = l.url;
          break;
        case 'Padrones':
          this.url_padrones = l.url;
          break;
        case 'Seccionales Policiales':
          this.url_sp = l.url;
          break;
      }
    });
  }
  private queryToIntersect(url: string, graphic: Graphic, field: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // Consultar las entidades cercanas al punto
      const featureLayer = new FeatureLayer({ url: url })
      const query = featureLayer.createQuery();
      query.geometry = graphic.geometry; // Buffer de 1000 metros alrededor del punto
      //query.geometry = geometryEngine.buffer(point, 1000); // Buffer de 1000 metros alrededor del punto
      query.spatialRelationship = "intersects"; // Relación espacial
      query.returnGeometry = false;
      query.outFields = [field];

      featureLayer.queryFeatures(query).then(function (response) {
        // Procesar los resultados de la consulta
        const features = response.features;
        const deptos = features.map(function (feature) {
          return feature.attributes[field]; // Obtener el valor del campo "DEPTO"
        });

        resolve(deptos); // Devolver los valores del campo "DEPTO"
      }).catch(function (error) {
        console.error("Error en la consulta: ", error);
        reject(error);
      });
    })
  }


}



export function graphicCollectionToGeoJSON(graphics: Graphic[]) {
  if (graphics.length > 0) {
    console.log(graphics.length);
    const features: object[] = [];
    const graphicCollection = {
      type: "FeatureCollection",
      features: features
    };
    graphics.forEach(graphic =>
      graphicCollection.features.push({
        type: "Feature",
        geometry: graphic.geometry.toJSON(),
        properties: graphic.attributes
      }));
    return graphicCollection;
  } else {
    return null;
  }
}

export function graphicToGeoJSON(graphic: Graphic) {
  return {
    type: "Feature",
    geometry: graphic.geometry.toJSON(),
    properties: graphic.attributes
  };
}

export function createGraphicFromGeoJSON(this: any, feature: any, symbol: SimpleMarkerSymbol) {
  let geometry;

  switch (feature.geometry.type) {
    case 'Point':
      geometry = new Point({
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1]
      });
      break;
    case 'LineString':
      geometry = new Polyline({
        paths: feature.geometry.coordinates,
        spatialReference: { wkid: 4326 }
      });
      break;
    case 'Polygon':
      geometry = new Polygon({
        rings: feature.geometry.coordinates,
        spatialReference: { wkid: 4326 }
      });
      break;
    default:
      throw new Error(`Unsupported geometry type: ${feature.geometry.type}`);
  }

  return new Graphic({
    geometry: geometry,
    symbol: symbol,
    attributes: feature.properties
  });
}
