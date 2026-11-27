import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, throwError } from 'rxjs';
import { catchError, retry, switchMap, tap } from 'rxjs/operators';
import { ServiceContinuityService } from './service-continuity.service';
import { SKIP_TELEMETRY_PROBE } from './telemetry.interceptor';

/**
 * Interceptor de Alta Disponibilidad (HA) y Continuidad del Servicio:
 * 1. Aplica Retry automático en peticiones GET idempotentes ante micro-cortes (HTTP 0 / 502 / 503 / 504).
 * 2. Almacena réplica Read-Through en IndexedDB (FinnovaContinuityDB.ha_read_cache).
 * 3. Si el nodo primario (Render) cae o el Circuit Breaker está en OPEN_FAILOVER, responde desde la réplica Standby.
 */
export const continuityInterceptor: HttpInterceptorFn = (req, next) => {
  // Las sondas directas de diagnóstico miden el estado real sin enmascarar fallas
  if (req.context.get(SKIP_TELEMETRY_PROBE) || req.method !== 'GET' || !req.url.includes('/api/')) {
    return next(req);
  }

  const continuity = inject(ServiceContinuityService);

  // Si el Circuit Breaker fue conmutado manualmente a Failover Standby, servir réplica primero si existe
  if (continuity.circuitState === 'OPEN_FAILOVER') {
    return from(continuity.getStandbyCachedResponse(req.url)).pipe(
      switchMap(cached => {
        if (cached) {
          return of(
            new HttpResponse({
              status: 200,
              body: cached.body,
              headers: new HttpHeaders({
                'X-Finnova-HA-Mode': 'STANDBY-REPLICA',
                'X-Finnova-Cached-At': cached.cachedAt
              }),
              url: req.url
            })
          );
        }
        return next(req);
      })
    );
  }

  return next(req).pipe(
    retry({
      count: 1,
      delay: (err: HttpErrorResponse) => {
        if (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504) {
          return of(true);
        }
        return throwError(() => err);
      }
    }),
    tap(event => {
      if (event instanceof HttpResponse && event.status === 200 && event.body !== null) {
        void continuity.cacheHealthyResponse(req.url, event.body);
      }
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0 || err.status >= 500) {
        return from(continuity.getStandbyCachedResponse(req.url)).pipe(
          switchMap(cached => {
            if (cached) {
              return of(
                new HttpResponse({
                  status: 200,
                  body: cached.body,
                  headers: new HttpHeaders({
                    'X-Finnova-HA-Mode': 'FAILOVER-REPLICA',
                    'X-Finnova-Cached-At': cached.cachedAt
                  }),
                  url: req.url
                })
              );
            }
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
