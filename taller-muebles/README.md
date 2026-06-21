# Arcadia — Control de producción

Plataforma web interna para administrar las órdenes de fabricación de muebles de **Leather House (LH)** y **La Reina (LR)**. Centraliza notas de venta, avance productivo, responsables, fechas de entrega, stock, comentarios, adjuntos y trazabilidad.

El objetivo es reemplazar el seguimiento disperso en planillas por una fuente única de información que permita saber qué se está fabricando, en qué etapa está cada producto, quién puede intervenir y qué órdenes requieren atención.

## Qué permite hacer

- Crear y editar órdenes asociadas a una nota de venta.
- Registrar varios productos de un mismo cliente como órdenes independientes y seguir cada uno por separado.
- Mover productos entre etapas mediante un tablero visual.
- Iniciar, completar o bloquear etapas desde la vista del taller.
- Asignar trabajadores a una o varias áreas productivas.
- Registrar comentarios, archivos y sesiones de trabajo por etapa.
- Controlar existencias y movimientos de materiales.
- Consultar atrasos, prioridades, bloqueos, carga por proceso y próximas entregas.
- Mantener un historial de cambios mediante registros de auditoría.
- Configurar reglas de producción, alertas y permisos desde la aplicación.

## Flujo productivo

Cada producto avanza de forma independiente por las siguientes etapas:

1. Estructura
2. En Blanco
3. Corte
4. Costura
5. Tapicería
6. Control Calidad
7. Despacho

Una nota de venta puede contener varios productos en etapas diferentes. Por ejemplo, un sofá puede estar en Costura mientras otro producto del mismo cliente está en Tapicería.

Los estados posibles de una etapa son `pending`, `active`, `done` y `blocked`. Los cambios guardan fechas, responsable, observaciones y sesiones de trabajo.

## Tipos de usuario

| Rol | Uso principal |
| --- | --- |
| Administrador | Acceso completo a órdenes, usuarios, stock, configuración, reportes e historial. |
| Supervisor | Gestión operativa de órdenes y stock, según los permisos configurados. |
| Trabajador | Vista simplificada del taller y acceso limitado a sus áreas asignadas. |
| Lectura | Consulta de avance sin capacidad de modificación. |

La ruta inicial redirige automáticamente a `/admin` o `/taller` según el rol del usuario.

## Módulos y rutas

| Ruta | Módulo |
| --- | --- |
| `/login` | Inicio de sesión. |
| `/admin` | Resumen y tablero productivo del administrador. |
| `/admin/orders/new` | Creación de órdenes. |
| `/admin/orders/[id]` | Detalle, producción, comentarios y adjuntos. |
| `/admin/stock` | Materiales y movimientos de stock. |
| `/admin/reports` | Indicadores operativos. |
| `/admin/history` | Historial y auditoría. |
| `/admin/users` | Usuarios, roles y áreas de trabajo. |
| `/admin/settings` | Reglas generales, producción, alertas y permisos. |
| `/taller` | Cola de trabajo adaptada para operarios. |

## Tecnología

- Next.js 16 con App Router
- React 19 y TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, Auth y Storage
- Row Level Security (RLS)
- Zod y React Hook Form
- TanStack Table

## Arquitectura de datos

Las entidades principales son:

- `stores`: empresas o locales LH/LR.
- `profiles`: perfil, rol, estado y áreas de cada usuario autenticado.
- `orders`: producto, cliente, nota de venta, fechas, prioridad y estado general.
- `production_steps`: avance y sesiones de trabajo por etapa y producto.
- `order_comments`: comentarios vinculados a la orden y opcionalmente a una etapa.
- `order_attachments`: metadatos de archivos privados guardados en Supabase Storage.
- `materials` y `stock_movements`: existencias y movimientos de inventario.
- `audit_logs`: trazabilidad de acciones importantes.
- `system_settings`: configuración operativa editable.

Las migraciones están en [`supabase/migrations`](supabase/migrations). El esquema utiliza RLS y un bucket privado llamado `order-attachments`.

## Requisitos

- Node.js 20 o superior.
- npm.
- Un proyecto Supabase para trabajar con datos persistentes.
- Supabase CLI, incluida como dependencia de desarrollo del proyecto.

## Instalación local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Variables de entorno

Completa `.env.local` con los datos del proyecto Supabase:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=sb_secret_REPLACE_ME
LOCAL_DEMO_MODE=0
```

- La URL y la publishable key pueden llegar al navegador y están protegidas por RLS.
- `SUPABASE_SERVICE_ROLE_KEY` es exclusivamente de servidor y permite administrar usuarios.
- Nunca publiques `.env.local`, tokens, contraseñas ni la service role key.
- `OPENAI_API_KEY` está reservado para posibles funciones futuras; actualmente no es necesario.

## Modo de demostración local

Para ejecutar la aplicación sin Supabase:

```dotenv
LOCAL_DEMO_MODE=1
```

En este modo la aplicación utiliza datos persistidos en `.local-data`. Es útil para desarrollo y demostraciones, pero no reemplaza la base de producción.

## Configuración de Supabase

La guía completa se encuentra en [`docs/supabase-setup.md`](docs/supabase-setup.md). El flujo resumido es:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TOKEN_TEMPORAL"
npx supabase link --project-ref "PROJECT_REF"
npm run supabase:db:dry-run
npm run supabase:db:push
npm run supabase:migrations
npm run supabase:db:lint
npm run supabase:types
Remove-Item Env:SUPABASE_ACCESS_TOKEN
```

Usa un token temporal en la terminal y no lo guardes en archivos del proyecto.

### Primer administrador

1. Crea el usuario en Supabase Authentication.
2. Copia su UUID.
3. Inserta el perfil desde SQL Editor:

```sql
insert into public.profiles (user_id, full_name, role, active)
values ('UUID_DEL_USUARIO', 'Nombre del administrador', 'admin', true);
```

Después del primer acceso, los administradores pueden gestionar usuarios desde `/admin/users`.

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run build` | Genera la compilación de producción. |
| `npm run start` | Ejecuta una compilación de producción. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run supabase:status` | Muestra el estado de Supabase local. |
| `npm run supabase:db:dry-run` | Simula las migraciones pendientes del proyecto vinculado. |
| `npm run supabase:db:push` | Aplica las migraciones pendientes. |
| `npm run supabase:db:lint` | Revisa problemas SQL del esquema remoto. |
| `npm run supabase:migrations` | Compara el historial de migraciones local y remoto. |
| `npm run supabase:types` | Regenera los tipos TypeScript desde Supabase. |

## Crear una migración

Los cambios de esquema deben quedar versionados:

```powershell
npx supabase migration new nombre_descriptivo
```

Edita el archivo generado, comprueba primero el resultado con `npm run supabase:db:dry-run` y luego aplica con `npm run supabase:db:push`. Después de cambiar el esquema, regenera los tipos.

## Verificación antes de publicar

```powershell
npm run lint
npm run build
npm run supabase:migrations
npm run supabase:db:lint
```

También deben probarse al menos estos flujos:

1. Inicio y cierre de sesión.
2. Creación de una orden con todas sus etapas.
3. Movimiento entre etapas y persistencia después de recargar.
4. Inicio, bloqueo y finalización desde la vista Taller.
5. Creación y desactivación de usuarios.
6. Movimientos de stock y validación de existencias.
7. Acceso correcto para cada rol.

## Seguridad

- Supabase Auth valida las sesiones.
- Las tablas expuestas utilizan políticas RLS.
- Los adjuntos están en un bucket privado.
- La service role key solo debe usarse en componentes de servidor.
- Las acciones importantes generan registros de auditoría.
- Los usuarios se desactivan en lugar de borrar su historial.
- No deben usarse credenciales ficticias en producción.

## Despliegue

La aplicación está preparada para desplegarse en Vercel u otro entorno compatible con Next.js:

1. Configura las variables de entorno del proyecto.
2. Aplica las migraciones al Supabase de producción.
3. Ejecuta `npm run build` antes de publicar.
4. Crea el administrador inicial.
5. Verifica los flujos y permisos con usuarios de prueba.

No ejecutes la aplicación de producción con `LOCAL_DEMO_MODE=1`.

## Documentación adicional

- [`docs/product-blueprint.md`](docs/product-blueprint.md): alcance funcional y principios del producto.
- [`docs/supabase-setup.md`](docs/supabase-setup.md): conexión y preparación de Supabase.
- [`docs/formulario-reunion-dueno.md`](docs/formulario-reunion-dueno.md): preguntas para validar el flujo operativo con el dueño.
- [`AGENTS.md`](AGENTS.md): instrucciones técnicas para asistentes de desarrollo.

## Estado actual

La plataforma cuenta con autenticación, roles, tablero productivo, vista de taller, órdenes, stock, usuarios, configuración, reportes, comentarios, adjuntos y auditoría. La siguiente fase debe centrarse en validar el flujo con datos reales, preparar el despliegue de producción y ajustar reglas operativas según el uso diario del taller.
