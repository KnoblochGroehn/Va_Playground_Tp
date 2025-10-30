// ol-circle-icon-map.js
//SH//import OlShadowTileCache from '../map/shadowmap.js';

import MapOverlay from './mapoverlay.js';

// mountMap
// ajaxcalls
// controller view
// id für jedes element
export default class OlCircleIconMap {
    constructor(options = {}) {
        if (typeof ol === 'undefined' || !ol.Map) {
            throw new Error('OpenLayers (ol.*) ist nicht geladen. Bitte OL vor dieser Klasse einbinden.');
        }

        const {
            target,
            center = [7.466, 51.51494],
            zoom = 12,
            minRadius = 50,
            maxRadius = 20050,
            enablePopup = true,

            popupMultiple = true,
            showDefaultZoomButtons = true,  
            // Shadow-Cache
            //SH//enableShadowTileCache = false,
            //SH//shadowTileCacheFactor = 2,
            //SH//shadowDebounceMs = 0,
            //SH//shadowLayerSelector,

            overlay = true,
            overlayConfig = {},           // { place: {top:[...], right:[...], ...}, htmlTopStart: '...', ... }
            homeCenter = null,
            homeZoom = null,
            zoomKmPresets = [1, 5, 10, 100, 500],
        } = options;



        this.MIN_R = minRadius;
        this.MAX_R = maxRadius;

        this.to3857 = (lonlat) => ol.proj.fromLonLat(lonlat);
        this.from3857 = (xy) => ol.proj.toLonLat(xy);
        this.clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        // Basemap (aktiv ladefreudig)
        const base = new ol.layer.Tile({
            source: new ol.source.OSM(),
            preload: 0,
            transition: 0,

        });

        this.map = new ol.Map({
            target,
            view: new ol.View({
                center: ol.proj.fromLonLat(center), zoom,
                constrainResolution: true,          
                smoothResolutionConstraint: false
            }),
            layers: [base],
            loadTilesWhileAnimating: true,
            loadTilesWhileInteracting: true,
            controls: []
        });

        // Vector-Layer
        this.circleSource = new ol.source.Vector();
        
        this.circleLayer = new ol.layer.Vector({
            source: this.circleSource,
            //style: (f) => this.#circleStyle(f),
            style: (f) => this._filters.circle(f) ? this.#circleStyle(f) : null,
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false,
        });

        this.iconSource = new ol.source.Vector();
        this.iconLayer = new ol.layer.Vector({
            source: this.iconSource,
            //style: (f) => this.#iconStyle(f),
            style: (f) => this._filters.icon(f) ? this.#iconStyle(f) : null,

            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false,
        });

        this.polygonSource = new ol.source.Vector();
        this.polygonLayer = new ol.layer.Vector({
            source: this.polygonSource,
            style: (f) => this._filters.polygon(f) ? this.#polygonStyle(f) : null,
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false,
        });

        this._filters = {
            circle: () => true,
            icon: () => true,
            polygon: () => true
        };

        this.map.addLayer(this.circleLayer);
        this.map.addLayer(this.polygonLayer);
        this.map.addLayer(this.iconLayer);
        this.setZIndices({ circles: 5, icons: 10 });

        this._circleById = new Map();
        this._polygonById = new Map();
        this._iconById = new Map();


        this.popupMultiple = popupMultiple;        
        this.popupOverlays = [];

        // Popup & Styles
        this.popupEnabled = false;
        this.styleCache = new Map();
        this.#initPopup(enablePopup);


        //SH//  Shadow-Cache
        //SH//this.shadowCache = null;
        /*SH// if (enableShadowTileCache) {
            this.shadowCache = new OlShadowTileCache(this.map, {
                factor: shadowTileCacheFactor,
                debounceMs: shadowDebounceMs,
                layerSelector: shadowLayerSelector,
            });
        }*/

        this.animTimer = null;

        this._homeCenter = Array.isArray(homeCenter) ? homeCenter : center;
        this._homeZoom = typeof homeZoom === 'number' ? homeZoom : zoom;

        if (overlay) {
            this.overlay = new MapOverlay({ map: this.map, target });
            this.#initDefaultOverlays({ zoomKmPresets, overlayConfig });
        }
    }

    getMap() { return this.map; }
    setCenter(lonLat) { this.map.getView().setCenter(this.to3857(lonLat)); }
    getCenter() { return ol.proj.toLonLat(this.map.getView().getCenter()); }
    setZoom(z) { this.map.getView().setZoom(z); }
    getZoom() { return this.map.getView().getZoom(); }
    setZIndices({ circles = 5, icons = 10 } = {}) { this.circleLayer.setZIndex(circles); this.iconLayer.setZIndex(icons); }
    setDeclutterIcons(flag) { this.iconLayer.setDeclutter(!!flag); }

    setCircleFilter(fn) { this._filters.circle = typeof fn === 'function' ? fn : () => true; this.circleSource.changed(); }
    setIconFilter(fn) { this._filters.icon = typeof fn === 'function' ? fn : () => true; this.iconSource.changed(); }
    setPolygonFilter(fn) { this._filters.polygon = typeof fn === 'function' ? fn : () => true; this.polygonSource.changed(); } 

    // --- Polygone: API wie Kreise ---
    addPolygonsFrom(list = []) {
        for (const p of list) {
            this.addPolygon({
                id: p.id ?? p.Id,
                coordsLonLat: p.coords ?? p.Coords, // [ [lon,lat], ... ]
                color: p.color ?? p.Color,
                label: p.label ?? p.Label,
                html: p.html ?? p.Html
            });
        }
        return this;
    }

    addPolygon({ id, coordsLonLat = [], coords3857, color = 'rgba(255,165,0,0.25)', label, html = '' } = {}) {
        if (id != null) {
            const existing = this._polygonById.get(id);
            if (existing) {
                if (coordsLonLat?.length || coords3857?.length) {
                    //const ring = coords3857 || coordsLonLat.map(ll => this.to3857(ll));
                    const ring = (coords3857 && coords3857.length)
                        ? this.#ensureClosedRing(coords3857)
                        : (coordsLonLat?.length ? this.#ensureClosedRing(coordsLonLat.map(ll => this.to3857(ll))) : []);

                    existing.setGeometry(new ol.geom.Polygon([ring]));
                }
                if (html != null) existing.set('html', html);
                if (color != null) existing.set('color', color);
                if (label != null) existing.set('label', label);
                return existing;
            }
        }
        const ring = (coords3857 && coords3857.length)
            ? coords3857
            : (coordsLonLat?.length ? coordsLonLat.map(ll => this.to3857(ll)) : []);
        const geom = new ol.geom.Polygon([ring]);
        const f = new ol.Feature({ geometry: geom, color, label });
        if (id != null) { f.setId(id); this._polygonById.set(id, f); }
        if (html != null) f.set('html', html);
        this.polygonSource.addFeature(f);
        return f;
    }

    clearPolygons() { this.polygonSource.clear(); }

    updatePolygonsFrom(list = [], opts = {}) {
        const norm = [];
        for (const p of list) {
            if (p.Kill === true) {
                if (p.id != null) {
                    const existing = this._polygonById.get(p.id);
                    if (existing) {
                        this.polygonSource.removeFeature(existing);
                        this._polygonById.delete(p.id);
                    }
                }
            } else {
                norm.push({
                    id: p.id ?? p.Id,
                    coords: p.coords ?? p.Coords,
                    color: p.color ?? p.Color,
                    label: p.label ?? p.Label,
                    html: p.html ?? p.Html
                });
            }
        }
        this.updatePolygons(norm, opts);
        return this;
    }

    updatePolygons(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id; if (id == null) continue;
            let f = this._polygonById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addPolygon({ id, coordsLonLat: u.coords, color: u.color, label: u.label, html: u.html });
            }
            //if (u.coords?.length) {
            //    const ring = u.coords.map(ll => this.to3857(ll));
            //    f.setGeometry(new ol.geom.Polygon([ring]));
            //}
            if (u.coords?.length) {
                const ring = this.#ensureClosedRing(u.coords.map(ll => this.to3857(ll)));
                f.setGeometry(new ol.geom.Polygon([ring]));
            }

            if (u.html != null) f.set('html', u.html);
            if (u.color != null) f.set('color', u.color);
            if (u.label != null) f.set('label', u.label);

            if (this.popupMultiple && this.popupOverlays.length && u.html != null) {
                for (const ov of this.popupOverlays) {
                    if (ov.htmlid === id) {
                        const content = ov.getElement().querySelector('[data-popup-content]');
                        if (content) content.innerHTML = u.html;
                    }
                }
            } else if (!this.popupMultiple) {
                if (this.popupContent.htmlid === id) this.popupContent.innerHTML = u.html;
            }
        }
        this.polygonSource.changed();
    }
    goHome() { this.flyTo(this._homeCenter, this._homeZoom); }
    zoomIn() { this.map.getView().setZoom(this.getZoom() + 1); }
    zoomOut() { this.map.getView().setZoom(this.getZoom() - 1); }
    flyTo(lonlat, zoom = null, duration = 400) {
        const v = this.map.getView();
        const anim = [];
        if (lonlat) anim.push({ center: this.to3857(lonlat), duration });
        if (typeof zoom === 'number') anim.push({ zoom, duration });
        v.animate(...anim);
    }

    zoomToDistanceKm(km, atLonLat = null) {
        const view = this.map.getView();
        const size = this.map.getSize() || [1024, 768];
        const lat = (atLonLat ? atLonLat[1] : this.getCenter()[1]) * Math.PI / 180;
        const metersAcross = km * 1000;
        const cosLat = Math.cos(lat) || 1;
        const metersPerPixelZ0 = 156543.03392804097 * cosLat;
        const targetMPP = metersAcross / (size[0] * 0.6);
        const z = Math.log2(metersPerPixelZ0 / targetMPP);
        if (atLonLat) this.setCenter(atLonLat);
        view.setZoom(Math.max(2, Math.min(19, z)));
    }


    addCirclesFrom(list = []) {
        for (const c of list) {
            this.addCircle({
                id: c.id ?? c.Id,
                centerLonLat: [
                    (c.lon ?? c.Lon),
                    (c.lat ?? c.Lat)
                ],
                radius: c.radius ?? c.Radius,
                color: c.color ?? c.Color,
                label: c.label ?? c.Label,
                html: c.html ?? c.Html
            });
        }
        return this;
    }

    addIconsFrom(list = []) {
        for (const m of list) {
            this.addIcon({
                id: m.id ?? m.Id,
                lonLat: [
                    (m.lon ?? m.Lon),
                    (m.lat ?? m.Lat)
                ],
                html: m.html ?? m.Html,
                fa: m.fa ?? m.Fa
            });
        }
        return this;
    }

    async loadByCallbacks({ getCircles, getIcons, getPolygons, n } = {}) {
        const jobs = [];
        if (typeof getCircles === 'function') {
            jobs.push(Promise.resolve(getCircles({ n })).then(arr => this.addCirclesFrom(arr || [])));
        }
        if (typeof getIcons === 'function') {
            jobs.push(Promise.resolve(getIcons({ n })).then(arr => this.addIconsFrom(arr || [])));
        }
        if (typeof getPolygons === 'function') { // neu
            jobs.push(Promise.resolve(getPolygons({ n })).then(arr => this.addPolygonsFrom(arr || [])));
        }
        await Promise.all(jobs);
        return this;
    }


    updateCirclesFrom(list = [], opts = {}) {
        const norm = [];
        for (const c of list) {

            if (c.Kill === true)
            {
                if (c.id != null)
                {
                    const existing = this._circleById.get(c.id);
                    if (existing)
                    {
                        this.circleSource.removeFeature(existing);
                        this._circleById.delete(c.id);
                    }
                }
            }
            else
            {
                norm.push({
                    id: c.id ?? c.Id,
                    lon: c.lon ?? c.Lon,
                    lat: c.lat ?? c.Lat,
                    radius: c.radius ?? c.Radius,
                    color: c.color ?? c.Color,
                    label: c.label ?? c.Label,
                    html: c.html ?? c.Html
                });
            }
        }
        this.updateCircles(norm, opts);
        return this;
    }

    updateIconsFrom(list = [], opts = {})
    {
        const norm = [];
        for (const m of list)
        {
            if (m.Kill === true)
            {
                if (m.id != null)
                {
                    const existing = this._iconById.get(m.id);
                    if (existing)
                    {
                        this.iconSource.removeFeature(existing);
                        this._iconById.delete(m.id);
                    }

                }

            }
            else
            {
                norm.push({
                    id: m.id ?? m.Id,
                    lon: m.lon ?? m.Lon,
                    lat: m.lat ?? m.Lat,
                    html: m.html ?? m.Html,
                    fa: m.fa ?? m.Fa   // z.B. { fill: '#ff00aa' }
                });
            }
        }
        this.updateIcons(norm, opts);
        return this;
    }

    async loadUpdatesByCallbacks({ getCircleUpdates, getIconUpdates, getPolygonUpdates, upsert = false } = {}) {
        const jobs = [];
        if (typeof getCircleUpdates === 'function') {
            jobs.push(Promise.resolve(getCircleUpdates()).then(arr => this.updateCirclesFrom(arr || [], { upsert })));
        }
        if (typeof getIconUpdates === 'function') {
            jobs.push(Promise.resolve(getIconUpdates()).then(arr => this.updateIconsFrom(arr || [], { upsert })));
        }
        if (typeof getPolygonUpdates === 'function') { // neu
            jobs.push(Promise.resolve(getPolygonUpdates()).then(arr => this.updatePolygonsFrom(arr || [], { upsert })));
        }
        await Promise.all(jobs);
        return this;
    }

    // --- öffentliche API (gekürzt auf Relevantes) ---
    getMap() { return this.map; }
    setCenter(lonLat) { this.map.getView().setCenter(this.to3857(lonLat)); }
    getCenter() { return ol.proj.toLonLat(this.map.getView().getCenter()); }
    setZoom(z) { this.map.getView().setZoom(z); }
    getZoom() { return this.map.getView().getZoom(); }
    setZIndices({ circles = 5, icons = 10 } = {}) { this.circleLayer.setZIndex(circles); this.iconLayer.setZIndex(icons); }
    setDeclutterIcons(flag) { this.iconLayer.setDeclutter(!!flag); }

    addCircle({ id, centerLonLat, center3857, radius, color = 'rgba(0,128,255,0.20)', label , html='' } = {}) {
        if (id != null) {
            const existing = this._circleById.get(id);
            if (existing) {
                if (centerLonLat || center3857) {
                    const xy = center3857 || this.to3857(centerLonLat);
                    const r = existing.getGeometry().getRadius();
                    existing.setGeometry(new ol.geom.Circle(xy, r));
                }
                if (html != null) existing.set('html', html);
                if (radius != null) existing.getGeometry().setRadius(this.#clampRadius(radius));
                if (color != null) existing.set('color', color);
                if (label != null) existing.set('label', label);
                return existing;
            }
        } 

        const centerXY = center3857 || this.to3857(centerLonLat || this.getCenter());
        const r = this.#clampRadius(radius ?? this.MIN_R);
        const f = new ol.Feature({
            geometry: new ol.geom.Circle(centerXY, r),
            color,
            label: typeof label === 'string' ? label : `${this.#radiusToPercent(r)}%`,            
        });
        if (id != null) { f.setId(id); this._circleById.set(id, f); }
        if (html != null) f.set('html', html);

        this.circleSource.addFeature(f);
        return f;
    }


    clearCircles() { this.circleSource.clear(); }

    addIcon({ id, lonLat, xy3857, html = '<b>Marker</b>', fa, style } = {}) {
        if (id != null) {
            const existing = this._iconById.get(id);
            if (existing) {
                if (lonLat || xy3857) existing.setGeometry(new ol.geom.Point(xy3857 || this.to3857(lonLat)));
                if (html != null) existing.set('html', html);
                if (fa != null) { existing.set('fa', fa); this.styleCache.clear(); }
                if (style instanceof ol.style.Style) existing.setStyle(style);
                return existing;
            }
        }
        const xy = xy3857 || this.to3857(lonLat || this.getCenter());
        const f = new ol.Feature({ geometry: new ol.geom.Point(xy) }); 
        if (id != null) f.setId(id);
        if (html) f.set('html', html);
        if (fa) f.set('fa', fa);
        if (style instanceof ol.style.Style) f.setStyle(style);
        this.iconSource.addFeature(f);
        if (id != null) this._iconById.set(id, f);
        return f;
    }

    clearIcons() { this.iconSource.clear(); }

    setPopupEnabled(enabled) {
        this.popupEnabled = !!enabled;
        if (!enabled) this.popupOverlay.setPosition(undefined);
    }
    setPopupFormatter(fn) { this.popupFormatter = typeof fn === 'function' ? fn : null; }

    setPopupMultiple(flag) { this.popupMultiple = !!flag; }
    closeAllPopups() {
        if (!this.popupMultiple) {
            if (this.popupOverlay) this.popupOverlay.setPosition(undefined);
            return;
        }
        for (const ov of this.popupOverlays) {
            this.map.removeOverlay(ov);
        }
        this.popupOverlays = [];
    }

    // Shadow-Cache Steuerung
    //SH//setShadowCacheEnabled(enabled = true, opts = {}) {
    //SH//    if (enabled) {
    //SH//        if (!this.shadowCache) this.shadowCache = new OlShadowTileCache(this.map, opts);
    //SH//    } else if (this.shadowCache) {
    //SH//        this.shadowCache.destroy(); this.shadowCache = null;
    //SH//    }
    //SH//}
    //SH//setShadowCacheFactor(f) { if (this.shadowCache) this.shadowCache.setFactor(f); }

    updateCircles(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id;
            if (id == null) continue;
            let f = this._circleById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addCircle({ id, centerLonLat: [u.lon ?? u.Lon, u.lat ?? u.Lat], radius: u.radius ?? u.Radius, color: u.color ?? u.Color, label: u.label ?? u.Label });
            }
            if (u.lon != null && u.lat != null) {
                const xy = this.to3857([u.lon, u.lat]);
                f.setGeometry(new ol.geom.Circle(xy, f.getGeometry().getRadius()));
            }
            if (u.radius != null) {
                const r = this.#clampRadius(u.radius);
                const geom = f.getGeometry();
                geom.setRadius(r);
                if (!u.label && f.get('label')) {
                    f.set('label', `${this.#radiusToPercent(r)}%`);
                }
            }
            if (u.html != null) f.set('html', u.html);
            if (u.color != null) f.set('color', u.color);
            if (u.label != null) f.set('label', u.label);

            if (this.popupMultiple && this.popupOverlays.length && u.html != null) {
                for (const ov of this.popupOverlays) {
                    if (ov.htmlid === id) {
                        const content = ov.getElement().querySelector('[data-popup-content]');
                        if (content) content.innerHTML = u.html;
                    }
                }
            }
            else if (!this.popupMultiple)
            {
                if (this.popupContent.htmlid === id)
                {
                    this.popupContent.innerHTML = u.html;
                }
            }
            

        }
        this.circleSource.changed();
    }

    updateIcons(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id;
            if (id == null) continue;
            let f = this._iconById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addIcon({ id, lonLat: [u.lon ?? u.Lon, u.lat ?? u.Lat], html: u.html ?? u.Html, fa: u.fa ?? u.Fa });
            }
            if (u.lon != null && u.lat != null) {
                f.setGeometry(new ol.geom.Point(this.to3857([u.lon, u.lat])));
            }
            if (u.html != null) f.set('html', u.html);
            if (u.fa != null) f.set('fa', u.fa);
            // Style-Cache neu, falls fa geändert
            if (u.fa != null) this.styleCache.clear();

            if (this.popupMultiple && this.popupOverlays.length && u.html != null) {
                for (const ov of this.popupOverlays) {
                    if (ov.htmlid === id) {
                        const content = ov.getElement().querySelector('[data-popup-content]');
                        if (content) content.innerHTML = u.html;
                    }
                }
            }
            else if (!this.popupMultiple) {
                if (this.popupContent.htmlid === id) {
                    this.popupContent.innerHTML = u.html;
                }
            }

        }
        this.iconSource.changed();
    }

    startUpdateTimer(intervalMs, onTick) {
        this.stopUpdateTimer();
        this._updateIntervalMs = Math.max(200, +intervalMs || 1000);
        if (typeof onTick !== 'function') return;
        this._updateTimer = setInterval(() => {
            try { onTick({ ui: this }); } catch (e) { /* eslint-disable no-console */ console.error(e); }
        }, this._updateIntervalMs);
    }
    stopUpdateTimer() {
        if (this._updateTimer) clearInterval(this._updateTimer);
        this._updateTimer = null;
    }

    destroy() {
        if (this.animTimer) clearInterval(this.animTimer);
        this.stopUpdateTimer?.();

        if (this.popupMultiple && this.popupOverlays?.length) {
            for (const ov of this.popupOverlays) this.map.removeOverlay(ov);
            this.popupOverlays = [];
        }

        if (this.popupOverlay) this.popupOverlay.setPosition(undefined);
        this.map.setTarget(null);

        //if (this.popupEl?.parentElement) this.popupEl.parentElement.removeChild(this.popupEl);
        if (!this.popupMultiple && this.popupEl?.parentElement)
        {
            this.popupEl.parentElement.removeChild(this.popupEl);
        }
    }

    // --- private helpers / styles / popup ---
    #radiusToPercent(r) { return Math.round(((r - this.MIN_R) / (this.MAX_R - this.MIN_R)) * 100); }
    #clampRadius(r) { return this.clamp(r, this.MIN_R, this.MAX_R); }
    #ensureClosedRing(ring) {
        if (!ring || ring.length < 3) return ring;
        const a = ring[0], b = ring[ring.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) ring = [...ring, a];
        return ring;
    }

    #circleStyle(feature) {
        const color = feature.get('color') || 'rgba(0,128,255,0.20)';
        const label = feature.get('label') || '';
        const key = `circle|${color}|${label}`;
        if (!this.styleCache.has(key)) {
            this.styleCache.set(key, new ol.style.Style({
                fill: new ol.style.Fill({ color }),
                stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.5)', width: 8 }),
                text: new ol.style.Text({
                    text: label,
                    font: 'bold 24px system-ui, sans-serif',
                    fill: new ol.style.Fill({ color: '#fff' }),
                    stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.5)', width: 8 }),
                }),
            }));
        }
        return this.styleCache.get(key);
    }

    #iconStyle(feature) {
        const custom = feature.getStyle(); if (custom) return custom;
        const fa = feature.get('fa') || {};

        if (typeof fa.image === 'string' && /^https?:\/\//.test(fa.image)) {
            const z = fa.zIndex ?? 1000;
            const s = fa.scale ?? 1;
            const key = `svg|png|${fa.image}|${s}|${z}`;
            if (!this.styleCache.has(key)) {
                this.styleCache.set(key, new ol.style.Style({
                    image: new ol.style.Icon({
                        src: fa.image,
                        scale: s,
                        anchor: [0.5, 1],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'fraction'
                    }),
                    zIndex: z,
                }));
            }
            return this.styleCache.get(key);
        }

        const glyph = fa.glyph ?? '\uf8ef';
        const size = fa.size ?? 26;
        const weight = fa.weight ?? 900;
        const family = fa.family || '"Font Awesome 6 Free"';
        const fill = fa.fill || '#e53227';
        const stroke = fa.stroke || '#fff';
        const strokeWidth = fa.strokeWidth ?? 5;
        const textAlign = fa.textAlign || 'center';
        const textBaseline = fa.textBaseline || 'bottom';
        const zIndex = fa.zIndex ?? 1000;

        const key = `fa|${glyph}|${size}|${weight}|${family}|${fill}|${stroke}|${strokeWidth}|${textAlign}|${textBaseline}|${zIndex}`;
        if (!this.styleCache.has(key)) {
            this.styleCache.set(key, new ol.style.Style({
                text: new ol.style.Text({
                    text: glyph,
                    font: `${weight} ${size}px ${family}`,
                    fill: new ol.style.Fill({ color: fill }),
                    stroke: new ol.style.Stroke({ color: stroke, width: strokeWidth }),
                    textAlign,
                    textBaseline,
                }),
                zIndex,
            }));
        }
        return this.styleCache.get(key);
    }

    #polygonStyle(feature) {
        const color = feature.get('color') || 'rgba(255,165,0,0.25)';
        const label = feature.get('label') || '';
        const key = `poly|${color}|${label}`;
        if (!this.styleCache.has(key)) {
            this.styleCache.set(key, new ol.style.Style({
                fill: new ol.style.Fill({ color }),
                stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.6)', width: 2 }),
                text: label ? new ol.style.Text({
                    text: label,
                    font: 'bold 18px system-ui, sans-serif',
                    fill: new ol.style.Fill({ color: '#000' }),
                    stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.7)', width: 4 }),
                }) : undefined
            }));
        }
        return this.styleCache.get(key);
    }


    #initPopup(enable) {
        if (!this.popupMultiple) {
            const existing = document.getElementById('popup');
            this.popupEl = existing || this.#createPopupElement();
            this.popupOverlay = new ol.Overlay({
                element: this.popupEl,
                autoPan: true,
                autoPanAnimation: { duration: 200 }
            });
            this.map.addOverlay(this.popupOverlay);

            // Close-Button
            this.popupCloser = this.popupEl.querySelector('[data-popup-close]');
            this.popupContent = this.popupEl.querySelector('[data-popup-content]');
            this.popupCloser.onclick = () => { this.popupOverlay.setPosition(undefined); };
        }

        this.setPopupEnabled(!!enable);

        // Click-Verhalten
        this.map.on('click', (e) => {
            if (!this.popupEnabled) return;

            const feature = this.map.forEachFeatureAtPixel(e.pixel, (f) => f, { hitTolerance: 6 });

            if (!feature)
            {
                this.closeAllPopups();

                if (this.popupOverlay)
                {
                    this.popupOverlay.setPosition(undefined);
                }
                return;
            }

            if (!this.popupMultiple)
            {
                this.closeAllPopups();
            }

            // Inhalt bestimmen
            let html = null;
            if (this.popupFormatter) html = this.popupFormatter(feature, e.coordinate, e);
            if (html == null) html = feature.get('html') || '<b>Kein Inhalt</b>';
            if (!html) {
                if (!this.popupMultiple && this.popupOverlay) this.popupOverlay.setPosition(undefined);
                return;
            }

            const geom = feature.getGeometry();
            const pos = geom instanceof ol.geom.Point ? geom.getCoordinates() : geom.getClosestPoint(e.coordinate);
            const id= feature.getId() || '';

            if (this.popupMultiple)
            {
                const el = this.#createPopupElement(); // eigenes DOM je Overlay
                const overlay = new ol.Overlay({ element: el, autoPan: true, autoPanAnimation: { duration: 200 } });
                const closer = el.querySelector('[data-popup-close]');
                const content = el.querySelector('[data-popup-content]');
                content.innerHTML = html;
                overlay.htmlid= id;
                closer.onclick = () => {
                    this.map.removeOverlay(overlay);
                    this.popupOverlays = this.popupOverlays.filter(o => o !== overlay);
                };

                this.map.addOverlay(overlay);
                overlay.setPosition(pos);
                this.popupOverlays.push(overlay);

            }
            else
            {
                this.popupContent.htmlid = id;
                this.popupContent.innerHTML = html;
                this.popupOverlay.setPosition(pos);
            }
        });
    }

    #createPopupElement() {
        const el = document.createElement('div');
        el.id = el.id || 'popup';
        if (1) {
            el.className = 'ol-popup card shadow border-0';
            el.style.cssText = 'position:absolute; min-width:240px;';
            el.innerHTML = `
      <div class="card-body p-3 position-relative">
        <button type="button" class="btn-close position-absolute" style="right:.5rem; top:.5rem;" aria-label="Close" data-popup-close></button>
        <div class="card-text" data-popup-content></div>
      </div>`;
        } else {
            el.className = 'ol-popup';
            el.style.cssText = 'position:absolute;background:#fff;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);padding:8px 10px;min-width:240px;';
            el.innerHTML = `
      <a data-popup-close style="position:absolute;right:8px;top:6px;cursor:pointer;text-decoration:none">x</a>
      <div data-popup-content></div>`;
        }
        if (!this.popupMultiple) document.body.appendChild(el); 
        return el;
    }



    #initDefaultOverlays({ zoomKmPresets = [1, 5, 10, 100, 500], overlayConfig = {} } = {}) {
        if (!this.overlay) return;

        const nav = this.overlay.createNavControls({
            kmPresets: zoomKmPresets,
            onHome: () => this.goHome(),
            onZoomToKm: (km) => this.zoomToDistanceKm(km),
            onZoomIn: () => this.zoomIn(),
            onZoomOut: () => this.zoomOut(),
            label: ''
        });
        this.overlay.add('left', nav, 'start');

        // Titel oben
        if (overlayConfig.title) {
            const titleEl = this.overlay.createHtml(`<div class="fw-semibold px-3 py-2 bg-light border rounded shadow-sm">${overlayConfig.title}</div>`);
            this.overlay.add('top', titleEl, 'start');
        }

        //const jumps = this.overlay.createJumpButtons({
        //    items: [
        //        { label: 'Dortmund', lonlat: [7.468, 51.514], icon: 'fa-solid fa-city', km: 20 },
        //        { label: 'Duesseldorf', lonlat: [6.773, 51.227], icon: 'fa-solid fa-city', km: 20 },
        //        { label: 'Koeln', lonlat: [6.960, 50.938], icon: 'fa-solid fa-city', km: 20 },
        //    ],
        //    onJump: (it) => { this.flyTo(it.lonlat, null); this.zoomToDistanceKm(it.km || 20, it.lonlat); }
        //});
        //this.overlay.add('top', jumps, 'end');

        //const circ = this.overlay.createCircleFilter({
        //    defActive: true,
        //    min: this.MIN_R,
        //    max: this.MAX_R,
        //    onApply: ({ enabled, min, max }) => {
        //        if (!enabled) { this.setCircleFilter(() => true); return; }
        //        const mi = Math.max(this.MIN_R, +min || this.MIN_R);
        //        const ma = Math.min(this.MAX_R, +max || this.MAX_R);
        //        this.setCircleFilter((f) => {
        //            const r = f.getGeometry()?.getRadius?.() || 0;
        //            return r >= mi && r <= ma;
        //        });
        //    }
        //});
        //this.overlay.add('top', circ, 'start');

        if (overlayConfig.htmlTopStart) this.overlay.add('top', this.overlay.createHtml(overlayConfig.htmlTopStart), 'start');
        if (overlayConfig.htmlTopEnd) this.overlay.add('top', this.overlay.createHtml(overlayConfig.htmlTopEnd), 'end');
        if (overlayConfig.htmlBottomStart) this.overlay.add('bottom', this.overlay.createHtml(overlayConfig.htmlBottomStart), 'start');
        if (overlayConfig.htmlBottomEnd) this.overlay.add('bottom', this.overlay.createHtml(overlayConfig.htmlBottomEnd), 'end');
        if (overlayConfig.htmlLeftStart) this.overlay.add('left', this.overlay.createHtml(overlayConfig.htmlLeftStart), 'start');
        if (overlayConfig.htmlLeftEnd) this.overlay.add('left', this.overlay.createHtml(overlayConfig.htmlLeftEnd), 'end');
        if (overlayConfig.htmlRightStart) this.overlay.add('right', this.overlay.createHtml(overlayConfig.htmlRightStart), 'start');
        if (overlayConfig.htmlRightEnd) this.overlay.add('right', this.overlay.createHtml(overlayConfig.htmlRightEnd), 'end');
    }
}


export function mountMap(options = {}, hooks = {}, timerOptions = {})
{
    
    console.log('mountMap');
    console.log('options:', options);


    const ui = new OlCircleIconMap(options);

    if (Array.isArray(options.jumps) && options.jumps.length && ui.overlay) {
        const defaultJumpKm = options.defaultJumpKm ?? 20;

        const jumps = ui.overlay.createJumpButtons({
            items: options.jumps.map(it => ({
                ...it,
                km: it.km ?? defaultJumpKm,
            })),
            onJump: (it) => {
                ui.flyTo(it.lonlat, null);
                ui.zoomToDistanceKm(it.km ?? defaultJumpKm, it.lonlat);
            }
        });

        ui.overlay.add('top', jumps, 'end');
    }

    if (options.circle && ui.overlay && typeof ui.setCircleFilter === 'function') {
        // Bounds aus Parametern, fallback auf evtl. vorhandene this.MIN_R/MAX_R
        const minBound = (typeof options.circle.min === 'number') ? options.circle.min : (ui.MIN_R ?? 0);
        const maxBound = (typeof options.circle.max === 'number') ? options.circle.max : (ui.MAX_R ?? 1e9);
        const defActive = (options.circle.defActive ?? true);

        const circ = ui.overlay.createCircleFilter({
            defActive: defActive,
            min: minBound,
            max: maxBound,
            onApply: ({ enabled, min, max }) =>
            {
                if (!enabled) { ui.setCircleFilter(() => true); return; }

                const mi = Math.max(minBound, Number(min) || minBound);
                const ma = Math.min(maxBound, Number(max) || maxBound);

                ui.setCircleFilter((f) => {
                    // robust gegen fehlende Methoden
                    const geom = f?.getGeometry?.();
                    const r = geom?.getRadius?.() || 0;
                    return r >= mi && r <= ma;
                });
            }
        });

        ui.overlay.add('top', circ, 'end');
    }

    if (typeof hooks.onReady === 'function') {
        Promise.resolve().then(() => hooks.onReady({ ui }));
    }

    if (typeof hooks.onMapClick === 'function') {
        ui.getMap().on('click', (evt) => {
            hooks.onMapClick({ ui, coordinate3857: evt.coordinate, lonlat: ui.from3857(evt.coordinate), originalEvent: evt });
        });
    }

    if (timerOptions.intervalMs && typeof hooks.onTick === 'function') {
        ui.startUpdateTimer(timerOptions.intervalMs, ({ ui }) => hooks.onTick({ ui }));
    }

    return { ui };
}
