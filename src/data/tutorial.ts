export interface WizardStep {
  label: string;
  helpTitle: string;
  helpBody: string;
  helpChecklist: string[];
}

export const wizardSteps: WizardStep[] = [
  {
    label: 'Estudio',
    helpTitle: 'Definir los datos comunes del estudio',
    helpBody:
      'Captura primero la fecha, horario, intervalo, aforador, clima y observaciones generales. Estos datos se conservan como memoria comun y se reutilizan automaticamente al trabajar con distintas intersecciones del mismo estudio.',
    helpChecklist: ['La hora de termino puede corresponder al dia siguiente.', 'Elige intervalos de 5, 10, 15, 20 o 30 minutos.', 'Completa los datos comunes antes de crear o seleccionar intersecciones.'],
  },
  {
    label: 'Interseccion',
    helpTitle: 'Crear o elegir el cruce de trabajo',
    helpBody:
      'Crea un marcador sobre el mapa o selecciona una interseccion ya creada. Revisa la clave, nombre, municipio, localidad y coordenadas; el CSV TDPA y las relaciones quedan vinculados solo a ese marcador.',
    helpChecklist: ['Crea o selecciona un marcador.', 'Confirma nombre, municipio, localidad y coordenadas.', 'Vincula el CSV o cruces relacionados cuando aplique.'],
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
      'Consulta el resumen ejecutivo con la misma fuente de datos que el Excel: KPIs, volumen por intervalo y acceso, distribucion por movimientos, colas y operacion e indicadores semaforicos.',
    helpChecklist: ['Revisa KPIs principales.', 'Compara las graficas y tablas consolidadas.', 'Confirma que hora pico, colas e indicadores tengan sentido con lo capturado.'],
  },
  {
    label: 'Exportar',
    helpTitle: 'Generar el archivo Excel',
    helpBody:
      'Cuando la informacion este revisada, genera el archivo XLSX. El Excel contiene ficha tecnica, dashboard, aforo detallado, programacion, colas, indicadores e instructivo para entregar el estudio.',
    helpChecklist: ['Genera el XLSX al finalizar la revision.', 'Abre el archivo para comprobar que se creo correctamente.', 'Solo limpia el estudio completo cuando ya no necesites ninguna interseccion capturada.'],
  },
];
