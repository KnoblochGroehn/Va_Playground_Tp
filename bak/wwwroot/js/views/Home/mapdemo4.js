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


    // MAP 9: Icon clustering badge style only (with buttons)
    mountMap(
        {
            target: 'map9',
            center: LOC.essen,
            zoom: 9,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 9 Icons clustering badge style'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'left', align: 'start' },
                navLayout: 'vertical',
                htmlTopEnd: `
          <div class="card shadow-sm border-0" style="pointer-events:auto">
            <div class="card-body p-2 d-flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline-primary" id="m9-on">Cluster on</button>
              <button class="btn btn-sm btn-outline-secondary" id="m9-off">Cluster off</button>
            </div>
          </div>`
            },

            icon: {
                cluster: {
                    enabled: true,
                    distance: 70,
                    badge: {
                        radius: 20,
                        fill: 'rgba(0,0,0,0.70)',
                        stroke: 'rgba(255,255,255,0.90)',
                        strokeWidth: 3,
                        font: '900 13px system-ui, sans-serif',
                        textFill: '#fff',
                        outlined: true,
                        textStroke: { color: 'rgba(0,0,0,0.65)', width: 3 }
                    }
                }
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 200,
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 260, n, 0))
                });

                const on = document.getElementById('m9-on');
                const off = document.getElementById('m9-off');
                if (on) on.onclick = () => ui.setIconClusteringEnabled(true);
                if (off) off.onclick = () => ui.setIconClusteringEnabled(false);
            }
        },
        { intervalMs: 0 }
    );

    // MAP 10: Circle clustering badge style only
    mountMap(
        {
            target: 'map10',
            center: LOC.essen,
            zoom: 9,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 10 Circles clustering badge style'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'right', align: 'start' },
                navLayout: 'vertical'
            },

            circle: {
                cluster: {
                    enabled: true,
                    distance: 80,
                    badge: {
                        radius: 20,
                        fill: 'rgba(30,144,255,0.70)',
                        stroke: 'rgba(255,255,255,0.90)',
                        strokeWidth: 3,
                        font: '900 13px system-ui, sans-serif',
                        textFill: '#fff',
                        outlined: true,
                        textStroke: { color: 'rgba(0,0,0,0.65)', width: 3 }
                    }
                }
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 2600,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 260, n, 0))
                });
            }
        },
        { intervalMs: 0 }
    );

    // MAP 11: Polygon stroke and outline variants only
    mountMap(
        {
            target: 'map11',
            center: LOC.koeln,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 11 Polygons stroke outline variants'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'bottom', align: 'start' },
                navLayout: 'vertical'
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 400,
                    getPolygons: ({ n }) => $.getJSON('/api/map/polygons-initial', q(center, 220, n, 0))
                });

                let i = 0;
                ui.polygonSource.getFeatures().slice(0, 120).forEach(f => {
                    f.set('strokeWidth', 1 + (i % 10));
                    f.set('strokeColor', (i % 4 === 0) ? 'rgba(30,144,255,0.90)'
                        : (i % 4 === 1) ? 'rgba(255,105,180,0.90)'
                            : (i % 4 === 2) ? 'rgba(0,0,0,0.80)'
                                : 'rgba(46,204,113,0.90)');
                    f.set('outlineWidth', (i % 3 === 0) ? 10 : (i % 3 === 1) ? 6 : 0);
                    f.set('outlineColor', 'rgba(255,255,255,0.40)');
                    i++;
                });
                ui.polygonSource.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 12: Overlay placements + vertical jump bar
    mountMap(
        {
            target: 'map12',
            center: LOC.duesseldorf,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 12 Overlay placements vertical toolbars'),
                titlePlace: { edge: 'bottom', align: 'start' },
                navPlace: { edge: 'top', align: 'end' },
                navLayout: 'vertical'
            },

            jumps: [
                { label: 'Dortmund', lonlat: LOC.dortmund, km: 90 },
                { label: 'Koeln', lonlat: LOC.koeln, km: 90 },
                { label: 'Duesseldorf', lonlat: LOC.duesseldorf, km: 90 }
            ],
            jumpsPlace: { edge: 'left', align: 'end' },
            jumpsLayout: 'vertical',
            defaultJumpKm: 90
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 300,
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 240, n, 0))
                });
            }
        },
        { intervalMs: 0 }
    );

}
