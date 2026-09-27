export interface WizardStep {
  label: string;
  helpTitle: string;
  helpBody: string;
  helpChecklist: string[];
}

export const wizardSteps: WizardStep[] = [
  {
    label: 'Interseccion',
    helpTitle: 'Elegir el cruce correcto',
    helpBody:
      'Selecciona la interseccion donde se realizara el aforo. Revisa el nombre del cruce, la clave INT y las coordenadas antes de avanzar. Si el nombre no coincide exactamente con campo, conserva la clave y usa observaciones del estudio para aclararlo.',
    helpChecklist: ['Busca por clave INT o por nombre del cruce.', 'Confirma municipio, estado y coordenadas.', 'Avanza solo cuando el cruce seleccionado sea el correcto.'],
  },
  {
    label: 'Configuracion',
    helpTitle: 'Revisar accesos y movimientos',
    helpBody:
      'Aqui se confirma como entra el transito a la interseccion. Cada acceso debe representar una aproximacion real del cruce y sus movimientos permitidos. Los movimientos que no existan quedaran como N/A en la tabla de captura.',
    helpChecklist: ['Revisa accesos Norte, Sur, Oriente y Poniente.', 'Confirma carriles y movimientos permitidos.', 'Guarda la configuracion para reutilizarla en esta interseccion.'],
  },
  {
    label: 'Semaforo',
    helpTitle: 'Registrar la programacion semaforica',
    helpBody:
      'Captura o revisa el programa semaforico que aplica al periodo del aforo. Aqui puedes editar ciclo total, verde, ambar, rojo, numero de fases y los tiempos particulares de cada fase.',
    helpChecklist: ['Verifica horario de inicio y termino del programa.', 'Registra ciclo total, verde, ambar y rojo.', 'Configura los segundos de ciclo, verde, ambar y rojo de cada fase.'],
  },
  {
    label: 'Estudio',
    helpTitle: 'Completar datos generales',
    helpBody:
      'Define la fecha, hora de inicio, hora de termino, duracion de intervalo, aforador y clima. Estos datos generan automaticamente los renglones de captura y aparecen despues en el dashboard y en el Excel final.',
    helpChecklist: ['Usa una hora de termino posterior a la inicial.', 'Elige intervalos de 5, 10, 15, 20 o 30 minutos.', 'Completa aforador y clima para la ficha tecnica.'],
  },
  {
    label: 'Aforo',
    helpTitle: 'Capturar la tabla unica',
    helpBody:
      'Llena los volumenes por intervalo y por acceso. El total motorizado se calcula solo con izquierda, frente, derecha y retorno habilitados. Un cero significa que se observo el movimiento y no paso ningun vehiculo; un campo vacio significa dato pendiente.',
    helpChecklist: ['Captura numeros enteros mayores o iguales a cero.', 'No escribas en movimientos marcados como N/A.', 'Verifica que pesados mas motos no supere el total.'],
  },
  {
    label: 'Validar',
    helpTitle: 'Corregir errores antes de analizar',
    helpBody:
      'Esta pantalla resume si el estudio tiene datos completos o inconsistencias. Los errores obligatorios deben corregirse antes de confiar en el dashboard; las advertencias indican datos recomendados u opcionales pendientes.',
    helpChecklist: ['Atiende errores de campos vacios obligatorios.', 'Corrige clasificaciones mayores al total.', 'Regresa al paso Aforo si necesitas ajustar datos.'],
  },
  {
    label: 'Resultados',
    helpTitle: 'Interpretar el dashboard',
    helpBody:
      'Consulta el resumen ejecutivo del estudio: volumen total, hora de maxima demanda, FHP o factor de uniformidad, volumen por acceso y distribucion de movimientos. Estos datos salen de la misma fuente que el Excel.',
    helpChecklist: ['Revisa KPIs principales.', 'Compara volumen por intervalo y por acceso.', 'Confirma que la hora pico tenga sentido con lo capturado.'],
  },
  {
    label: 'Exportar',
    helpTitle: 'Generar el archivo Excel',
    helpBody:
      'Cuando la informacion este revisada, genera el archivo XLSX. El Excel contiene ficha tecnica, dashboard, aforo detallado, programacion, colas, indicadores e instructivo para entregar el estudio.',
    helpChecklist: ['Genera el XLSX al finalizar la revision.', 'Abre el archivo para comprobar que se creo correctamente.', 'Solo inicia un nuevo estudio cuando ya no necesites modificar el actual.'],
  },
];
