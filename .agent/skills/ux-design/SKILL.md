---
name: ux-design
description: Guía la implementación UI/UX enfocada en estética moderna, limpia y minimalista (Glassmorphism). Úsalo para generar componentes, estilizar con TailwindCSS o mejorar el flujo de usuario.
---

# Habilidad: Diseño UX (UX Design)

Actúas como el **Director de Diseño**. Tu objetivo es crear interfaces **Modernas, Profesionales, Intuitivas, Armónicas y Elegantes**. Mantén el principio de "Limpias, Compactas y con Aire".

## Cuándo usar esta habilidad
- Al crear o modificar componentes React (`.tsx`).
- Al estilizar con TailwindCSS.
- Cuando el usuario pide "que se vea mejor" o "modernizar".

## Capacidades (Comandos)

### `modernize`
Aplica el estilo **Glassmorphism Lite**:
- **Fondos**: `bg-white` o `bg-slate-50`.
- **Bordes**: Sutil `border-slate-200`.
- **Sombras**: Suave `shadow-sm` o `shadow-lg` para flotantes.
- **Redondeo**: Generoso `rounded-xl` o `rounded-2xl`.

### `review_ui`
Critica el componente actual:
- **Espaciado**: ¿Los elementos respiran? Usa `gap-4` o `p-6`.
- **Jerarquía**: ¿La acción principal es obvia? (ej: fondo sólido vs botones ghost).
- **Densidad**: ¿Es "Compacto pero con Aire"? (ej: inputs `py-1.5` en tablas).

### `mobile_check`
Asegura la respuesta móvil (Responsive):
- **Grid**: Usa `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- **Flex**: Usa `flex-col` en móvil, `flex-row` en escritorio.

## Guías Visuales
- **Íconos**: Usa `lucide-react` con trazos finos (default).
- **Gráficos**: Usa `Recharts` con líneas de cuadrícula mínimas (`strokeDasharray="3 3"`).
- **Colores**:
    - **Primario**: Índigo/Violeta (`text-indigo-600`).
    - **Éxito**: Esmeralda (`text-emerald-500`).
    - **Error**: Rosa (`text-rose-500`).

## Reglas de Oro
- **Cero Cambios Funcionales**: En rediseños, NUNCA toques la lógica (`useEffect`, handlers, cálculos, estado). Solo altera JSX (estructura visual) y clases CSS.
- **Preservación**: Todo debe funcionar exactamente igual tras el cambio estético.
- **Excepción**: Solo modifica funciones o lógica si el usuario lo pide explícitamente.
