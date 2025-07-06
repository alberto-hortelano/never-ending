import { GameEvent, StateChangeEvent, StateChangeEventsMap, GUIEvent } from "../../common/events";
import { Component } from "../Component";
import { DragScroll } from "../../common/helpers/DragScroll";
import { ICoord } from "../../common/interfaces";
import { BoardService } from "../../common/services/BoardService";

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
        this.centerScreen(player.position);
      }
    });
    
    // Listen for popup visibility events
    this.listen(GUIEvent.popupShow, () => {
      if (this.isMobile()) {
        this.classList.add('popup-active');
      }
    });
    
    this.listen(GUIEvent.popupHide, () => {
      this.classList.remove('popup-active');
    });
  }

  private isMobile(): boolean {
    return window.innerWidth <= 768;
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


  private updateMap(newMap: StateChangeEventsMap[StateChangeEvent.map]) {
    this.mapData = newMap;
    this.id = 'board';

    const dimensions = BoardService.getBoardDimensions(this.mapData);
    this.style.setProperty('--map-width', dimensions.width.toString() || null);
    this.style.setProperty('--map-height', dimensions.height.toString() || null);

    this.innerHTML = '';

    const cellsToRender = BoardService.getCellsToRender(this.mapData);
    
    cellsToRender.forEach(cellData => {
      const cellElement = document.createElement('cell-component');
      cellElement.dataset.x = cellData.x.toString();
      cellElement.dataset.y = cellData.y.toString();
      cellElement.id = cellData.id;
      cellElement.setAttribute('content', cellData.content);
      cellElement.style.setProperty('--cell-x', cellData.x.toString());
      cellElement.style.setProperty('--cell-y', cellData.y.toString());
      
      cellData.wallClasses.forEach(wallClass => {
        cellElement.classList.add(wallClass);
      });

      this.appendChild(cellElement);
    });
  }


  private centerScreen({ x, y }: ICoord) {
    // Get cell width from CSS directly in the component
    const rootStyles = getComputedStyle(document.documentElement);
    const cellWidthStr = rootStyles.getPropertyValue('--cell-width');
    const cellWidthInVH = parseFloat(cellWidthStr);
    const cellWidth = BoardService.calculateCellWidthFromViewportHeight(cellWidthInVH, window.innerHeight);
    
    const boardWidth = this.clientWidth || window.innerWidth;
    const boardHeight = this.clientHeight || window.innerHeight;

    const scrollPosition = BoardService.calculateCenterScreenPosition(
      { x, y },
      cellWidth,
      boardWidth,
      boardHeight
    );

    this.dragger?.scrollTo(scrollPosition);
  }
}

customElements.define('board-component', Board);
