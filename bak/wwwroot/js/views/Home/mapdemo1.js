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
          //  overlayConfig: {
          //      title: safeText('Map 1 Mixed - clusters jumps updates'),
          //      titlePlace: { edge: 'top', align: 'start' },
          //      navPlace: { edge: 'left', align: 'start' },
          //      navLayout: 'vertical',
          //      htmlBottomEnd: `
          //<div class="card shadow-sm border-0" style="pointer-events:auto">
          //  <div class="card-body p-2 d-flex flex-wrap gap-2">
          //    <button class="btn btn-sm btn-outline-primary" id="m1-ic">Icons cluster</button>
          //    <button class="btn btn-sm btn-outline-primary" id="m1-cc">Circles cluster</button>
          //    <button class="btn btn-sm btn-outline-secondary" id="m1-an">Anim on off</button>
          //  </div>
          //</div>`
          //  },

            jumps: [
                { label: 'Dortmund', lonlat: LOC.dortmund, km: 80 },
                { label: 'Koeln', lonlat: LOC.koeln, km: 80 },
                { label: 'Duesseldorf', lonlat: LOC.duesseldorf, km: 80 },
                { label: 'Bochum', lonlat: LOC.bochum, km: 80 },
            ],
            jumpsPlace: { edge: 'bottom', align: 'end' },
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

}
