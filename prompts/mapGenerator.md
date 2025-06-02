Your goal is to write a map generator class for a video game.
It is a top‐down, tile‐based environment (spaceship interior, dungeon, courtyard, etc.)
Each tile is one element of a matrix that can be a 0 for a wall or a 1 for walkable floor.

The MapGenerator class has a method generateMap that gets this arguments:
* rooms: an array of rooms with the size of each room. Size can be 3, 5, 7, 9 or 11

It will choose one position for the center of each room.
It will start at x = 0 y = 0.
It will move in a random direction (up, right, left, down) a random distance.
the distance is minimum of half (ceil) the size of the room and half (ceil) the size of the next room and max n times the min distance.
The direction wont go back to the previous direction and will retry if there is a center of another room at less than its min distance.




