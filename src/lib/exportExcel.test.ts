import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { exportStudyWorkbook } from './exportExcel';
import { createDefaultStudy } from './study';
import { intersections } from '../data/intersections';

describe('exportStudyWorkbook', () => {
  it('creates the seven required sheets without invalid numeric values', () => {
    const study = createDefaultStudy('INT-001');
    const workbook = exportStudyWorkbook(study, intersections[0]);
    const names = workbook.SheetNames;

    expect(names).toEqual([
      '01_FICHA_TECNICA',
      '02_DASHBOARD',
      '03_AFORO_DETALLADO',
      '04_PROGRAMACION',
      '05_COLAS_OPERACION',
      '06_INDICADORES',
      '07_INSTRUCTIVO',
    ]);

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const allCells = parsed.SheetNames.flatMap((name) => Object.values(parsed.Sheets[name]));

    expect(allCells.some((cell) => typeof cell === 'object' && String(cell.v).match(/NaN|Infinity|#DIV\/0!/))).toBe(false);
  });
});
