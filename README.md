# Brownies Loyalty – Fase 0/1

Proyecto inicial del programa de fidelidad (PWA móvil + API NestJS).

## Estructura
- `src/` – Frontend React + Vite (PWA móvil).
- `backend/` – API NestJS (health y reglas de fidelidad; TypeORM listo para Postgres).

## Cómo correr
Frontend:
```bash
npm install
npm run dev
```

Backend:
```bash
cd backend
npm install
npm run start:dev
```

Base de datos y migraciones:
- Usa PostgreSQL. Crea `backend/.env` desde `backend/.env.example` con `DATABASE_URL=postgres://user:pass@host:5432/brownies` (`DB_SSL=true` si aplica).
- Crear tablas iniciales: `cd backend && npm run migration:run` (TypeORM).
- Revertir la última migración: `npm run migration:revert`.
- Si usas Supabase con pooler IPv4, usa el usuario con sufijo de proyecto (ej. `postgres.<project-ref>`) y el puerto del pooler (a menudo 6543). Ejemplo: `postgres://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres`.

Frontend con API:
- Opcional: define `VITE_API_URL=http://localhost:3000` en `.env` (raíz) para apuntar al backend. Si no responde, la app usa reglas locales como respaldo.

## Endpoints clave (backend)
- `GET /health` – estado.
- `GET /loyalty/rules` – reglas de fidelidad.
- `POST /auth/register` – registro (email, password) → JWT.
- `POST /auth/login` – login → JWT.
- `POST /loyalty/claim` – reclamar QR (header `Authorization: Bearer <token>`).
- `GET /loyalty/me` – puntos acumulados y cupones del usuario.
- `POST /loyalty/claims/generate` – generar códigos de producto (requiere token de admin).
- `POST /loyalty/coupons/redeem` – canjear cupón (roles admin o seller).

## Reglas definidas (Fase 0)
- 1 punto por producto.
- Primer cupón: 5 pts; siguientes cada 10 pts.
- Cupones expiran a los 60 días.
- Escalera de cupones progresiva (descuentos y productos gratis).
- Tokens firmados para QRs (productos y cupones) + antifraude (estado, rate limit, auditoría).

## Ticket points integrity (operacion)
- Endpoint auditoria: `GET /loyalty/admin/tickets/integrity?limit=200` (admin/seller).
- Endpoint reconciliacion: `POST /loyalty/admin/tickets/reconcile` (solo admin).
- Payload de reconciliacion: `{ "limit": 200, "dryRun": true }`.
- `dryRun: true` simula acciones sin escribir en BD.
- `dryRun: false` aplica correcciones reales (crea claim faltante, ajusta puntos y reprocesa rewards cuando corresponde).

Flujo recomendado:
1. Ejecutar auditoria y revisar `issueCount`.
2. Ejecutar reconciliacion en simulacion (`dryRun: true`).
3. Revisar `actions` y confirmar que no hay casos de `manual_review` sin validar.
4. Ejecutar reconciliacion real (`dryRun: false`) y volver a auditar.

UI admin:
- En la pesta�a `Tickets` hay panel para `Auditar`, `Simular` y `Aplicar`.
- El panel muestra inconsistencias y el resumen de la ultima corrida.
