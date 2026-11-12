# @nlib/js-backend

Fondation logique **headless** de NLib : aucune dépendance au DOM, utilisable dans un navigateur, un Worker, Node.js ou une WebView.

## Installation (workspace)

```json
{ "dependencies": { "@nlib/js-backend": "workspace:*" } }
```

```js
import { NUtil, NDatabase, NWorker } from '@nlib/js-backend';
```

## Contenu

| Dossier | Classes | Rôle |
|---|---|---|
| `core/` | `NObject`, `NEvent`, `NException` | Classe de base, événements, erreurs |
| `utils/` | `NUtil`, `NString`, `NNumber`, `NDateTime`, `NAmount`, `NEmail`, `NPhoneNumber`, `NCryptography`, `NUrl`, `NJson`, `NPassword`, `NArray` | Utilitaires, accessibles via `NUtil.*` |
| `config/` | `NConfig` | Configuration hiérarchique (`NUtil.config`) |
| `system/` | `NSystem` | Informations système (`NUtil.sys`) |
| `environment/` | `NEnvironment` | Détection de l'environnement, `requestApp` (`NUtil.env`) |
| `worker/` | `NWorker`, `NManagedWorker`, `NWorkerManager` | Web Workers, requêtes bidirectionnelles (`NUtil.worker`) |
| `requests/` | `NNetwork` | fetch / XHR, upload et download par chunks de 1 Mo (`NUtil.network`) |
| `database/` | `NDatabase`, `NIndexedDB`, `NSql`, `NStorage` | Persistance (`NUtil.db`) |

## Exemples rapides

```js
// Stockage : localStorage -> sessionStorage -> mémoire
NUtil.db.store.set('theme', 'dark');

// SQLite (sql.js ou pont natif)
await NUtil.db.sql.init({ dbStructure: { users: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);' } });
await NUtil.db.sql.insert('users', { name: 'Alice' });

// IndexedDB : réponses toujours { ok, data, error, code }
const res = await NUtil.db.idb.getAll('products');

// Réseau : fichiers > 1 Mo transférés par chunks
await NUtil.network.uploadFile('/api/upload', file, { chunkMode: 'formData' });
```

## Règles du package

- Documentation JSDoc en français : 3 `@example` minimum par classe, 2 par méthode ou accesseur.
- Aucune variable hors classe, aucun import inutilisé.
- Export nommé et `export default` pour chaque classe.
- Imports ESM avec extension `.js` explicite.

## Licence

MIT

