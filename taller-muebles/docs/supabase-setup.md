# Conectar el proyecto a Supabase

Esta guía conecta una cuenta nueva sin usar el plugin de Supabase ni reemplazar la sesión de otra cuenta. La CLI está instalada localmente en el proyecto y se ejecuta mediante `npm`/`npx`.

## Datos necesarios

Desde el proyecto nuevo en Supabase:

- Project ref
- Project URL
- Publishable key (`sb_publishable_...`)
- Secret key (`sb_secret_...`), solo para el servidor
- Database password
- Personal access token de la cuenta nueva

No pegues estos valores en archivos versionados ni en conversaciones. `.env.local` está ignorado por Git.

## 1. Configurar la aplicación

Copia `.env.example` como `.env.local` y reemplaza los tres valores de Supabase. Mantén `LOCAL_DEMO_MODE=0`.

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

## 2. Vincular la CLI sin cambiar otra sesión

Crea un personal access token desde la cuenta nueva y colócalo solo en la terminal actual. No ejecutes `supabase login`.

```powershell
$env:SUPABASE_ACCESS_TOKEN = "TOKEN_DE_LA_CUENTA_NUEVA"
npx supabase link --project-ref "PROJECT_REF"
```

La CLI solicitará la contraseña de la base de datos. No la agregues al historial del terminal mediante `--password`.

## 3. Revisar y aplicar el esquema

Primero ejecuta la simulación. Debe mostrar las tres migraciones pendientes sin modificar la base.

```powershell
npm run supabase:db:dry-run
npm run supabase:db:push
npm run supabase:migrations
npm run supabase:db:lint
```

Las migraciones crean las tablas, RLS, permisos explícitos para la Data API, el bucket privado `order-attachments` y los locales LH/LR.

## 4. Crear el primer administrador

En Supabase, abre Authentication > Users y crea el usuario administrador. Copia su UUID. Luego ejecuta lo siguiente en SQL Editor, reemplazando los valores:

```sql
insert into public.profiles (user_id, full_name, role, active)
values ('UUID_DEL_USUARIO', 'NOMBRE DEL ADMINISTRADOR', 'admin', true);
```

Este paso de arranque se hace manualmente porque las políticas impiden que un usuario común se otorgue privilegios de administrador.

## 5. Generar tipos y verificar

```powershell
npm run supabase:types
npm run lint
npm run build
npm run dev
```

Abre `http://localhost:3000/login`, inicia sesión y comprueba que los pedidos y cambios persistan después de recargar.

## 6. Cerrar la sesión temporal de CLI

```powershell
Remove-Item Env:SUPABASE_ACCESS_TOKEN
```

La vinculación local queda guardada en archivos ignorados por Git. El token no queda almacenado por este procedimiento.
