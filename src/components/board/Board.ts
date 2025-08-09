import { StateChangeEvent, StateChangeEventsMap, GUIEvent, GUIEventsMap, UpdateStateEvent, ControlsEvent } from "../../common/events";
import { Component } from "../Component";
import { DragScroll } from "../../common/helpers/DragScroll";
import { ICoord, IProjectileState, IInteractionMode } from "../../common/interfaces";
import { BoardService } from "../../common/services/BoardService";
import { ANIMATION_DURATIONS } from "../../common/constants";
import "../projectile/Projectile";

export default class Board extends Component {
  private mapData: StateChangeEventsMap[StateChangeEvent.map] = [];
  private dragger?: DragScroll;
  protected override hasCss = true;
  protected override hasHtml = true;
  private shootingCharacterName?: string;
  private overwatchCharacterName?: string;

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

    // Listen for UI state changes for board visual state
    this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
      const boardState = visualStates.board;
      if (boardState.hasPopupActive && this.isMobile()) {
        this.classList.add('popup-active');
      } else {
        this.classList.remove('popup-active');
      }
    });

    // Listen for shoot projectile events
    this.listen(GUIEvent.shootProjectile, (data) => this.createProjectile(data));
    
    // Listen for projectile state changes
    this.listen(StateChangeEvent.uiTransient, (transientUI) => {
      this.updateProjectiles([...transientUI.projectiles]);
    });
    
    // Listen for interaction mode changes
    this.listen(StateChangeEvent.uiInteractionMode, (mode) => {
      this.onInteractionModeChange(mode);
    });
    
    // Listen for cell mouse enter events during shooting mode
    this.listen(ControlsEvent.cellMouseEnter, (coord) => {
      this.onCellMouseEnter(coord);
    });
  }

  private isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  override async connectedCallback() {
    const root = await super.connectedCallback();
    
    // Initialize map from state if available
    const state = this.getState();
    if (state && state.map.length > 0) {
      this.updateMap(state.map);
      
      // Also center on player if available
      const player = state.findCharacter('player');
      if (player) {
        this.centerScreen(player.position);
      }
    }
    
    const fullScreenButton = root?.getElementById('full-screen');
    fullScreenButton?.addEventListener('click', () => {
      fullScreenButton.remove();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          alert(
            `Error attempting to enable fullscreen mode: ${document.fullscreenEnabled} ${err.message} (${err.name})`,
          );
        });
      }
    });
    return root;
  }
  
  disconnectedCallback() {
    // Cleanup if needed
  }


  private updateMap(newMap: StateChangeEventsMap[StateChangeEvent.map]) {
    this.mapData = newMap;
    this.id = 'board';

    const dimensions = BoardService.getBoardDimensions(this.mapData);
    
    // Update board visual state with dimensions
    this.dispatch(UpdateStateEvent.uiBoardVisual, {
      updates: {
        mapWidth: dimensions.width,
        mapHeight: dimensions.height
      }
    });
    
    this.style.setProperty('--map-width', dimensions.width.toString() || null);
    this.style.setProperty('--map-height', dimensions.height.toString() || null);

    this.innerHTML = '';

    const cellsToRender = BoardService.getCellsToRender(this.mapData);

    cellsToRender.forEach(cellData => {
      const cellElement = document.createElement('cell-component');
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

  private createProjectile(data: GUIEventsMap[GUIEvent.shootProjectile]) {
    // Add projectile to UI state instead of directly creating DOM element
    const projectileId = `projectile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.dispatch(UpdateStateEvent.uiAddProjectile, {
      id: projectileId,
      type: data.type,
      from: data.from,
      to: data.to,
      startTime: Date.now(),
      duration: ANIMATION_DURATIONS.PROJECTILE
    });
  }
  
  private updateProjectiles(projectiles: IProjectileState[]) {
    // Get existing projectile elements
    const existingProjectiles = new Set(
      Array.from(this.querySelectorAll('projectile-component')).map(el => el.id)
    );
    
    // Add new projectiles
    projectiles.forEach(projectile => {
      if (!existingProjectiles.has(projectile.id)) {
        const projectileElement = document.createElement('projectile-component');
        projectileElement.id = projectile.id;
        // No need to set dataset attributes - projectile will get data from state
        this.appendChild(projectileElement);
      }
    });
    
    // Remove projectiles that are no longer in state
    const currentProjectileIds = new Set(projectiles.map(p => p.id));
    existingProjectiles.forEach(id => {
      if (!currentProjectileIds.has(id)) {
        this.querySelector(`#${id}`)?.remove();
      }
    });
  }
  
  private onInteractionModeChange(mode: IInteractionMode) {
    // Clear previous modes
    this.shootingCharacterName = undefined;
    this.overwatchCharacterName = undefined;
    
    if (mode.type === 'shooting' && mode.data) {
      const shootingData = mode.data as { characterId: string };
      this.shootingCharacterName = shootingData.characterId;
    } else if (mode.type === 'overwatch' && mode.data) {
      const overwatchData = mode.data as { characterId: string };
      this.overwatchCharacterName = overwatchData.characterId;
    } else if (mode.type === 'melee' && mode.data) {
      // Add support for melee mode rotation
      const meleeData = mode.data as { attacker: string };
      this.shootingCharacterName = meleeData.attacker; // Reuse shootingCharacterName for melee
    }
  }
  
  private onCellMouseEnter(coord: ICoord) {
    // Process for shooting, overwatch, and melee modes
    const activeCharacterName = this.shootingCharacterName || this.overwatchCharacterName;
    if (!activeCharacterName) return;
    
    // Dispatch the coordinate update to appropriate service
    this.dispatch(ControlsEvent.mousePositionUpdate, {
      characterName: activeCharacterName,
      newDirection: 'down', // Placeholder, will be calculated in service
      mouseCoord: coord
    });
  }
}

customElements.define('board-component', Board);
