# Never ending

A game to test AI

## Tareas:
1. Mover character

## Events:
GameEvents: Dinamica del juego como play, pause, save...
StateEvents: Peticion de modificacion del estado. Solo la clase State puede escucharlos, cualquiera puede lanzarlos.
ComponentEvent: Eventos de la interfaz. Solo los componentes pueden lanzarlos

## TODO:
1. Show actions

## Actions
Hay 100 puntos por turno y cada accion consume n puntos, dependiendo de la habilidad del personaje

1. Disparo: Hace daño en base a la precision, el angulo de impacto.
1. Apuntar: Mejora la precision del siguiente disparo, reduce el angulo.
1. Supresion: Guardo acciones y disparo en cada accion del otro.
1. Movimiento
1. Cobertura: Se coloca en una cobertura adyacente
1. Lanzar granada
1. Talk: Hablar con alguien
1. Ataque CC: Se abre un selector con los ataques disponibles:
    1. Fuerte
    1. Medio
    1. Rapido
    1. Finta
    1. Al arma

## Daño
Daño base del arma 
