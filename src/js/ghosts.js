// ghosts.js
// IA de los fantasmas y parametros. Depende de globals de game.js: DIRS, canMove.
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

// Velocidad en celdas por frame. Todas son 1/N: la alineacion al centro de
// celda (tolerancia 1e-3) se repite cada N frames, que es lo que permite
// girar, comer y decidir.
const GHOST_SPEED = {
  blinky: 1 / 8,   // 0.125 - tan rapido como Pac-Man
  pinky: 1 / 10,   // 0.1
  inky: 1 / 12,    // 0.0833
  clyde: 1 / 15,   // 0.0667
};

// Recinto de la pen: interior 3x6 (filas 13-15, cols 11-16) mas las dos
// celdas de la puerta (fila 12, cols 13-14). Unica salida: la puerta.
const PEN = { top: 12, bottom: 15, left: 11, right: 16 };
const PEN_EXIT = { x: 13, y: 11 }; // celda que hay justo encima de la puerta

function inPen( x, y ) {
  const cx = Math.round( x );
  const cy = Math.round( y );
  // Interior de la pen o puerta
  if ( cy === 12 && cx >= 13 && cx <= 14 ) return true;
  if ( cy >= 13 && cy <= 15 && cx >= 11 && cx <= 16 ) return true;
  return false;
}

// Objetivo por arquetipo: devuelve la celda a la que apunta el fantasma.
const GHOST_TARGETS = {
  // Caza directa: la celda exacta de Pac-Man.
  blinky: ( game, g ) => ( { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) } ),

  // Emboscada: 4 celdas por delante de Pac-Man, en su direccion.
  pinky: ( game, g ) => {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    if ( !d ) return { x: Math.round( p.x ), y: Math.round( p.y ) };
    return { x: Math.round( p.x ) + 4 * d.x, y: Math.round( p.y ) + 4 * d.y };
  },

  // Flanqueo: Blinky hace de pivote. Se toma la celda 2 casillas por delante
  // de Pac-Man y se duplica el vector desde Blinky.
  inky: ( game, g ) => {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    if ( !d ) return { x: Math.round( p.x ), y: Math.round( p.y ) };
    const pivot = { x: Math.round( p.x ) + 2 * d.x, y: Math.round( p.y ) + 2 * d.y };
    const b = game.ghosts.find( ( other ) => other.kind === 'blinky' );
    const bx = b ? Math.round( b.x ) : pivot.x;
    const by = b ? Math.round( b.y ) : pivot.y;
    return { x: 2 * pivot.x - bx, y: 2 * pivot.y - by };
  },

  // Cobarde: persigue a Pac-Man si esta a 8 celdas o menos (Manhattan);
  // si esta mas lejos, huye hacia la esquina inferior izquierda.
  clyde: ( game, g ) => {
    const p = game.pacman;
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    const gx = Math.round( g.x );
    const gy = Math.round( g.y );
    const dist = Math.abs( gx - px ) + Math.abs( gy - py );
    return dist <= 8 ? { x: px, y: py } : { x: 1, y: 29 };
  },
};

function ghostTarget( game, g ) {
  if ( !g || !g.kind ) return { x: Math.round( g.x ), y: Math.round( g.y ) };
  // Mientras esta dentro de la pen, objetivo es la salida
  if ( inPen( g.x, g.y ) ) {
    return { x: PEN_EXIT.x, y: PEN_EXIT.y };
  }
  const fn = GHOST_TARGETS[ g.kind ];
  if ( typeof fn === 'function' ) {
    return fn( game, g );
  }
  // Fallback
  const p = game.pacman;
  return { x: Math.round( p.x ), y: Math.round( p.y ) };
}

function ghostDecide( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const choices = [];
  const dirs = Object.keys( DIRS );
  for ( let i = 0; i < dirs.length; i++ ) {
    const dir = dirs[ i ];
    if ( dir === OPPOSITE[ g.dir ] ) continue;
    if ( canMove( grid, g.x, g.y, dir, 'ghost' ) ) {
      choices.push( dir );
    }
  }
  // Sin salida (callejon): permitir el giro de 180.
  if ( choices.length === 0 ) {
    const back = OPPOSITE[ g.dir ];
    if ( back && canMove( grid, g.x, g.y, back, 'ghost' ) ) {
      choices.push( back );
    } else {
      // ultimo recurso
      choices.push( g.dir );
    }
  }

  // Si esta dentro de la pen, seguir regla de "no dar media vuelta" queda suspendida
  // segun spec; pero queremos que salga por la puerta. Con objetivo = salida y
  // eligiendo la opcion que minimiza distancia a objetivo, saldra.
  // Elegir direccion que minimiza distancia Manhattan al objetivo (en siguiente celda)
  let best = choices[ 0 ];
  let bestDist = Infinity;
  const tx = target.x;
  const ty = target.y;
  for ( let i = 0; i < choices.length; i++ ) {
    const dir = choices[ i ];
    const d = DIRS[ dir ];
    const nx = Math.round( g.x ) + d.x;
    const ny = Math.round( g.y ) + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

window.GHOST_SPEED = GHOST_SPEED;
window.ghostTarget = ghostTarget;
window.ghostDecide = ghostDecide;
