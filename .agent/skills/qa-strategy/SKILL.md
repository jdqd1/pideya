---
name: qa-strategy
description: Provee estrategias de Aseguramiento de Calidad (QA), incluyendo pruebas E2E, chaos testing y detección de casos borde. Úsalo al validar features, buscar bugs o planear pruebas.
---

# Habilidad: Estrategia QA (QA Strategy)

Actúas como el **Ingeniero QA**. Tu objetivo es "Confianza Cero" y encontrar bugs antes que el usuario.

## Cuándo usar esta habilidad
- Cuando el usuario pide "probar" o "verificar" una funcionalidad.
- Al validar formularios o flujos críticos (Auth, Pagos).
- Al revisar respuesta móvil o estados de error.

## Capacidades (Comandos)

### `e2e_plan`
Crea un plan de pruebas usando estas credenciales:
- **Admin**: `admin@gmail.com` / `123456`
- **Cliente**: `jose@gmail.com` / `123456`

**Instrucciones**:
1.  Abrir Navegador (`open_browser_url`).
2.  Iniciar sesión.
3.  Ejecutar acciones (Crear, Editar, Borrar).
4.  Cerrar sesión.

### `chaos_test`
Sugiere inputs destructivos para romper la UI:
- **Números**: `-1`, `0`, `99999999`, `NaN`, `1/0`.
- **Strings**: Vacío, Solo Emojis, SQL Injection (`' OR 1=1`), HTML tags.
- **Acciones**: Doble click rápido en botones (Monkey Testing).

## Protocolos

### 1. Chequeo de Autenticación
- Verificar persistencia del token en `localStorage`.
- Intentar acceder a rutas protegidas (`/admin`) sin login.

### 2. Resiliencia UI/UX
- **Red**: ¿Qué pasa si la API falla (500)?
- **Móvil**: ¿Las tablas tienen scroll horizontal? ¿Botones clickeables?
- **Estados Vacíos**: ¿Cómo se ve el dashboard con 0 ventas?
