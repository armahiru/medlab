/**
 * MediChain — QR helpers for public report verification
 * Primary: server-generated PNG (/api/qr) so the UI never hangs on CDNs.
 */
const QR = {
  SCRIPT_TIMEOUT_MS: 4000,

  buildVerifyUrl(reportId) {
    const id = String(reportId || '').trim();
    return new URL(`index.html?id=${encodeURIComponent(id)}#verify`, window.location.href).href;
  },

  qrImageUrl(reportId, width = 220) {
    const id = String(reportId || '').trim();
    const base = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL)
      ? CONFIG.API_BASE_URL
      : `${window.location.origin}/api`;
    return `${base}/qr?id=${encodeURIComponent(id)}&size=${width}`;
  },

  parseReportIdFromScan(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw);
      const fromQuery = url.searchParams.get('id');
      if (fromQuery) return fromQuery.trim();
    } catch {
      /* not a full URL */
    }

    const queryMatch = raw.match(/[?&]id=([^&#]+)/i);
    if (queryMatch) return decodeURIComponent(queryMatch[1]).trim();

    return raw;
  },

  withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`${label || 'Operation'} timed out`));
      }, ms);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          window.clearTimeout(timer);
          reject(err);
        }
      );
    });
  },

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1' || window.Html5Qrcode) {
          existing.dataset.loaded = '1';
          resolve();
          return;
        }
        existing.addEventListener('load', () => {
          existing.dataset.loaded = '1';
          resolve();
        }, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  },

  /**
   * Render a report QR into a container via the MediChain API (instant, no CDN).
   */
  async renderInto(container, reportId, options = {}) {
    if (!container || !reportId) return '';
    const url = this.buildVerifyUrl(reportId);
    const width = options.width || 160;
    container.innerHTML = '';

    const img = document.createElement('img');
    img.className = options.className || 'qr-code__canvas';
    img.alt = `QR code to verify report ${reportId}`;
    img.width = width;
    img.height = width;
    img.decoding = 'async';
    container.appendChild(img);

    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      img.onload = done;
      img.onerror = () => {
        // Last-resort external image if API route is down
        img.onerror = done;
        img.onload = done;
        img.src = `https://quickchart.io/qr?size=${width}&margin=2&text=${encodeURIComponent(url)}`;
      };
      img.src = this.qrImageUrl(reportId, width);
      window.setTimeout(done, 4000);
    });

    return url;
  },

  async createScanner(containerId, onScan, onError) {
    await this.withTimeout(
      this.loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'),
      8000,
      'Camera scanner'
    );
    const { Html5Qrcode } = window;
    if (!Html5Qrcode) throw new Error('Camera scanner failed to load.');
    const scanner = new Html5Qrcode(containerId);
    let active = false;
    let lastScan = '';

    return {
      async start() {
        if (active) return;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onDecoded = (decoded) => {
          const id = QR.parseReportIdFromScan(decoded);
          if (!id || id === lastScan) return;
          lastScan = id;
          onScan(id, decoded);
        };

        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecoded, onError || (() => {}));
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || !cameras.length) {
            throw new Error('No camera found. Allow camera access or enter the Report ID manually.');
          }
          const back = cameras.find((c) => /back|rear|environment/i.test(c.label));
          const cameraId = (back || cameras[cameras.length - 1]).id;
          await scanner.start(cameraId, config, onDecoded, onError || (() => {}));
        }
        active = true;
      },
      async stop() {
        if (!active) return;
        try {
          await scanner.stop();
          scanner.clear();
        } catch {
          /* ignore */
        }
        active = false;
        lastScan = '';
      },
      resetScanLock() {
        lastScan = '';
      },
    };
  },

  async openVerifyModal(reportId, reportTitle) {
    let overlay = document.getElementById('qr-verify-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'qr-verify-modal';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="qr-verify-modal-title">
          <div class="modal__header">
            <h2 class="modal__title" id="qr-verify-modal-title">Verify with QR</h2>
            <button type="button" class="modal__close" id="qr-verify-close" aria-label="Close">&times;</button>
          </div>
          <div class="modal__body" style="text-align: center;">
            <p id="qr-verify-subtitle" class="form-helper" style="margin-bottom: var(--space-04);"></p>
            <div id="qr-verify-canvas" class="qr-code" style="margin: 0 auto;"></div>
            <p id="qr-verify-link" class="form-helper" style="margin-top: var(--space-03); word-break: break-all;"></p>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--secondary" id="qr-verify-done">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#qr-verify-close').addEventListener('click', () => overlay.classList.remove('is-open'));
      overlay.querySelector('#qr-verify-done').addEventListener('click', () => overlay.classList.remove('is-open'));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('is-open');
      });
    }

    const subtitle = overlay.querySelector('#qr-verify-subtitle');
    const canvasBox = overlay.querySelector('#qr-verify-canvas');
    const linkEl = overlay.querySelector('#qr-verify-link');
    subtitle.textContent = reportTitle ? `Report: ${reportTitle}` : 'Scan to verify this medical report';
    linkEl.textContent = '';

    overlay.classList.add('is-open');
    const url = await this.renderInto(canvasBox, reportId, { width: 200 });
    if (url && linkEl) linkEl.textContent = url;
  },
};
