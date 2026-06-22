# Control de Produccion - Blueprint Inicial

## Objetivo

Construir una plataforma web interna para Leather House y La Reina que mantenga la logica operativa de la planilla actual, pero con datos trazables, permisos, control de produccion, stock inicial, reportes y una base preparada para IA.

Ultima definicion con Rodrigo: 2026-06-22. Ver `docs/reunion-rodrigo-2026-06-22.md`.

## Personas

### Administrador

Rol pensado para Rodrigo o encargados con permiso completo.

- Crear notas de venta.
- Ver ventas historicas y produccion activa.
- Editar datos comerciales y fechas.
- Asignar responsables.
- Revisar stock, atrasos, bloqueos y prioridades.
- Cerrar ordenes terminadas.
- Acceder a reportes y trazabilidad.

### Operario

Rol enfocado en taller.

- Ver solo ordenes activas.
- Filtrar por proceso.
- Iniciar, terminar o bloquear etapas.
- Agregar observaciones productivas.
- Ver fecha de entrega, prioridad y datos minimos del producto.

### Viewer

Rol de solo lectura para supervision.

- Revisar avance sin editar.
- Consultar historial y reportes.

## Modulos

### 1. Ordenes

Entidad central del sistema.

Campos base:

- Tienda: LH o LR.
- Codigo comun de pedido para agrupar multiples productos de una misma venta.
- Codigo interno.
- Nota de venta o presupuesto generado de forma automatica y correlativa por serie.
- Cliente libre: persona o empresa.
- Producto/modelo.
- Material.
- Color.
- Fecha de ingreso.
- Fecha de entrega.
- Prioridad calculada desde fecha de entrega, sin prioridad manual paralela.
- Estado general.
- Condicion.
- Garantia.
- Responsable actual.
- Observaciones.
- Adjuntos.

Reglas acordadas:

- Un pedido puede tener varios productos asociados al mismo codigo comun, manteniendo avance individual por articulo.
- Las observaciones importantes deben activar un indicador visual discreto en tarjetas y tablas.
- Se conserva la marca de garantia para diferenciar reingresos por falla de ventas nuevas.
- Debe existir flexibilidad para medidas, materiales y productos personalizados.

### 2. Produccion

Etapas iniciales:

- Estructura.
- Corte.
- Costura.
- Tapiceria.
- Revision/calidad.

Cada etapa debe guardar:

- Estado: pendiente, activo, terminado, bloqueado.
- Responsable.
- Fecha/hora de inicio.
- Fecha/hora de termino.
- Usuario que actualizo.
- Observacion opcional.

### 3. Stock

Control inicial de materiales criticos.

- Material.
- Categoria.
- Unidad.
- Stock actual.
- Stock minimo.
- Tienda o stock general.
- Ubicacion fisica: bodega o taller.
- Movimientos de entrada/salida.
- Relacion opcional con orden de produccion.

Los materiales bajo minimo deben destacarse con alerta roja para reposicion inmediata.

### 4. Reportes

Primera version:

- Ordenes activas.
- Ordenes urgentes.
- Ordenes atrasadas.
- Ordenes bloqueadas.
- Carga por proceso.
- Stock bajo.
- Proximas entregas.
- Historial de despachos con filtro por mes y ultimos 30 dias.

Segunda version:

- Tiempo promedio por etapa.
- Produccion por responsable.
- Atrasos recurrentes.
- Materiales con mayor consumo.
- Cuellos de botella recurrentes con asistencia de IA cuando existan datos suficientes.

### 5. IA

La IA se agrega sobre datos ya ordenados.

Casos realistas:

- Resumen diario del taller.
- Ordenes en riesgo de atraso.
- Cuellos de botella por proceso.
- Sugerencia de prioridad.
- Reporte semanal automatico.
- Consulta en lenguaje natural sobre produccion.

## Flujos Principales

### Crear nota de venta

1. Admin crea orden.
2. Define tienda, cliente libre, producto, material, medidas y fechas.
3. Sistema genera codigo correlativo y codigo interno.
4. Orden queda programada o activa.

### Actualizar produccion

1. Operario entra a panel taller.
2. Filtra por area.
3. Selecciona orden.
4. Inicia, termina o bloquea etapa.
5. Sistema registra usuario, fecha y cambio.
6. Admin ve avance actualizado.

### Cerrar orden

1. Ultima etapa pasa a revision.
2. Admin valida condicion final.
3. Orden se marca terminada.
4. Sale de produccion activa.
5. Queda disponible en historial.

El panel principal debe mostrar solo productos activos o listos para coordinar despacho. No debe acumular historiales de despacho.

### Bloquear orden

1. Operario o admin marca etapa bloqueada.
2. Se exige motivo.
3. Admin ve alerta.
4. Al resolverse, etapa vuelve a activa o pendiente.

## Stack

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- TanStack Table.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- Vercel.
- OpenAI API o Vercel AI SDK para modulos de IA.

## Principios de Producto

- La tabla es el centro de operacion.
- El admin ve contexto completo.
- El taller ve solo lo necesario para ejecutar.
- El taller tambien debe ver trabajos futuros para planificar la semana y abastecimiento.
- Nada critico se borra; se archiva o queda en historial.
- Cada cambio relevante debe ser trazable.
- La IA no reemplaza los flujos; mejora decisiones sobre datos confiables.
- La prioridad operativa sale de la fecha de entrega, no de una seleccion manual.

## Pendientes Para La Siguiente Iteracion

- Crear o recibir el proyecto Supabase definitivo del cliente.
- Aplicar la migracion validada y cargar variables de produccion.
- Crear los usuarios reales y revisar permisos con Rodrigo.
- Validar columnas, reglas de stock y flujo final contra la planilla real.
- Incorporar decisiones de la reunion 2026-06-22: agrupacion por pedido, cliente libre, prioridad por fecha, ubicacion de stock, filtros de historial, etiquetas y trabajos futuros.
- Recibir y modelar ejemplo real de etiqueta de producto.
- Disenar regla editable para conversion de medidas internas en modelos especiales como Chesterfield.
- Verificar despliegue, tabletas del taller y recuperacion de acceso.
- Agregar funciones de IA solo despues de acumular datos operativos confiables.

## Estado De Implementacion

### Ya construido

- Proyecto Next.js con TypeScript, Tailwind y App Router.
- Panel administrador separado del panel taller.
- Login real con Supabase Auth, proteccion por sesion y rutas por rol.
- Tabla administrativa con busqueda, filtros, detalle, creacion, edicion, cierre e historial.
- Vista taller responsive con cola por area, detalle dedicado y transiciones de etapa validadas.
- Comentarios, adjuntos privados, auditoria, stock, usuarios, reportes y reglas configurables.
- Capa de repositorio con Supabase persistente y fallback local persistente cuando no hay variables.
- Migracion SQL con tablas, enums, indices, RLS, permisos explicitos y bucket privado para adjuntos.
- Supabase CLI inicializado, migracion aplicada localmente y tipos TypeScript generados desde la base.
- Matriz RLS validada localmente con admin, manager, operator y viewer.
- QA visual realizado en escritorio y movil de 390 px.

### Siguiente trabajo tecnico

- Vincular el repositorio al proyecto Supabase definitivo.
- Aplicar la migracion y volver a generar tipos desde ese proyecto.
- Repetir pruebas RLS y flujos completos con usuarios reales.
- Ajustar modelo y UI segun la reunion del 2026-06-22 antes de cargar datos reales en produccion.
- Configurar variables y despliegue de produccion en Vercel.
