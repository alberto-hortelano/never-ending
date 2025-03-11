export class GameDialog extends HTMLElement {
  private isVisible = false;
  private dialogContainer: HTMLElement | null = null;
  private dialogContent: HTMLElement | null = null;
  private dialogChoices: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
          }
          .dialog-container {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 600px;
            background-color: rgba(0, 0, 0, 0.8);
            border: 2px solid #555;
            border-radius: 5px;
            padding: 15px;
            color: white;
            font-family: 'Courier New', monospace;
            z-index: 100;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            display: none;
          }
          .dialog-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .speaker-name {
            font-weight: bold;
            color: #ffcc00;
          }
          .close-btn {
            background: none;
            border: none;
            color: #999;
            cursor: pointer;
            font-size: 16px;
          }
          .close-btn:hover {
            color: white;
          }
          .dialog-content {
            margin-bottom: 15px;
            line-height: 1.4;
          }
          .dialog-choices {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .dialog-choice {
            background-color: #333;
            border: 1px solid #555;
            border-radius: 3px;
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .dialog-choice:hover {
            background-color: #444;
          }
          .dialog-choice:active {
            background-color: #555;
          }
          .dialog-choice-number {
            display: inline-block;
            background-color: #555;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            text-align: center;
            line-height: 20px;
            margin-right: 8px;
          }
          .typing-effect {
            overflow: hidden;
            border-right: .15em solid orange;
            white-space: pre-wrap;
            animation: typing 3.5s steps(40, end), blink-caret .75s step-end infinite;
          }
          @keyframes typing {
            from { width: 0 }
            to { width: 100% }
          }
          @keyframes blink-caret {
            from, to { border-color: transparent }
            50% { border-color: orange; }
          }
        </style>
        <div class="dialog-container" id="dialog-container">
          <div class="dialog-header">
            <div class="speaker-name" id="speaker-name">Character</div>
            <button class="close-btn" id="close-dialog">×</button>
          </div>
          <div class="dialog-content" id="dialog-content"></div>
          <div class="dialog-choices" id="dialog-choices"></div>
        </div>
      `;

      this.dialogContainer = this.shadowRoot.getElementById('dialog-container');
      this.dialogContent = this.shadowRoot.getElementById('dialog-content');
      this.dialogChoices = this.shadowRoot.getElementById('dialog-choices');

      // Setup close button listener
      const closeButton = this.shadowRoot.getElementById('close-dialog');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.hideDialog());
      }
    }
  }

  showDialog(data: { speaker: string, content: string, choices?: Array<{ id: string, text: string }> }) {
    if (!this.shadowRoot || !this.dialogContainer || !this.dialogContent || !this.dialogChoices) return;

    // Set speaker name
    const speakerElement = this.shadowRoot.getElementById('speaker-name');
    if (speakerElement) {
      speakerElement.textContent = data.speaker;
    }

    // Set dialog content with typing effect
    this.dialogContent.innerHTML = '';
    this.dialogContent.textContent = data.content;
    this.dialogContent.classList.add('typing-effect');

    // Clear and add dialog choices if provided
    this.dialogChoices.innerHTML = '';
    if (data.choices && data.choices.length > 0) {
      data.choices.forEach((choice, index) => {
        const choiceElement = document.createElement('div');
        choiceElement.className = 'dialog-choice';
        choiceElement.dataset.choiceId = choice.id;

        const numberElement = document.createElement('span');
        numberElement.className = 'dialog-choice-number';
        numberElement.textContent = (index + 1).toString();

        choiceElement.appendChild(numberElement);
        choiceElement.appendChild(document.createTextNode(choice.text));

        choiceElement.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('dialog-choice-selected', {
            detail: { choiceId: choice.id }
          }));
          this.hideDialog();
        });

        this.dialogChoices?.appendChild(choiceElement);
      });
    }

    // Show the dialog
    this.dialogContainer.style.display = 'block';
    this.isVisible = true;

    // Setup keyboard shortcuts for choices
    document.addEventListener('keydown', this.handleKeydown);
  }

  hideDialog() {
    if (!this.dialogContainer) return;

    this.dialogContainer.style.display = 'none';
    this.isVisible = false;

    // Remove keyboard listener when dialog is closed
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown = (event: KeyboardEvent) => {
    if (!this.isVisible || !this.dialogChoices) return;

    // Check if a number key was pressed (1-9)
    if (event.key >= '1' && event.key <= '9') {
      const index = parseInt(event.key) - 1;
      const choices = this.dialogChoices.querySelectorAll('.dialog-choice');

      if (index < choices.length) {
        event.preventDefault();
        const choiceId = choices[index]?.getAttribute('data-choice-id');

        if (choiceId) {
          this.dispatchEvent(new CustomEvent('dialog-choice-selected', {
            detail: { choiceId }
          }));
          this.hideDialog();
        }
      }
    } else if (event.key === 'Escape') {
      // Close dialog on ESC key
      this.hideDialog();
    }
  }
}

customElements.define('game-dialog', GameDialog);