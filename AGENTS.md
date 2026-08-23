# AGENTS.md — Contexto del proyecto ARCADIA

Este documento es el punto de entrada para cualquier agente que trabaje en este repositorio. Léelo antes de modificar código. Las instrucciones más específicas de `taller-muebles/AGENTS.md` también aplican dentro de la aplicación.

## 1. Resumen del producto

ARCADIA es una plataforma interna de control para el taller de muebles de Rodrigo. Sustituye y mejora un flujo basado en Excel para administrar notas de venta, producción, entregas, stock y trazabilidad.

El cliente opera con dos tiendas/talleres:

- `LH`: Leather House.
- `LR`: La Reina.

La aplicación debe sentirse como una herramienta operacional profesional, sobria, rápida y confiable. El prototipo o planilla de referencia sirve para entender el negocio, pero no debe copiarse literalmente.

Principios esenciales:

- La tabla y las colas de trabajo son el centro de la operación.
- Administración y taller son experiencias distintas.
- El panel administrativo conserva el contexto comercial y operacional completo.
- El taller debe ser móvil/tablet-first, simple y orientado a la tarea actual.
- Los registros importantes no se eliminan físicamente: se archivan, cancelan o completan.
- Todo cambio crítico debe poder auditarse.
- La IA se incorpora sólo cuando los datos operacionales sean confiables.

## 2. Ubicación y Git

Raíz real del repositorio en este equipo:

```text
C:\Users\ninch\OneDrive\Escritorio\Códigos Hackers\Taller de Muebles
```

La aplicación Next.js está en:

```text
taller-muebles/
```

Estado conocido al actualizar este documento:

- Rama: `master`.
- Remoto: `https://github.com/Arcadia-muebles/taller-muebles.git`.
- El árbol de trabajo estaba limpio.

Antes de editar o publicar, ejecutar desde la raíz:

```powershell
git status --short
git branch --show-current
git remote -v
```

No incluir archivos `.env*`, `.next`, `node_modules`, `.local-data`, logs, capturas de QA ni otros artefactos generados salvo que la tarea los solicite expresamente.

## 3. Stack

- Next.js App Router `16.2.12`.
- React `19.2.4`.
- TypeScript 5.
- Tailwind CSS v4.
- TanStack Table.
- React Hook Form + Zod.
- `lucide-react`.
- Supabase: PostgreSQL, Auth, Storage y RLS.
- Vercel como destino de despliegue.
- OpenAI API / Vercel AI SDK reservado para funcionalidades posteriores.

Esta versión de Next.js puede diferir de patrones antiguos. Antes de tocar routing, cookies, middleware/proxy, Server Actions, caché o APIs del framework, leer la guía correspondiente dentro de `taller-muebles/node_modules/next/dist/docs/` y atender las advertencias de deprecación.

## 4. Roles y modelos mentales

Roles de aplicación:

- `admin`: administración completa.
- `manager`: supervisión y operación administrativa permitida.
- `operator`: trabajador de una o más áreas productivas.
- `viewer`: consulta sin edición operacional.

Reglas de acceso:

- Los operadores no deben editar información comercial o administrativa.
- Admin y manager gestionan órdenes y configuración según las políticas vigentes.
- Los operadores sólo actualizan pasos y órdenes dentro de sus áreas autorizadas.
- Una validación en la interfaz nunca reemplaza RLS ni la autorización del servidor.
- El `SUPABASE_SERVICE_ROLE_KEY` es exclusivamente de servidor.

`src/lib/auth.ts` resuelve sesión y redirección por rol. Con Supabase configurado valida el usuario mediante Auth y busca un perfil activo; en modo local usa una cookie HTTP-only y usuarios guardados localmente.

## 5. Áreas principales y rutas

### Acceso

- `/login`: autenticación.
- `/`: punto de entrada/redirección según sesión y rol.
- `/demo-login/[profile]`: acceso de demostración; tratarlo como funcionalidad local/controlada, no como autenticación de producción.

### Administración

- `/admin`: panel principal de producción activa y KPIs.
- `/admin/orders/new`: crear orden.
- `/admin/orders/[id]`: detalle de orden.
- `/admin/orders/[id]/edit`: editar orden.
- `/admin/history`: historial.
- `/admin/ready`: órdenes listas.
- `/admin/agenda`: agenda operativa.
- `/admin/documents`: documentos comerciales.
- `/admin/documents/[code]`: documento individual.
- `/admin/stock`: stock y movimientos.
- `/admin/structures`: solicitudes de estructuras.
- `/admin/suppliers`: proveedores.
- `/admin/reports`: reportes.
- `/admin/users`: usuarios, roles y áreas.
- `/admin/settings`: reglas y configuración del sistema.

### Taller

- `/taller`: cola de producción del operario.
- `/taller/orders/[id]`: detalle y acciones de la orden para taller.

No redirigir una experiencia propia del taller hacia una pantalla administrativa salvo que sea una decisión explícita de producto.

## 6. Conceptos de negocio

Campos principales de una orden:

- Tienda.
- Código interno.
- Número de nota de venta.
- Cliente.
- Producto/modelo.
- Material y color.
- Fecha de ingreso y fecha de entrega.
- Prioridad, condición y estado general.
- Garantía.
- Responsable.
- Observaciones y adjuntos.
- Pagos y documentos comerciales cuando corresponda.

Pasos productivos base:

- `structure`: estructura.
- `cutting`: corte.
- `sewing`: costura.
- `upholstery`: tapicería.
- `quality`: revisión de calidad.

El código también contempla áreas/etapas adicionales derivadas del flujo acordado con Rodrigo, como en blanco y despacho. Antes de cambiar la secuencia, revisar tipos, configuración, migraciones y el documento de reunión.

Estados de paso:

- `pending`.
- `active`.
- `done`.
- `blocked`.

Estados de orden:

- `draft`.
- `scheduled`.
- `in_production`.
- `blocked`.
- `urgent`.
- `quality_control`.
- `completed`.
- `cancelled`.

No asumir que una lista de este documento reemplaza los tipos actuales. Para implementar lógica, confirmar siempre en `src/lib/types.ts`, validaciones y migraciones.

## 7. Arquitectura de datos y modos de ejecución

La capa central de lectura está en `src/lib/repositories/production.ts`. La aplicación soporta dos modos:

1. Supabase, cuando existen `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Modo local persistente, cuando falta esa configuración o `LOCAL_DEMO_MODE=1`.

El modo local usa `src/lib/local-store.ts` y guarda datos en `taller-muebles/.local-data/`. Es útil para desarrollo y QA, pero no debe tratarse como fuente operacional de producción.

No asumir que la mera existencia de `.env.local` significa que todas las migraciones estén aplicadas o que RLS esté verificado. Antes de trabajar contra Supabase real, comprobar de forma explícita:

- Proyecto y entorno correctos.
- Migraciones aplicadas y en orden.
- Tipos alineados con el esquema real.
- Políticas RLS verificadas por rol.
- Bucket y permisos de adjuntos.
- Ausencia de claves sensibles en código cliente o logs.

Variables documentadas en `.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
LOCAL_DEMO_MODE=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Nunca mostrar ni copiar valores reales de `.env.local` en respuestas, commits, capturas o logs. Nunca usar el prefijo `NEXT_PUBLIC_` para la service role.

## 8. Estado funcional actual

La base existente incluye, como mínimo:

- Login y control de sesión por rol.
- Dashboard administrativo y métricas.
- Listado, creación, edición y detalle de órdenes.
- Cola y detalle específico para taller.
- Acciones sobre etapas de producción y comentarios.
- Cierre trazable de observaciones internas, que deja de mostrarlas como pendientes sin borrar su historial.
- Historial y vista de órdenes listas.
- Adjuntos con ruta local y soporte previsto para Storage.
- Agenda.
- Documentos comerciales y nota de venta imprimible.
- Registro de pagos y correcciones.
- Stock y movimientos.
- Solicitudes de estructuras.
- Proveedores.
- Usuarios, roles y múltiples áreas.
- Configuración del sistema.
- Auditoría consultable desde la capa de datos.
- Soporte dual Supabase / almacenamiento local.

No declarar que un flujo está terminado sólo porque exista su pantalla. Verificar persistencia, permisos, errores, estados vacíos, comportamiento responsive y correspondencia con el esquema.

## 9. Archivos importantes

Documentación:

```text
taller-muebles/docs/product-blueprint.md
taller-muebles/docs/reunion-rodrigo-2026-06-22.md
taller-muebles/docs/formulario-reunion-dueno.md
```

Autenticación, entorno y acceso:

```text
taller-muebles/src/lib/auth.ts
taller-muebles/src/lib/env.ts
taller-muebles/src/lib/workshop-access.ts
taller-muebles/src/lib/supabase/server.ts
taller-muebles/src/lib/supabase/browser.ts
taller-muebles/src/lib/supabase/admin.ts
taller-muebles/src/lib/supabase/database.types.ts
```

Datos y dominio:

```text
taller-muebles/src/lib/repositories/production.ts
taller-muebles/src/lib/repositories/settings.ts
taller-muebles/src/lib/local-store.ts
taller-muebles/src/lib/types.ts
taller-muebles/src/lib/orders.ts
taller-muebles/src/lib/metrics.ts
taller-muebles/src/lib/validation/order.ts
taller-muebles/src/lib/validation/production.ts
```

Acciones y componentes clave:

```text
taller-muebles/src/app/admin/orders/actions.ts
taller-muebles/src/app/admin/orders/collaboration-actions.ts
taller-muebles/src/app/taller/actions.ts
taller-muebles/src/components/order-table.tsx
taller-muebles/src/components/order-form.tsx
taller-muebles/src/components/active-production-dashboard.tsx
taller-muebles/src/components/worker-queue.tsx
taller-muebles/src/components/workshop-order-action-panel.tsx
taller-muebles/src/components/production-step-controls.tsx
taller-muebles/src/components/production-timeline.tsx
```

Esquema:

```text
taller-muebles/supabase/migrations/
```

Las migraciones cubren el esquema inicial, endurecimiento de acceso de operadores, cambios del flujo acordado con Rodrigo, documentos comerciales, estructuras/proveedores, agenda y pagos. Revisarlas cronológicamente antes de modificar la base.

## 10. Comandos y validación

Ejecutar desde `taller-muebles/`:

```powershell
npm install
npm run dev
npm run lint
npm run build
```

Para una modificación normal:

1. Leer este archivo, `taller-muebles/AGENTS.md` y la documentación relevante.
2. Revisar `git status` y preservar cambios ajenos.
3. Identificar si el flujo usa Supabase, modo local o ambos.
4. Implementar la mínima solución completa sin romper permisos ni el modelo admin/taller.
5. Ejecutar lint y build en proporción al cambio.
6. Probar manualmente el flujo y los roles afectados cuando sea posible.
7. Revisar el diff antes de entregar o publicar.

No afirmar que lint o build pasan basándose en una ejecución antigua; indicar sólo lo verificado en el turno actual.

## 11. Reglas de diseño y experiencia

- Mantener una estética minimalista, silenciosa, densa y profesional.
- Priorizar claridad operacional por encima de decoración.
- Usar iconos reales de `lucide-react`.
- Evitar patrones propios de una landing page.
- Mantener acciones peligrosas explícitas y confirmadas.
- Mostrar sólo la información necesaria al operario.
- Diseñar el taller para uso táctil y pantallas pequeñas sin degradar escritorio.
- Preservar consistencia con componentes y tokens existentes antes de crear variantes nuevas.

## 12. Seguridad y calidad

- RLS debe permanecer habilitado en tablas expuestas.
- Las Server Actions deben validar entrada y autorización; no confiar en datos del cliente.
- La service role sólo puede importarse en módulos server-only.
- Validar IDs, estados permitidos y transiciones de producción.
- Pedir y persistir una razón al bloquear cuando el flujo lo requiera.
- Registrar acciones críticas en auditoría.
- Tratar adjuntos como privados y validar acceso tanto en Storage como en rutas locales.
- No borrar historial de pagos, órdenes, stock o producción para “corregir” datos; usar movimientos o correcciones trazables.
- Mantener compatibilidad entre Supabase y modo local cuando el módulo admita ambos.

## 13. Trabajo pendiente y criterio de terminado

El proyecto sigue en evolución. Para cualquier módulo, considerar terminado sólo cuando se haya verificado:

- Persistencia real y modo local aplicable.
- Autorización de servidor y RLS por `admin`, `manager`, `operator` y `viewer` según corresponda.
- Manejo de errores, duplicados y estados vacíos.
- Trazabilidad/auditoría.
- Responsive en escritorio y móvil/tablet, especialmente en taller.
- Migraciones y tipos sincronizados.
- Lint y build actuales.

Áreas que requieren especial atención continua:

- Confirmar el estado real del proyecto Supabase y sus migraciones.
- Generar o regenerar tipos desde el esquema real cuando cambie.
- Auditar políticas RLS y privilegios de funciones.
- Verificar carga/descarga privada de adjuntos en producción.
- Completar y validar reportes con datos reales.
- Probar flujos de bloqueo, cierre, despacho, pagos y correcciones de punta a punta.
- Validar UX del taller en dispositivos reales.
- Incorporar funciones de IA únicamente después de estabilizar calidad, permisos y trazabilidad de datos.

## 14. Publicación y handoff

Antes de commit, push o PR:

- Revisar `git diff` y `git status`.
- No mezclar cambios ajenos o artefactos de desarrollo.
- No incluir secretos ni datos reales de clientes.
- Describir qué se cambió y qué se verificó realmente.
- Señalar cualquier supuesto, migración pendiente o validación que dependa de infraestructura externa.

Si el código contradice este documento, investigar primero. Actualizar `AGENTS.md` cuando cambien de forma material la arquitectura, rutas, roles, fuente de datos, seguridad o estado funcional.
