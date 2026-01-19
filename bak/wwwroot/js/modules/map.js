// map.js

import MapOverlay from './mapoverlay.js';

export default class OlCircleIconMap {
    constructor(options = {}) {
        if (typeof ol === 'undefined' || !ol.Map) {
            throw new Error('OpenLayers (ol.*) is not loaded. Please include OL before this class.');
        }

        const {
            target,
            center = [7.466, 51.51494],
            zoom = 12,
            minRadius = 50,
            maxRadius = 20050,
            enablePopup = true,
            popupMultiple = true,

            overlay = true,
            overlayConfig = {},
            zoomKmPresets = [1, 5, 10, 100, 500],

            debug = { enabled: false, client: true, prefix: '' },

            // layer config
            layers = {
                order: ['circle0', 'circle1', 'polygon0', 'polygon1', 'icon0', 'icon1'],
                zIndex: { circle0: 5, circle1: 6, polygon0: 7, polygon1: 8, icon0: 10, icon1: 11 },
                declutterIcons: false
            },

            // style defaults
            styles = {},

            circle = {},
            icon = {},
            polygon = {},

            animations = { enabled: true, fps: 30 },

            homeCenter = null,
            homeZoom = null,
        } = options;

        this.MIN_R = minRadius;
        this.MAX_R = maxRadius;
        this._debug = this.#mergeDeep({ enabled: false, client: true, prefix: '' }, debug || {});
        this._layersCfg = this.#mergeDeep(
            { order: ['circle0', 'circle1', 'polygon0', 'polygon1', 'icon0', 'icon1'], zIndex: { circle0: 5, circle1: 6, polygon0: 7, polygon1: 8, icon0: 10, icon1: 11 }, declutterIcons: false },
            layers || {}
        );

        this._styleDefaults = this.#mergeDeep({
            circle: {
                fill: { colorFallback: 'rgba(0,128,255,0.20)' },
                stroke: { color: 'rgba(255,255,255,0.6)', width: 8 },
                outline: { enabled: true, color: 'rgba(0,0,0,0.2)', width: 14 },
                label: {
                    text: null,
                    font: 'bold 18px system-ui, sans-serif',
                    color: '#fff',
                    outlined: true,
                    outlineColor: 'rgba(0,0,0,0.55)',
                    outlineWidth: 4,
                    background: { enabled: false, fill: 'rgba(0,0,0,0.35)', padding: [4, 6, 4, 6], borderRadius: 6, stroke: null }
                }
            },
            polygon: {
                fill: { colorFallback: 'rgba(255,165,0,0.25)' },
                stroke: { color: 'rgba(0,0,0,0.6)', width: 3 },
                outline: { enabled: false, color: 'rgba(255,255,255,0.35)', width: 8 },
                label: {
                    font: 'bold 16px system-ui, sans-serif',
                    color: '#000',
                    outlined: false,
                    outlineColor: 'rgba(255,255,255,0.7)',
                    outlineWidth: 4,
                    background: { enabled: true, fill: 'rgba(255,255,255,0.65)', padding: [3, 5, 3, 5], borderRadius: 6, stroke: 'rgba(0,0,0,0.25)' }
                }
            },
            icon: {
                fa: {
                    glyph: '\uf041',
                    size: 28,
                    weight: 900,
                    family: '"Font Awesome 6 Free"',
                    fill: '#e53227',
                    stroke: '#fff',
                    strokeWidth: 5,
                    textAlign: 'center',
                    textBaseline: 'bottom',
                    zIndex: 1000
                }
            }
        }, styles || {});

        this._animationsEnabled = !!(animations?.enabled ?? true);
        this._animFps = Math.max(10, Math.min(60, +(animations?.fps ?? 30)));
        this._t0 = performance.now();
        this._animTimer = null;

        this.to3857 = (lonlat) => ol.proj.fromLonLat(lonlat);
        this.from3857 = (xy) => ol.proj.toLonLat(xy);
        this.clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        this._homeCenter = Array.isArray(homeCenter) ? homeCenter : center;
        this._homeZoom = typeof homeZoom === 'number' ? homeZoom : zoom;

        this._keepCircleRadiusPixels = !!circle.keepRadiusPixelsWithZoom;

        // per-layer cluster configs (0..1)
        this._iconClusterCfg = this.#normalizeClusterCfg(icon?.cluster, {
            enabled: false,
            distance: 45,
            minDistance: 0,
            badge: {
                radius: 15,
                fill: 'rgba(0,0,0,0.65)',
                stroke: 'rgba(255,255,255,0.85)',
                strokeWidth: 2,
                font: '800 12px system-ui, sans-serif',
                textFill: '#fff',
                outlined: false,
                textStroke: { color: 'rgba(0,0,0,0.55)', width: 3 }
            }
        });

        this._circleClusterCfg = this.#normalizeClusterCfg(circle?.cluster, {
            enabled: false,
            distance: 55,
            minDistance: 0,
            badge: {
                radius: 14,
                fill: 'rgba(30,144,255,0.65)',
                stroke: 'rgba(255,255,255,0.85)',
                strokeWidth: 2,
                font: '800 12px system-ui, sans-serif',
                textFill: '#fff',
                outlined: false,
                textStroke: { color: 'rgba(0,0,0,0.55)', width: 3 }
            }
        });

        this._polygonClusterCfg = this.#normalizeClusterCfg(polygon?.cluster, {
            enabled: false,
            distance: 55,
            minDistance: 0,
            badge: {
                radius: 15,
                fill: 'rgba(0,0,0,0.55)',
                stroke: 'rgba(255,255,255,0.85)',
                strokeWidth: 2,
                font: '900 12px system-ui, sans-serif',
                textFill: '#fff',
                outlined: true,
                textStroke: { color: 'rgba(0,0,0,0.65)', width: 3 }
            }
        });

        // Basemap
        const base = new ol.layer.Tile({
            source: new ol.source.OSM(),
            preload: 0,
            transition: 0
        });

        this.map = new ol.Map({
            target,
            view: new ol.View({
                center: ol.proj.fromLonLat(center),
                zoom,
                constrainResolution: true,
                smoothResolutionConstraint: false
            }),
            layers: [base],
            loadTilesWhileAnimating: true,
            loadTilesWhileInteracting: true,
            controls: []
        });

        // sources + layers (two layers per type: layer 0 and layer 1)
        this.circleSourceRaw0 = new ol.source.Vector();
        this.circleSourceRaw1 = new ol.source.Vector();
        this.circleClusterSource0 = null;
        this.circleClusterSource1 = null;

        this.circleLayer0 = new ol.layer.Vector({
            source: this.circleSourceRaw0,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.circle(baseF) ? this.#circleStyle(f, 0) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false
        });
        this.circleLayer1 = new ol.layer.Vector({
            source: this.circleSourceRaw1,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.circle(baseF) ? this.#circleStyle(f, 1) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false
        });

        this.iconSourceRaw0 = new ol.source.Vector();
        this.iconSourceRaw1 = new ol.source.Vector();
        this.iconClusterSource0 = null;
        this.iconClusterSource1 = null;

        this.iconLayer0 = new ol.layer.Vector({
            source: this.iconSourceRaw0,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.icon(baseF) ? this.#iconStyle(f, 0) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: !!this._layersCfg.declutterIcons
        });

        this.iconLayer1 = new ol.layer.Vector({
            source: this.iconSourceRaw1,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.icon(baseF) ? this.#iconStyle(f, 1) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: !!this._layersCfg.declutterIcons
        });

        this.polygonSource0 = new ol.source.Vector();
        this.polygonSource1 = new ol.source.Vector();
        this.polygonClusterSource0 = null;
        this.polygonClusterSource1 = null;

        this.polygonLayer0 = new ol.layer.Vector({
            source: this.polygonSource0,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.polygon(baseF) ? this.#polygonStyle(f, 0) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false
        });

        this.polygonLayer1 = new ol.layer.Vector({
            source: this.polygonSource1,
            style: (f) => {
                const baseF = this.#unwrapSingleClusterFeature(f);
                return this._filters.polygon(baseF) ? this.#polygonStyle(f, 1) : null;
            },
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            declutter: false
        });

        this._filters = { circle: () => true, icon: () => true, polygon: () => true };
        this.styleCache = new Map();

        // add layers
        this.map.addLayer(this.circleLayer0);
        this.map.addLayer(this.circleLayer1);
        this.map.addLayer(this.polygonLayer0);
        this.map.addLayer(this.polygonLayer1);
        this.map.addLayer(this.iconLayer0);
        this.map.addLayer(this.iconLayer1);

        // apply per-layer clustering
        this.#applyIconClustering(!!this._iconClusterCfg[0].enabled, 0);
        this.#applyIconClustering(!!this._iconClusterCfg[1].enabled, 1);

        this.#applyCircleClustering(!!this._circleClusterCfg[0].enabled, 0);
        this.#applyCircleClustering(!!this._circleClusterCfg[1].enabled, 1);

        this.#applyPolygonClustering(!!this._polygonClusterCfg[0].enabled, 0);
        this.#applyPolygonClustering(!!this._polygonClusterCfg[1].enabled, 1);

        this.#applyLayerOrderAndZ();

        this._circleById = new Map();
        this._iconById = new Map();
        this._polygonById = new Map();

        this.popupMultiple = !!popupMultiple;
        this.popupOverlays = [];
        this.popupEnabled = false;
        this.popupFormatter = null;
        this.#initPopup(enablePopup);

        if (overlay) {
            this.overlay = new MapOverlay({ map: this.map, target });
            this.#initDefaultOverlays({ zoomKmPresets, overlayConfig, circle });
        }

        this.#initClusterClickZoom();
        this.#startAnimLoopIfNeeded();

        this._log('ready', { target, center, zoom });
    }

    // ---- debug helpers
    _log(...args) {
        if (!this._debug.enabled || !this._debug.client) return;
        const p = this._debug.prefix ? `[${this._debug.prefix}]` : '[map]';
        // eslint-disable-next-line no-console
        console.log(p, ...args);
    }

    // ---- basic map api
    getMap() { return this.map; }
    setCenter(lonLat) { this.map.getView().setCenter(this.to3857(lonLat)); }
    getCenter() { return ol.proj.toLonLat(this.map.getView().getCenter()); }
    setZoom(z) { this.map.getView().setZoom(z); }
    getZoom() { return this.map.getView().getZoom(); }
    zoomIn() { this.setZoom(this.getZoom() + 1); }
    zoomOut() { this.setZoom(this.getZoom() - 1); }
    flyTo(lonlat, zoom = null, duration = 400) {
        const v = this.map.getView();
        const anim = [];
        if (lonlat) anim.push({ center: this.to3857(lonlat), duration });
        if (typeof zoom === 'number') anim.push({ zoom, duration });
        v.animate(...anim);
    }
    goHome() { this.flyTo(this._homeCenter, this._homeZoom); }

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

    // ---- config setters
    setKeepCircleRadiusPixelsWithZoom(flag) { this._keepCircleRadiusPixels = !!flag; this.circleSourceRaw0.changed(); this.circleSourceRaw1.changed(); }
    setCircleFilter(fn) { this._filters.circle = (typeof fn === 'function') ? fn : () => true; this.circleSourceRaw0.changed(); this.circleSourceRaw1.changed(); }
    setIconFilter(fn) { this._filters.icon = (typeof fn === 'function') ? fn : () => true; this.iconSourceRaw0.changed(); this.iconSourceRaw1.changed(); }
    setPolygonFilter(fn) { this._filters.polygon = (typeof fn === 'function') ? fn : () => true; this.polygonSource0.changed(); this.polygonSource1.changed(); }

    setStyleConfig(styles = {}) {
        this._styleDefaults = this.#mergeDeep(this._styleDefaults, styles);
        this.styleCache.clear();
        this.circleSourceRaw0.changed(); this.circleSourceRaw1.changed();
        this.iconSourceRaw0.changed(); this.iconSourceRaw1.changed();
        this.polygonSource0.changed(); this.polygonSource1.changed();
    }

    setLayerConfig(cfg = {}) {
        this._layersCfg = this.#mergeDeep(this._layersCfg, cfg);
        this.#applyLayerOrderAndZ();
        this.iconLayer0.setDeclutter(!!this._layersCfg.declutterIcons);
        this.iconLayer1.setDeclutter(!!this._layersCfg.declutterIcons);
    }

    setAnimationsEnabled(flag) {
        this._animationsEnabled = !!flag;
        this.styleCache.clear();
        this.circleSourceRaw0.changed(); this.circleSourceRaw1.changed();
        this.iconSourceRaw0.changed(); this.iconSourceRaw1.changed();
        this.polygonSource0.changed(); this.polygonSource1.changed();
        this.#startAnimLoopIfNeeded();
    }

    // Per-layer cluster toggles (layerIndex: 0 or 1). Backward compatible: layerIndex defaults to 0.
    setIconClusteringEnabled(flag, cfg = null, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        if (cfg) this._iconClusterCfg[li] = this.#mergeDeep(this._iconClusterCfg[li], cfg);
        this.#applyIconClustering(!!flag, li);
        this.#applyLayerOrderAndZ();
        (li === 0 ? this.iconSourceRaw0 : this.iconSourceRaw1).changed();
    }

    setCircleClusteringEnabled(flag, cfg = null, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        if (cfg) this._circleClusterCfg[li] = this.#mergeDeep(this._circleClusterCfg[li], cfg);
        this.#applyCircleClustering(!!flag, li);
        this.#applyLayerOrderAndZ();
        (li === 0 ? this.circleSourceRaw0 : this.circleSourceRaw1).changed();
    }

    setPolygonClusteringEnabled(flag, cfg = null, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        if (cfg) this._polygonClusterCfg[li] = this.#mergeDeep(this._polygonClusterCfg[li], cfg);
        this.#applyPolygonClustering(!!flag, li);
        this.#applyLayerOrderAndZ();
        (li === 0 ? this.polygonSource0 : this.polygonSource1).changed();
    }

    #applyIconClustering(enabled, layerIndex) {
        const li = (layerIndex === 1) ? 1 : 0;
        const raw = (li === 0) ? this.iconSourceRaw0 : this.iconSourceRaw1;
        const layer = (li === 0) ? this.iconLayer0 : this.iconLayer1;

        if (!enabled) {
            if (li === 0 && this.iconClusterSource0) this.iconClusterSource0 = null;
            if (li === 1 && this.iconClusterSource1) this.iconClusterSource1 = null;
            layer.setSource(raw);
            this._iconClusterCfg[li].enabled = false;
            return;
        }

        const cfg = this._iconClusterCfg[li] || {};
        const cluster = new ol.source.Cluster({
            distance: Math.max(0, +(cfg.distance ?? 45)),
            minDistance: Math.max(0, +(cfg.minDistance ?? 0)),
            source: raw
        });

        if (li === 0) this.iconClusterSource0 = cluster;
        else this.iconClusterSource1 = cluster;

        layer.setSource(cluster);
        this._iconClusterCfg[li].enabled = true;
    }

    #applyCircleClustering(enabled, layerIndex) {
        const li = (layerIndex === 1) ? 1 : 0;
        const raw = (li === 0) ? this.circleSourceRaw0 : this.circleSourceRaw1;
        const layer = (li === 0) ? this.circleLayer0 : this.circleLayer1;

        if (!enabled) {
            if (li === 0 && this.circleClusterSource0) this.circleClusterSource0 = null;
            if (li === 1 && this.circleClusterSource1) this.circleClusterSource1 = null;
            layer.setSource(raw);
            this._circleClusterCfg[li].enabled = false;
            return;
        }

        const cfg = this._circleClusterCfg[li] || {};
        const cluster = new ol.source.Cluster({
            distance: Math.max(0, +(cfg.distance ?? 55)),
            minDistance: Math.max(0, +(cfg.minDistance ?? 0)),
            source: raw
        });

        if (li === 0) this.circleClusterSource0 = cluster;
        else this.circleClusterSource1 = cluster;

        layer.setSource(cluster);
        this._circleClusterCfg[li].enabled = true;
    }

    #applyPolygonClustering(enabled, layerIndex) {
        const li = (layerIndex === 1) ? 1 : 0;
        const raw = (li === 0) ? this.polygonSource0 : this.polygonSource1;
        const layer = (li === 0) ? this.polygonLayer0 : this.polygonLayer1;

        if (!enabled) {
            if (li === 0 && this.polygonClusterSource0) this.polygonClusterSource0 = null;
            if (li === 1 && this.polygonClusterSource1) this.polygonClusterSource1 = null;
            layer.setSource(raw);
            this._polygonClusterCfg[li].enabled = false;
            return;
        }

        const cfg = this._polygonClusterCfg[li] || {};
        const cluster = new ol.source.Cluster({
            distance: Math.max(0, +(cfg.distance ?? 55)),
            minDistance: Math.max(0, +(cfg.minDistance ?? 0)),
            source: raw,
            geometryFunction: (f) => {
                const g = f.getGeometry && f.getGeometry();
                if (!g) return null;
                const ex = g.getExtent ? g.getExtent() : null;
                if (!ex) return null;
                const c = ol.extent.getCenter(ex);
                return new ol.geom.Point(c);
            }
        });

        if (li === 0) this.polygonClusterSource0 = cluster;
        else this.polygonClusterSource1 = cluster;

        layer.setSource(cluster);
        this._polygonClusterCfg[li].enabled = true;
    }

    #applyLayerOrderAndZ() {
        const order = this._layersCfg.order || ['circle0', 'circle1', 'polygon0', 'polygon1', 'icon0', 'icon1'];
        const z = this._layersCfg.zIndex || {};
        const byName = {
            circle0: this.circleLayer0, circle1: this.circleLayer1,
            polygon0: this.polygonLayer0, polygon1: this.polygonLayer1,
            icon0: this.iconLayer0, icon1: this.iconLayer1
        };
        order.forEach((name, i) => {
            const layer = byName[name]; if (!layer) return;
            layer.setZIndex(typeof z[name] === 'number' ? z[name] : (i * 2 + 5));
        });
    }

    // ---- data loading helpers
    async loadByCallbacks({ getCircles, getIcons, getPolygons, n } = {}) {
        const jobs = [];
        if (typeof getCircles === 'function') jobs.push(Promise.resolve(getCircles({ n })).then(arr => this.addCirclesFrom(arr || [])));
        if (typeof getIcons === 'function') jobs.push(Promise.resolve(getIcons({ n })).then(arr => this.addIconsFrom(arr || [])));
        if (typeof getPolygons === 'function') jobs.push(Promise.resolve(getPolygons({ n })).then(arr => this.addPolygonsFrom(arr || [])));
        await Promise.all(jobs);
        return this;
    }

    async loadUpdatesByCallbacks({ getCircleUpdates, getIconUpdates, getPolygonUpdates, upsert = false } = {}) {
        const jobs = [];
        if (typeof getCircleUpdates === 'function') jobs.push(Promise.resolve(getCircleUpdates()).then(arr => this.updateCirclesFrom(arr || [], { upsert })));
        if (typeof getIconUpdates === 'function') jobs.push(Promise.resolve(getIconUpdates()).then(arr => this.updateIconsFrom(arr || [], { upsert })));
        if (typeof getPolygonUpdates === 'function') jobs.push(Promise.resolve(getPolygonUpdates()).then(arr => this.updatePolygonsFrom(arr || [], { upsert })));
        await Promise.all(jobs);
        return this;
    }

    // ---- circles (stored as point+radius property)
    addCirclesFrom(list = []) {
        for (const c of list) {
            this.addCircle({
                id: c.id ?? c.Id,
                centerLonLat: [(c.lon ?? c.Lon), (c.lat ?? c.Lat)],
                radius: c.radius ?? c.Radius,
                color: c.color ?? c.Color,
                label: c.label ?? c.Label,
                html: c.html ?? c.Html,
                strokeColor: c.strokeColor ?? c.StrokeColor,
                strokeWidth: c.strokeWidth ?? c.StrokeWidth,
                outlineColor: c.outlineColor ?? c.OutlineColor,
                outlineWidth: c.outlineWidth ?? c.OutlineWidth,
                anim: c.anim ?? c.Anim,
                layer: c.layer ?? c.Layer ?? 0
            });
        }
        return this;
    }

    addCircle({ id, centerLonLat, center3857, radius, color, label, html = '', strokeColor, strokeWidth, outlineColor, outlineWidth, anim, layer = 0 } = {}) {
        const li = (layer === 1) ? 1 : 0;

        if (id != null) {
            const existing = this._circleById.get(id);
            if (existing) {
                const oldLayer = (existing.get('layer') === 1) ? 1 : 0;
                if (oldLayer !== li) this.#moveCircleFeature(existing, oldLayer, li);

                if (centerLonLat || center3857) existing.setGeometry(new ol.geom.Point(center3857 || this.to3857(centerLonLat)));
                if (radius != null) existing.set('radius', this.#clampRadius(radius));
                if (color != null) existing.set('color', color);
                if (label != null) existing.set('label', label);
                if (html != null) existing.set('html', html);
                if (strokeColor != null) existing.set('strokeColor', strokeColor);
                if (strokeWidth != null) existing.set('strokeWidth', strokeWidth);
                if (outlineColor != null) existing.set('outlineColor', outlineColor);
                if (outlineWidth != null) existing.set('outlineWidth', outlineWidth);
                if (anim != null) existing.set('anim', anim);
                existing.set('layer', li);
                return existing;
            }
        }

        const centerXY = center3857 || this.to3857(centerLonLat || this.getCenter());
        const r = this.#clampRadius(radius ?? this.MIN_R);

        const f = new ol.Feature({ geometry: new ol.geom.Point(centerXY) });
        f.set('radius', r);
        f.set('layer', li);
        if (color != null) f.set('color', color);
        if (label != null) f.set('label', label);
        if (html != null) f.set('html', html);
        if (strokeColor != null) f.set('strokeColor', strokeColor);
        if (strokeWidth != null) f.set('strokeWidth', strokeWidth);
        if (outlineColor != null) f.set('outlineColor', outlineColor);
        if (outlineWidth != null) f.set('outlineWidth', outlineWidth);
        if (anim != null) f.set('anim', anim);

        if (id != null) { f.setId(id); this._circleById.set(id, f); }
        (li === 0 ? this.circleSourceRaw0 : this.circleSourceRaw1).addFeature(f);
        return f;
    }

    clearCircles() {
        this.circleSourceRaw0.clear(); this.circleSourceRaw1.clear();
        this._circleById.clear();
    }

    updateCirclesFrom(list = [], opts = {}) {
        const norm = [];
        for (const c of list) {
            if (c.Kill === true) {
                const id = c.id ?? c.Id;
                if (id != null) {
                    const existing = this._circleById.get(id);
                    if (existing) {
                        const li = (existing.get('layer') === 1) ? 1 : 0;
                        (li === 0 ? this.circleSourceRaw0 : this.circleSourceRaw1).removeFeature(existing);
                        this._circleById.delete(id);
                    }
                }
            } else {
                norm.push({
                    id: c.id ?? c.Id,
                    lon: c.lon ?? c.Lon,
                    lat: c.lat ?? c.Lat,
                    radius: c.radius ?? c.Radius,
                    color: c.color ?? c.Color,
                    label: c.label ?? c.Label,
                    html: c.html ?? c.Html,
                    strokeColor: c.strokeColor ?? c.StrokeColor,
                    strokeWidth: c.strokeWidth ?? c.StrokeWidth,
                    outlineColor: c.outlineColor ?? c.OutlineColor,
                    outlineWidth: c.outlineWidth ?? c.OutlineWidth,
                    anim: c.anim ?? c.Anim,
                    layer: c.layer ?? c.Layer
                });
            }
        }
        this.updateCircles(norm, opts);
        return this;
    }

    updateCircles(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id;
            if (id == null) continue;

            const nextLayer = (u.layer === 1) ? 1 : 0;

            let f = this._circleById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addCircle({ id, centerLonLat: [u.lon, u.lat], radius: u.radius, color: u.color, label: u.label, html: u.html, layer: nextLayer });
            }

            const oldLayer = (f.get('layer') === 1) ? 1 : 0;
            if (nextLayer !== oldLayer) this.#moveCircleFeature(f, oldLayer, nextLayer);

            if (u.lon != null && u.lat != null) f.setGeometry(new ol.geom.Point(this.to3857([u.lon, u.lat])));
            if (u.radius != null) f.set('radius', this.#clampRadius(u.radius));
            if (u.color != null) f.set('color', u.color);
            if (u.label != null) f.set('label', u.label);
            if (u.html != null) f.set('html', u.html);
            if (u.strokeColor != null) f.set('strokeColor', u.strokeColor);
            if (u.strokeWidth != null) f.set('strokeWidth', u.strokeWidth);
            if (u.outlineColor != null) f.set('outlineColor', u.outlineColor);
            if (u.outlineWidth != null) f.set('outlineWidth', u.outlineWidth);
            if (u.anim != null) f.set('anim', u.anim);

            f.set('layer', nextLayer);
        }
        this.circleSourceRaw0.changed();
        this.circleSourceRaw1.changed();
    }

    #moveCircleFeature(feature, fromLayer, toLayer) {
        const from = (fromLayer === 1) ? this.circleSourceRaw1 : this.circleSourceRaw0;
        const to = (toLayer === 1) ? this.circleSourceRaw1 : this.circleSourceRaw0;
        if (from === to) return;
        from.removeFeature(feature);
        to.addFeature(feature);
    }

    // ---- icons
    addIconsFrom(list = []) {
        for (const m of list) {
            this.addIcon({
                id: m.id ?? m.Id,
                lonLat: [(m.lon ?? m.Lon), (m.lat ?? m.Lat)],
                html: m.html ?? m.Html,
                fa: m.fa ?? m.Fa,
                anim: m.anim ?? m.Anim,
                layer: m.layer ?? m.Layer ?? 0
            });
        }
        return this;
    }

    addIcon({ id, lonLat, xy3857, html = '<b>Marker</b>', fa, style, anim, layer = 0 } = {}) {
        const li = (layer === 1) ? 1 : 0;

        if (id != null) {
            const existing = this._iconById.get(id);
            if (existing) {
                const oldLayer = (existing.get('layer') === 1) ? 1 : 0;
                if (oldLayer !== li) this.#moveIconFeature(existing, oldLayer, li);

                if (lonLat || xy3857) existing.setGeometry(new ol.geom.Point(xy3857 || this.to3857(lonLat)));
                if (html != null) existing.set('html', html);
                if (fa != null) { existing.set('fa', fa); this.styleCache.clear(); }
                if (anim != null) existing.set('anim', anim);
                if (style instanceof ol.style.Style) existing.setStyle(style);
                existing.set('layer', li);
                return existing;
            }
        }

        const xy = xy3857 || this.to3857(lonLat || this.getCenter());
        const f = new ol.Feature({ geometry: new ol.geom.Point(xy) });
        if (id != null) { f.setId(id); this._iconById.set(id, f); }
        if (html != null) f.set('html', html);
        if (fa != null) f.set('fa', fa);
        if (anim != null) f.set('anim', anim);
        if (style instanceof ol.style.Style) f.setStyle(style);
        f.set('layer', li);

        (li === 0 ? this.iconSourceRaw0 : this.iconSourceRaw1).addFeature(f);
        return f;
    }

    clearIcons() {
        this.iconSourceRaw0.clear(); this.iconSourceRaw1.clear();
        this._iconById.clear();
    }

    updateIconsFrom(list = [], opts = {}) {
        const norm = [];
        for (const m of list) {
            if (m.Kill === true) {
                const id = m.id ?? m.Id;
                if (id != null) {
                    const existing = this._iconById.get(id);
                    if (existing) {
                        const li = (existing.get('layer') === 1) ? 1 : 0;
                        (li === 0 ? this.iconSourceRaw0 : this.iconSourceRaw1).removeFeature(existing);
                        this._iconById.delete(id);
                    }
                }
            } else {
                norm.push({
                    id: m.id ?? m.Id,
                    lon: m.lon ?? m.Lon,
                    lat: m.lat ?? m.Lat,
                    html: m.html ?? m.Html,
                    fa: m.fa ?? m.Fa,
                    anim: m.anim ?? m.Anim,
                    layer: m.layer ?? m.Layer
                });
            }
        }
        this.updateIcons(norm, opts);
        return this;
    }

    updateIcons(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id;
            if (id == null) continue;

            const nextLayer = (u.layer === 1) ? 1 : 0;

            let f = this._iconById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addIcon({ id, lonLat: [u.lon, u.lat], html: u.html, fa: u.fa, layer: nextLayer });
            }

            const oldLayer = (f.get('layer') === 1) ? 1 : 0;
            if (nextLayer !== oldLayer) this.#moveIconFeature(f, oldLayer, nextLayer);

            if (u.lon != null && u.lat != null) f.setGeometry(new ol.geom.Point(this.to3857([u.lon, u.lat])));
            if (u.html != null) f.set('html', u.html);
            if (u.fa != null) { f.set('fa', u.fa); this.styleCache.clear(); }
            if (u.anim != null) f.set('anim', u.anim);

            f.set('layer', nextLayer);
        }
        this.iconSourceRaw0.changed();
        this.iconSourceRaw1.changed();
    }

    #moveIconFeature(feature, fromLayer, toLayer) {
        const from = (fromLayer === 1) ? this.iconSourceRaw1 : this.iconSourceRaw0;
        const to = (toLayer === 1) ? this.iconSourceRaw1 : this.iconSourceRaw0;
        if (from === to) return;
        from.removeFeature(feature);
        to.addFeature(feature);
    }

    // ---- polygons
    addPolygonsFrom(list = []) {
        for (const p of list) {
            this.addPolygon({
                id: p.id ?? p.Id,
                coordsLonLat: p.coords ?? p.Coords,
                color: p.color ?? p.Color,
                label: p.label ?? p.Label,
                html: p.html ?? p.Html,
                strokeColor: p.strokeColor ?? p.StrokeColor,
                strokeWidth: p.strokeWidth ?? p.StrokeWidth,
                outlineColor: p.outlineColor ?? p.OutlineColor,
                outlineWidth: p.outlineWidth ?? p.OutlineWidth,
                anim: p.anim ?? p.Anim,
                layer: p.layer ?? p.Layer ?? 0
            });
        }
        return this;
    }

    addPolygon({ id, coordsLonLat = [], coords3857, color, label, html = '', strokeColor, strokeWidth, outlineColor, outlineWidth, anim, layer = 0 } = {}) {
        const li = (layer === 1) ? 1 : 0;

        if (id != null) {
            const existing = this._polygonById.get(id);
            if (existing) {
                const oldLayer = (existing.get('layer') === 1) ? 1 : 0;
                if (oldLayer !== li) this.#movePolygonFeature(existing, oldLayer, li);

                if (coordsLonLat?.length || coords3857?.length) {
                    const ring = (coords3857 && coords3857.length)
                        ? this.#ensureClosedRing(coords3857)
                        : this.#ensureClosedRing(coordsLonLat.map(ll => this.to3857(ll)));
                    existing.setGeometry(new ol.geom.Polygon([ring]));
                }
                if (html != null) existing.set('html', html);
                if (color != null) existing.set('color', color);
                if (label != null) existing.set('label', label);
                if (strokeColor != null) existing.set('strokeColor', strokeColor);
                if (strokeWidth != null) existing.set('strokeWidth', strokeWidth);
                if (outlineColor != null) existing.set('outlineColor', outlineColor);
                if (outlineWidth != null) existing.set('outlineWidth', outlineWidth);
                if (anim != null) existing.set('anim', anim);
                existing.set('layer', li);
                return existing;
            }
        }

        const ring = (coords3857 && coords3857.length) ? coords3857 : coordsLonLat.map(ll => this.to3857(ll));
        const geom = new ol.geom.Polygon([this.#ensureClosedRing(ring)]);
        const f = new ol.Feature({ geometry: geom });
        if (id != null) { f.setId(id); this._polygonById.set(id, f); }
        if (color != null) f.set('color', color);
        if (label != null) f.set('label', label);
        if (html != null) f.set('html', html);
        if (strokeColor != null) f.set('strokeColor', strokeColor);
        if (strokeWidth != null) f.set('strokeWidth', strokeWidth);
        if (outlineColor != null) f.set('outlineColor', outlineColor);
        if (outlineWidth != null) f.set('outlineWidth', outlineWidth);
        if (anim != null) f.set('anim', anim);
        f.set('layer', li);

        (li === 0 ? this.polygonSource0 : this.polygonSource1).addFeature(f);
        return f;
    }

    clearPolygons() {
        this.polygonSource0.clear(); this.polygonSource1.clear();
        this._polygonById.clear();
    }

    updatePolygonsFrom(list = [], opts = {}) {
        const norm = [];
        for (const p of list) {
            if (p.Kill === true) {
                const id = p.id ?? p.Id;
                if (id != null) {
                    const existing = this._polygonById.get(id);
                    if (existing) {
                        const li = (existing.get('layer') === 1) ? 1 : 0;
                        (li === 0 ? this.polygonSource0 : this.polygonSource1).removeFeature(existing);
                        this._polygonById.delete(id);
                    }
                }
            } else {
                norm.push({
                    id: p.id ?? p.Id,
                    coords: p.coords ?? p.Coords,
                    color: p.color ?? p.Color,
                    label: p.label ?? p.Label,
                    html: p.html ?? p.Html,
                    strokeColor: p.strokeColor ?? p.StrokeColor,
                    strokeWidth: p.strokeWidth ?? p.StrokeWidth,
                    outlineColor: p.outlineColor ?? p.OutlineColor,
                    outlineWidth: p.outlineWidth ?? p.OutlineWidth,
                    anim: p.anim ?? p.Anim,
                    layer: p.layer ?? p.Layer
                });
            }
        }
        this.updatePolygons(norm, opts);
        return this;
    }

    updatePolygons(updates = [], { upsert = false } = {}) {
        for (const u of updates) {
            const id = u.id ?? u.Id;
            if (id == null) continue;

            const nextLayer = (u.layer === 1) ? 1 : 0;

            let f = this._polygonById.get(id);
            if (!f) {
                if (!upsert) continue;
                f = this.addPolygon({ id, coordsLonLat: u.coords, color: u.color, label: u.label, html: u.html, layer: nextLayer });
            }

            const oldLayer = (f.get('layer') === 1) ? 1 : 0;
            if (nextLayer !== oldLayer) this.#movePolygonFeature(f, oldLayer, nextLayer);

            if (u.coords?.length) {
                const ring = this.#ensureClosedRing(u.coords.map(ll => this.to3857(ll)));
                f.setGeometry(new ol.geom.Polygon([ring]));
            }
            if (u.html != null) f.set('html', u.html);
            if (u.color != null) f.set('color', u.color);
            if (u.label != null) f.set('label', u.label);
            if (u.strokeColor != null) f.set('strokeColor', u.strokeColor);
            if (u.strokeWidth != null) f.set('strokeWidth', u.strokeWidth);
            if (u.outlineColor != null) f.set('outlineColor', u.outlineColor);
            if (u.outlineWidth != null) f.set('outlineWidth', u.outlineWidth);
            if (u.anim != null) f.set('anim', u.anim);

            f.set('layer', nextLayer);
        }
        this.polygonSource0.changed();
        this.polygonSource1.changed();
    }

    #movePolygonFeature(feature, fromLayer, toLayer) {
        const from = (fromLayer === 1) ? this.polygonSource1 : this.polygonSource0;
        const to = (toLayer === 1) ? this.polygonSource1 : this.polygonSource0;
        if (from === to) return;
        from.removeFeature(feature);
        to.addFeature(feature);
    }

    // ---- popup
    setPopupEnabled(enabled) {
        this.popupEnabled = !!enabled;
        if (!enabled) this.popupOverlay?.setPosition(undefined);
    }
    setPopupFormatter(fn) { this.popupFormatter = (typeof fn === 'function') ? fn : null; }

    setPopupMultiple(flag) { this.popupMultiple = !!flag; }
    closeAllPopups() {
        if (!this.popupMultiple) {
            this.popupOverlay?.setPosition(undefined);
            return;
        }
        for (const ov of this.popupOverlays) this.map.removeOverlay(ov);
        this.popupOverlays = [];
    }

    #initPopup(enable) {
        if (!this.popupMultiple) {
            const existing = document.getElementById('popup');
            this.popupEl = existing || this.#createPopupElement();
            this.popupOverlay = new ol.Overlay({ element: this.popupEl, autoPan: true, autoPanAnimation: { duration: 200 } });
            this.map.addOverlay(this.popupOverlay);
            this.popupCloser = this.popupEl.querySelector('[data-popup-close]');
            this.popupContent = this.popupEl.querySelector('[data-popup-content]');
            this.popupCloser.onclick = () => { this.popupOverlay.setPosition(undefined); };
        }

        this.setPopupEnabled(!!enable);

        this.map.on('click', (e) => {
            if (!this.popupEnabled) return;

            const hit = this.map.forEachFeatureAtPixel(e.pixel, (f) => f, { hitTolerance: 6 });
            if (!hit) {
                this.closeAllPopups();
                this.popupOverlay?.setPosition(undefined);
                return;
            }

            // cluster click => zoom
            const clustered = hit.get && hit.get('features');
            if (Array.isArray(clustered) && clustered.length > 1) {
                const extent = ol.extent.createEmpty();
                clustered.forEach(f => ol.extent.extend(extent, f.getGeometry().getExtent()));
                this.map.getView().fit(extent, { duration: 250, padding: [40, 40, 40, 40], maxZoom: 18 });
                return;
            }

            if (!this.popupMultiple) this.closeAllPopups();

            let html = null;
            if (this.popupFormatter) html = this.popupFormatter(hit, e.coordinate, e);
            if (html == null) html = hit.get('html') || '<b>No content</b>';
            if (!html) {
                if (!this.popupMultiple) this.popupOverlay?.setPosition(undefined);
                return;
            }

            const geom = hit.getGeometry();
            const pos = geom instanceof ol.geom.Point ? geom.getCoordinates() : geom.getClosestPoint(e.coordinate);
            const id = hit.getId() || '';

            if (this.popupMultiple) {
                const el = this.#createPopupElement();
                const overlay = new ol.Overlay({ element: el, autoPan: true, autoPanAnimation: { duration: 200 } });
                const closer = el.querySelector('[data-popup-close]');
                const content = el.querySelector('[data-popup-content]');
                content.innerHTML = html;
                overlay.htmlid = id;
                closer.onclick = () => {
                    this.map.removeOverlay(overlay);
                    this.popupOverlays = this.popupOverlays.filter(o => o !== overlay);
                };
                this.map.addOverlay(overlay);
                overlay.setPosition(pos);
                this.popupOverlays.push(overlay);
            } else {
                this.popupContent.htmlid = id;
                this.popupContent.innerHTML = html;
                this.popupOverlay.setPosition(pos);
            }
        });
    }

    #createPopupElement() {
        const el = document.createElement('div');
        el.className = 'ol-popup card shadow border-0';
        el.style.cssText = 'position:absolute; min-width:240px; pointer-events:auto;';
        el.innerHTML = `
      <div class="card-body p-3 position-relative">
        <button type="button" class="btn-close position-absolute" style="right:.5rem; top:.5rem;" aria-label="Close" data-popup-close></button>
        <div class="card-text" data-popup-content></div>
      </div>`;
        if (!this.popupMultiple) document.body.appendChild(el);
        return el;
    }

    // ---- overlay ui
    #initDefaultOverlays({ zoomKmPresets, overlayConfig = {}, circle = {} } = {}) {
        const titlePlace = overlayConfig.titlePlace || { edge: 'top', align: 'start' };
        const navPlace = overlayConfig.navPlace || { edge: 'left', align: 'start' };

        const nav = this.overlay.createNavControls({
            kmPresets: zoomKmPresets,
            onHome: () => this.goHome(),
            onZoomToKm: (km) => this.zoomToDistanceKm(km),
            onZoomIn: () => this.zoomIn(),
            onZoomOut: () => this.zoomOut(),
            layout: overlayConfig.navLayout || 'horizontal'
        });

        this.overlay.add(navPlace.edge, nav, navPlace.align);

        if (overlayConfig.title) {
            const titleEl = this.overlay.createHtml(`<div class="fw-semibold px-3 py-2 bg-light border rounded shadow-sm">${overlayConfig.title}</div>`);
            this.overlay.add(titlePlace.edge, titleEl, titlePlace.align);
        }

        if (overlayConfig.htmlTopStart) this.overlay.add('top', this.overlay.createHtml(overlayConfig.htmlTopStart), 'start');
        if (overlayConfig.htmlTopEnd) this.overlay.add('top', this.overlay.createHtml(overlayConfig.htmlTopEnd), 'end');
        if (overlayConfig.htmlBottomStart) this.overlay.add('bottom', this.overlay.createHtml(overlayConfig.htmlBottomStart), 'start');
        if (overlayConfig.htmlBottomEnd) this.overlay.add('bottom', this.overlay.createHtml(overlayConfig.htmlBottomEnd), 'end');
        if (overlayConfig.htmlLeftStart) this.overlay.add('left', this.overlay.createHtml(overlayConfig.htmlLeftStart), 'start');
        if (overlayConfig.htmlLeftEnd) this.overlay.add('left', this.overlay.createHtml(overlayConfig.htmlLeftEnd), 'end');
        if (overlayConfig.htmlRightStart) this.overlay.add('right', this.overlay.createHtml(overlayConfig.htmlRightStart), 'start');
        if (overlayConfig.htmlRightEnd) this.overlay.add('right', this.overlay.createHtml(overlayConfig.htmlRightEnd), 'end');

        // optional circle filter widget
        if (circle?.filterWidget?.enabled) {
            const place = circle.filterWidget.place || { edge: 'top', align: 'end' };
            const minBound = (typeof circle.filterWidget.min === 'number') ? circle.filterWidget.min : (this.MIN_R ?? 0);
            const maxBound = (typeof circle.filterWidget.max === 'number') ? circle.filterWidget.max : (this.MAX_R ?? 1e9);
            const circ = this.overlay.createCircleFilter({
                defActive: circle.filterWidget.defActive ?? true,
                min: minBound,
                max: maxBound,
                onApply: ({ enabled, min, max }) => {
                    if (!enabled) { this.setCircleFilter(() => true); return; }
                    const mi = Math.max(minBound, Number(min) || minBound);
                    const ma = Math.min(maxBound, Number(max) || maxBound);
                    this.setCircleFilter((f) => {
                        const r = +(f?.get?.('radius') ?? 0);
                        return r >= mi && r <= ma;
                    });
                }
            });
            this.overlay.add(place.edge, circ, place.align);
        }
    }

    // ---- clustering click behavior (extra: cursor)
    #initClusterClickZoom() {
        this.map.on('pointermove', (e) => {
            const hit = this.map.hasFeatureAtPixel(e.pixel, { hitTolerance: 6 });
            this.map.getTargetElement().style.cursor = hit ? 'pointer' : '';
        });
    }

    // ---- styles
    #circleStyle(feature, layerIndex = 0) {
        const clustered = feature.get && feature.get('features');
        if (Array.isArray(clustered)) {
            const count = clustered.length;
            if (count > 1) return this.#circleClusterBadgeStyle(count, layerIndex);
            const single = clustered[0];
            return single ? this.#circleStyleSingle(single) : null;
        }
        return this.#circleStyleSingle(feature);
    }

    #circleClusterBadgeStyle(count, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        const b = (this._circleClusterCfg[li] && this._circleClusterCfg[li].badge) ? this._circleClusterCfg[li].badge : {};
        const r = Math.max(8, +(b.radius ?? 14));
        const fill = b.fill || 'rgba(30,144,255,0.65)';
        const stroke = b.stroke || 'rgba(255,255,255,0.85)';
        const sw = Math.max(0, +(b.strokeWidth ?? 2));
        const font = b.font || '800 12px system-ui, sans-serif';
        const textFill = b.textFill || '#fff';
        const outlined = !!b.outlined;
        const textStrokeCfg = b.textStroke || { color: 'rgba(0,0,0,0.55)', width: 3 };

        const key = `ccluster|L${li}|${count}|${r}|${fill}|${stroke}|${sw}|${font}|${textFill}|${outlined}|${textStrokeCfg.color}|${textStrokeCfg.width}`;
        if (this.styleCache.has(key)) return this.styleCache.get(key);

        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: r,
                fill: new ol.style.Fill({ color: fill }),
                stroke: new ol.style.Stroke({ color: stroke, width: sw })
            }),
            text: new ol.style.Text({
                text: String(count),
                font,
                fill: new ol.style.Fill({ color: textFill }),
                stroke: (outlined && textStrokeCfg.width > 0) ? new ol.style.Stroke({ color: textStrokeCfg.color || '#000', width: textStrokeCfg.width }) : undefined,
                textAlign: 'center',
                textBaseline: 'middle'
            })
        });

        this.styleCache.set(key, style);
        return style;
    }

    #circleStyleSingle(feature) {
        const cfg = this._styleDefaults.circle || {};
        const strokeCfg = this.#mergeDeep(cfg.stroke || {}, { color: feature.get('strokeColor'), width: feature.get('strokeWidth') });
        const outlineCfg = this.#mergeDeep(cfg.outline || {}, { color: feature.get('outlineColor'), width: feature.get('outlineWidth') });

        const baseFill = feature.get('color') || cfg.fill?.colorFallback || 'rgba(0,128,255,0.20)';
        const label = feature.get('label') || '';

        const anim = (this._animationsEnabled ? (feature.get('anim') || null) : null);
        const { fillColor, strokeColor, radiusMul } = this.#animComputeCircle(anim, baseFill, strokeCfg.color);

        const res = this.map.getView().getResolution() || 1;
        const storedR = +(feature.get('radius') ?? this.MIN_R);
        const innerR = Math.max(0.1, (this._keepCircleRadiusPixels ? (storedR * res) : storedR) * (radiusMul || 1));

        const center = feature.getGeometry()?.getCoordinates?.();
        if (!center) return null;

        const sw = Math.max(0, +(strokeCfg.width ?? 8)); // px
        const ow = (outlineCfg && outlineCfg.enabled) ? Math.max(0, +(outlineCfg.width ?? (sw))) : 0; // px

        const cacheable = !anim;
        const key = cacheable ? `circle|${fillColor}|${strokeColor}|${sw}|${outlineCfg.enabled}|${outlineCfg.color}|${ow}|${label}|${JSON.stringify(cfg.label || {})}|${this._keepCircleRadiusPixels}` : null;
        if (cacheable && this.styleCache.has(key)) return this.styleCache.get(key);

        const labelCfg = this.#mergeDeep(cfg.label || {}, feature.get('labelCfg') || {});
        const textStyle = this.#buildTextStyle(labelCfg, label);

        const styles = [];
        styles.push(new ol.style.Style({
            geometry: new ol.geom.Circle(center, innerR),
            fill: new ol.style.Fill({ color: fillColor }),
            text: textStyle || undefined
        }));

        if (outlineCfg && outlineCfg.enabled && ow > 0) {
            styles.push(new ol.style.Style({
                geometry: new ol.geom.Circle(center, innerR),
                stroke: new ol.style.Stroke({ color: outlineCfg.color || 'rgba(0,0,0,0.25)', width: ow })
            }));
        }

        if (sw > 0) {
            styles.push(new ol.style.Style({
                geometry: new ol.geom.Circle(center, innerR + (sw / 2) * res),
                stroke: new ol.style.Stroke({ color: strokeColor || 'rgba(255,255,255,0.5)', width: sw })
            }));
        }

        const out = (styles.length === 1) ? styles[0] : styles;
        if (cacheable) this.styleCache.set(key, out);
        return out;
    }

    #iconStyle(feature, layerIndex = 0) {
        const clustered = feature.get && feature.get('features');
        if (Array.isArray(clustered)) {
            const count = clustered.length;
            if (count > 1) return this.#iconClusterBadgeStyle(count, layerIndex);
            const single = clustered[0];
            return single ? this.#iconStyleSingle(single) : null;
        }
        return this.#iconStyleSingle(feature);
    }

    #iconClusterBadgeStyle(count, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        const b = (this._iconClusterCfg[li] && this._iconClusterCfg[li].badge) ? this._iconClusterCfg[li].badge : {};
        const r = Math.max(8, +(b.radius ?? 15));
        const fill = b.fill || 'rgba(0,0,0,0.65)';
        const stroke = b.stroke || 'rgba(255,255,255,0.85)';
        const sw = Math.max(0, +(b.strokeWidth ?? 2));
        const font = b.font || '800 12px system-ui, sans-serif';
        const textFill = b.textFill || '#fff';
        const outlined = !!b.outlined;
        const textStrokeCfg = b.textStroke || { color: 'rgba(0,0,0,0.55)', width: 3 };

        const key = `icluster|L${li}|${count}|${r}|${fill}|${stroke}|${sw}|${font}|${textFill}|${outlined}|${textStrokeCfg.color}|${textStrokeCfg.width}`;
        if (this.styleCache.has(key)) return this.styleCache.get(key);

        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: r,
                fill: new ol.style.Fill({ color: fill }),
                stroke: new ol.style.Stroke({ color: stroke, width: sw })
            }),
            text: new ol.style.Text({
                text: String(count),
                font,
                fill: new ol.style.Fill({ color: textFill }),
                stroke: (outlined && textStrokeCfg.width > 0) ? new ol.style.Stroke({ color: textStrokeCfg.color || '#000', width: textStrokeCfg.width }) : undefined,
                textAlign: 'center',
                textBaseline: 'middle'
            })
        });

        this.styleCache.set(key, style);
        return style;
    }

    #iconStyleSingle(feature) {
        const custom = feature.getStyle && feature.getStyle();
        if (custom) return custom;

        const fa = feature.get('fa') || {};
        const anim = (this._animationsEnabled ? (feature.get('anim') || null) : null);

        if (typeof fa.image === 'string' && /^https?:\/\//.test(fa.image)) {
            const z = fa.zIndex ?? 1000;
            const s = (fa.scale ?? 1) * (anim?.type === 'scale' ? (1 + 0.12 * this.#osc(0.9)) : 1);
            const key = `img|${fa.image}|${s}|${z}`;
            if (this.styleCache.has(key)) return this.styleCache.get(key);
            const st = new ol.style.Style({
                image: new ol.style.Icon({ src: fa.image, scale: s, anchor: [0.5, 1], anchorXUnits: 'fraction', anchorYUnits: 'fraction' }),
                zIndex: z
            });
            this.styleCache.set(key, st);
            return st;
        }

        const base = this.#mergeDeep(this._styleDefaults.icon.fa || {}, fa || {});
        const glyph = base.glyph ?? '\uf041';
        const size = base.size ?? 26;
        const weight = base.weight ?? 900;
        const family = base.family || '"Font Awesome 6 Free"';
        const fill = base.fill || '#e53227';
        const stroke = base.stroke || '#fff';
        const strokeWidth = base.strokeWidth ?? 5;
        const textAlign = base.textAlign || 'center';
        const textBaseline = base.textBaseline || 'bottom';
        const zIndex = base.zIndex ?? 1000;

        const wob = (anim?.type === 'wobble') ? (Math.sin(this.#t() * 2.5) * 0.25) : 0;
        const bob = (anim?.type === 'bob') ? (Math.sin(this.#t() * 2.0) * 6.0) : 0;
        const scale = (anim?.type === 'scale') ? (1 + 0.12 * this.#osc(0.9)) : 1;

        const key = `fa|${glyph}|${size}|${weight}|${family}|${fill}|${stroke}|${strokeWidth}|${textAlign}|${textBaseline}|${zIndex}|${wob.toFixed(3)}|${bob.toFixed(1)}|${scale.toFixed(3)}`;
        if (!anim && this.styleCache.has(key)) return this.styleCache.get(key);

        const st = new ol.style.Style({
            text: new ol.style.Text({
                text: glyph,
                font: `${weight} ${size}px ${family}`,
                fill: new ol.style.Fill({ color: fill }),
                stroke: new ol.style.Stroke({ color: stroke, width: strokeWidth }),
                textAlign,
                textBaseline,
                offsetY: bob,
                rotation: wob,
                scale
            }),
            zIndex
        });

        if (!anim) this.styleCache.set(key, st);
        return st;
    }

    #polygonStyle(feature, layerIndex = 0) {
        const clustered = feature.get && feature.get('features');
        if (Array.isArray(clustered)) {
            const count = clustered.length;
            if (count > 1) return this.#polygonClusterBadgeStyle(count, layerIndex);
            const single = clustered[0];
            return single ? this.#polygonStyleSingle(single) : null;
        }
        return this.#polygonStyleSingle(feature);
    }

    #polygonClusterBadgeStyle(count, layerIndex = 0) {
        const li = (layerIndex === 1) ? 1 : 0;
        const b = (this._polygonClusterCfg[li] && this._polygonClusterCfg[li].badge) ? this._polygonClusterCfg[li].badge : {};
        const r = Math.max(8, +(b.radius ?? 15));
        const fill = b.fill || 'rgba(0,0,0,0.55)';
        const stroke = b.stroke || 'rgba(255,255,255,0.85)';
        const sw = Math.max(0, +(b.strokeWidth ?? 2));
        const font = b.font || '900 12px system-ui, sans-serif';
        const textFill = b.textFill || '#fff';
        const outlined = !!b.outlined;
        const textStrokeCfg = b.textStroke || { color: 'rgba(0,0,0,0.65)', width: 3 };

        const key = `pcluster|L${li}|${count}|${r}|${fill}|${stroke}|${sw}|${font}|${textFill}|${outlined}|${textStrokeCfg.color}|${textStrokeCfg.width}`;
        if (this.styleCache.has(key)) return this.styleCache.get(key);

        const style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: r,
                fill: new ol.style.Fill({ color: fill }),
                stroke: new ol.style.Stroke({ color: stroke, width: sw })
            }),
            text: new ol.style.Text({
                text: String(count),
                font,
                fill: new ol.style.Fill({ color: textFill }),
                stroke: (outlined && textStrokeCfg.width > 0) ? new ol.style.Stroke({ color: textStrokeCfg.color || '#000', width: textStrokeCfg.width }) : undefined,
                textAlign: 'center',
                textBaseline: 'middle'
            })
        });

        this.styleCache.set(key, style);
        return style;
    }

    #polygonStyleSingle(feature) {
        const cfg = this._styleDefaults.polygon || {};
        const baseFill = feature.get('color') || cfg.fill?.colorFallback || 'rgba(255,165,0,0.25)';
        const label = feature.get('label') || '';

        const strokeCfg = this.#mergeDeep(cfg.stroke || {}, { color: feature.get('strokeColor'), width: feature.get('strokeWidth') });
        const outlineCfg = this.#mergeDeep(cfg.outline || {}, { color: feature.get('outlineColor'), width: feature.get('outlineWidth') });

        const anim = (this._animationsEnabled ? (feature.get('anim') || null) : null);
        const fillColor = (anim?.type === 'blink') ? this.#blinkColor(baseFill) : baseFill;

        const key = (!anim) ? `poly|${fillColor}|${strokeCfg.color}|${strokeCfg.width}|${outlineCfg.enabled}|${outlineCfg.color}|${outlineCfg.width}|${label}` : null;
        if (!anim && this.styleCache.has(key)) return this.styleCache.get(key);

        const labelCfg = this.#mergeDeep(cfg.label || {}, feature.get('labelCfg') || {});
        const textStyle = label ? this.#buildTextStyle(labelCfg, label) : undefined;

        const styles = [];
        styles.push(new ol.style.Style({
            fill: new ol.style.Fill({ color: fillColor }),
            stroke: new ol.style.Stroke({ color: strokeCfg.color || 'rgba(0,0,0,0.6)', width: Math.max(0, +(strokeCfg.width ?? 2)) }),
            text: textStyle || undefined
        }));

        if (outlineCfg && outlineCfg.enabled && (outlineCfg.width ?? 0) > 0) {
            styles.push(new ol.style.Style({
                stroke: new ol.style.Stroke({ color: outlineCfg.color || 'rgba(255,255,255,0.35)', width: Math.max(0, +outlineCfg.width) })
            }));
        }

        const out = (styles.length === 1) ? styles[0] : styles;
        if (!anim) this.styleCache.set(key, out);
        return out;
    }

    // ---- text style builder (label)
    #buildTextStyle(labelCfg = {}, text = '') {
        if (!text) return null;

        const cfg = this.#mergeDeep({
            font: 'bold 18px system-ui, sans-serif',
            color: '#fff',
            outlined: false,
            outlineColor: 'rgba(0,0,0,0.55)',
            outlineWidth: 4,
            background: { enabled: false, fill: 'rgba(0,0,0,0.35)', padding: [4, 6, 4, 6], borderRadius: 6, stroke: null }
        }, labelCfg || {});

        const bg = cfg.background || {};
        const bgEnabled = !!bg.enabled;

        const textOpts = {
            text,
            font: cfg.font,
            fill: new ol.style.Fill({ color: cfg.color }),
            stroke: cfg.outlined
                ? new ol.style.Stroke({ color: cfg.outlineColor, width: cfg.outlineWidth })
                : undefined,
            textAlign: 'center',
            textBaseline: 'middle'
        };

        if (bgEnabled) {
            textOpts.padding = Array.isArray(bg.padding) ? bg.padding : [4, 6, 4, 6];
            textOpts.backgroundFill = new ol.style.Fill({ color: bg.fill || 'rgba(255,255,255,0.75)' });
            if (bg.stroke) {
                textOpts.backgroundStroke = new ol.style.Stroke({ color: bg.stroke, width: 1 });
            }
        }

        return new ol.style.Text(textOpts);
    }

    // ---- animations helpers
    #t() { return (performance.now() - this._t0) / 1000.0; }
    #osc(freq = 1) { return (Math.sin(this.#t() * Math.PI * 2 * freq) + 1) / 2; }
    #blinkColor(rgba) {
        const a = 0.35 + 0.65 * this.#osc(1.2);
        return this.#withAlpha(rgba, a);
    }
    #withAlpha(rgba, a) {
        if (typeof rgba !== 'string') return rgba;
        const m = rgba.match(/rgba?\(([^)]+)\)/i);
        if (!m) return rgba;
        const parts = m[1].split(',').map(s => s.trim());
        const r = parts[0], g = parts[1], b = parts[2];
        return `rgba(${r},${g},${b},${a})`;
    }
    #animComputeCircle(anim, fill, stroke) {
        if (!anim || !anim.type) return { fillColor: fill, strokeColor: stroke, radiusMul: 1 };
        if (anim.type === 'pulse') {
            const mul = 0.88 + 0.24 * this.#osc(anim.freq ?? 0.9);
            return { fillColor: fill, strokeColor: stroke, radiusMul: mul };
        }
        if (anim.type === 'blink') {
            return { fillColor: this.#blinkColor(fill), strokeColor: stroke, radiusMul: 1 };
        }
        if (anim.type === 'scale') {
            const mul = 0.92 + 0.20 * this.#osc(anim.freq ?? 1.2);
            return { fillColor: fill, strokeColor: stroke, radiusMul: mul };
        }
        return { fillColor: fill, strokeColor: stroke, radiusMul: 1 };
    }

    #startAnimLoopIfNeeded() {
        if (this._animTimer) { clearInterval(this._animTimer); this._animTimer = null; }
        if (!this._animationsEnabled) return;
        this._animTimer = setInterval(() => {
            this.circleLayer0.changed(); this.circleLayer1.changed();
            this.iconLayer0.changed(); this.iconLayer1.changed();
            this.polygonLayer0.changed(); this.polygonLayer1.changed();
            this.map.render();
        }, Math.round(1000 / this._animFps));
    }

    // ---- utils
    #radiusToPercent(r) { return Math.round(((r - this.MIN_R) / (this.MAX_R - this.MIN_R)) * 100); }
    #clampRadius(r) { return this.clamp(r, this.MIN_R, this.MAX_R); }
    #ensureClosedRing(ring) {
        if (!ring || ring.length < 3) return ring;
        const a = ring[0], b = ring[ring.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) ring = [...ring, a];
        return ring;
    }

    #mergeDeep(target, src) {
        const out = Array.isArray(target) ? [...target] : { ...(target || {}) };
        if (!src || typeof src !== 'object') return out;
        for (const [k, v] of Object.entries(src)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                out[k] = this.#mergeDeep(out[k] || {}, v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }

    #unwrapSingleClusterFeature(feature) {
        const clustered = feature && feature.get && feature.get('features');
        if (Array.isArray(clustered) && clustered.length === 1) return clustered[0];
        return feature;
    }

    #normalizeClusterCfg(userCfg, defaults) {
        // Returns [cfg0, cfg1]
        const def = this.#mergeDeep({}, defaults || {});
        const def2 = this.#mergeDeep({}, defaults || {});

        if (!userCfg) return [def, def2];

        // Support:
        //  - { enabled, distance, ... } => apply to both
        //  - { layers: [cfg0, cfg1] }
        //  - { layer0: cfg0, layer1: cfg1 }
        if (userCfg.layers && Array.isArray(userCfg.layers)) {
            const c0 = this.#mergeDeep(def, userCfg.layers[0] || {});
            const c1 = this.#mergeDeep(def2, userCfg.layers[1] || userCfg.layers[0] || {});
            return [c0, c1];
        }
        if (userCfg.layer0 || userCfg.layer1) {
            const c0 = this.#mergeDeep(def, userCfg.layer0 || {});
            const c1 = this.#mergeDeep(def2, userCfg.layer1 || userCfg.layer0 || {});
            return [c0, c1];
        }

        // treat as single cfg applied to both
        const c0 = this.#mergeDeep(def, userCfg);
        const c1 = this.#mergeDeep(def2, userCfg);
        return [c0, c1];
    }

    destroy() {
        if (this._animTimer) clearInterval(this._animTimer);
        this.closeAllPopups();
        this.popupOverlay?.setPosition(undefined);
        if (!this.popupMultiple && this.popupEl?.parentElement) this.popupEl.parentElement.removeChild(this.popupEl);
        this.map.setTarget(null);
    }
}

// mountMap helper
export function mountMap(options = {}, hooks = {}, timerOptions = {}) {
    const ui = new OlCircleIconMap(options);

    // jumps
    if (Array.isArray(options.jumps) && options.jumps.length && ui.overlay) {
        const defaultJumpKm = options.defaultJumpKm ?? 20;
        const jumps = ui.overlay.createJumpButtons({
            items: options.jumps.map(it => ({ ...it, km: it.km ?? defaultJumpKm })),
            onJump: (it) => {
                ui.flyTo(it.lonlat, null);
                ui.zoomToDistanceKm(it.km ?? defaultJumpKm, it.lonlat);
            },
            layout: options.jumpsLayout || options.overlayConfig?.jumpsLayout || 'horizontal'
        });
        const place = options.jumpsPlace || { edge: 'top', align: 'end' };
        ui.overlay.add(place.edge, jumps, place.align);
    }

    // Backward compatible:
    // If options.icon.cluster.enabled is set, it configures layer 0 only here.
    // Layer 1 can be configured via ui.setIconClusteringEnabled(true/false, cfg, 1) after mount.
    if (options.icon?.cluster?.enabled != null) ui.setIconClusteringEnabled(!!options.icon.cluster.enabled, options.icon.cluster, 0);
    if (options.circle?.cluster?.enabled != null) ui.setCircleClusteringEnabled(!!options.circle.cluster.enabled, options.circle.cluster, 0);
    if (options.polygon?.cluster?.enabled != null) ui.setPolygonClusteringEnabled(!!options.polygon.cluster.enabled, options.polygon.cluster, 0);

    if (typeof hooks.onReady === 'function') Promise.resolve().then(() => hooks.onReady({ ui }));

    if (typeof hooks.onMapClick === 'function') {
        ui.getMap().on('click', (evt) => {
            hooks.onMapClick({ ui, coordinate3857: evt.coordinate, lonlat: ui.from3857(evt.coordinate), originalEvent: evt });
        });
    }

    if (timerOptions.intervalMs && typeof hooks.onTick === 'function') {
        const ms = Math.max(200, +timerOptions.intervalMs || 1000);
        ui._updateTimer = setInterval(() => {
            try { hooks.onTick({ ui }); } catch (e) { console.error(e); }
        }, ms);
    }

    return { ui };
}
