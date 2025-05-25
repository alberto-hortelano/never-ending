# Never ending

A game to test AI

## Tareas:
1. Mover character

## Events:
GameEvents: Dinamica del juego como play, pause, save...
StateEvents: Peticion de modificacion del estado. Solo la clase State puede escucharlos, cualquiera puede lanzarlos.
ComponentEvent: Eventos de la interfaz. Solo los componentes pueden lanzarlos

### Carga del juego:
1. GameEvent.play: Inicia el juego cargando el estado inicial. Podemos esperar las cosas que haya que cargar antes de lanzar este evento.
1. StateEvent: Un evento con cualquier parte del estado. 
 
## TODO:
1. Print characters
1. Move characters

## Actions
Hay 100 puntos por turno y cada accion consume n puntos, dependiendo de la habilidad del personaje

1. Disparo: Hace daño en base a la precision, el angulo de impacto.
1. Apuntar: Mejora la precision del siguiente disparo, reduce el angulo.
1. Supresion: Guardo acciones y disparo en cada accion del otro.
1. Movimiento
1. Cobertura: Se coloca en una cobertura adyacente
1. Lanzar granada
1. Sprint: Se declara al principio del turno y solo se puede mover pero mas barato

## Daño
Daño base del arma 


