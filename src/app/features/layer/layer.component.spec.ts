import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayerComponent } from './layer.component';
import { LayerService } from '../../services/layer.service';
import { Subject } from 'rxjs';

describe('LayerComponent', () => {
  let component: LayerComponent;
  let fixture: ComponentFixture<LayerComponent>;
  let mockLayerService: jasmine.SpyObj<LayerService>;

  beforeEach(async () => {
    mockLayerService = jasmine.createSpyObj('LayerService', ['addLayer', 'getGraphicLayer']);
    (mockLayerService as any).layerObservable$ = new Subject<any>().asObservable();

    await TestBed.configureTestingModule({
      imports: [LayerComponent],
      providers: [
        { provide: LayerService, useValue: mockLayerService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LayerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call addLayer for each visible WMS or Feature layer on init', () => {
    // LAYER_CONFIGS from environment has layers with show: true
    fixture.detectChanges(); // triggers ngOnInit -> loadLayers
    expect(mockLayerService.addLayer).toHaveBeenCalled();
  });
});
