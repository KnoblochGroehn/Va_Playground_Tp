// mapdemo5.js

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

/*
English documentation 

mountMap(options, hooks, timerOptions) -> { ui }

options (common):
- target: string (DOM element id)
- center: [lon, lat]
- zoom: number
- enablePopup: boolean
- popupMultiple: boolean
- overlay: boolean
- overlayConfig: object (title, placements, custom html blocks)
- styles: object (label / style overrides)
- icon / circle / polygon: objects

Two-layer system:
- Every data item can include: layer: 0 or 1
- Items with layer=0 go to layer0 sources/layers, layer=1 to layer1 sources/layers.
- If an update changes layer, the feature is moved between sources automatically.

Cluster per layer:
- ui.setIconClusteringEnabled(enabled, cfg, layerIndex)
- ui.setCircleClusteringEnabled(enabled, cfg, layerIndex)
- ui.setPolygonClusteringEnabled(enabled, cfg, layerIndex)
  layerIndex is 0 or 1 (default is 0 for backward compatibility)

Cluster cfg fields (same as before):
- enabled: boolean
- distance: number
- minDistance: number
- badge: { radius, fill, stroke, strokeWidth, font, textFill, outlined, textStroke:{color,width} }

hooks:
- onReady({ ui })
- onMapClick({ ui, coordinate3857, lonlat, originalEvent })
- onTick({ ui })  (if timerOptions.intervalMs is set)

timerOptions:
- intervalMs: number
*/

const DEMO5_LABELS = {
    circle: {
        label: {
            background: { enabled: true, fill: 'rgba(0,0,0,0.35)', padding: [3, 6, 3, 6], stroke: 'rgba(255,255,255,0.25)' },
            outlined: true,
            outlineColor: 'rgba(0,0,0,0.7)',
            outlineWidth: 4,
            textAlign: 'center',
            textBaseline: 'middle',
        }
    },

    polygon: {
        label: {
            background: { enabled: true, fill: 'rgba(255,255,255,0.70)', padding: [2, 5, 2, 5], stroke: 'rgba(0,0,0,0.25)' },
            outlined: false,
            textAlign: 'center',
            textBaseline: 'middle',
        }
    },

    icon: {
        label: {
            background: { enabled: true, fill: 'rgba(0,0,0,0.45)', padding: [2, 4, 2, 4], stroke: null },
            outlined: true,
            outlineColor: 'rgba(0,0,0,0.65)',
            outlineWidth: 3,
            textAlign: 'center',
            textBaseline: 'top',
            offsetY: 8,
        }
    }
};

export default function init(container) {
    // MAP 9: Icon clustering badge style (now: controls for layer0 and layer1)
    mountMap(
        {
            target: 'map13',
            center: LOC.essen,
            zoom: 9,
            enablePopup: true,
            popupMultiple: true,

            styles: DEMO5_LABELS,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 9 Icons clustering badge style (layer0 + layer1)'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'left', align: 'start' },
                navLayout: 'vertical',
                htmlTopEnd: `
          <div class="card shadow-sm border-0" style="pointer-events:auto">
            <div class="card-body p-2 d-flex flex-wrap gap-2">
              <div class="fw-semibold small text-muted">Icons clustering</div>
              <button class="btn btn-sm btn-outline-primary" id="m9-on-0">On L0</button>
              <button class="btn btn-sm btn-outline-secondary" id="m9-off-0">Off L0</button>
              <button class="btn btn-sm btn-outline-primary" id="m9-on-1">On L1</button>
              <button class="btn btn-sm btn-outline-secondary" id="m9-off-1">Off L1</button>
            </div>
          </div>`
            },

            // backward compatible: this config applies to layer 0 by default in mountMap
            icon: {
                cluster: {
                    enabled: true,
                    distance: 70,
                    badge: {
                        radius: 20,
                        fill: 'rgba(0,0,0,0.50)',
                        stroke: 'rgba(255,255,255,0.90)',
                        strokeWidth: 2,
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
                    getIcons: ({ n }) => $.getJSON('/api/map/demo5/icons-initial', q(center, 260, n, 0)),
                    getCircles: ({ n }) => $.getJSON('/api/map/demo5/circles-initial', q(center, 260, n, 0))
                });

                // Layer 1: enable with same cfg by default (can be adjusted independently)
                ui.setIconClusteringEnabled(true, {
                    distance: 70,
                    badge: {
                        radius: 20,
                        fill: 'rgba(0,0,0,0.35)',
                        stroke: 'rgba(255,255,255,0.90)',
                        strokeWidth: 2,
                        font: '900 13px system-ui, sans-serif',
                        textFill: '#fff',
                        outlined: true,
                        textStroke: { color: 'rgba(0,0,0,0.65)', width: 3 }
                    }
                }, 1);

                const on0 = document.getElementById('m9-on-0');
                const off0 = document.getElementById('m9-off-0');
                const on1 = document.getElementById('m9-on-1');
                const off1 = document.getElementById('m9-off-1');

                if (on0) on0.onclick = () => ui.setIconClusteringEnabled(true, null, 0);
                if (off0) off0.onclick = () => ui.setIconClusteringEnabled(false, null, 0);
                if (on1) on1.onclick = () => ui.setIconClusteringEnabled(true, null, 1);
                if (off1) off1.onclick = () => ui.setIconClusteringEnabled(false, null, 1);
            }
        },
        { intervalMs: 0 }
    );

    // MAP 10: Circle clustering badge style (controls for layer0 and layer1)
    mountMap(
        {
            target: 'map14',
            center: LOC.essen,
            zoom: 9,
            enablePopup: true,
            popupMultiple: true,

            styles: DEMO5_LABELS,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 10 Circles clustering badge style (layer0 + layer1)'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'right', align: 'start' },
                navLayout: 'vertical',
                htmlTopEnd: `
          <div class="card shadow-sm border-0" style="pointer-events:auto">
            <div class="card-body p-2 d-flex flex-wrap gap-2">
              <div class="fw-semibold small text-muted">Circles clustering</div>
              <button class="btn btn-sm btn-outline-primary" id="m10-on-0">On L0</button>
              <button class="btn btn-sm btn-outline-secondary" id="m10-off-0">Off L0</button>
              <button class="btn btn-sm btn-outline-primary" id="m10-on-1">On L1</button>
              <button class="btn btn-sm btn-outline-secondary" id="m10-off-1">Off L1</button>
            </div>
          </div>`
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
                    getCircles: ({ n }) => $.getJSON('/api/map/demo5/circles-initial', q(center, 260, n, 0))
                });

                // Layer 1: enable with same cfg by default
                ui.setCircleClusteringEnabled(true, {
                    distance: 80,
                    badge: {
                        radius: 20,
                        fill: 'rgba(30,144,255,0.35)',
                        stroke: 'rgba(255,255,255,0.90)',
                        strokeWidth: 3,
                        font: '900 13px system-ui, sans-serif',
                        textFill: '#fff',
                        outlined: true,
                        textStroke: { color: 'rgba(0,0,0,0.65)', width: 3 }
                    }
                }, 1);

                const on0 = document.getElementById('m10-on-0');
                const off0 = document.getElementById('m10-off-0');
                const on1 = document.getElementById('m10-on-1');
                const off1 = document.getElementById('m10-off-1');

                if (on0) on0.onclick = () => ui.setCircleClusteringEnabled(true, null, 0);
                if (off0) off0.onclick = () => ui.setCircleClusteringEnabled(false, null, 0);
                if (on1) on1.onclick = () => ui.setCircleClusteringEnabled(true, null, 1);
                if (off1) off1.onclick = () => ui.setCircleClusteringEnabled(false, null, 1);
            }
        },
        { intervalMs: 0 }
    );

    // MAP 11: Polygons stroke and outline variants only (optional polygon clustering controls)
    mountMap(
        {
            target: 'map15',
            center: LOC.koeln,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,

            styles: DEMO5_LABELS,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 11 Polygons stroke outline variants (layer0 + layer1)'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'bottom', align: 'start' },
                navLayout: 'vertical',
                htmlTopEnd: `
          <div class="card shadow-sm border-0" style="pointer-events:auto">
            <div class="card-body p-2 d-flex flex-wrap gap-2">
              <div class="fw-semibold small text-muted">Polygons clustering</div>
              <button class="btn btn-sm btn-outline-primary" id="m11-on-0">On L0</button>
              <button class="btn btn-sm btn-outline-secondary" id="m11-off-0">Off L0</button>
              <button class="btn btn-sm btn-outline-primary" id="m11-on-1">On L1</button>
              <button class="btn btn-sm btn-outline-secondary" id="m11-off-1">Off L1</button>
            </div>
          </div>`
            }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 400,
                    getPolygons: ({ n }) => $.getJSON('/api/map/demo5/polygons-initial', q(center, 220, n, 0))
                });

                // Default: polygon clustering off on both layers (toggle via buttons)
                const on0 = document.getElementById('m11-on-0');
                const off0 = document.getElementById('m11-off-0');
                const on1 = document.getElementById('m11-on-1');
                const off1 = document.getElementById('m11-off-1');

                if (on0) on0.onclick = () => ui.setPolygonClusteringEnabled(true, null, 0);
                if (off0) off0.onclick = () => ui.setPolygonClusteringEnabled(false, null, 0);
                if (on1) on1.onclick = () => ui.setPolygonClusteringEnabled(true, null, 1);
                if (off1) off1.onclick = () => ui.setPolygonClusteringEnabled(false, null, 1);
            }
        },
        { intervalMs: 0 }
    );

    // MAP 12: Overlay placements + vertical jump bar
    mountMap(
        {
            target: 'map16',
            center: LOC.duesseldorf,
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,

            styles: DEMO5_LABELS,

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
                    getIcons: ({ n }) => $.getJSON('/api/map/demo5/icons-initial', q(center, 240, n, 0))
                });

                // Example: enable clustering only for layer 1 (independent)
                ui.setIconClusteringEnabled(true, { distance: 60 }, 1);
            }
        },
        { intervalMs: 0 }
    );
}
