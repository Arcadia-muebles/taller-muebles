# ARCADIA - Control de Producción

Aplicación interna para controlar notas de venta, producción, stock, usuarios y reportes del taller de muebles de Rodrigo.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage y RLS

## Desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables

Copiar `.env.example` a `.env.local` y completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` es sólo de servidor. No debe usarse con prefijo `NEXT_PUBLIC_`.

## Validación

```bash
npm run lint
npm run build
```

Sin variables de Supabase, la app queda en modo local limitado para revisión técnica. No usar ese modo como fuente operativa.
