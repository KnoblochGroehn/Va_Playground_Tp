// mapdemo.js

import OlCircleIconMap, { mountMap } from '/js/modules/map.js';

console.log('mapdemo loaded (top of file)');

export default function init(container) {
    console.log("mapdemo loaded");

    // Map 1 – wie bisher, plus Titel
    mountMap(
        {
            target: 'map1',
            center: [7.466, 51.51494],
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,
            overlay: true,
            overlayConfig: {
                title: 'Map 1 Mixed (Circles + Icons)',
                htmlTopEnd: `
                  <div class="btn-group ms-2" role="group" aria-label="radius">
                    <button class="btn btn-sm btn-outline-primary" id="m2-f1000">&lt; 1000</button>
                    <button class="btn btn-sm btn-outline-primary" id="m2-f5000">&lt; 5000</button>
                    <button class="btn btn-sm btn-outline-secondary" id="m2-fall">ALL</button>
                  </div>` }
        },
        {
            onReady: async ({ ui }) => {
                await ui.loadByCallbacks({
                    n: 2000,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', { n }),
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', { n })
                });

                const f1000 = document.getElementById('m2-f1000');
                const f5000 = document.getElementById('m2-f5000');
                const fall = document.getElementById('m2-fall');
                if (f1000) f1000.onclick = () => ui.setCircleFilter(f => (f.getGeometry()?.getRadius?.() || 0) < 1000);
                if (f5000) f5000.onclick = () => ui.setCircleFilter(f => (f.getGeometry()?.getRadius?.() || 0) < 5000);
                if (fall) fall.onclick = () => ui.setCircleFilter(() => true);
            },
            onTick: async ({ ui }) => {
                await ui.loadUpdatesByCallbacks({
                    getCircleUpdates: () => $.getJSON('/api/map/circles-delta', { n: 5000 }),
                    getIconUpdates: () => $.getJSON('/api/map/icons-delta', { n: 5000 }),
                    upsert: false
                });
            }
        },
        { intervalMs: 200 }
    );

    // Map 2 – nur Kreise + Schnellfilter
    mountMap(
        {
            target: 'map2',
            center: [6.96, 50.938], // Köln
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,
            overlay: true,
            overlayConfig: {
                title: 'Map 2 Circles Only'
            },

            circle: {
                defActive: true,
                min: 0,
                max: 5000
            }
        },
        {
            onReady: async ({ ui }) => {
                await ui.loadByCallbacks({
                    n: 1500,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', { n })
                });
                
            },
            onTick: async ({ ui }) => {
                await ui.loadUpdatesByCallbacks({
                    getCircleUpdates: () => $.getJSON('/api/map/circles-delta', { n: 5000 }),
                    upsert: false
                });
            }
        },
        { intervalMs: 400 }
    );

    // Map 3 – Polygone
    mountMap(
        {
            target: 'map3',
            center: [6.773, 51.227], // Düsseldorf
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,
            overlay: true,
            overlayConfig: { title: 'Map 3 Polygons' }
        },
        {
            onReady: async ({ ui }) => {
                await ui.loadByCallbacks({
                    n: 100,
                    getPolygons: ({ n }) => $.getJSON('/api/map/polygons-initial', { n })
                });
            },
            onTick: async ({ ui }) => {
                await ui.loadUpdatesByCallbacks({
                    getPolygonUpdates: () => $.getJSON('/api/map/polygons-delta', { n: 300 }),
                    upsert: true
                });
            }
        },
        { intervalMs: 800 }
    );

    // Map 4 – Mixed (Polygone + Kreise + Icons) andere Region
    mountMap(
        {
            target: 'map4',
            center: [6.773, 51.227], // Düsseldorf
            zoom: 10,
            enablePopup: true,
            popupMultiple: true,
            overlay: true,
            overlayConfig: { title: 'Map 4 Mixed (All)' },

            jumps: [
                { label: 'Dortmund', lonlat: [7.468, 51.514], icon: 'fa-solid fa-city', km: 20 },
                { label: 'Duesseldorf', lonlat: [6.773, 51.227], icon: 'fa-solid fa-city', km: 20 },
                { label: 'Koeln', lonlat: [6.960, 50.938], icon: 'fa-solid fa-city', km: 20 },
            ],
            defaultJumpKm: 20
        },
        {
            onReady: async ({ ui }) => {
                await ui.loadByCallbacks({
                    n: 300,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', { n }),
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', { n }),
                    getPolygons: ({ n }) => $.getJSON('/api/map/polygons-initial', { n })
                });
            },
            onTick: async ({ ui }) => {
                await ui.loadUpdatesByCallbacks({
                    getCircleUpdates: () => $.getJSON('/api/map/circles-delta', { n: 1000 }),
                    getIconUpdates: () => $.getJSON('/api/map/icons-delta', { n: 1000 }),
                    getPolygonUpdates: () => $.getJSON('/api/map/polygons-delta', { n: 1000 }),
                    upsert: true
                });
            }
        },
        { intervalMs: 1000 }
    );
}
