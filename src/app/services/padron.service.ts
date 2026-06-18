import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Observable } from 'rxjs';

/**
 * Service to fetch geometries for padrones (cadastral parcels) from the MGAP ArcGIS service.
 * The method receives a map where the key is the department code (e.g., "L") and the value
 * is an array of padron numbers (as strings). It constructs a single combined query using an
 * `IN` clause per department, as specified in the implementation plan.
 */
@Injectable({
  providedIn: 'root'
})
export class PadronService {
  private readonly baseUrl = 'https://mapastest.mgap.gub.uy/arcgis/rest/services/SNIA_Temas/ParcelasCatastrales/MapServer/0/query';

  constructor(private http: HttpClient) { }

  /**
   * Build and execute a query to fetch padron geometries.
   * @param deptPadMap Map of department code to array of padron numbers.
   * @returns Observable emitting the FeatureCollection compatible with `addGraphics`.
   */
  fetchPadronGeometries(deptPadMap: Record<string, string[]>): Observable<any> {
    const whereClauses: string[] = [];
    for (const dept in deptPadMap) {
      if (deptPadMap.hasOwnProperty(dept)) {
        const pads = deptPadMap[dept].join(',');
        // Padron numbers are numeric, but can be passed as strings without quotes.
        whereClauses.push(`CODDEPTO='${dept}' AND PADRON IN (${pads})`);
      }
    }
    const where = whereClauses.join(' OR ');
    const params = new URLSearchParams({
      f: 'geojson',
      outFields: 'CODDEPTO,PADRON,NOMDEPTO',
      returnGeometry: 'true',
      where: where,
      resultRecordCount: '10' // keep limit as per user request
    });
    const url = `${this.baseUrl}?${params.toString()}`;
    return this.http.get<any>(url).pipe(
      tap(res => console.log(res, 'padrones response'))
    );
  }
}
