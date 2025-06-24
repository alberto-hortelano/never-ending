import { GameEvent, StateChangeEvent, StateChangeEventsMap } from "../../common/events";
import { Component } from "../Component";
import { DragScroll } from "../../common/helpers/DragScroll";
import { ICoord } from "../../common/interfaces";

export default class Board extends Component {
  private mapData: StateChangeEventsMap[StateChangeEvent.map] = [];
  private dragger?: DragScroll;
  protected override hasCss = true;
  protected override hasHtml = true;

  constructor() {
    super();
    this.dragger = new DragScroll(this);
    this.listen(StateChangeEvent.map, (newMap) => this.updateMap(newMap));
    this.listen(StateChangeEvent.characters, (characters) => {
      const player = characters.find(c => c.name === 'player');
      if (player) {
        // Delay centering to ensure DOM elements are rendered
        setTimeout(() => {
          this.centerScreen(player.position);
        }, 100);
      }
    });
  }

  override async connectedCallback() {
    const root = await super.connectedCallback();
    const fullScreenButton = root?.getElementById('full-screen');
    fullScreenButton?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          alert(
            `Error attempting to enable fullscreen mode: ${document.fullscreenEnabled} ${err.message} (${err.name})`,
          );
        });
      }
    });
    this.dispatch(GameEvent.play, true);
    return root;
  }

  private generateCellId(x: number, y: number) {
    return `cell-${x}-${y}`;
  }

  private updateMap(newMap: StateChangeEventsMap[StateChangeEvent.map]) {
    this.mapData = newMap;
    this.id = 'board';

    this.style.setProperty('--map-width', this.mapData[0]?.length.toString() || null);
    this.style.setProperty('--map-height', this.mapData.length.toString() || null);

    this.innerHTML = '';


    // Only create elements for walkable cells (not walls)
    this.mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell.content?.blocker) {
          const cellElement = document.createElement('cell-component');
          cellElement.dataset.x = x.toString();
          cellElement.dataset.y = y.toString();
          cellElement.id = this.generateCellId(x, y);
          cellElement.setAttribute('content', 'floor');
          cellElement.style.setProperty('--cell-x', x.toString());
          cellElement.style.setProperty('--cell-y', y.toString());
          this.appendChild(cellElement);
        }
      });
    });
  }

  private centerScreen({ x, y }: ICoord) {
    // Get cell width from document root where it's defined
    const rootStyles = getComputedStyle(document.documentElement);
    const cellWidthStr = rootStyles.getPropertyValue('--cell-width');
    // Parse the value (it's in dvh units like "4dvh")
    const cellWidth = parseFloat(cellWidthStr) * window.innerHeight / 100;

    // Use window dimensions if client dimensions are not available yet
    const boardWidth = this.clientWidth || window.innerWidth;
    const boardHeight = this.clientHeight || window.innerHeight;

    const centerX = (x * cellWidth) - (boardWidth / 2) + (cellWidth / 2);
    const centerY = (y * cellWidth) - (boardHeight / 2) + (cellWidth / 2);

    // Ensure we don't scroll to negative values
    const scrollX = Math.max(0, centerX);
    const scrollY = Math.max(0, centerY);

    this.dragger?.scrollTo({ x: scrollX, y: scrollY });
  }
}

customElements.define('board-component', Board);
