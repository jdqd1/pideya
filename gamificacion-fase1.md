# Gamificacion - Fase 1 (niveles y datos)

Que se incluyo:
- Definicion de niveles con acumulacion de puntos de por vida (sin ventana) y perks por rango.
- Modelo user_levels para persistir el ultimo calculo de nivel por usuario.
- Endpoints existentes exponen la info de nivel en las respuestas de reglas y estado del usuario.

Niveles (sin expiracion de puntos):
- Nivel 0 (>= 0 pts): sin descuento permanente, sin acceso anticipado.
- Nivel 1 (>= 15 pts): 5% permanente, 1 cupon exclusivo por trimestre, acceso anticipado 2 dias.
- Nivel 2 (>= 40 pts): 8% permanente + 10% selectivo, 2 cupones exclusivos por trimestre, acceso anticipado 5 dias.

Modelo de datos:
- Nueva tabla user_levels (migration 1727133000000-AddUserLevels): level_id, points_in_window, window_start/window_end, awarded_at, expires_at, timestamps; FK a users y constraint unica por usuario.
- Calculo de puntos de nivel: suma acumulada de product_claims con status claimed (sin ventana de tiempo).
- Se guarda/actualiza la fila de user_levels en cada recalculo para tener awarded_at y tracking del total; expires_at queda en null (sin vencimiento).

APIs / servicios:
- GET /loyalty/rules ahora incluye levelLadder y levelWindowDays (definicion de niveles y ventana).
- GET /loyalty/me ahora devuelve levelState { currentLevel, nextLevel, pointsInWindow, pointsToNext, windowStart, windowEnd, awardedAt, expiresAt }.
- POST /loyalty/claim recalcula nivel y devuelve levelState junto con el resto de la respuesta.

Notas para Fase 2:
- Conectar perks de nivel con pricing/checkout (descuentos permanentes y selectivos).
- Generar cupones exclusivos segun allowance por nivel.
- Superficie en UI: insignia en tarjeta, barra de progreso a siguiente nivel (sin countdown de expiracion).
