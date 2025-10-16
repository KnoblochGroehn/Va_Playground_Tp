// shadowmap.js
export default class OlShadowTileCache {
    /**
     * @param {ol.Map} primaryMap 
     * @param {Object} [opts]
     * @param {number} [opts.factor=2]           // Flächenfaktor relativ zur sichtbaren Map (2 = doppelte Fläche)
     * @param {number} [opts.debounceMs=200]     // Debounce für moveend
     * @param {(layer:any)=>boolean} [opts.layerSelector] // optionaler Tile-Layer-Selektor
     */
    constructor(primaryMap, { factor = 2, debounceMs = 200, layerSelector } = {}) {
        if (!primaryMap) throw new Error('OlShadowTileCache: primaryMap fehlt');
        this.primary = primaryMap;
        this.factor = Math.max(1, factor);
        this.debounceMs = debounceMs;

        // Basistile-Layer wählen
        this.baseLayer = this.#selectBaseLayer(layerSelector);
        if (!this.baseLayer) throw new Error('OlShadowTileCache: Kein Tile-Basemap-Layer gefunden');

        // Unsichtbarer Container (nicht display:none!)
        this.container = document.createElement('div');
        this.container.className = 'ol-shadowmap-container';
        Object.assign(this.container.style, {
            position: 'fixed',
            left: '-10000px', top: '-10000px',
            width: '1px', height: '1px',
            opacity: '1',
            pointerEvents: 'none', zIndex: '100',
        });
        document.body.appendChild(this.container);

        // Quelle teilen -> HTTP/Tiles-Cache für beide Maps identisch
        const sharedSource = this.baseLayer.getSource();

        this.shadow = new ol.Map({
            target: this.container,
            view: new ol.View({
                center: this.primary.getView().getCenter(),
                zoom: this.primary.getView().getZoom(),
            }),
            layers: [
                new ol.layer.Tile({
                    source: sharedSource,
                    visible: true,
                    preload: 0,
                    transition: 0,
                    visible: true,
                    constrainResolution: true,
                    smoothResolutionConstraint: false

                }),
            ],
            controls: [],
            interactions: [],
            loadTilesWhileAnimating: true,
            loadTilesWhileInteracting: true,
        });

        const debounced = this.#debounce(() => this.update(), this.debounceMs);
        this._onMoveStart = () => this.update();   
        this._onMoveEnd   = () => debounced();     
        this.primary.on('movestart', this._onMoveStart);
        this.primary.on('moveend', this._onMoveEnd);

        this._onPrimaryFirstRender = () => {
            this.update();
            this.primary.un('rendercomplete', this._onPrimaryFirstRender);
            this._onPrimaryFirstRender = null;
        };
        this.primary.on('rendercomplete', this._onPrimaryFirstRender);

        this.update();
    }

    setFactor(f) {
        this.factor = Math.max(1, f || 1);
        this.update();
    }

    update() {
        const size = this.primary.getSize();
        if (!size || size[0] <= 0 || size[1] <= 0) return; // primary noch nicht bereit

        const w = Math.max(1, Math.round(size[0] * Math.sqrt(this.factor)));
        const h = Math.max(1, Math.round(size[1] * Math.sqrt(this.factor)));

        // Größe per CSS setzen, anschließend updateSize()
        this.container.style.width = `${w}px`;
        this.container.style.height = `${h}px`;
        this.shadow.updateSize();

        // View synchronisieren
        const view = this.primary.getView();
        const sView = this.shadow.getView();
        sView.setCenter(view.getCenter());
        sView.setZoom(view.getZoom());

        // Sofort rendern -> Kacheln werden angefordert
        this.shadow.renderSync();
    }

    destroy() {
        if (this._onMoveStart) this.primary.un('movestart', this._onMoveStart);
        if (this._onPrimaryFirstRender) this.primary.un('rendercomplete', this._onPrimaryFirstRender);
        this.shadow.setTarget(null);
        if (this.container?.parentElement) this.container.parentElement.removeChild(this.container);
    }

    #selectBaseLayer(layerSelector) {
        const layers = this.primary.getLayers().getArray();
        if (typeof layerSelector === 'function') return layers.find(layerSelector) || null;
        // bevorzuge OSM-Source, sonst ersten Tile-Layer
        return (
            layers.find(l => l instanceof ol.layer.Tile && l.getSource?.() instanceof ol.source.OSM) ||
            layers.find(l => l instanceof ol.layer.Tile) ||
            null
        );
    }

    #debounce(fn, ms) { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
}
