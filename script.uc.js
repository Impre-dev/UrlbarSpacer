// ==UserScript==
// @name           UrlbarSpacer
// @version        1.0.0
// @description    Spacer-widget plaçable via le mode personnalisation — margin-right réglable en live pour affiner le centrage de l'urlbar
// @author         Impre
// @include        main
// ==/UserScript==

(function () {
    'use strict';

    const WIDGET_ID = 'urlbarspacer-btn';
    const PANEL_ID  = 'urlbarspacer-panel';
    const PREF      = 'UrlbarSpacer.marginRight';
    const MIN = -100, MAX = 200;

    // Icône : double flèche ← → (spacer). Fill gris fixe — context-stroke refusé sur data: post-158.
    const ICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
        '<path d="M6 3 1 8l5 5zM10 3l5 5-5 5z" fill="#9a9a9a"/></svg>'
    );

    const getMargin = () => Services.prefs.getIntPref(PREF, 0);

    function applyMargin(node, v) {
        node.style.marginRight = v + 'px';
    }

    // Applique la valeur à toutes les instances du widget, toutes fenêtres
    function applyAll(v) {
        const wins = Services.wm.getEnumerator('navigator:browser');
        while (wins.hasMoreElements()) {
            const win = wins.getNext();
            if (win.closed) continue;
            const btn = win.document.getElementById(WIDGET_ID);
            if (btn) applyMargin(btn, v);
        }
    }

    /* ── Mini panneau (slider) ─────────────────────────────────────────── */

    function ensurePanel(doc) {
        let panel = doc.getElementById(PANEL_ID);
        if (panel) return panel;

        panel = doc.createXULElement('panel');
        panel.id = PANEL_ID;
        panel.setAttribute('type', 'arrow');
        panel.setAttribute('position', 'bottomcenter topleft');

        const box = doc.createXULElement('vbox');
        box.className = 'urlbarspacer-box';

        // Titre + valeur
        const head = doc.createXULElement('hbox');
        head.className = 'urlbarspacer-head';
        const title = doc.createXULElement('label');
        title.className = 'urlbarspacer-title';
        title.value = 'UrlbarSpacer';
        const value = doc.createXULElement('label');
        value.className = 'urlbarspacer-value';
        head.append(title, value);

        // Slider
        const slider = doc.createElementNS('http://www.w3.org/1999/xhtml', 'input');
        slider.type = 'range';
        slider.className = 'urlbarspacer-slider';
        slider.min = MIN;
        slider.max = MAX;
        slider.step = 1;

        // Reset
        const reset = doc.createXULElement('button');
        reset.className = 'urlbarspacer-reset';
        reset.setAttribute('label', 'Réinitialiser');

        box.append(head, slider, reset);
        panel.appendChild(box);

        // Live : applique pendant le drag — persiste au relâchement
        slider.addEventListener('input', () => {
            applyAll(Number(slider.value));
            value.value = slider.value + ' px';
        });
        slider.addEventListener('change', () => Services.prefs.setIntPref(PREF, Number(slider.value)));
        reset.addEventListener('command', () => {
            slider.value = 0;
            applyAll(0);
            value.value = '0 px';
            Services.prefs.setIntPref(PREF, 0);
        });

        doc.getElementById('mainPopupSet').appendChild(panel);
        panel._slider = slider;
        panel._value = value;
        return panel;
    }

    function togglePanel(btn) {
        const panel = ensurePanel(btn.ownerDocument);
        if (panel.state === 'open' || panel.state === 'showing') {
            panel.hidePopup();
            return;
        }
        panel._slider.value = getMargin();
        panel._value.value = getMargin() + ' px';
        panel.openPopup(btn);
    }

    /* ── Widget CustomizableUI ─────────────────────────────────────────── */

    function registerWidget() {
        try {
            CustomizableUI.createWidget({
                id: WIDGET_ID,
                type: 'custom',
                defaultArea: CustomizableUI.AREA_NAVBAR,
                onBuild: (doc) => {
                    const btn = doc.createXULElement('toolbarbutton');
                    btn.id = WIDGET_ID;
                    btn.className = 'toolbarbutton-1 chromeclass-toolbar-additional';
                    btn.setAttribute('label', 'UrlbarSpacer');
                    btn.setAttribute('tooltiptext', 'UrlbarSpacer — clic : régler le margin-right');
                    btn.setAttribute('image', ICON);
                    applyMargin(btn, getMargin());
                    btn.addEventListener('command', () => togglePanel(btn));
                    return btn;
                }
            });
            console.log('[UrlbarSpacer] widget registered');
        } catch (e) {
            // Déjà enregistré (re-init) — OK
            console.log('[UrlbarSpacer] widget already registered:', e.message);
        }
    }

    /* ── Init ──────────────────────────────────────────────────────────── */

    function init() {
        if (window.__urlbarSpacerInit) return;
        if (!window.gBrowser || !gBrowser.tabContainer) { setTimeout(init, 500); return; }
        window.__urlbarSpacerInit = true;

        registerWidget();

        // Pref observée → édition externe (about:config) appliquée en live.
        // (Un observer par fenêtre — applyAll est idempotent, aucun risque de boucle.)
        Services.prefs.addObserver(PREF, () => applyAll(getMargin()));

        console.log('[UrlbarSpacer] initialized — margin-right: ' + getMargin() + 'px');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') init();
    else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
