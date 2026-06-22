import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import { GraphicComponent } from './features/graphic/graphic.component';
import { MessageService } from './features/message.service';
import esriConfig from '@arcgis/core/config';
import Portal from '@arcgis/core/portal/Portal';
import { BehaviorSubject } from 'rxjs';
import { LayerService } from './services/layer.service';
import { LayerComponent } from './features/layer/layer.component';
import { APP_CONFIG_TOKEN, AppConfig } from './core/config/app.config';
import Extent from '@arcgis/core/geometry/Extent';
import { AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GraphicComponent, LayerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  map: Map;
  view: MapView;
  extent: Extent;
  mapSubject = new BehaviorSubject<Map | null>(null);
  viewSubject = new BehaviorSubject<MapView | null>(null);
  cargoMapa = false;

  constructor(
    private layerService: LayerService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig
  ) { }

  // The <div> where we will place the map
  @ViewChild('mapViewNode', { static: true }) private mapViewEl!: ElementRef;

  initializeMap(): Promise<any> {
    // Initialize MapView and return an instance of MapView
    const container = this.mapViewEl.nativeElement;


    this.map = new Map({
      basemap: {
        portalItem: {
          id: this.appConfig.idBaseMap //Streets (WGS84)
        },
      }
    });
    this.cargoMapa = true;

    this.view = new MapView({
      container: container,
      map: this.map,
      spatialReference: {
        wkid: 4326
      }
    });

    return this.view.when().then(() => {
      this.mapSubject.next(this.map);
      this.viewSubject.next(this.view);
      setTimeout(() => {
        this.centerMapView();
      })
    });
  }


  private centerMapView(): void {
    this.view.goTo({
      center: [-55.7658, -32.5228],
      scale: 4000000
    });

    this.extent = new Extent({
      xmin: -59,
      ymin: -35,
      xmax: -53,
      ymax: -30,
      spatialReference: { wkid: 4326 }
    });
    console.log(this.extent);
    this.view.constraints = {
      minScale: 5000000,
      maxScale: 1000,
      geometry: this.extent,
      rotationEnabled: false
    };

  }
  ngOnInit(): void {
    this.setupLayerSubscription();
    this.messageService.listenMessageFromParent();
    esriConfig.portalUrl = this.appConfig.urlPortal;

    const portalInstance = new Portal();
    portalInstance
      .load()
      .then(() => {
        console.log('Portal loaded');
      }
      )
  }
  private setupLayerSubscription(): void {
    this.layerService.layerObservable$.subscribe(layer => {

      if (this.map) {
        this.map.add(layer);

      }
    });
  }
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeMap().then(() => {
        this.messageService.sendMessageToParent('INITIALIZE_COMPLETE', {});
        this.cdr.detectChanges();
      }).catch((err) => {
        console.log("Error iniciando map: ", err);
      });
    });
  }
  ngOnDestroy(): void {
    if (this.viewSubject.value) {
      this.viewSubject.value.destroy();
    }
  }
}
