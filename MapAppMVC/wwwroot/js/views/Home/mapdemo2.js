import { mountMap } from '/js/modules/map.js';

console.log('mapdemo loaded');

function q(center, km, n, debug = 0) {
    return { lon: center[0], lat: center[1], km, n, debug };
}

// Keep all maps inside the controller demo data area (Ruhrgebiet),
// but use a much larger "km" filter so the server returns points in a wider region.
const LOC = {
    dortmund: [7.468, 51.514],
    koeln: [6.960, 50.938],
    duesseldorf: [6.773, 51.227],
    bochum: [7.216, 51.481],
    essen: [7.012, 51.455],
};

function safeText(t) {
    // Avoid < > " ' & in UI titles / labels.
    return String(t || '').replace(/[<>"'&]/g, '');
}

export default function init(container) {

    // MAP 1: Mixed overview (clusters + jumps + updates + anim toggle)
    mountMap(
        {
            target: 'map1',
            center: LOC.essen,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,
            //debug: { enabled: true, client: true, prefix: 'map1' },

            overlay: true,
            overlayConfig: {
                title: safeText('Map 1 Mixed - clusters jumps updates'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'left', align: 'start' },
                navLayout: 'vertical',
                htmlBottomEnd: `
          <div class="card shadow-sm border-0" style="pointer-events:auto">
            <div class="card-body p-2 d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline-primary" id="m1-ic">Icons cluster</button>
              <button class="btn btn-sm btn-outline-primary" id="m1-cc">Circles cluster</button>
              <button class="btn btn-sm btn-outline-secondary" id="m1-an">Anim on off</button>
            </div>
          </div>`
            },

            jumps: [
                { label: 'Dortmund', lonlat: LOC.dortmund, km: 80 },
                { label: 'Koeln', lonlat: LOC.koeln, km: 80 },
                { label: 'Duesseldorf', lonlat: LOC.duesseldorf, km: 80 },
                { label: 'Bochum', lonlat: LOC.bochum, km: 80 },
            ],
            jumpsPlace: { edge: 'top', align: 'end' },
            jumpsLayout: 'vertical',
            defaultJumpKm: 80,

            //icon: { cluster: { enabled: true, distance: 55 } },
            //circle: { cluster: { enabled: true, distance: 65 } },

            animations: { enabled: true, fps: 30 },

            styles: {
                circle: { stroke: { width: 6 }, outline: { enabled: false, width: 0 } }
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 300,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 220, n, 1)),
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 220, n, 1)),
                    getPolygons: ({ n }) => $.getJSON('/api/map/polygons-initial', q(center, 220, Math.min(200, n), 1))
                });

                const ic = document.getElementById('m1-ic');
                const cc = document.getElementById('m1-cc');
                const an = document.getElementById('m1-an');

                if (ic) ic.onclick = () => ui.setIconClusteringEnabled(!ui._iconClusterCfg.enabled);
                if (cc) cc.onclick = () => ui.setCircleClusteringEnabled(!ui._circleClusterCfg.enabled);

                let animOn = true;
                if (an) an.onclick = () => { animOn = !animOn; ui.setAnimationsEnabled(animOn); };
            },
            onTick: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadUpdatesByCallbacks({
                    getCircleUpdates: () => $.getJSON('/api/map/circles-delta', q(center, 220, 60, 0)),
                    getIconUpdates: () => $.getJSON('/api/map/icons-delta', q(center, 220, 50, 0)),
                    getPolygonUpdates: () => $.getJSON('/api/map/polygons-delta', q(center, 220, 12, 0)),
                    upsert: true
                });
            }
        },
        { intervalMs: 700 }
    );

    // MAP 2: Circle ring widths (stroke vs outline) - large variety
    mountMap(
        {
            target: 'map2',
            center: LOC.dortmund,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 2 Circle ring widths'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'right', align: 'start' },
                navLayout: 'vertical'
            },

            circle: { cluster: { enabled: false } }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 200,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 180, n, 0))
                });

                const fs = ui.circleSourceRaw.getFeatures();
                fs.slice(0, 80).forEach((f, i) => {
                    f.set('radius', 350 + (i % 10) * 250);
                    f.set('strokeWidth', 1 + (i % 14));
                    f.set('outlineWidth', 0 + (i % 10));
                    f.set('strokeColor', (i % 3 === 0) ? 'rgba(0,0,0,0.55)' : (i % 3 === 1) ? 'rgba(255,255,255,0.75)' : 'rgba(30,144,255,0.75)');
                    f.set('outlineColor', (i % 2) ? 'rgba(255,105,180,0.45)' : 'rgba(0,0,0,0.25)');
                });
                ui.circleSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 3: Text styles showcase (fonts, sizes, colors, rectangle bg, outline, offsets)
    mountMap(
        {
            target: 'map3',
            center: LOC.koeln,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 3 Text styles (font size color bg outline offset)'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'bottom', align: 'start' },
                navLayout: 'vertical'
            },

            circle: { cluster: { enabled: false } },
            styles: {
                circle: {
                    stroke: { width: 6, color: 'rgba(255,255,255,0.75)' },
                    outline: { enabled: true, width: 10, color: 'rgba(0,0,0,0.25)' },
                    label: { outlined: true }
                }
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 160,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 120, n, 0))
                });

                const samples = [
                    { t: 'Bold', font: '900 18px system-ui, sans-serif', color: '#fff', outlined: true, outlineColor: 'rgba(0,0,0,0.65)', outlineWidth: 4, offsetY: -18 },
                    { t: 'Big', font: '900 26px system-ui, sans-serif', color: 'rgba(255,105,180,0.95)', outlined: false, offsetY: -22 },
                    { t: 'Mono', font: '800 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', color: 'rgba(30,144,255,0.95)', outlined: true, outlineColor: 'rgba(255,255,255,0.7)', outlineWidth: 3, offsetX: 16, offsetY: 0 },
                    { t: 'Rect', font: '800 15px system-ui, sans-serif', color: '#111', outlined: false, background: { fill: 'rgba(255,255,255,0.92)', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 }, offsetY: 22 },
                    { t: 'Rect+Out', font: '900 15px system-ui, sans-serif', color: '#fff', outlined: true, outlineColor: 'rgba(0,0,0,0.55)', outlineWidth: 3, background: { fill: 'rgba(0,0,0,0.55)', stroke: 'rgba(255,255,255,0.75)', strokeWidth: 2 }, offsetX: -18, offsetY: 18 },
                ];

                const fs = ui.circleSourceRaw.getFeatures().slice(0, samples.length);
                fs.forEach((f, i) => {
                    const s = samples[i];
                    f.set('label', s.t);
                    f.set('radius', 900);
                    f.set('labelStyle', {
                        font: s.font,
                        color: s.color,
                        outlined: s.outlined,
                        outlineColor: s.outlineColor,
                        outlineWidth: s.outlineWidth,
                        background: s.background,
                        offsetX: s.offsetX ?? 0,
                        offsetY: s.offsetY ?? 0,
                        align: 'center',
                        baseline: 'middle'
                    });
                });
                ui.circleSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 4: Circle filter widget only
    mountMap(
        {
            target: 'map4',
            center: LOC.koeln,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 4 Circle filter widget'),
                titlePlace: { edge: 'bottom', align: 'center' },
                navPlace: { edge: 'left', align: 'end' },
                navLayout: 'vertical'
            },

            circle: {
                cluster: { enabled: false },
                filterWidget: { enabled: true, defActive: true, min: 300, max: 2200, place: { edge: 'top', align: 'end' } }
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 300,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 220, n, 0))
                });
            }
        },
        { intervalMs: 0 }
    );

}
