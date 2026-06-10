# Twitterly

Clon de Twitter/X con Next.js 15, Prisma, SQLite y JWT. Backend en API Routes, frontend en App Router, tests de integración con Jest + Supertest.

---

## Stack y justificación

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router, TypeScript, Turbopack) |
| ORM | Prisma 6 |
| Base de datos | SQLite (`file:./dev.db`) |
| Auth | JWT (`jsonwebtoken`) + bcryptjs |
| Validación | Zod |
| Estilos | Tailwind CSS v4 |
| Tests | Jest + Supertest + ts-jest |

### Por qué Next.js 15 + Prisma + SQLite

**Next.js 15** unifica frontend y API en un solo repo. App Router permite route groups (`(auth)`, `(main)`), middleware para protección de rutas, y API Routes como backend sin servidor aparte. Para un clon de red social con CRUD y auth, es suficiente y reduce fricción de deploy local.

**Prisma** da tipado end-to-end sobre el schema, migraciones versionadas y queries legibles. El grafo de follows, likes y notificaciones se modela con relaciones explícitas y composite keys (`@@id` en `Follow` y `Like`).

**SQLite** elimina dependencias externas: un archivo `prisma/dev.db`, cero Docker, setup en segundos. Ideal para desarrollo, demos y tests de integración con seed determinístico.

### Trade-offs

| Decisión | Ventaja | Costo |
|----------|---------|-------|
| SQLite | Setup instantáneo, portable | Sin concurrencia real de escritura; no escala horizontal |
| JWT stateless | Sin sesiones en DB | No hay revoke centralizado; logout es client-side |
| API Routes monolíticas | Simplicidad | Sin colas, websockets ni workers para notificaciones en tiempo real |
| Prisma 6 (no 7) | Schema clásico con `url` en `datasource` | Migrar a Prisma 7 requiere `prisma.config.ts` |
| Paginación por cursor | Estable ante inserts concurrentes | Más compleja que offset; cursor inválido no falla explícitamente |

---

## Runbook

### Prerrequisitos

- **Node.js 20+**
- **npm 10+**
- Git (opcional)

### Instalación

```bash
# 1. Clonar o entrar al directorio del proyecto
cd twitterly

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Generar cliente Prisma
npm run db:generate

# 5. Aplicar migraciones
npm run db:migrate

# 6. (Opcional) Poblar datos de desarrollo
npm run db:seed
```

### Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Ruta al archivo SQLite. Relativa a `prisma/`. | `file:./dev.db` |
| `JWT_SECRET` | Clave para firmar y verificar tokens JWT. Cambiar en producción. | `super-secret-key-change-in-production` |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (frontend, links absolutos). | `http://localhost:3000` |

### Correr el seed

```bash
npm run db:seed
# equivalente: npx prisma db seed
```

Genera 12 usuarios, ~115 tweets, follows cruzados, likes y notificaciones derivadas. Password de todos: `password123`.

### Levantar en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Login en `/login`, timeline en `/home`.

### Correr los tests

```bash
# Todos los tests
npm test

# Con cobertura (umbral global 80%)
npm run test:coverage

# Modo watch
npm run test:watch
```

86 tests de integración. Prisma mockeado con `jest.mock`; no requiere DB real.

### Credenciales de prueba

| Email | Username | Password |
|-------|----------|----------|
| `alice@example.com` | `alice` | `password123` |
| `bob@example.com` | `bob` | `password123` |
| `carla@example.com` | `carla` | `password123` |

Los 12 usuarios del seed comparten la misma contraseña.

---

## Arquitectura

### Estructura de carpetas

```
app/
  api/              → API Routes (backend)
  (auth)/           → login, register
  (main)/           → home, search, notifications, [username]
components/         → UI reutilizable
lib/                → prisma, auth, session, validators, api-client
prisma/             → schema, migrations, seed
tests/              → integración backend (Jest + Supertest)
middleware.ts       → protección de rutas (Edge)
```

### Timeline y grafo de follows

El grafo de follows es una tabla de aristas dirigidas:

```
Follow { followerId, followingId }  @@id([followerId, followingId])
```

- `follower` → usuario que sigue
- `following` → usuario seguido

Para armar el timeline, primero se obtienen los IDs que el usuario actual sigue, y se agrega su propio ID (para incluir sus tweets):

```typescript
const follows = await prisma.follow.findMany({
  where: { followerId: session.userId },
  select: { followingId: true },
});

const authorIds = [
  session.userId,
  ...follows.map((f) => f.followingId),
];
```

Luego se consultan tweets de esos autores, ordenados por `createdAt DESC` + `id DESC` (desempate estable), con paginación por cursor:

```typescript
const tweets = await prisma.tweet.findMany({
  where: {
    authorId: { in: authorIds },
    // Si hay cursor: tweets más viejos que el cursor
    OR: [
      { createdAt: { lt: cursorTweet.createdAt } },
      { createdAt: cursorTweet.createdAt, id: { lt: cursorTweet.id } },
    ],
  },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: limit + 1,  // +1 para detectar si hay más páginas
  include: {
    author: { select: { id, username, displayName, avatarUrl } },
    _count: { select: { likes: true } },
  },
});
```

Se pide `limit + 1` registros. Si vienen más de `limit`, el último ID del slice es `nextCursor`. Los likes del usuario actual se resuelven en una segunda query batch (`like.findMany` con `tweetId IN [...]`) para evitar N+1.

**Follow toggle** (`POST /api/users/[username]/follow`): busca arista existente; si existe → `delete` (unfollow), si no → `create` + notificación `FOLLOW`.

### Autenticación JWT

1. **Registro/Login**: validación Zod → hash bcrypt (cost 10) → `signToken(userId)` con expiración 7 días.
2. **Token**: payload `{ userId }`, firmado con `JWT_SECRET` (HS256).
3. **Cliente**: guarda token en `localStorage` + cookie `token` (para middleware Edge).
4. **API Routes**: `getSession(request)` lee `Authorization: Bearer <token>` o cookie `token` → `verifyToken`.
5. **Middleware** (`middleware.ts`): protege páginas `(main)` y `/api/*` (excepto `/api/auth/*`). Usa Web Crypto (`crypto.subtle`) para verificar JWT en Edge Runtime (jsonwebtoken no corre ahí).
6. **Logout**: `POST /api/auth/logout` retorna `{ success: true }`; el cliente borra token de localStorage y cookie. No hay blacklist server-side.

### Notificaciones

Modelo:

```
Notification {
  userId    → receptor
  actorId   → quien generó la acción
  type      → LIKE | FOLLOW | REPLY
  tweetId?  → tweet relacionado (LIKE, REPLY)
  read      → boolean, default false
}
```

Se crean en el momento de la acción:

| Acción | Tipo | Receptor | Condición |
|--------|------|----------|-----------|
| Like | `LIKE` | Autor del tweet | No like propio |
| Follow | `FOLLOW` | Usuario seguido | Siempre al seguir |
| Reply | `REPLY` | Autor del tweet padre | No reply a tweet propio |

Endpoints:

- `GET /api/notifications` — lista (máx 50), incluye `actor` y `tweet`
- `POST /api/notifications/read` — marca todas como leídas
- `GET /api/notifications/unread-count` — contador para badge en nav

---

## API Routes

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Registro |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | No | Logout (client-side) |
| GET | `/api/auth/me` | Sí | Usuario actual |
| GET | `/api/timeline` | Sí | Timeline con cursor |
| POST | `/api/tweets` | Sí | Crear tweet/reply |
| GET | `/api/tweets/[id]` | No | Detalle tweet |
| DELETE | `/api/tweets/[id]` | Sí | Borrar (solo autor) |
| POST | `/api/tweets/[id]/like` | Sí | Toggle like |
| GET | `/api/users/search?q=` | No | Buscar usuarios |
| GET | `/api/users/[username]` | No | Perfil |
| GET | `/api/users/[username]/tweets` | No | Tweets del usuario |
| POST | `/api/users/[username]/follow` | Sí | Toggle follow |
| GET | `/api/users/[username]/followers` | No | Seguidores |
| GET | `/api/users/[username]/following` | No | Siguiendo |
| GET | `/api/notifications` | Sí | Lista notificaciones |
| POST | `/api/notifications/read` | Sí | Marcar leídas |
| GET | `/api/notifications/unread-count` | Sí | Contador unread |
| GET | `/api/health` | No | Health check |

---

## Uso de AI

### Herramientas

- **Cursor** (Agent mode) para scaffolding, implementación de features y generación de tests.

### Cómo dirigí el agente

Prompts por feature, en orden:

1. Scaffold (Next.js + Prisma + Jest + estructura de carpetas)
2. Schema Prisma + migración
3. Auth (JWT, middleware, session)
4. API Routes por dominio (auth → tweets → timeline → follows → likes → notifications → profile)
5. Tests de integración por archivo (`auth.test.ts`, `tweets.test.ts`, etc.)
6. Frontend (AuthContext, páginas, componentes)
7. Seed + README

Cada prompt especificaba: rutas exactas, validaciones, códigos de error, estructura de respuesta, y patrón de tests (Jest + Supertest + mock de Prisma).

### Revisión manual

| Área | Por qué |
|------|---------|
| Paginación por cursor | Lógica de `OR` con `createdAt` + `id` es propensa a bugs de orden |
| Middleware Edge vs Node | JWT en Edge requiere Web Crypto, no jsonwebtoken |
| Follow/Like toggle | Condiciones de notificación (no auto-notificar) |
| Composite keys Prisma | `@@id` en Follow/Like afecta `findUnique` |
| Cobertura de tests | Verifiqué que cada endpoint tenga éxito, 401, validación y edge cases |
| Sincronización token cookie/localStorage | Middleware solo lee cookie; sin esto las páginas protegidas fallan tras login |

---

## Limitaciones conocidas

- **SQLite no es para producción**: una escritura a la vez; sin réplicas ni connection pooling real.
- **Sin rate limiting**: endpoints de auth y creación de tweets son vulnerables a brute force / spam.
- **Avatares placeholder**: `avatarUrl` existe en schema pero no hay upload ni CDN; el UI muestra iniciales.
- **JWT sin revoke**: un token robado es válido hasta expirar (7 días). No hay refresh token ni blacklist.
- **Logout solo client-side**: el servidor no invalida tokens.
- **Sin WebSockets/SSE**: notificaciones requieren polling (`unread-count` en cada navegación).
- **Búsqueda básica**: `contains` case-insensitive por limitaciones de SQLite; sin full-text search ni ranking.
- **Replies en schema, UI parcial**: `parentId` y notificación `REPLY` funcionan en API; el frontend no tiene hilo de conversación dedicado.
- **Sin validación de imagen/media**: solo texto, máx 280 caracteres.
- **Prisma 6 pinned**: Prisma 7 cambió configuración de datasource; migración futura requerida.
- **`GET /api/users`**: stub que retorna 501.

---

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm test` | Tests |
| `npm run test:coverage` | Tests + reporte de cobertura |
| `npm run test:watch` | Tests en modo watch |
| `npm run db:generate` | Generar Prisma Client |
| `npm run db:migrate` | Aplicar migraciones |
| `npm run db:push` | Push schema sin migración |
| `npm run db:seed` | Poblar DB de desarrollo |
| `npm run lint` | ESLint |
