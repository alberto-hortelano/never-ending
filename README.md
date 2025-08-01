# Never ending

A game to test AI

## Tareas:
1. Mover character

## Events:
GameEvents: Dinamica del juego como play, pause, save...
StateEvents: Peticion de modificacion del estado. Solo la clase State puede escucharlos, cualquiera puede lanzarlos.
ComponentEvent: Eventos de la interfaz. Solo los componentes pueden lanzarlos

## TODO:
1. Hace falta un cancelar accion
1. Al mover tendria que resaltar el path al ir haciendo hover en las celdas. Y al hacer click, dejar el path resaltado e ir quitando celdas a medida que el personaje avanza

## Actions
Hay 100 puntos por turno y cada accion consume n puntos, dependiendo de la habilidad del personaje

1. Disparo: Hace daño en base a la precision, el angulo de impacto.
Lets build the shoot action. When the user clicks the shoot button, the cells in front of the character should highlight in the direction the character is looking. With a given angle of vision. The cells that are partially visible should be highlighted with an intensity showing the percentage of cell that is visible. It should also get a max range and the highlight should also dimm with the distance. For this you will create a class Shoot that has a method that gets the map, the position and orientation of the character that is shooting and the range of the weapon. The method should return an array of reachable cells with the percentage given by the distance and visibility. Any questions?
1. Apuntar: Mejora la precision del siguiente disparo, reduce el angulo.
1. Supresion: Guardo acciones y disparo en cada accion del otro.
1. Movimiento
1. Cobertura: Se coloca en una cobertura adyacente
1. Lanzar granada
    1. Explosiva: hace danio en area
    1. Flash: Rompe los overwqatches que en los que caiga (porcentaje segun el del overwatch)
    1. humo: Reduce danio en area en ambas direcciones
1. Talk: Hablar con alguien
1. Ataque CC: Se abre un selector con los ataques disponibles:
    1. Fuerte
    1. Medio
    1. Rapido
    1. Finta
    1. Al arma

## Daño
Daño base del arma 
