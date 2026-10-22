# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Aprobado
> **Depende de:** — (primer spec del repo; el MVP base todavía no está espeificado)
> **Fecha:** 2026-10-21
> **Objetivo:** Cuatro fantasmas con IA propia —blinky agresivo, pinky emboscada, inky flanqueo y clyde cobarde— que se comporten de forma distinta y ocupen el laberinto.
> **Estados válidos:** Borrador · En revisión · Aprobado · Implementado · Obsoleto

## Por qué existe este spec

El MVP actual tiene 2 fantasmas con una sola lógica (`kind: 'hunter'` cazador greedy vs `kind: 'random'` aleatorio). La diferencia de comportamiento es mínima y el fantasma "cazador" no es agresivo: comparte velocidad con el resto (1/10 celda/frame) y recalcula su objetivo igual que cualquier otro.

Este spec define cuatro arquetipos con objetivos, velocidades y roles distintos, y hace verificable esa diferencia con una tecla de diagnóstico.

## Alcance

**Dentro:**

- Cuatro fantasmas en juego, con los cuatro arquetipos del arcade: `blinky`, `pinky`, `inky`, `clyde`.
- Un objetivo y una velocidad distintos por arquetipo, con reglas deterministas y sin aleatoriedad.
- Un fantasma dentro de la pen que sale por la puerta en lugar de oscilar.
- Colores del arcade por arquetipo: blinky rojo, pinky rosa, inky cian, clyde naranja.
- Tecla `D` que dibuja el objetivo de cada fantasma para verificar los comportamientos.

**Fuera de alcance (para futuros specs):**

- Power pellets y modo "asustado" (fantasmas que huyen de Pac-Man).
- Modo alterno scatter/chase: los comportamientos son fijos durante toda la partida.
- Cambios en puntuación, vidas, HUD, laberinto o en el sistema de colisiones y vidas.
- Niveles adicionales, menú de inicio, audio, control táctil/móvil.

## Modelo de datos

### Roster de fantasmas

`src/js/maze.js` pasa de 2 a 4 fantasmas. Cada entrada lleva `kind`; la velocidad vive en `ghosts.js`.

```js
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera de la pen, justo encima de la puerta
  { x: 13, y: 14, kind: 'pinky' },  // dentro de la pen, en la columna de la puerta
  { x: 11, y: 15, kind: 'inky' },   // dentro de la pen, abajo izquierda
  { x: 15, y: 15, kind: 'clyde' },  // dentro de la pen, abajo derecha
];
```

### Parámetros e IA de los fantasmas

`src/js/ghosts.js` (archivo nuevo).

```js
// Velocidad en celdas por frame. Todas son 1/N: la alineación al centro de
// celda (tolerancia 1e-3) se repite cada N frames, que es lo que permite
// girar, comer y decidir.
const GHOST_SPEED = {
  blinky: 1 / 8,   // 0.125 - tan rápido como Pac-Man
  pinky: 1 / 10,   // 0.1
  inky: 1 / 12,    // 0.0833
  clyde: 1 / 15,   // 0.0667
};

// Recinto de la pen: interior 3x6 (filas 13-15, cols 11-16) más las dos
// celdas de la puerta (fila 12, cols 13-14). Única salida: la puerta.
const PEN = { top: 12, bottom: 15, left: 11, right: 16 };
const PEN_EXIT = { x: 13, y: 11 }; // celda que hay justo encima de la puerta

// Objetivo por arquetipo: devuelve la celda a la que apunta el fantasma.
const GHOST_TARGETS = {
  // Caza directa: la celda exacta de Pac-Man.
  blinky: ( game, g ) => ( { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) } ),

  // Emboscada: 4 celdas por delante de Pac-Man, en su dirección.
  pinky: ( game, g ) => {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    return { x: Math.round( p.x ) + 4 * d.x, y: Math.round( p.y ) + 4 * d.y };
  },

  // Flanqueo: Blinky hace de pivote. Se toma la celda 2 casillas por delante
  // de Pac-Man y se duplica el vector desde Blinky.
  inky: ( game, g ) => {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    const pivot = { x: Math.round( p.x ) + 2 * d.x, y: Math.round( p.y ) + 2 * d.y };
    const b = game.ghosts.find( ( other ) => other.kind === 'blinky' );
    return { x: 2 * pivot.x - b.x, y: 2 * pivot.y - b.y };
  },

  // Cobarde: persigue a Pac-Man si está a 8 celdas o menos (Manhattan);
  // si está más lejos, huye hacia la esquina inferior izquierda.
  clyde: ( game, g ) => {
    const p = game.pacman;
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    return dist <= 8 ? { x: px, y: py } : { x: 1, y: 29 };
  },
};
```

### Estado por fantasma

`game.ghosts[]` conserva su forma actual (`x`, `y`, `dir`, `speed`, `kind`). Solo cambian dos cosas: `speed` deja de ser común y `kind` pasa a ser el discriminante del comportamiento.

```js
// game.ghosts[i]
{
  x: 13,          // float, en celdas
  y: 11,
  dir: 'up',
  speed: 0.125,   // ahora sale de GHOST_SPEED[ kind ]
  kind: 'blinky', // 'blinky' | 'pinky' | 'inky' | 'clyde'
}
```

### Contrato entre archivos

`src/js/ghosts.js` necesita de `game.js` los helpers `DIRS` y `canMove( grid, x, y, dir, actor )`; `game.js` llama a `ghostDecide( game, g )` en tiempo de ejecución.

```js
// game.js
window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.canMove = canMove;   // nuevo: lo usa ghosts.js

// ghosts.js
window.GHOST_SPEED = GHOST_SPEED;  // nuevo: verificable desde la consola
window.ghostTarget = ghostTarget;  // nuevo: lo usa render.js para el diagnóstico
window.ghostDecide = ghostDecide;  // nuevo: lo usa game.js
```

`OPPOSITE` se traslada de `game.js` a `ghosts.js`: solo lo usa la IA.

## Plan de implementación

1. **Crear `src/js/ghosts.js` con los datos y la IA.** Nuevo archivo con `GHOST_SPEED`, `PEN`, `PEN_EXIT`, `OPPOSITE`, `GHOST_TARGETS`, `ghostTarget( game, g )` y `ghostDecide( game, g )`. Exportar en `window`: `GHOST_SPEED`, `ghostTarget`, `ghostDecide`. `game.js` exporta además `window.canMove = canMove;`. Registrar `<script src="js/ghosts.js"></script>` en `src/index.html` **después de `game.js`** y antes de `render.js`. En este paso `game.js` conserva su `decideGhost` local y el juego no cambia de comportamiento.
   *Verificación:* en la consola, `typeof window.ghostDecide === 'function'`; el juego sigue igual que antes.

2. **Integrar la IA y ampliar el roster a 4 fantasmas.** `src/js/maze.js`: sustituir `GHOST_STARTS` por el roster de 4 con `kind`. `src/js/game.js`: `createGame()` toma la velocidad de `GHOST_SPEED[ g.kind ]` en lugar de la constante común; `moveGhost()` llama a `ghostDecide( game, g )`; borrar de `game.js` el `decideGhost`, el `OPPOSITE` y el `GHOST_SPEED` locales.
   *Verificación:* aparecen 4 fantasmas; el rojo apunta a la casilla de Pac-Man, el rosa a 4 casillas por delante, el cian a la casilla de flanqueo y el naranja huye a la esquina cuando Pac-Man se aleja.

3. **Colores del arcade.** `src/js/render.js`: `GHOST_COLORS` pasa de array por índice a tabla por `kind` (`blinky: '#ff0000'`, `pinky: '#ffb8ff'`, `inky: '#00ffff'`, `clyde: '#ffb852'`) y `drawGhost` recibe el color según `g.kind`.
   *Verificación:* los 4 fantasmas son distinguibles de un vistazo: rojo, rosa, cian y naranja.

4. **Tecla de diagnóstico.** `src/js/main.js`: bandera `debug` que la tecla `d`/`D` alterna; `draw( ctx, game, frame, debug )`. `src/js/render.js`: `draw` acepta el cuarto parámetro y, cuando está activo, dibuja por fantasma un círculo hueco de 4 px en su color en la casilla objetivo, una línea de 1 px del fantasma al objetivo y su `kind` en 10 px. `src/index.html`: el párrafo del overlay inicial menciona la tecla `D`.
   *Verificación:* con `D` pulsado se ven 4 objetivos claramente distintos; con `D` de nuevo, la pantalla vuelve a limpio.

## Criterios de aceptación

- [ ] La página carga sin errores en la consola.
- [ ] Aparecen 4 fantasmas: rojo, rosa, cian y naranja, con los colores del arcade.
- [ ] `GHOST_SPEED` en la consola devuelve `blinky: 0.125`, `pinky: 0.1`, `inky: 0.0833`, `clyde: 0.0667` (todas con forma 1/N).
- [ ] Blinky, el fantasma rojo, tiene siempre como objetivo la casilla exacta de Pac-Man.
- [ ] Pinky, el fantasma rosa, tiene como objetivo 4 casillas por delante de Pac-Man en su dirección de avance.
- [ ] Inky, el fantasma cian, tiene como objetivo la celda obtenida con Blinky como pivote (2 casillas por delante de Pac-Man, vector duplicado desde Blinky).
- [ ] Clyde, el fantasma naranja, persigue a Pac-Man cuando está a 8 celdas o menos y se dirige a la esquina inferior izquierda cuando está más lejos.
- [ ] Ningún fantasma da media vuelta, salvo en un callejón sin salida donde no queda ninguna otra opción.
- [ ] Los 3 fantasmas que empiezan dentro de la pen salen por la puerta por arriba y no se quedan oscilando dentro del recinto.
- [ ] Al perder una vida, los 4 fantasmas vuelven a sus posiciones de inicio.
- [ ] Con la tecla `D` activada se ve el objetivo de cada fantasma y los 4 objetivos son distintos entre sí.
- [ ] Puntuación, vidas, conteo de puntos, estado `won`/`lost` y el reinicio siguen funcionando igual que antes del cambio.

## Decisiones

- **Sí:** los cuatro arquetipos canónicos del arcade (`blinky`, `pinky`, `inky`, `clyde`) en lugar de comportamientos inventados. Cada uno es reconocible y cubre los cuatro roles (cazador, emboscador, flanqueador, cobarde).
- **Sí:** el agresivo es `blinky`: objetivo fijo en la casilla de Pac-Man + velocidad 1/8 + nunca media vuelta. "Agresivo" se define por esos tres rasgos, no solo por la velocidad.
- **No:** modo scatter/chase alterno. Los comportamientos son fijos toda la partida; un temporizador global añadiría estado y modos de fallo que este spec no necesita.
- **Sí:** velocidades 1/8, 1/10, 1/12 y 1/15. Las proporciones del arcade (80/75/65/50 %) no son de forma 1/N y romperían la detección de alineación (tolerancia 1e-3): los fantasmas dejarían de girar y de comer correctamente.
- **Sí:** blinky arranca fuera de la pen, en `(13, 11)`, justo encima de la puerta; los otros tres dentro del recinto 3×6.
- **Sí:** mientras un fantasma está dentro de la pen (filas 12-15, cols 11-16) su objetivo es `(13, 11)` y la regla de "no dar media vuelta" queda suspendida. El recinto es una caja con una única salida: sin esa suspensión el fantasma puede quedar oscilando entre dos celdas en lugar de salir.
- **No:** el bug original de pinky (mira 4 casillas arriba *y* 4 a la izquierda cuando Pac-Man mira hacia arriba). Aquí mira recto hacia delante.
- **Sí:** `inky` usa 2 casillas por delante de Pac-Man como pivote (no 4, como pinky) y el objetivo no se recorta al laberinto: se usa tal cual para comparar distancias.
- **Sí:** `clyde` usa distancia Manhattan con umbral de 8 celdas. El arcade usa euclídea; se mantiene Manhattan por coherencia con el resto del código y se anota como desviación consciente.
- **Sí:** `clyde` huye hacia la esquina inferior izquierda `(1, 29)`, equivalente al scatter target del arcade.
- **Sí:** la IA vive en un archivo nuevo `src/js/ghosts.js` y se registra en `index.html` entre `game.js` y `render.js`. `game.js` lo invoca en tiempo de ejecución y `ghosts.js` lee `DIRS` y `canMove` de `game.js`: la dependencia es circular a nivel de archivo pero se resuelve en runtime por el orden de carga.
- **Sí:** la tecla `D` dibuja los objetivos. Distinguir cuatro IA a simple vista no es verificable; dibujar el objetivo convierte el criterio en algo comprobable de un vistazo.
- **No:** cualquier cambio en puntuación, vidas, HUD, laberinto, power pellets o en el sistema de colisiones.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La distancia Manhattan no atraviesa el túnel: un fantasma al otro extremo del pasillo puede elegir el camino aparentemente más largo. | Aceptado: es el criterio que usa hoy el código. El túnel solo existe en la fila 14. |
| `ghosts.js` y `game.js` quedan acoplados en las dos direcciones (`game.js` llama a `ghostDecide`; `ghosts.js` lee `DIRS` y `canMove`). | Se resuelve en runtime por el orden de carga (`ghosts.js` después de `game.js`). Si alguien reordena los `<script>`, el juego deja de funcionar. Queda escrito en `index.html` y en `AGENTS.md`. |
| La alineación al centro de celda depende de que las velocidades sean 1/N. | Documentado en `ghosts.js` y en `AGENTS.md`. Si se cambia una velocidad a un valor que no sea 1/N, los fantasmas dejan de girar y de comer. |
| Blinky arranca en `(13, 11)`, una celda cuyo único camino es lateral: el pasillo superior le obliga a un rodeo de ~4 celdas antes de bajar hacia Pac-Man. | Aceptado: reproduce el rodeo del arcade. Su objetivo sigue siendo la casilla de Pac-Man en todo momento. |
| La tecla `D` dibuja encima del escenario y puede tapar dots. | Es un modo de diagnóstico explícito y se desactiva con la misma tecla. |
| Si un fantasma entra en la pen con un objetivo inalcanzable, la regla de la pen lo saca, pero puede dar una vuelta de más. | La salida está verificada para las 4 posiciones de inicio: de 3 a 5 celdas hasta `(13, 11)`. |

## Lo que **no** incluye este spec

- Power pellets y modo "asustado" (fantasmas que huyen al ser alcanzados).
- Modo scatter/chase alterno con temporizador.
- Cambios en puntuación, vidas, HUD, laberinto o en el sistema de colisiones.
- Niveles adicionales, menú de inicio, audio, control táctil/móvil.
- Pruebas automatizadas: el repo no tiene runner ni linter, la verificación es manual en el navegador.

Cada uno, si entra, va en su propio spec.
