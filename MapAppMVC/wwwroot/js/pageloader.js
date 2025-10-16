// pageLoader.js (ES-Modul)
// Initialisiert NUR Container, die data-controller UND data-init haben.
// Jeder Container wird genau einmal initialisiert (data-init-done).

(async () => {
    const base = "/js/views/";

    const containers = Array.from(
        document.querySelectorAll('[data-controller][data-init]')
    ).filter(c => !c.dataset.initDone);

    for (const container of containers) {
        const controller = (container.dataset.controller || "").trim();
        const pageName = (container.dataset.init || "").trim();
        const scriptName = (container.dataset.script || "Index").trim();

        if (!controller || !pageName) continue;

        let loaded = false;

        try {
            loadCss(controller, scriptName);

            const mod = await import(`/js/views/${controller}/${scriptName}.js`);
            mod.default?.(container);
            loaded = true;
            break;
        } catch {
            // nächster Kandidat
        }

        if (!loaded) {
            console.error("Kein View-Modul gefunden:", { controller: controller, scriptName: scriptName });
        }

        // Markieren, damit wir bei späteren Läufen (AJAX o.ä.) nicht doppelt initialisieren
        container.dataset.initDone = "1";
    }
})();

function loadCss(controller, scriptName) {
    const href = `/css/views/${controller}/${scriptName}.css`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}