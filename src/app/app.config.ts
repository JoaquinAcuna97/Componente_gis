import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { APP_CONFIG, APP_CONFIG_TOKEN } from './core/config/app.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: APP_CONFIG_TOKEN, useValue: APP_CONFIG }
  ]
};
