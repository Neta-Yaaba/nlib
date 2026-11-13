# NLib — Universal Cross-Platform Ecosystem

**NLib** est une architecture logicielle universelle, modulaire et multi-plateforme conçue selon les normes internationales. Chaque environnement intègre nativement la **classe de base universelle**, la **base de données SQL** (`sql.js` / `SQLite`) et le **pont de communication (Bridge)**.

---

## Structure des Packages (`packages/`)

L'écosystème est organisé en **3 grands piliers** :
1. **`js/`** : La base JavaScript (`frontend/` et `backend/`).
2. **`server/`** : Les serveurs (`php/`, `node/`).
3. **`os/`** : Les bibliothèques natives de chaque système d'exploitation, structurées selon les normes officielles de leurs IDE respectifs (Android Studio, DevEco Studio, Xcode SwiftPM, Visual Studio .NET, CMake/Meson GTK4) avec séparation `frontend/` (WebView) et `backend/` (Base, SQLite, APIs système).

```text
packages/
├── js/
│   ├── frontend/                        (Interface 100 % JS : classe de base, balises DOM en JS, CSS objet, NWindow, SQL, Bridge)
│   └── backend/                         (Logique JS sans interface : classe de base, traitements, SQL, Bridge)
│
├── server/
│   ├── php/                             (Serveur PHP : classe de base, SQL PDO/SQLite, Bridge RPC)
│   └── node/                            (Serveur Node : utilisé exactement comme PHP côté serveur, SQL, Bridge RPC)
│
└── os/
    ├── android/                         (Module Android Library - Android Studio / Gradle)
    │   └── src/main/
    │       ├── assets/                  (Accueil du code js/frontend)
    │       ├── res/                     (Ressources Android)
    │       └── java/com/nlib/
    │           ├── frontend/            (Classes Java WebView)
    │           └── backend/             (Classes Java Base, SQLite, APIs Android)
    │
    ├── harmonyos/                       (Bibliothèque Statique HAR - DevEco Studio / ArkTS)
    │   └── src/main/
    │       ├── resources/rawfile/       (Accueil du code js/frontend)
    │       └── ets/
    │           ├── frontend/            (Classes ArkTS ArkWeb)
    │           └── backend/             (Classes ArkTS Base, SQLite, APIs OHOS)
    │
    ├── ios/                             (Swift Package - Xcode / iOS)
    │   ├── Sources/NLib/
    │   │   ├── Resources/               (Accueil du code js/frontend)
    │   │   ├── frontend/                (Classes Swift WKWebView)
    │   │   └── backend/                 (Classes Swift Base, SQLite3, APIs iOS)
    │   └── Tests/NLibTests/
    │
    ├── macos/                           (Swift Package - Xcode / macOS)
    │   ├── Sources/NLib/
    │   │   ├── Resources/               (Accueil du code js/frontend)
    │   │   ├── frontend/                (Classes Swift WKWebView)
    │   │   └── backend/                 (Classes Swift Base, SQLite3, APIs macOS)
    │   └── Tests/NLibTests/
    │
    ├── windows/                         (Class Library .NET SDK - Visual Studio / C#)
    │   ├── assets/                      (Accueil du code js/frontend)
    │   ├── frontend/                    (Classes C# WebView2)
    │   └── backend/                     (Classes C# Base, SQLite, APIs Windows)
    │
    └── linux/                           (Bibliothèque C/C++ GTK4 - CMake / Meson)
        ├── data/                        (Ressources GTK4 & accueil du code js/frontend)
        ├── include/nlib/
        │   ├── frontend/                (Headers .h publics WebKitGTK/GTK4)
        │   └── backend/                 (Headers .h publics Base, SQLite3, Linux)
        └── src/
            ├── frontend/                (Sources .c/.cpp WebKitGTK/GTK4)
            └── backend/                 (Sources .c/.cpp Base, SQLite3, Linux)
```

---

## Site Web de Documentation Complète

Le dossier [`website/`](./website) est dédié au site web documentant **chaque package, chaque classe, chaque méthode et chaque variable** de l'écosystème NLib.

---

## Décision d'architecture : emplacement du CSS

Le DOM et le style de NLib vivent **dans `packages/js/frontend`** (`@nlib/js-frontend`) : `dom/` pour les balises créées en JS, `style/` pour le **CSS objet** (objets JS appliqués au DOM). Il n'y a **pas** de package séparé `@nlib/ui` ou `js/ui`.

Raisons :
- Le frontend est déjà défini comme « interface 100 % JS : balises DOM en JS, CSS objet, NWindow » : le style est indissociable des composants DOM.
- Le CSS objet n'a aucune dépendance propre ; un package dédié ajouterait du versionnement et de la publication sans bénéfice.
- Le package `js/backend` reste strictement headless (aucun DOM, aucun style).
- Les feuilles CSS du site de documentation restent isolées dans `website/assets/css/` et ne font pas partie de la bibliothèque.

Si le volume du CSS grandit (thèmes, design tokens partagés), il pourra être extrait plus tard en `packages/js/ui` : le `pnpm-workspace.yaml` (`packages/js/*`) le prendra en compte automatiquement.

---

## Démarrage rapide

Prérequis : Node.js >= 18 et pnpm >= 9.

```bash
pnpm install     # installe le workspace
pnpm test        # lance les tests
```

Workspace pnpm (`pnpm-workspace.yaml`) :

| Package | Chemin | Rôle |
|---|---|---|
| `@nlib/js-backend` | `packages/js/backend` | Fondation logique headless ([README](./packages/js/backend/README.md)) |
| `@nlib/js-frontend` | `packages/js/frontend` | DOM et style en JS ([README](./packages/js/frontend/README.md)) |
| `@nlib/server-node` | `packages/server/node` | Serveur Node |
| `@nlib/website` | `website` | Site de documentation |

```js
import { NUtil } from '@nlib/js-backend';

NUtil.db.store.set('theme', 'dark');          // Stockage clé-valeur avec contextes applicatifs et cryptage
await NUtil.db.init();                        // Initialisation SQLite et persistance WebAssembly dans IndexedDB
await NUtil.db.saveSql();                     // Sauvegarde binaire de la base SQL dans ntable
const res = await NUtil.db.idb.getAll('ntable'); // IndexedDB : { ok, data, error, code }
```

## Avancement

- Fait : `packages/js/backend` (core, utils, config, system, environment, worker, requests, database).
- Squelette : `packages/js/frontend` (`dom/`, `style/`), `website/`.
- À venir : classes du frontend, serveurs PHP et Node, conteneurs natifs.

## Licence

MIT
