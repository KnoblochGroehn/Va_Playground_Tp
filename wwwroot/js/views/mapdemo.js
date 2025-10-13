import OlCircleIconMap, { mountMap } from '../modules/map.js';

const { ui } = mountMap(
    {
        target: 'map',
        center: [7.466, 51.51494],
        zoom: 11,
        enablePopup: true, 
        popupMultiple: true
    }, 
    { 
        onReady: async ({ ui }) => {

            await ui.loadByCallbacks({
                n: 5000,
                getCircles: ({ n }) => $.getJSON('/api/map/circles-initial', { n }),
                getIcons: ({ n }) => $.getJSON('/api/map/icons-initial', { n })
            });
        },

        // (optional) per Klick neues Icon + POST 
        /*onMapClick: async ({ ui, lonlat }) => {
            const [lon, lat] = lonlat;
            const created = await $.ajax({
                url: '/api/map/icon',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ lon, lat, html: `<b>${lon.toFixed(4)}, ${lat.toFixed(4)}</b>` })
            });
            ui.addIcon({
                id: created.id,
                lonLat: [created.lon, created.lat],
                html: created.html,
                fa: created.fa
            });
        },*/

        // onTick unten via timerOptions aktiv
        onTick: async ({ ui }) => {
            await ui.loadUpdatesByCallbacks({
                getCircleUpdates: () => $.getJSON('/api/map/circles-delta', { n: 5000 }),
                getIconUpdates: () => $.getJSON('/api/map/icons-delta', { n: 5000 }),
                upsert: false // bei Bedarf true
            });

        }
    },
    {
        intervalMs: 200 // alle 2s Teilupdates abfragen
    }
);
