# Never ending

A game to test AI

## Tareas:
1. Mover character

UI refactor:
 * 

## Events:
GameEvents: Dinamica del juego como play, pause, save...
StateEvents: Peticion de modificacion del estado. Solo la clase State puede escucharlos, cualquiera puede lanzarlos.
ComponentEvent: Eventos de la interfaz. Solo los componentes pueden lanzarlos

## TODO:
1. Hace falta un cancelar accion
1. Al mover tendria que resaltar el path al ir haciendo hover en las celdas. Y al hacer click, dejar el path resaltado e ir quitando celdas a medida que el personaje avanza
1. UI Refactor:
 * Character selection. If the player has only one character it is automatically selected. If there is no character selected none of the following is shown.
 When a character is selected:
 * Movement is pre-selected when a character is selected, the reachable cells are shown and shows the path on mouse hover with a heavier highlight. The click on a highlighted cell initiates the movement.
 * A top and a botom bar are added. They get space from the board component, so the board is between both bars.
 * The top bar is for info and less used buttons.
 * The bottom bar is the actions bar.
 * Rotate component is fixed in the bottom left corner.
 * Action Points are displayed at the top, labeled with the character's name: "Character Name: Action Points", shown as a progress bar.
 * Clicking on a character (while not in targeting mode) brings up a popup with the "Talk" option to confirm interaction. More actions may be added in the future.
 * Clicking on a usable object brings up a popup with the "Use" option to confirm, similar to "Talk".
 * Inventory is a button located at the right of the top bar. Clicking it opens the inventory popup.
 * The combat buttons have a toggle between close and ranged. They display on the bottom bar from left to right, on mobile both types of combar are shown in two columns and the full bottom bar has a toggle button to expand or contract it


## Actions
Hay 100 puntos por turno y cada accion consume n puntos, dependiendo de la habilidad del personaje

1. Disparo: Hace daño en base a la precision, el angulo de impacto.
Lets build the shoot action. When the user clicks the shoot button, the cells in front of the character should highlight in the direction the character is looking. With a given angle of vision. The cells that are partially visible should be highlighted with an intensity showing the percentage of cell that is visible. It should also get a max range and the highlight should also dimm with the distance. For this you will create a class Shoot that has a method that gets the map, the position and orientation of the character that is shooting and the range of the weapon. The method should return an array of reachable cells with the percentage given by the distance and visibility. Any questions?
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
