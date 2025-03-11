export class EventBridge extends HTMLElement {
  private connected: boolean = false;
  private pendingMessages: any[] = [];
  
  // Event handlers
  private eventHandlers: Map<string, Set<Function>> = new Map();
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: none;
          }
        </style>
      `;
    }
    
    // Initialize connection
    this.connect();
  }
  
  connect() {
    // Mark as connected - the adapter will handle the actual connection
    setTimeout(() => {
      this.connected = true;
      
      // Process any pending messages
      while (this.pendingMessages.length > 0) {
        const message = this.pendingMessages.shift();
        this.sendToGame(message.eventName, message.data);
      }
      
      // Notify that connection is established
      this.triggerEvent('system', { type: 'connection', status: 'connected' });
    }, 100);
  }
  
  // Send events to the game engine via the adapter
  sendToGame(eventName: string, data: any) {
    if (!this.connected) {
      // Queue message for when we're connected
      this.pendingMessages.push({ eventName, data });
      return;
    }
    
    // Log event being sent to game
    console.log(`Sending to game: ${eventName}`, data);
    
    // The actual sending is handled by dispatching events
    // The adapter will listen for these events and forward them to the game logic
    this.dispatchEvent(new CustomEvent(eventName, { detail: data, bubbles: true }));
  }
  
  // Receive events from the game engine
  receiveFromGame(eventName: string, data: any) {
    // Log event received from game
    console.log(`Received from game: ${eventName}`, data);
    
    // Process the event and trigger appropriate UI updates
    this.triggerEvent(eventName, data);
  }
  
  // Event system
  on(eventName: string, handler: Function) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    
    this.eventHandlers.get(eventName)?.add(handler);
  }
  
  off(eventName: string, handler: Function) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  triggerEvent(eventName: string, data: any) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventName} handler:`, error);
        }
      });
    }
    
    // Dispatch the event to the DOM as well
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
}

customElements.define('event-bridge', EventBridge);