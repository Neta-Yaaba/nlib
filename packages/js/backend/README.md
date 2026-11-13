# @nlib/js-backend

Fondation logique **headless** de l'écosystème NLib : aucune dépendance au DOM, universellement compatible Navigateur Web (Main Thread), Web Worker, Node.js et conteneurs natifs / WebViews (Android, iOS, macOS, Windows, Linux, HarmonyOS).

## Installation (workspace)

```json
{
  "dependencies": {
    "@nlib/js-backend": "workspace:*"
  }
}
```

```js
import { NUtil, NDatabase, NSql, NIndexedDB, NStorage, NWorker, NNetwork, NTableRequest, NRequestManager } from '@nlib/js-backend';
```

## Architecture & Contenu

| Dossier | Classes principales | Responsabilités & Capacités |
|---|---|---|
| `core/` | `NObject`, `NEvent` | Classe racine universelle, bus d'événements typé avec écouteurs asynchrones protégés |
| `log/` | `NLog` | Journalisation unifiée et filtrable multi-niveaux (`debug`, `info`, `warn`, `error`), accessible via `NUtil.log` |
| `utils/` | `NUtil`, `NString`, `NNumber`, `NDateTime`, `NAmount`, `NEmail`, `NPhoneNumber`, `NCryptography`, `NUrl`, `NJson`, `NPassword`, `NArray` | Boîte à outils transversale complète sans dépendance externe, accessible via les accesseurs paresseux `NUtil.*` |
| `config/` | `NConfig` | Gestion hiérarchique de la configuration applicative (`.env`, `process.env`, defaults, freeze), accessible via `NUtil.config` |
| `system/` | `NSystem` | Métriques matérielles, CPU, mémoire, monitoring de performances, accessible via `NUtil.sys` |
| `environment/` | `NEnvironment` | Détection d'OS, navigateur, type de runtime et pont de communication natif (`requestApp`), accessible via `NUtil.env` |
| `worker/` | `NWorker`, `NManagedWorker`, `NWorkerManager` | Gestionnaire de Web Workers avec protocoles de requêtes-réponses asynchrones bidirectionnels, accessible via `NUtil.worker` |
| `requests/` | `NNetwork`, `NTableRequest`, `NRequestManager` | Client HTTP unifié (fetch/XHR avec transferts par chunks de 1 Mo), requêtes CRUD de tables avec cache et gestionnaire centralisé |
| `database/` | `NDatabase`, `NSql`, `NIndexedDB`, `NStorage` | Persistance unifiée : SQLite relationnel, IndexedDB NoSQL et stockage clé-valeur avec contextes et cryptage |

---

## Fonctionnalités Clés de la Persistance (`database/`)

### 1. `NDatabase` — Coordinateur de persistance orienté SQL
- **Priorité au SQL** : Conçu principalement pour piloter le moteur relationnel SQLite (`NSql`).
- **Initialisation épurée** : `constructor(sqlOptions)` et `init(sqlOptions)` se concentrent sur la configuration SQL.
- **Persistance WebAssembly via IndexedDB** : Pour les applications Web non natives (utilisant `sql.js` en mémoire), `NDatabase` sauvegarde et restaure automatiquement la base SQLite dans le magasin `ntable` d'`IndexedDB` (`saveSql()`, `loadSql()`).
- **Résolution automatique du contexte** : Si aucune option n'est fournie, `NDatabase` résout le contexte applicatif depuis `NUtil.config` (`context`, `app.context` ou `app.name`), permettant à `indexed` et `store` d'être immédiatement opérationnels même sans base SQL.

### 2. `NStorage` — Stockage clé-valeur avec contextes et cryptage
- **Moteurs navigateur stricts** : Prend en charge `localStorage` et `sessionStorage` (sans stockage mémoire volatile).
- **Contextes applicatifs** : Cloisonnement des données sur un même domaine via `context` (ex: `admin`, `app`, `site`). Les clés sont isolées (ex: `admin:token`), et les méthodes `keys()` et `clear()` respectent scrupuleusement le périmètre du contexte.
- **Dérivation fluide** : `storage.withContext('admin')` permet de dériver instantanément une instance cloisonnée.
- **Cryptage modulaire (4 modes)** :
  1. Clé et donnée (`encryptKey: true, encryptData: true`)
  2. Clé seule (`encryptKey: true, encryptData: false`)
  3. Donnée seule (`encryptData: true, encryptKey: false`)
  4. Aucun cryptage (`encryptKey: false, encryptData: false` - standard)

### 3. `NIndexedDB` — Magasin NoSQL résilient & cryptable
- **Transactionnellement sécurisé** : Validation définitive sur `tx.oncomplete`, déduplication des ouvertures concurrentes.
- **Magasin `ntable` par défaut** : Magasin standard `ntable` (`keyPath: 'id'`, index `'data'`).
- **Cryptage au repos** : Chiffrement optionnel des identifiants et des données pour protéger le stockage local contre l'inspection DevTools.
- **Contrat Zero Throw / Zero Reject** : Toutes les promesses résolvent une structure standardisée `{ ok, data, error, code }`.

---

## Exemples Rapides

### 1. Utilisation de la base SQL et persistance automatique
```javascript
import { NDatabase, NUtil } from '@nlib/js-backend';

const db = new NDatabase({
    name: 'pos_app',
    dbStructure: {
        products: 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL);'
    }
});

// Initialise IndexedDB, restaure le binaire SQLite si existant et initialise NSql
await db.init();

// Requêtes SQL
await db.sql.insert('products', { name: 'Pain', price: 150 });
const items = await db.sql.select('SELECT * FROM products WHERE price > :min', { min: 100 });

// Sauvegarde dans IndexedDB (ntable) pour persistance entre sessions de navigation Web
await db.saveSql();
```

### 2. Stockage contextuel et cryptage avec `NStorage`
```javascript
import { NStorage } from '@nlib/js-backend';

// Instance de base avec préfixe et cryptage
const storage = new NStorage({
    driver: 'localStorage',
    prefix: 'pos:',
    encryptKey: true,
    encryptData: true,
    secretKey: 'mon_mot_de_passe_secret'
});

// Cloisonnement étanche par contexte sur un même domaine
const adminStore = storage.withContext('admin');
const siteStore  = storage.withContext('site');

adminStore.set('theme', 'dark');  // Clé physique : 'pos:enck(admin:theme)'
siteStore.set('theme', 'light');  // Clé physique : 'pos:enck(site:theme)'

console.log(adminStore.getString('theme')); // 'dark' (déchiffré)
console.log(siteStore.getString('theme'));  // 'light'
```

### 3. Requêtes de table avec `NTableRequest` et `NUtil.db`
```javascript
import { NTableRequest, NUtil } from '@nlib/js-backend';

const tableReq = new NTableRequest('articles');

// tableReq.db accède automatiquement à NUtil.db (NDatabase)
// Utilise le SQL sous-jacent via tableReq.db.sql
const rows = await tableReq.db.sql.select('SELECT * FROM articles WHERE active = 1');
```

---

## Règles de Conception du Package

- **Zero Throw / Zero Reject** : Les méthodes de persistance et de requêtes gèrent systématiquement leurs erreurs et retournent des résultats prévisibles sans interrompre le thread d'exécution.
- **Journalisation Centralisée** : Aucun appel direct à `console.*` au runtime, tous les logs sont routés via `NUtil.log`.
- **Documentation JSDoc Exhaustive en Français** : Minimum 3 `@example` par classe, 2 par méthode et accesseur.
- **Encapsulation Stricte** : Utilisation systématique des champs privés natifs (`#privateField`).
- **Imports ESM Explicites** : Tous les imports relatifs comportent l'extension `.js`.

## Licence

MIT
