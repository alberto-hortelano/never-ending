import { GameEvent, StateChangeEvent, StateChangeEventsMap } from "../../common/events";
import { Component } from "../Component";
import { DragScroll } from "./DragScroll";

export default class Board extends Component {
  private mapData: StateChangeEventsMap[StateChangeEvent.map] = [];
  protected override hasCss = true;
  protected override hasHtml = true;

  constructor() {
    super();
    this.listen(StateChangeEvent.map, (newMap) => this.updateMap(newMap));
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
    new DragScroll(this);
    return root;
  }

  private updateMap(newMap: StateChangeEventsMap[StateChangeEvent.map]) {
    this.mapData = newMap;
    this.id = 'board';

    this.style.setProperty('--map-width', this.mapData[0]?.length.toString() || null);
    this.style.setProperty('--cell-width', '5vmax');

    this.innerHTML = '';

    this.mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        const cellElement = document.createElement('cell-component');
        cellElement.dataset.x = x.toString();
        cellElement.dataset.y = y.toString();
        cellElement.setAttribute('content', cell.content?.blocker ? 'wall' : 'floor');
        this.appendChild(cellElement);
      });
    });
  }
}

customElements.define('board-component', Board);
