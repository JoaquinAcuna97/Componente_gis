// src/app/core/config/app.config.ts
import { environment } from '../../../environments/environment';

export interface AppConfig {
  /** Base map portal item id */
  idBaseMap: string;
  /** Portal base URL */
  urlPortal: string;
  /** Enable/disable multiple point selection */
  multiplePointSelection: boolean;
  /** Enable draw tool */
  enableDrawTool: boolean;
  /** Enable search feature UI */
  enableSearchFeature: boolean;
}

export const APP_CONFIG: Readonly<AppConfig> = Object.freeze({
  idBaseMap: (environment as any).id_base_map,
  urlPortal: (environment as any).url_portal,
  multiplePointSelection: (environment as any).multiplePointSelection ?? false,
  enableDrawTool: (environment as any).enableDrawTool ?? false,
  enableSearchFeature: (environment as any).enableSearchFeature ?? false,
});

/** Helper to inject configuration via Angular DI */
import { InjectionToken } from '@angular/core';
export const APP_CONFIG_TOKEN = new InjectionToken<AppConfig>('APP_CONFIG');
