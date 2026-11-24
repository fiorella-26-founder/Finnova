import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { EventMonitoringService } from './event-monitoring.service';

/**
 * Interceptor de telemetría real (Semana 15):
 * Mide latencia real con performance.now() y clasifica cada respuesta HTTP
 * (INFO / WARNING / EXCEPTION) en el Motor de Eventos de Finnova.
 */
export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  // Evitar doble registro de sondas sintéticas lanzadas por el propio monitor
  if (req.headers.has('X-Finnova-Probe')) {
    return next(req);
  }

  const monitor = inject(EventMonitoringService);
  const start = performance.now();

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const latencyMs = performance.now() - start;
          monitor.recordHttpTelemetry(req.url, event.status, latencyMs);
        }
      },
      error: (err: HttpErrorResponse) => {
        const latencyMs = performance.now() - start;
        monitor.recordHttpTelemetry(req.url, err?.status ?? 0, latencyMs, err?.message);
      }
    })
  );
};

/**
 * Manejador global de excepciones de Angular:
 * Captura errores no controlados en el Frontend SPA y los envía como eventos EXCEPTION al NOC.
 */
@Injectable()
export class GlobalEventErrorHandler implements ErrorHandler {
  private injector = inject(Injector);

  handleError(error: unknown): void {
    console.error('[Finnova Telemetry ErrorHandler]', error);
    try {
      const monitor = this.injector.get(EventMonitoringService);
      monitor.recordFrontendException(error);
    } catch {
      // Evitar ciclo si ocurre antes de inicializar DI
    }
  }
}
