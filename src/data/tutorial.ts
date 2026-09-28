export interface WizardStep {
  label: string;
  helpTitle: string;
  helpBody: string;
  helpChecklist: string[];
}

export const wizardSteps: WizardStep[] = [
  {
    label: 'Estudio',
    helpTitle: 'Mínimo a capturar en Estudio',
    helpBody:
      'En este paso se registran los datos generales que aplican a todo el estudio. Esta información se reutiliza en las intersecciones y define cómo se construirá la tabla de aforo.',
    helpChecklist: [
      'Fecha del estudio.',
      'Hora de inicio y hora de término.',
      'Intervalo de captura: 5, 10, 15, 20 o 30 minutos.',
      'Nombre del aforador o responsable.',
      'Clima observado.',
      'Observaciones generales si existe una condición especial: obra, lluvia, bloqueo, evento, accidente o desviación.',
    ],
  },
  {
    label: 'Interseccion',
    helpTitle: 'Mínimo a capturar en Intersección',
    helpBody:
      'Aquí se identifica el cruce que será evaluado. Cada intersección debe quedar claramente ubicada para que el aforo, la configuración, la semaforización y los resultados correspondan al mismo punto físico.',
    helpChecklist: [
      'Crear o seleccionar el marcador en el mapa.',
      'Clave de intersección.',
      'Nombre del cruce, por ejemplo: Reforma y Juárez.',
      'Municipio.',
      'Localidad.',
      'Coordenadas verificadas en el mapa.',
      'Observaciones de ubicación si el punto requiere aclaración.',
      'Vincular CSV TDPA solo si existe información externa disponible.',
      'Relacionar otras intersecciones solo si forman parte del mismo corredor o análisis.',
    ],
  },
  {
    label: 'Configuracion',
    helpTitle: 'Mínimo a capturar en Configuración',
    helpBody:
      'En este paso se describe cómo opera físicamente la intersección: accesos, carriles y movimientos permitidos. Esta configuración controla qué columnas deben capturarse en el aforo y qué movimientos aparecerán como no aplicables.',
    helpChecklist: [
      'Revisar los accesos Norte, Sur, Oriente y Poniente.',
      'Confirmar el nombre real de cada acceso.',
      'Capturar número de carriles por acceso.',
      'Activar únicamente los movimientos existentes: izquierda, frente, derecha y retorno.',
      'Desactivar movimientos que no existan físicamente.',
      'Definir grupos de carriles si se analizarán indicadores semafóricos.',
      'Capturar saturación por carril cuando se tenga dato medido o estimado.',
      'Guardar configuración antes de continuar.',
    ],
  },
  {
    label: 'Semaforo',
    helpTitle: 'Mínimo a capturar en Semáforo',
    helpBody:
      'Aquí se registra la programación semafórica observada o proporcionada. Esta información permite relacionar el aforo con ciclos, fases, verdes efectivos, colas e indicadores operativos.',
    helpChecklist: [
      'Crear al menos un programa semafórico.',
      'Capturar horario de inicio y término del programa.',
      'Capturar ciclo total en segundos.',
      'Registrar verde, ámbar y rojo del programa.',
      'Definir número de fases.',
      'Capturar tiempos por fase.',
      'Vincular los grupos de carriles configurados con su programa, fase y verde efectivo.',
      'Confirmar que los tiempos registrados correspondan al programa observado durante el aforo.',
    ],
  },
  {
    label: 'Aforo',
    helpTitle: 'Mínimo a capturar en Aforo',
    helpBody:
      'En este paso se capturan los volúmenes observados por intervalo, acceso y movimiento. La calidad de los resultados depende directamente de que la tabla esté completa y sea consistente.',
    helpChecklist: [
      'Capturar los movimientos habilitados: izquierda, frente, derecha y retorno.',
      'Registrar pesados, motos, bicicletas y peatones cuando aplique.',
      'Capturar colas: máxima, promedio, longitud de cola y vehículos detenidos por ciclo si fueron observados.',
      'Usar cero cuando el movimiento fue observado pero no pasó ningún vehículo.',
      'Dejar vacío solo cuando el dato esté pendiente.',
      'No capturar datos en movimientos marcados como N/A.',
      'Verificar que pesados más motos no sea mayor que el total motorizado.',
      'Registrar observaciones por intervalo si hubo una condición atípica.',
    ],
  },
  {
    label: 'Validar',
    helpTitle: 'Mínimo a revisar en Validar',
    helpBody:
      'Este paso sirve para detectar errores antes de interpretar resultados o exportar el Excel. Primero se corrigen errores obligatorios; después se revisan advertencias y datos recomendados.',
    helpChecklist: [
      'Revisar que no existan campos obligatorios vacíos.',
      'Corregir inconsistencias de clasificación vehicular.',
      'Confirmar que los movimientos N/A no tengan captura indebida.',
      'Revisar intervalos incompletos.',
      'Verificar advertencias de colas, ciclos o datos opcionales.',
      'Regresar al paso correspondiente para corregir.',
      'Validar solo cuando la información capturada sea confiable.',
    ],
  },
  {
    label: 'Resultados',
    helpTitle: 'Mínimo a revisar en Resultados',
    helpBody:
      'Aquí se interpreta el estudio con base en los datos capturados. Antes de exportar, se deben revisar los indicadores principales para confirmar que el comportamiento mostrado tenga sentido técnico.',
    helpChecklist: [
      'Revisar volumen total.',
      'Identificar hora pico.',
      'Revisar distribución por acceso.',
      'Revisar distribución por movimientos.',
      'Verificar composición vehicular: ligeros, pesados, motos, bicicletas y peatones.',
      'Revisar colas e indicadores semafóricos si fueron capturados.',
      'Confirmar que gráficas y tablas coincidan con lo observado en campo.',
      'Detectar valores atípicos antes de generar el Excel.',
    ],
  },
  {
    label: 'Exportar',
    helpTitle: 'Mínimo a revisar antes de Exportar',
    helpBody:
      'Este paso genera el archivo XLSX final. La exportación debe hacerse cuando el estudio ya fue capturado, validado y revisado en resultados.',
    helpChecklist: [
      'Confirmar que el estudio corresponde a la intersección correcta.',
      'Confirmar que los datos generales del estudio son correctos.',
      'Revisar que no existan errores pendientes en Validar.',
      'Revisar el dashboard antes de exportar.',
      'Generar el archivo Excel.',
      'Abrir el XLSX para confirmar que se creó correctamente.',
      'Verificar ficha técnica, dashboard, aforo detallado, programación, colas, indicadores e instructivo.',
      'No limpiar el estudio hasta confirmar que el archivo fue respaldado.',
    ],
  },
];
