import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { APP_CONFIG, APP_CONFIG_TOKEN } from './core/config/app.config';
import { HttpClientModule } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: APP_CONFIG_TOKEN, useValue: APP_CONFIG },
    importProvidersFrom(HttpClientModule)
  ]
};
