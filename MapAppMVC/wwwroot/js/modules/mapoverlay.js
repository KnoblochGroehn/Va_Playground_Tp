export default class MapOverlay {
    constructor({ map, target }) {
        this.map = map;
        const host = document.getElementById(target);
        this.el = document.createElement('div');
        this.el.className = 'map-overlay-root';
        this.el.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;';
        host.style.position = host.style.position || 'relative';
        host.appendChild(this.el);

        this.buckets = {};
    }

    _bucket(edge, align) {
        const key = `${edge}:${align}`;
        if (this.buckets[key]) return this.buckets[key];

        const b = document.createElement('div');
        b.className = `map-overlay-bucket ${edge} ${align}`;
        const isRow = (edge === 'top' || edge === 'bottom');
        b.style.cssText = [
            'position:absolute',
            'pointer-events:none',
            isRow ? 'display:flex;flex-direction:row;gap:.5rem;align-items:flex-start' : 'display:flex;flex-direction:column;gap:.5rem;align-items:flex-start'
        ].join(';') + ';';

        if (edge === 'top' || edge === 'bottom') {
            if (align === 'start') {
                b.style.left = '.5rem';
            } else if (align === 'center') {
                b.style.left = '50%';
                b.style.transform = 'translateX(-50%)';
                b.style.alignItems = 'center';
            } else {
                b.style.right = '.5rem';
                b.style.alignItems = 'flex-end';
            }
        } else {
            if (align === 'start') {
                b.style.top = '.5rem';
            } else if (align === 'center') {
                b.style.top = '50%';
                b.style.transform = 'translateY(-50%)';
                b.style.alignItems = 'center';
            } else {
                b.style.bottom = '.5rem';
                b.style.alignItems = 'flex-end';
            }
        }


        this.el.appendChild(b);
        this.buckets[key] = b;
        return b;
    }

    createHtml(html) {
        const el = document.createElement('div');
        el.style.pointerEvents = 'auto';
        el.innerHTML = html;
        return el;
    }

    add(edge, el, align = 'start') {
        this._bucket(edge, align).appendChild(el);
        return el;
    }

    createNavControls({
        onHome, onZoomIn, onZoomOut, onZoomToKm,
        kmPresets = [1, 5, 10, 100],
        layout = 'horizontal'
    }) {
        const vertical = (layout === 'vertical');

        const wrap = document.createElement('div');
        wrap.style.pointerEvents = 'auto';
        wrap.className = 'card shadow-sm border-0';
        wrap.innerHTML = `
  <div class="card-body p-2 d-flex gap-2 align-items-center">
    <button class="btn btn-sm btn-outline-secondary" data-act="home">Home</button>
    <button class="btn btn-sm btn-outline-secondary" data-act="zin">+</button>
    <button class="btn btn-sm btn-outline-secondary" data-act="zout">-</button>
    <div class="btn-group ${vertical ? 'mt-2' : 'ms-2'}" role="group" aria-label="km">
      ${kmPresets.map(km => `<button class="btn btn-sm btn-outline-primary" data-km="${km}">${km}km</button>`).join('')}
    </div>
  </div>`;

        // layout for toolbar
        const body = wrap.querySelector('.card-body');
        body.classList.toggle('flex-column', vertical);
        body.classList.toggle('flex-row', !vertical);
        body.classList.toggle('flex-wrap', !vertical);
        body.classList.toggle('align-items-stretch', vertical);
        body.classList.toggle('align-items-center', !vertical);

        const kmGroup = wrap.querySelector('[aria-label="km"]');
        kmGroup.classList.remove('btn-group', 'btn-group-vertical');
        kmGroup.classList.add(vertical ? 'btn-group-vertical' : 'btn-group');

        // --- ACTIVE STATE: one active across ALL buttons (home/+/-, km)
        const homeBtn = wrap.querySelector('[data-act="home"]');
        const zinBtn = wrap.querySelector('[data-act="zin"]');
        const zoutBtn = wrap.querySelector('[data-act="zout"]');
        const kmButtons = Array.from(wrap.querySelectorAll('[data-km]'));

        const allButtons = [homeBtn, zinBtn, zoutBtn, ...kmButtons].filter(Boolean);

        function setActive(btn) {
            // reset all to "default look"
            allButtons.forEach(b => {
                // home/+/-
                if (b.hasAttribute('data-act')) {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline-secondary');
                }
                // km buttons
                if (b.hasAttribute('data-km')) {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline-primary');
                }
            });

            // activate clicked
            btn.classList.remove('btn-outline-secondary', 'btn-outline-primary');
            btn.classList.add('btn-primary');
        }

        homeBtn.onclick = () => { setActive(homeBtn); onHome?.(); };
        zinBtn.onclick = () => { setActive(zinBtn); onZoomIn?.(); };
        zoutBtn.onclick = () => { setActive(zoutBtn); onZoomOut?.(); };

        kmButtons.forEach(b => {
            b.onclick = () => {
                setActive(b);
                onZoomToKm?.(+b.getAttribute('data-km'));
            };
        });

        return wrap;
    }

    createJumpButtons({ items = [], onJump, layout = 'horizontal' }) {
        const vertical = (layout === 'vertical');

        const wrap = document.createElement('div');
        wrap.style.pointerEvents = 'auto';
        wrap.setAttribute('role', 'group');

        wrap.className = `${vertical ? 'btn-group-vertical' : 'btn-group'} shadow-sm`;

        const btns = [];
        items.forEach((it, idx) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-sm btn-light border';
            b.innerHTML = it.icon ? `<i class="${it.icon} me-1"></i>${it.label}` : it.label;

            b.onclick = () => {
                btns.forEach(x => {
                    x.classList.remove('btn-primary');
                    x.classList.add('btn-light', 'border');
                });
                b.classList.remove('btn-light', 'border');
                b.classList.add('btn-primary');

                onJump?.(it);
            };

            btns.push(b);
            wrap.appendChild(b);
        });

        return wrap;
    }

    createCircleFilter({ defActive = true, min = 0, max = 5000, onApply }) {
        const wrap = document.createElement('div');
        wrap.style.pointerEvents = 'auto';
        wrap.className = 'card shadow-sm border-0';
        wrap.innerHTML = `
      <div class="card-body p-2">
        <div class="form-check form-switch mb-2">
          <input class="form-check-input" type="checkbox" id="cf-en" ${defActive ? 'checked' : ''}>
          <label class="form-check-label" for="cf-en">Circle Filter</label>
        </div>
        <div class="d-flex gap-2">
          <input class="form-control form-control-sm" type="number" id="cf-min" value="${min}">
          <input class="form-control form-control-sm" type="number" id="cf-max" value="${max}">
          <button class="btn btn-sm btn-primary" id="cf-apply">Apply</button>
        </div>
      </div>`;
        const en = wrap.querySelector('#cf-en');
        const imin = wrap.querySelector('#cf-min');
        const imax = wrap.querySelector('#cf-max');
        wrap.querySelector('#cf-apply').onclick = () => {
            onApply?.({ enabled: !!en.checked, min: imin.value, max: imax.value });
        };
        return wrap;
    }
}
