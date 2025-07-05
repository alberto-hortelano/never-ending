import { StateChangeEventsMap, StateChangeEvent } from "../events";
import { ICoord } from "../interfaces";

export interface CellRenderData {
  x: number;
  y: number;
  id: string;
  content: string;
  wallClasses: string[];
  isWalkable: boolean;
}

export interface BoardDimensions {
  width: number;
  height: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

export class BoardService {
  private static readonly CELL_ID_PREFIX = 'cell';
  
  private static generateCellId(x: number, y: number): string {
    return `${this.CELL_ID_PREFIX}-${x}-${y}`;
  }
  
  public static getBoardDimensions(mapData: StateChangeEventsMap[StateChangeEvent.map]): BoardDimensions {
    return {
      width: mapData[0]?.length || 0,
      height: mapData.length || 0
    };
  }
  
  public static getCellsToRender(mapData: StateChangeEventsMap[StateChangeEvent.map]): CellRenderData[] {
    const cells: CellRenderData[] = [];
    
    mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell.content?.blocker) {
          cells.push({
            x,
            y,
            id: this.generateCellId(x, y),
            content: 'floor',
            wallClasses: this.getWallClasses(mapData, x, y),
            isWalkable: true
          });
        }
      });
    });
    
    return cells;
  }
  
  private static getWallClasses(mapData: StateChangeEventsMap[StateChangeEvent.map], x: number, y: number): string[] {
    const wallClasses: string[] = [];
    const dimensions = this.getBoardDimensions(mapData);
    
    const hasWallTop = y === 0 || mapData[y - 1]?.[x]?.content?.blocker === true;
    const hasWallRight = x === dimensions.width - 1 || mapData[y]?.[x + 1]?.content?.blocker === true;
    const hasWallBottom = y === dimensions.height - 1 || mapData[y + 1]?.[x]?.content?.blocker === true;
    const hasWallLeft = x === 0 || mapData[y]?.[x - 1]?.content?.blocker === true;
    
    if (hasWallTop) wallClasses.push('wall', 'wall-top');
    if (hasWallRight) wallClasses.push('wall', 'wall-right');
    if (hasWallBottom) wallClasses.push('wall', 'wall-bottom');
    if (hasWallLeft) wallClasses.push('wall', 'wall-left');
    
    return wallClasses;
  }
  
  public static calculateCenterScreenPosition(
    characterPosition: ICoord,
    cellWidth: number,
    boardWidth: number,
    boardHeight: number
  ): ScreenPosition {
    const centerX = (characterPosition.x * cellWidth) - (boardWidth / 2) + (cellWidth / 2);
    const centerY = (characterPosition.y * cellWidth) - (boardHeight / 2) + (cellWidth / 2);
    
    return {
      x: Math.max(0, centerX),
      y: Math.max(0, centerY)
    };
  }
  
  public static calculateCellWidthFromViewportHeight(cellWidthInVH: number, viewportHeight: number): number {
    return cellWidthInVH * viewportHeight / 100;
  }
}