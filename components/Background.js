/**
 * Background Web Component (<ar-background>)
 * Renders an empty background with a faded, highly efficient animated halo.
 */

class ARBackground extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: var(--theme-background);
          overflow: hidden;
          z-index: 1;
          transition: background-color 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .halo-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .halo {
          width: 80vmax;
          height: 80vmax;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            hsla(var(--theme-base-raw), 0.16) 0%,
            hsla(var(--theme-base-raw), 0.06) 40%,
            hsla(var(--theme-base-raw), 0) 70%
          );
          filter: blur(60px);
          animation: pulse 16s ease-in-out infinite alternate;
          transform-origin: center;
          will-change: transform, opacity;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.8) translate(-5%, -5%);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.1) translate(5%, 2%);
            opacity: 0.9;
          }
          100% {
            transform: scale(0.9) translate(-2%, 5%);
            opacity: 0.75;
          }
        }
      </style>
      <div class="halo-container">
        <div class="halo"></div>
      </div>
    `;
  }
}

customElements.define('ar-background', ARBackground);
export default ARBackground;
