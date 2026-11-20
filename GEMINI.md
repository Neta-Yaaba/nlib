# Règles de documentation NLib

- La documentation JSDoc des classes et méthodes doit décrire uniquement ce que la classe et chaque méthode font techniquement (rôle, algorithmes, entrées, sorties, comportement).
- Ne pas documenter ce que la classe ou les méthodes ne font pas (ex. éviter les mentions négatives ou méta-architecturales du type « Ne contient aucune propriété d'état interne », « empreinte mémoire nulle », « Ne lève aucune exception (`throw`) », « sans état interne »).
- Chaque méthode doit contenir au minimum deux exemples `@example` dans sa JSDoc.

# Règles CSS NLib

- L'arborescence des fichiers CSS dans `packages/js/frontend/styles/base/` (et dans les styles dérivés) doit respecter exactement la même structure de dossiers que `packages/js/frontend/dom/` (ex. `dom/NWindow.js` → `styles/base/NWindow.css`, `dom/components/frames/NFrame.js` → `styles/base/components/frames/NFrame.css`, `dom/components/panels/NToast.js` → `styles/base/components/panels/NToast.css`).
- Ne jamais inventer de variables CSS : utiliser uniquement les variables `--n-*` définies dans `packages/js/frontend/styles/core/variables.css`.
- Utiliser uniquement des sélecteurs simples pour les règles de base (`.n-*`) et, dans les variantes de style, cibler avec `:where([data-n-style="..."] .n-*, .n-*[data-n-style="..."])` et `:where(:hover:not(...))` / `:where(:focus)` pour les états afin de conserver une spécificité nulle `(0, 0, 0)` et des sélecteurs uniformisés.
