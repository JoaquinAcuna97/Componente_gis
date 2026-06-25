import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraphicComponent } from './graphic.component';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import { APP_CONFIG_TOKEN } from '../../core/config/app.config';
import { MessageService } from '../message.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PadronService } from '../../services/padron.service';
import { of } from 'rxjs';
import { Subject, BehaviorSubject, Subscription, Observable } from 'rxjs';
import { LayerService } from '../../services/layer.service';

describe('GraphicComponent', () => {
  let component: GraphicComponent;
  let fixture: ComponentFixture<GraphicComponent>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockLayerService: jasmine.SpyObj<LayerService>;
  const messageSubject = new Subject<void>();

  const mockAppConfig = {
    idBaseMap: 'cd40d1d0eae943039075856b87686c11',
    urlPortal: 'https://mapastest.mgap.gub.uy/portal',
    multiplePointSelection: false,
    enableDrawTool: false,
    enableSearchFeature: false
  };

  beforeEach(async () => {
    mockMessageService = jasmine.createSpyObj('MessageService', [
      'sendMessageToParent'
    ]);
    (mockMessageService as unknown as { mObservable$: Observable<void> }).mObservable$ = messageSubject.asObservable();

    mockLayerService = jasmine.createSpyObj('LayerService', ['addLayer', 'getGraphicLayer']);
    (mockLayerService as unknown as { layerObservable$: Observable<void> }).layerObservable$ = new Subject<void>().asObservable();

    await TestBed.configureTestingModule({
      imports: [GraphicComponent, HttpClientTestingModule],
      providers: [
        { provide: APP_CONFIG_TOKEN, useValue: mockAppConfig },
        { provide: MessageService, useValue: mockMessageService },
        { provide: LayerService, useValue: mockLayerService },
        { provide: PadronService, useValue: jasmine.createSpyObj('PadronService', ['fetchPadronGeometries']) }
      ]
    }).compileComponents();
    // Mock fetchPadronGeometries return value
    const padronService = TestBed.inject(PadronService) as jasmine.SpyObj<PadronService>;
    padronService.fetchPadronGeometries.and.returnValue(of({ features: [] }));

    fixture = TestBed.createComponent(GraphicComponent);
    component = fixture.componentInstance;

    // Provide required @Input() BehaviorSubjects so ngOnInit doesn't fail

    component.mapSubject = new BehaviorSubject<Map | null>(null);
    component.viewSubject = new BehaviorSubject<MapView | null>(null);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have subscriptions array initialized', () => {
    expect(component.subscriptions).toBeDefined();
    expect(Array.isArray(component.subscriptions)).toBeTrue();
  });

  it('should initialize on ngOnInit without crashing when subjects emit null', () => {
    expect(() => component.ngOnInit()).not.toThrow();
  });

  it('should unsubscribe all subscriptions on ngOnDestroy', () => {
    component.ngOnInit();
    const spies = component.subscriptions.map((s: Subscription) => spyOn(s, 'unsubscribe'));
    component.ngOnDestroy();
    spies.forEach((spy: jasmine.Spy) => expect(spy).toHaveBeenCalled());
  });
});