const PERCENT_TOLERANCE = 1e-9;

export type TdpaTemporalDistribution = readonly [number, number, number, number];
export type TdpaTemporalAllocation = [number, number, number, number];

export const UNIFORM_TDPA_TEMPORAL_DISTRIBUTION: TdpaTemporalDistribution = [25, 25, 25, 25];

export function validateTdpaTemporalDistribution(distribution: readonly number[]): string[] {
  const issues: string[] = [];

  if (distribution.length !== 4) {
    issues.push('El perfil temporal TDPA debe contener exactamente cuatro intervalos de 15 minutos.');
  }

  distribution.forEach((value, index) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      issues.push(`El porcentaje del intervalo ${index + 1} debe estar entre 0% y 100%.`);
    }
  });

  const total = distribution.reduce((sum, value) => sum + value, 0);
  if (distribution.every(Number.isFinite)) {
    if (total > 100 + PERCENT_TOLERANCE) {
      issues.push('La distribución temporal TDPA excede 100%.');
    } else if (Math.abs(total - 100) > PERCENT_TOLERANCE) {
      issues.push('La distribución temporal TDPA debe sumar exactamente 100%.');
    }
  }

  return issues;
}

export function allocateTdpaTemporalVolume(
  total: number,
  distribution: TdpaTemporalDistribution,
): TdpaTemporalAllocation {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error('El volumen horario TDPA debe ser un entero no negativo.');
  }

  const issues = validateTdpaTemporalDistribution(distribution);
  if (issues.length > 0) {
    throw new Error(`Perfil temporal TDPA inválido: ${issues.join(' ')}`);
  }

  const exact = distribution.map((percentage, index) => ({
    index,
    exact: total * percentage / 100,
  }));
  const allocated = exact.map(({ exact: value }) => Math.floor(value));
  let remainder = total - allocated.reduce((sum, value) => sum + value, 0);

  exact
    .map((item) => ({ ...item, fraction: item.exact - Math.floor(item.exact) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      allocated[index] += 1;
      remainder -= 1;
    });

  return [allocated[0], allocated[1], allocated[2], allocated[3]];
}
