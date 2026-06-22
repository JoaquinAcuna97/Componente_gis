import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { APP_CONFIG_TOKEN } from './core/config/app.config';
import { MessageService } from './features/message.service';
import { LayerService } from './services/layer.service';
import { Subject } from 'rxjs';


describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockLayerService: jasmine.SpyObj<LayerService>;
  const layerSubject = new Subject<any>();

  const mockAppConfig = {
    idBaseMap: 'cd40d1d0eae943039075856b87686c11',
    urlPortal: 'https://mapastest.mgap.gub.uy/portal',
    multiplePointSelection: false,
    enableDrawTool: false,
    enableSearchFeature: false
  };

  beforeEach(async () => {
    mockMessageService = jasmine.createSpyObj('MessageService', [
      'listenMessageFromParent',
      'sendMessageToParent'
    ]);

    mockLayerService = jasmine.createSpyObj('LayerService', ['addLayer', 'getGraphicLayer']);
    // Provide a proper Observable (not of()) so subscribe() works
    (mockLayerService as any).layerObservable$ = layerSubject.asObservable();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: APP_CONFIG_TOKEN, useValue: mockAppConfig },
        { provide: MessageService, useValue: mockMessageService },
        { provide: LayerService, useValue: mockLayerService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;

    // Prevent initializeMap from actually instantiating ArcGIS MapView
    spyOn(component, 'initializeMap').and.returnValue(Promise.resolve());
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have cargoMapa as false initially', () => {
    expect(component.cargoMapa).toBeFalse();
  });

  it('should expose mapSubject initialized to null', () => {
    expect(component.mapSubject).toBeTruthy();
    expect(component.mapSubject.getValue()).toBeNull();
  });

  it('should expose viewSubject initialized to null', () => {
    expect(component.viewSubject).toBeTruthy();
    expect(component.viewSubject.getValue()).toBeNull();
  });

  it('should call listenMessageFromParent on ngOnInit', () => {
    component.ngOnInit();
    expect(mockMessageService.listenMessageFromParent).toHaveBeenCalled();
  });

  it('should subscribe to layerObservable$ on ngOnInit', () => {
    spyOn(mockLayerService.layerObservable$, 'subscribe').and.callThrough();
    component.ngOnInit();
    expect(mockLayerService.layerObservable$.subscribe).toHaveBeenCalled();
  });
});
