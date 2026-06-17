import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraphicComponent } from './graphic.component';
import { APP_CONFIG_TOKEN } from '../../core/config/app.config';
import { MessageService } from '../message.service';
import { LayerService } from '../../services/layer.service';
import { Subject } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

describe('GraphicComponent', () => {
  let component: GraphicComponent;
  let fixture: ComponentFixture<GraphicComponent>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockLayerService: jasmine.SpyObj<LayerService>;
  const messageSubject = new Subject<any>();

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
    (mockMessageService as any).mObservable$ = messageSubject.asObservable();

    mockLayerService = jasmine.createSpyObj('LayerService', ['addLayer', 'getGraphicLayer']);
    (mockLayerService as any).layerObservable$ = new Subject<any>().asObservable();

    await TestBed.configureTestingModule({
      imports: [GraphicComponent],
      providers: [
        { provide: APP_CONFIG_TOKEN, useValue: mockAppConfig },
        { provide: MessageService, useValue: mockMessageService },
        { provide: LayerService, useValue: mockLayerService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GraphicComponent);
    component = fixture.componentInstance;

    // Provide required @Input() BehaviorSubjects so ngOnInit doesn't fail
    component.mapSubject = new BehaviorSubject<any>(null);
    component.viewSubject = new BehaviorSubject<any>(null);
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
    const spies = component.subscriptions.map(s => spyOn(s, 'unsubscribe'));
    component.ngOnDestroy();
    spies.forEach(spy => expect(spy).toHaveBeenCalled());
  });
});
