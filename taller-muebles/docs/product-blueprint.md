# Control de Produccion - Blueprint Inicial

## Objetivo

Construir una plataforma web interna para Leather House y La Reina que mantenga la logica operativa de la planilla actual, pero con datos trazables, permisos, control de produccion, stock inicial, reportes y una base preparada para IA.

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
- Codigo interno.
- Nota de venta.
- Cliente.
- Producto/modelo.
- Material.
- Color.
- Fecha de ingreso.
- Fecha de entrega.
- Prioridad.
- Estado general.
- Condicion.
- Garantia.
- Responsable actual.
- Observaciones.
- Adjuntos.

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
- Movimientos de entrada/salida.
- Relacion opcional con orden de produccion.

### 4. Reportes

Primera version:

- Ordenes activas.
- Ordenes urgentes.
- Ordenes atrasadas.
- Ordenes bloqueadas.
- Carga por proceso.
- Stock bajo.
- Proximas entregas.

Segunda version:

- Tiempo promedio por etapa.
- Produccion por responsable.
- Atrasos recurrentes.
- Materiales con mayor consumo.

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
2. Define tienda, cliente, producto, fechas y prioridad.
3. Sistema genera codigo interno.
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
- Nada critico se borra; se archiva o queda en historial.
- Cada cambio relevante debe ser trazable.
- La IA no reemplaza los flujos; mejora decisiones sobre datos confiables.

## Pendientes Para La Siguiente Iteracion

- Definir columnas definitivas con planilla real.
- Definir usuarios reales y permisos.
- Crear esquema Supabase.
- Conectar autenticacion.
- Reemplazar datos demo por queries reales.
- Implementar acciones de crear/editar/cerrar orden.
- Implementar historial de cambios.
- Definir reglas exactas de stock.

## Estado De Implementacion

### Ya construido

- Proyecto Next.js con TypeScript, Tailwind y App Router.
- Panel administrador separado del panel taller.
- Login visual y accion server-side preparada para Supabase OTP.
- Tabla administrativa con busqueda, detalle de orden y creacion de nota.
- Vista taller con filtros por proceso y acciones demo para iniciar, terminar o bloquear etapas.
- Capa de repositorio que usa Supabase cuando hay variables de entorno y fallback demo cuando no.
- Migracion SQL inicial con tablas, enums, indices, RLS, permisos y bucket privado para adjuntos.

### Siguiente trabajo tecnico

- Crear proyecto Supabase del cliente y cargar `.env.local`.
- Ejecutar migracion inicial.
- Generar tipos Supabase reales desde la base.
- Cambiar acciones demo por Server Actions persistentes.
- Activar middleware/proteccion por sesion y rol.
- Crear usuarios reales: admin, manager, operario, viewer.
