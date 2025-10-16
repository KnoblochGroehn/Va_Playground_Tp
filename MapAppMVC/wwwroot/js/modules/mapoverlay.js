// mapoverlay.js
// Minimaler, generischer Overlay-Manager für OpenLayers
// Erwartet Bootstrap + Font Awesome im Dokument.

export default class MapOverlay {
    constructor({ map, target } = {}) {
        if (!map) throw new Error('MapOverlay: map ist erforderlich.');
        this.map = map;

        // Vier Streifen-Container erzeugen (oben/unten/links/rechts)
        //const host = (typeof target === 'string' ? document.getElementById(target) : target) || map.getTargetElement();
        const host = map.getViewport(); // garantiert volle Größe + position:relative

        const root = document.createElement('div');
        root.className = 'map-overlay-root position-relative';
        root.style.position = 'absolute';
        root.style.inset = '0';
        root.style.pointerEvents = 'none';
        host.appendChild(root);
        this.root = root;

        this.regions = {
            top: this.#mkStrip('top'),
            bottom: this.#mkStrip('bottom'),
            left: this.#mkStrip('left'),
            right: this.#mkStrip('right'),
        };
        Object.values(this.regions).forEach(el => root.appendChild(el));
    }

    #mkStrip(where) {
        const el = document.createElement('div');
        el.className = `map-overlay-${where} d-flex gap-2`;
        el.style.pointerEvents = 'none';
        el.style.position = 'absolute';
        el.style.zIndex = '10000';
        el.style.padding = '0.5rem';
        el.style.maxWidth = where === 'left' || where === 'right' ? '28%' : '100%';
        // Positionierung
        if (where === 'top') { el.style.top = 0; el.style.left = 0; el.style.right = 0; el.style.justifyContent = 'flex-end'; el.style.alignItems = 'flex-start'; }
        if (where === 'bottom') { el.style.bottom = 0; el.style.left = 0; el.style.right = 0; el.style.justifyContent = 'space-between'; el.style.alignItems = 'flex-end'; }
        if (where === 'left') { el.style.top = 0; el.style.bottom = 0; el.style.left = 0; el.style.flexDirection = 'column'; el.style.justifyContent = 'flex-start'; }
        if (where === 'right') { el.style.top = 0; el.style.bottom = 0; el.style.right = 0; el.style.flexDirection = 'column'; el.style.justifyContent = 'flex-start'; }
        return el;
    }

    // mapoverlay.js

    #shield(el) {
      if (!el) return;
        const stop = (e) => {
            e.stopPropagation();
        };

        const cap = { capture: true, passive: false };

        el.addEventListener('pointerdown', stop, cap);
            el.addEventListener('pointerup', stop, cap);
            el.addEventListener('pointermove', stop, cap);
            el.addEventListener('mousedown', stop, cap);
            el.addEventListener('mouseup', stop, cap);
            el.addEventListener('wheel', stop, cap);
            el.addEventListener('touchstart', stop, cap);
            el.addEventListener('touchmove', stop, cap);
            el.addEventListener('touchend', stop, cap);
            el.addEventListener('dragstart', stop, cap);
     }


    // Element in Region hinzufügen; position: 'start' | 'end'
    add(region, el, position = 'start') {
        const r = this.regions[region];
        if (!r || !el) return;
        // Controls sollen bedienbar sein
        el.style.pointerEvents = 'auto';
        //this.#shield(el); 
        if (position === 'end') r.appendChild(el); else r.insertBefore(el, r.firstChild);
    }

    createPanel({ tight = true } = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'card shadow border-0';
        wrap.style.backdropFilter = 'blur(6px)';
        wrap.style.background = 'rgba(255,255,255,.9)';
        const body = document.createElement('div');
        body.className = `card-body ${tight ? 'p-2' : 'p-3'}`;
        wrap.appendChild(body);
        this.#shield(wrap); 
        return { panel: wrap, body };
    }

    createHtml(html = '') {
        const { panel, body } = this.createPanel();
        body.innerHTML = html;
        return panel;
    }

    createNavControls({ onHome, onZoomToKm, onZoomIn, onZoomOut, kmPresets = [10, 50, 100, 200, 300], label = 'Navigation' } = {}) {
        const { panel, body } = this.createPanel();
        const bar = document.createElement('div');
        bar.className = 'btn-group-vertical';
    
        const mkBtn = (html, title, handler, extra = 'btn-primary') => {
            const b = document.createElement('div');
            b.className = `btn ${extra} btn-sm me-1`;
            b.innerHTML = html;
            b.title = title;
            b.addEventListener('click', handler);
            return b;
        };

        // Home
        bar.appendChild(mkBtn('<i class="fa-solid fa-house "></i>', 'Home', () => onHome?.(), 'btn-danger') );
        // +/- 
        bar.appendChild(mkBtn('<i class="fa-solid fa-magnifying-glass-plus"></i>', 'Zoom in', () => onZoomIn?.(), 'btn-success'));
        bar.appendChild(mkBtn('<i class="fa-solid fa-magnifying-glass-minus"></i>', 'Zoom out', () => onZoomOut?.(), 'btn-success'));

        // Zoom Presets
        kmPresets.forEach(km => {
            bar.appendChild(
                mkBtn(`<i class="fa-solid fa-location-crosshairs"></i> ${km}`, `Zoom auf ~${km} km`, () => onZoomToKm?.(km))
            );
        });


        //const h = document.createElement('div');
        //h.className = 'small text-muted mb-2';
        //h.textContent = label;

        //body.appendChild(h);
        body.appendChild(bar);
        return panel;
    }

    // Sprungmarken (Städte-Buttons)
    createJumpButtons({ items = [], onJump } = {}) {
        const { panel, body } = this.createPanel();
        const grp = document.createElement('div');
        grp.className = 'btn-group-vertical';
        items.forEach(it => {
            const b = document.createElement('div');
            b.className = 'btn btn-primary btn-sm';
            b.innerHTML = `<i class="${it.icon || 'fa-solid fa-location-dot'} me-1"></i>${it.label}`;
            b.addEventListener('click', () => onJump?.(it));
            grp.appendChild(b);
        });
        body.appendChild(grp);
        return panel;
    }

    // Checkbox + Min/Max Radius Eingaben für Kreise
    createCircleFilter({ onApply, defActive = true, min = 50, max = 20050 } = {}) {
        const { panel, body } = this.createPanel({ tight: false });
        body.innerHTML = `
      <div class="form-check form-switch mb-2">
        <input class="form-check-input" type="checkbox" id="mf-circ-on">
        <label class="form-check-label" for="mf-circ-on">Kreis-Filter aktiv</label>
      </div>
      <div class="row g-2 align-items-center">
        <div class="col-12">
          <div class="input-group input-group-sm">
            <span class="input-group-text">min r</span>
            <input type="number" class="form-control" id="mf-circ-min" value="${min}">
          </div>
        </div>
      </div>
      <div class="row g-2 align-items-center">
        <div class="col-12">
          <div class="input-group input-group-sm">
            <span class="input-group-text">max r</span>
            <input type="number" class="form-control" id="mf-circ-max" value="${max}">
          </div>
        </div>
      </div>
      <div class="mt-2">
        <button class="btn btn-primary btn-sm" id="mf-circ-apply"><i class="fa-solid fa-filter"></i> Anwenden</button>
      </div>
    `;
        const on = body.querySelector('#mf-circ-on');
        const mi = body.querySelector('#mf-circ-min');
        const ma = body.querySelector('#mf-circ-max');
        const ap = body.querySelector('#mf-circ-apply');
        on.checked = !!defActive;
        const push = () => onApply?.({ enabled: on.checked, min: +mi.value || 0, max: +ma.value || 0 });
        ap.addEventListener('click', push);
        // sofort initial anwenden
        setTimeout(push, 0);
        return panel;
    }

    // Textfilter Icons
    createIconFilter({ onApply } = {}) {
        const { panel, body } = this.createPanel({ tight: false });
        body.innerHTML = `
      <div class="input-group input-group-sm">
        <span class="input-group-text"><i class="fa-solid fa-filter"></i> Icons</span>
        <input type="text" class="form-control" id="mf-icon-q" placeholder="frei: html / id / glyph">
        <button class="btn btn-outline-secondary" id="mf-icon-apply">Filtern</button>
      </div>
    `;
        const q = body.querySelector('#mf-icon-q');
        const ap = body.querySelector('#mf-icon-apply');
        const push = () => onApply?.(q.value.trim());
        ap.addEventListener('click', push);
        q.addEventListener('keydown', (e) => { if (e.key === 'Enter') push(); });
        return panel;
    }
}
