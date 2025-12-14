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


    // MAP 5: Circle animations only (pulse, blink, scale)
    mountMap(
        {
            target: 'map5',
            center: LOC.duesseldorf,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 5 Circle animations pulse blink scale'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'right', align: 'end' },
                navLayout: 'vertical'
            },

            circle: { cluster: { enabled: false } },
            animations: { enabled: true, fps: 30 }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 160,
                    getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', q(center, 120, n, 0))
                });

                const fs = ui.circleSourceRaw.getFeatures();
                fs.slice(0, 60).forEach((f, i) => {
                    f.set('radius', 600 + (i % 6) * 220);
                    const t = (i % 3 === 0) ? 'pulse' : (i % 3 === 1) ? 'blink' : 'scale';
                    f.set('anim', { type: t, freq: 0.8 + (i % 5) * 0.12 });
                });
                ui.circleSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 6: FontAwesome icon sizes only
    mountMap(
        {
            target: 'map6',
            center: LOC.duesseldorf,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 6 Icons FontAwesome sizes'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'left', align: 'start' },
                navLayout: 'vertical'
            },

            icon: { cluster: { enabled: false } }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 200,
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 160, n, 0))
                });

                let i = 0;
                ui.iconSourceRaw.getFeatures().slice(0, 120).forEach(f => {
                    const fa = f.get('fa') || {};
                    fa.image = null;
                    fa.glyph = '\uf041';
                    fa.size = 12 + (i % 12) * 4;
                    fa.fill = (i % 4 === 0) ? 'rgba(255,105,180,0.90)'
                        : (i % 4 === 1) ? 'rgba(30,144,255,0.90)'
                            : (i % 4 === 2) ? 'rgba(46,204,113,0.90)'
                                : 'rgba(243,156,18,0.90)';
                    fa.stroke = 'rgba(255,255,255,0.95)';
                    fa.strokeWidth = 4;
                    f.set('fa', fa);
                    i++;
                });
                ui.iconSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 7: Image icons only (scale variants)
    mountMap(
        {
            target: 'map7',
            center: LOC.bochum,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 7 Icons image markers (scale variants)'),
                titlePlace: { edge: 'top', align: 'center' },
                navPlace: { edge: 'bottom', align: 'end' },
                navLayout: 'vertical'
            },

            icon: { cluster: { enabled: false } }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 160,
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 140, n, 0))
                });

                const img = 'https://storage.e.jimdo.com/cdn-cgi/image/quality=85,fit=scale-down,format=auto,trim=0;0;0;0,width=128,height=128/image/281823853/56cc8507-3d3e-48f5-9dae-0bd009e2b182.png';
                ui.iconSourceRaw.getFeatures().slice(0, 160).forEach((f, i) => {
                    f.set('fa', { image: img, scale: 0.35 + (i % 8) * 0.10 });
                });
                ui.iconSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

    // MAP 8: Icon animations only (wobble bob scale)
    mountMap(
        {
            target: 'map8',
            center: LOC.bochum,
            zoom: 11,
            enablePopup: true,
            popupMultiple: true,

            overlay: true,
            overlayConfig: {
                title: safeText('Map 8 Icons animations wobble bob scale'),
                titlePlace: { edge: 'bottom', align: 'center' },
                navPlace: { edge: 'right', align: 'start' },
                navLayout: 'vertical'
            },

            icon: { cluster: { enabled: false } },
            animations: { enabled: true, fps: 30 }
        },
        {
            onReady: async ({ ui }) => {
                const center = ui.getCenter();
                await ui.loadByCallbacks({
                    n: 220,
                    getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', q(center, 180, n, 0))
                });

                let i = 0;
                ui.iconSourceRaw.getFeatures().slice(0, 200).forEach(f => {
                    const fa = f.get('fa') || {};
                    fa.image = null;
                    fa.glyph = '\uf041';
                    fa.size = 18 + (i % 6) * 6;
                    fa.fill = (i % 3 === 0) ? 'rgba(255,105,180,0.90)'
                        : (i % 3 === 1) ? 'rgba(30,144,255,0.90)'
                            : 'rgba(46,204,113,0.90)';
                    f.set('fa', fa);

                    const t = (i % 3 === 0) ? 'wobble' : (i % 3 === 1) ? 'bob' : 'scale';
                    f.set('anim', { type: t, freq: 0.9 + (i % 5) * 0.12 });
                    i++;
                });
                ui.iconSourceRaw.changed();
            }
        },
        { intervalMs: 0 }
    );

}
