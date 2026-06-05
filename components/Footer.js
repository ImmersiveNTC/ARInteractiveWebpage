/**
 * Footer Web Component (<ar-footer>)
 * Renders the bottom footer bar, styled dynamically with the adjusted footer color.
 */

class ARFooter extends HTMLElement {
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
          height: 48px;
          background-color: var(--theme-footer);
          color: rgba(0, 0, 0, 0.85);
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          position: relative;
          z-index: 5;
          transition: background-color 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .footer-content {
          max-width: 1400px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          font-size: 0.8rem;
        }
        .copyright {
          font-weight: 500;
          opacity: 0.8;
        }
        .placeholder {
          font-weight: 500;
          opacity: 0.6;
        }
      </style>
      <div class="footer-content">
        <div class="copyright">&copy; 2026 AR Interactive Loader</div>
        <div class="placeholder">Module Footer</div>
      </div>
    `;
  }
}

customElements.define('ar-footer', ARFooter);
export default ARFooter;
