import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { EventMonitoringService } from './event-monitoring.service';

/**
 * Token client-side (no envía cabeceras HTTP ni dispara CORS preflight)
 * para evitar doble registro de las sondas sintéticas lanzadas desde el NOC.
 */
export const SKIP_TELEMETRY_PROBE = new HttpContextToken<boolean>(() => false);

/**
 * Interceptor de telemetría real:
 * Mide latencia real con performance.now() y clasifica cada respuesta HTTP
 * (INFO / WARNING / EXCEPTION) en el Motor de Eventos de Finnova.
 */
export const telemetryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_TELEMETRY_PROBE)) {
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
