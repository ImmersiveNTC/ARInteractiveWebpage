/**
 * Header Web Component (<ar-header>)
 * Renders the top header bar, styled dynamically with the adjusted header color.
 */

class ARHeader extends HTMLElement {
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
          width: 100%;
          height: 60px;
          background-color: var(--theme-header);
          color: rgba(0, 0, 0, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          position: relative;
          z-index: 5;
          transition: background-color 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
        }
        .title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .placeholder {
          font-size: 0.8rem;
          font-weight: 500;
          opacity: 0.6;
        }
      </style>
      <div class="header-content">
        <div class="title">AR.LOADER</div>
        <div class="placeholder">Module Header</div>
      </div>
    `;
  }
}

customElements.define('ar-header', ARHeader);
export default ARHeader;
