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
import TextSymbol from '@arcgis/core/symbols/TextSymbol';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import { BehaviorSubject, Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { LayerService } from '../../services/layer.service';
import { PadronService } from '../../services/padron.service';
import { APP_CONFIG_TOKEN, AppConfig } from '../../core/config/app.config';
import { MAP_CONFIG } from '../../core/config/map.config';
import { LAYER_CONFIGS } from '../../core/config/layer.config';
import { PADRON_CONFIG } from '../../core/config/padron.config';

interface IHandle {
  remove(): void;
}

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
  padronLayer: GraphicsLayer; // Layer for persistent Padron polygons
  padronLabelLayer: GraphicsLayer; // Labels rendered above padron polygons
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
  private originalPadronLabelingInfo: __esri.LabelClass[] | null = null;
  private padronLabelScaleWatch: IHandle | null = null;


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
    // Initialize polygon symbol from PADRON_CONFIG
    this.polygonSymbol = new SimpleFillSymbol({
      color: PADRON_CONFIG.polygonSymbol.fillColor,
      outline: {
        color: PADRON_CONFIG.polygonSymbol.outlineColor,
        width: PADRON_CONFIG.polygonSymbol.outlineWidth
      }
    });
    // Initialize dedicated layers for Padron polygons and their labels
    this.padronLayer = new GraphicsLayer({ listMode: 'hide' });
    this.padronLabelLayer = new GraphicsLayer({ listMode: 'hide' });
    this.originalSymbol = MAP_CONFIG.defaultPointSymbol;
    this.optionToSelectMultiplePoints = this.appConfig.multiplePointSelection;
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

  ngOnDestroy(): void {
    this.padronLabelScaleWatch?.remove();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private enableSketchAfterPointCreated() {
    if (!this.sketch || this.sketch.destroyed) return;
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
    if (!this.sketch || this.sketch.destroyed) return;
    this.sketch.visibleElements = {
      selectionTools: {
        "rectangle-selection": value, // Deshabilitar Seleccionar por rectángulo
        "lasso-selection": value
      }
    };   // Deshabilitar Seleccionar por lazo
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
      try {
        this.sketch.cancel();
        this.sketch.destroy();
      } catch (e) {
        console.error('Error destroying sketch:', e);
      }
    }
    if (this.bkExpand_Sketch) {
      this.bkExpand_Sketch.visible = false;
    }
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

  zoomToAllFeatures(): Promise<void> {
    if (!this.view || !this.graphicLayer) {
      return Promise.resolve();
    }

    return this.view.when().then(() => {
      this.all_graphics = [
        ...this.graphicLayer.graphics.toArray(),
        ...this.padronLayer.graphics.toArray(),
        ...this.padronLabelLayer.graphics.toArray(),
      ];

      if (this.padronLabelLayer.graphics.length > 0) {
        this.padronLabelLayer.visible = false;
      }

      if (this.all_graphics.length === 0) {
        console.warn('No hay gráficos en la capa para hacer zoom.');
        return;
      }

      const goToPromise = this.all_graphics.length === 1 && this.all_graphics[0].geometry.type === 'point'
        ? this.view.goTo({
          target: this.all_graphics[0],
          scale: 5000,
        }, { duration: 1500 })
        : this.view.goTo(this.all_graphics, { duration: 1500 });

      return goToPromise
        .then(() => this.updatePadronLabelsVisibility())
        .catch((err) => {
          console.error('Error zooming to all features: ', err);
          this.updatePadronLabelsVisibility();
        });
    });
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
    const padronGraphicsSet = new Set([
      ...this.padronLayer.graphics.toArray(),
      ...this.padronLabelLayer.graphics.toArray(),
    ]);
    this.padronLayer.removeAll();
    this.padronLabelLayer.removeAll();
    this.all_graphics = this.all_graphics.filter(g => !padronGraphicsSet.has(g));

    if (featureCollection && Array.isArray(featureCollection.features)) {
      featureCollection.features.forEach((f: any) => {
        const props = { ...(f.properties || {}), ...(f.attributes || {}) };
        const id = props.id ?? props.PADRON ?? props.CODDEPTO;
        if (f.geometry && f.geometry.type) {
          // Ensure attributes (incl. NOMDEPTO, PADRON) are on properties for labels and selection
          f.properties = { ...props, id };
          // Choose appropriate symbol based on geometry type
          let symbol: any = this.originalSymbol;
          if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
            symbol = this.polygonSymbol;
          }
          const graphic = createGraphicFromGeoJSON(f, symbol);
          // Add polygon graphic to dedicated Padron layer
          this.padronLayer.add(graphic);
          // Add centered label with department name and padron number
          const labelGraphic = this.createPadronLabelGraphic(
            graphic.geometry,
            props.NOMDEPTO ?? props.CODDEPTO,
            props.PADRON
          );
          if (labelGraphic) {
            this.padronLabelLayer.add(labelGraphic);
            this.all_graphics.push(labelGraphic);
          }
          // Track graphic for future operations (zoom, selection, etc.)
          this.all_graphics.push(graphic);
        } else {
          console.warn('Skipping feature due to missing geometry or id', f);
        }
      });
      this.padronLabelLayer.visible = false;
      // Zoom to fit all newly added graphics, then reveal labels when close enough
      this.zoomToAllFeatures();
    }
  }

  private createPadronLabelGraphic(
    geometry: Graphic['geometry'],
    departamento: string | number | undefined,
    padron: string | number | undefined
  ): Graphic | null {
    if (!geometry || geometry.type !== 'polygon' || departamento == null || padron == null) {
      return null;
    }

    const labelPoint = this.getPolygonLabelPoint(geometry as Polygon);
    if (!labelPoint) {
      return null;
    }

    const labelText = `${departamento}\n${padron}`;

    return new Graphic({
      geometry: labelPoint,
      symbol: new TextSymbol({
        text: labelText,
        color: PADRON_CONFIG.label.color,
        haloColor: PADRON_CONFIG.label.haloColor,
        haloSize: PADRON_CONFIG.label.haloSize,
        font: {
          size: PADRON_CONFIG.label.fontSize,
          weight: PADRON_CONFIG.label.fontWeight,
        },
        horizontalAlignment: 'center',
        verticalAlignment: 'middle',
      }),
    });
  }
  /** Returns a point guaranteed to fall inside the polygon for label placement. */
  private getPolygonLabelPoint(polygon: Polygon): Point | null {
    const extent = polygon.extent;
    const centroid = polygon.centroid;
    const candidates: Point[] = [];

    if (centroid) {
      candidates.push(centroid);
    }
    if (extent?.center) {
      candidates.push(extent.center);
    }

    for (const candidate of candidates) {
      if (geometryEngine.contains(polygon, candidate)) {
        return candidate;
      }
    }

    if (!extent) {
      return centroid ?? null;
    }

    // Sample the extent grid until an interior point is found
    const gridSteps = 7;
    for (let row = 1; row < gridSteps; row++) {
      for (let col = 1; col < gridSteps; col++) {
        const candidate = new Point({
          x: extent.xmin + ((extent.xmax - extent.xmin) * col) / gridSteps,
          y: extent.ymin + ((extent.ymax - extent.ymin) * row) / gridSteps,
          spatialReference: polygon.spatialReference,
        });
        if (geometryEngine.contains(polygon, candidate)) {
          return candidate;
        }
      }
    }

    return centroid ?? extent.center ?? null;
  }

  private getPadronFeatureLayer(): FeatureLayer | undefined {
    if (!this.map) {
      return undefined;
    }

    for (const layer of this.map.layers) {
      if (layer.type !== 'feature') {
        continue;
      }

      const featureLayer = layer as FeatureLayer;
      if (
        featureLayer.url === this.url_padrones
        || /padron|parcela/i.test(featureLayer.title ?? '')
      ) {
        return featureLayer;
      }
    }

    return undefined;
  }

  private setupPadronLabelVisibility(): void {
    if (!this.view || this.padronLabelScaleWatch) {
      return;
    }

    this.padronLabelScaleWatch = this.view.watch('scale', () => {
      this.updatePadronLabelsVisibility();
    });
  }

  private updatePadronLabelsVisibility(): void {
    if (!this.view || this.padronLabelLayer.graphics.length === 0) {
      return;
    }

    this.padronLabelLayer.visible = this.view.scale <= PADRON_CONFIG.label.maxVisibleScale;
  }

  setupGraphicsLayer() {
    this.graphicLayer = this.layerService.getGraphicLayer();
    // Ensure base graphics layer is added only once
    if (!this.map.layers.find(l => l === this.graphicLayer)) {
      this.map.add(this.graphicLayer);
    }
    // Add Padron layers if not already present (labels above polygons)
    if (!this.map.layers.find(l => l === this.padronLayer)) {
      this.map.add(this.padronLayer);
    }
    if (!this.map.layers.find(l => l === this.padronLabelLayer)) {
      this.map.add(this.padronLabelLayer);
    }
    this.setupPadronLabelVisibility();
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

    const urlParams = new URLSearchParams(window.location.search);
    const modo = urlParams.get('modo') || 'vista';

    if (modo === 'edicion') {
      this.activateCreatePointMode();
    } else {
      this.startViewMode();
    }

    this.bkExpand_Sketch = new Expand({
      view: this.view,
      content: this.sketch,
      expanded: false,
    });

    this.view.ui.add(this.bkExpand_Sketch, 'top-right');
    if (modo !== 'edicion') {
      this.bkExpand_Sketch.visible = false;
    }
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
    if (!this.sketch || this.sketch.destroyed) return;
    this.sketch.visibleElements.createTools = { point: value };
  }

  private selectAndEditCreatedPoint(graphic: Graphic | null, finishSetting: boolean): void {
    if (!this.sketch || this.sketch.destroyed) return;
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
    if (!this.sketch || this.sketch.destroyed) return;
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
    if (!this.sketch || this.sketch.destroyed) return;
    this.sketch.on("update", async (event) => {
      if (this.onlyCreate) {
        if (this.sketch && !this.sketch.destroyed) this.sketch.cancel();
      }
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
    if (!this.sketch || this.sketch.destroyed) return;
    // existing delete handling
  }

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
    // Build list of requested full padron IDs
    const requestedPadrones: string[] = [];
    Object.entries(map).forEach(([dept, pads]) => {
      pads.forEach(p => requestedPadrones.push(`${dept}-${p}`));
    });
    // Call service to fetch geometries
    this.padronService.fetchPadronGeometries(map).subscribe(featureCollection => {
      if (featureCollection) {
        // Add graphics to map
        this.addGraphicsPoligon(featureCollection);
        console.log('FeatureCollection sample:', featureCollection.features?.[0]);
        // Determine which padrones have geometry and collect their pad numbers
        const returnedPadNumbers = new Set(
          (featureCollection.features || [])
            .filter((f: any) => !!f.geometry && Object.keys(f.geometry).length > 0)
            .map((f: any) => {
              const props = f.properties ?? f.attributes;

              const codDepto = props?.CODDEPTO ?? props?.coddepto;
              const padron = props?.PADRON ?? props?.padron;

              return codDepto && padron ? `${codDepto}-${padron}` : null;
            })
            .filter(Boolean)
        );
        // Build notFound list based on missing pad numbers per department
        const notFound = requestedPadrones.filter(
          pad => !returnedPadNumbers.has(pad)
        );
        const foundPadrones = featureCollection.features
          .map((f: any) => {
            const props = f.properties ?? f.attributes;
            return props?.PADRON;
          })
          .filter(Boolean);

        this.hideBaseLabelsForPadrones(foundPadrones);
        // Notify parent with results
        this.messageService.sendMessageToParent('PADRON_FOUND', { results: featureCollection.features });
        this.messageService.sendMessageToParent('PADRON_NOT_FOUND', { results: notFound });
      }
    }, error => {
      console.error('Error fetching padron geometries', error);
      // If request fails, treat all requested padrones as not found
      this.messageService.sendMessageToParent('PADRON_NOT_FOUND', { results: requestedPadrones });
    });
  }

  private hideBaseLabelsForPadrones(padrones: (string | number)[]): void {
    const layer = this.getPadronFeatureLayer();

    if (!layer || !layer.labelingInfo?.length) {
      return;
    }

    // Guardar configuración original una sola vez
    if (!this.originalPadronLabelingInfo) {
      this.originalPadronLabelingInfo = layer.labelingInfo.map(labelClass =>
        labelClass.clone()
      );
    }

    const values = padrones
      .map(p => `${String(p).replace(/'/g, "''")}`)
      .join(',');

    const originalClass = this.originalPadronLabelingInfo[0];
    const labelClass = originalClass.clone();

    const originalWhere =
      originalClass.where && originalClass.where.trim().length > 0
        ? `(${originalClass.where})`
        : '1=1';

    labelClass.where = `${originalWhere} AND PADRON NOT IN (${values})`;

    layer.labelingInfo = [labelClass];
    layer.labelsVisible = false;
    layer.labelsVisible = true;
    // fuerza refresco
    layer.refresh?.();


  }

  private activateCreatePointMode() {
    if (!this.sketch || this.sketch.destroyed) return;
    this.sketch.create('point');
  }
  private cancelCreatePointMode() {
    if (!this.sketch || this.sketch.destroyed) return;
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
    case 'MultiPolygon': {
      // GeoJSON MultiPolygon: coordinates is an array of polygons (each polygon is an array of linear rings)
      // Flatten all rings into a single array for Esri Polygon constructor
      const rings = feature.geometry.coordinates.reduce((acc: any[], poly: any[]) => acc.concat(poly), []);
      geometry = new Polygon({
        rings,
        spatialReference: { wkid: 4326 }
      });
      break;
    }
    default:
      throw new Error(`Unsupported geometry type: ${feature.geometry.type}`);
  }

  return new Graphic({
    geometry: geometry,
    symbol: symbol,
    attributes: feature.properties
  });
}
