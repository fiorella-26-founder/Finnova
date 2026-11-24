import { ErrorHandler, enableProdMode, importProvidersFrom } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/services/auth.interceptor';
import { GlobalEventErrorHandler, telemetryInterceptor } from './app/services/telemetry.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, telemetryInterceptor])),
    { provide: ErrorHandler, useClass: GlobalEventErrorHandler },
    importProvidersFrom(BrowserModule, AppRoutingModule)
  ]
}).catch((err) => console.error(err));
