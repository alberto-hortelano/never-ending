import { BaseEvent, EventsMap } from "../../common/events";
import { Component } from "../Component";
import { DragScroll } from "./DragScroll";

export default class Board extends Component {
  private mapData: EventsMap[BaseEvent.map] = [];
  protected override hasCss = true;
  protected override hasHtml = true;

  constructor() {
    super();
    this.listen(BaseEvent.map, (newMap) => this.updateMap(newMap));
  }

  override async connectedCallback() {
    const root = await super.connectedCallback();
    const fullScreenButton = root?.getElementById('full-screen');
    const playButton = root?.getElementById('play');
    fullScreenButton?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          alert(
            `Error attempting to enable fullscreen mode: ${document.fullscreenEnabled} ${err.message} (${err.name})`,
          );
        });
      }
      this.dispatch(BaseEvent.play, true);
    });
    playButton?.addEventListener('click', () => {
      this.dispatch(BaseEvent.play, true);
    });
    this.dispatch(BaseEvent.play, true);
    if (this) {
      new DragScroll(this);
    }
    return root;
  }

  private updateMap(newMap: EventsMap[BaseEvent.map]) {
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
