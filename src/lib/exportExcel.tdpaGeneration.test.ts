import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { intersections } from '../data/intersections';
import { exportStudyWorkbook } from './exportExcel';
import { createTrafficStudyForIntersection, parseRoadTrafficCsv } from './roadTrafficImport';
import { applyUniformTdpaTemporalDistribution } from './tdpaCorridorSettings';
import type { Study } from './types';

const roadTrafficCsv = `CARRETERA,"CLAVE CARRETERA",RUTA,"PUNTO GENERADOR",KM,TIPO,SC,TDPA2024,M,A,B,C2,C3,T3S2,T3S3,T3S2R4,OTROS,AUTOS,AUTOBUSES,CAMIONES,D,K',LAT,LONG
"Huajuapan de León - Oaxaca",20056,MEX-190,"T. Aut. Cuacnopalan - Oaxaca",181.8,3,1,24977,10.6,80.5,2,3.1,1.2,0.9,0.5,0.8,0.4,91.1,2,6.9,0.511,0.076,17.139925,-96.776604
`;

function tableRows<T>(sheet: XLSX.WorkSheet): T[] {
  return XLSX.utils.sheet_to_json<T>(sheet, { range: 3 });
}

describe('exportStudyWorkbook TDPA generation lifecycle', () => {
  it('does not export derived TDPA rows when generation is pending', () => {
    const [record] = parseRoadTrafficCsv(roadTrafficCsv);
    const { study: importedStudy } = createTrafficStudyForIntersection(record, intersections[0]);
    const study: Study = {
      ...importedStudy,
      tdpaCorridorSettings: applyUniformTdpaTemporalDistribution(importedStudy),
      tdpaGeneratedAt: null,
      status: 'draft',
    };

    const workbook = exportStudyWorkbook(study, intersections[0]);
    const rows = tableRows<Record<string, string | number>>(workbook.Sheets['08_TDPA_ESTIMACION']);
    const generationState = rows.find((row) => row.Tipo === 'Estado' && row.Concepto === 'Generación TDPA');

    expect(generationState).toMatchObject({
      Valor: 'Pendiente de generar o regenerar.',
      Origen: 'Ciclo de estado',
    });
    expect(rows.filter((row) => row.Tipo === 'Configuración movimiento')).toHaveLength(0);
    expect(rows.filter((row) => row.Tipo === 'Intervalo estimado')).toHaveLength(0);
  });
});
