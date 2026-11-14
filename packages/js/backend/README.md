# Documentation Technique — `@nlib/js-backend`

Documentation complète de l'API du paquet `@nlib/js-backend`, organisée dossier par dossier et classe par classe.

---

## Sommaire

1. [Installation et Importations](#installation-et-importations)
2. [Dossier `core/`](#1-dossier-core)
   - [`NObject`](#11-classe-nobject-corenobjectjs)
   - [`NEvent`](#12-classe-nevent-coreneventjs)
3. [Dossier `log/`](#2-dossier-log)
   - [`NLog`](#21-classe-nlog-lognlogjs)
4. [Dossier `config/`](#3-dossier-config)
   - [`NConfig`](#31-classe-nconfig-confignconfigjs)
5. [Dossier `environment/`](#4-dossier-environment)
   - [`NEnvironment`](#41-classe-nenvironment-environmentnenvironmentjs)
6. [Dossier `system/`](#5-dossier-system)
   - [`NSystem`](#51-classe-nsystem-systemnsystemjs)
7. [Dossier `utils/`](#6-dossier-utils)
   - [`NUtil`](#61-classe-nutil-utilsnutiljs)
   - [`NCryptography`](#62-classe-ncryptography-utilsncryptographyjs)
   - [`NString`](#63-classe-nstring-utilsnstringjs)
   - [`NNumber`](#64-classe-nnumber-utilsnnumberjs)
   - [`NDateTime`](#65-classe-ndatetime-utilsndatetimejs)
   - [`NAmount`](#66-classe-namount-utilsnamountjs)
   - [`NEmail`](#67-classe-nemail-utilsnemailjs)
   - [`NPhoneNumber`](#68-classe-nphonenumber-utilsnphonenumberjs)
   - [`NUrl`](#69-classe-nurl-utilsnurljs)
   - [`NJson`](#610-classe-njson-utilsnjsonjs)
   - [`NPassword`](#611-classe-npassword-utilsnpasswordjs)
   - [`NArray`](#612-classe-narray-utilsnarrayjs)
8. [Dossier `database/`](#7-dossier-database)
   - [`NDatabase`](#71-classe-ndatabase-databasendatabasejs)
   - [`NSql`](#72-classe-nsql-databasensqljs)
   - [`NIndexedDB`](#73-classe-nindexeddb-databasenindexeddbjs)
   - [`NStorage`](#74-classe-nstorage-databasenstoragejs)
9. [Dossier `filesystem/`](#8-dossier-filesystem)
   - [`NFile`](#81-classe-nfile-filesystemnfilejs)
   - [`NDirectory`](#82-classe-ndirectory-filesystemndirectoryjs)
10. [Dossier `cache/`](#9-dossier-cache)
    - [`NCache`](#91-classe-ncache-cachencachejs)
11. [Dossier `requests/`](#10-dossier-requests)
    - [`NNetwork`](#101-classe-nnetwork-requestsnnetworkjs)
    - [`NTableRequest`](#102-classe-ntablerequest-requestsntablerequestjs)
    - [`NRequestManager`](#103-classe-nrequestmanager-requestsnrequestmanagerjs)
12. [Dossier `worker/`](#11-dossier-worker)
    - [`NWorker`](#111-classe-nworker-workernworkerjs)
    - [`NManagedWorker`](#112-classe-nmanagedworker-workernmanagedworkerjs)
    - [`NWorkerManager`](#113-classe-nworkermanager-workernworkermanagerjs)
    - [`NServiceWorker`](#114-classe-nserviceworker-workernserviceworkerjs)

---

## Installation et Importations

Toutes les classes peuvent être importées depuis le point d'entrée principal `@nlib/js-backend` ou depuis leur sous-dossier respectif :

```js
// Importation globale depuis l'index
import {
    NUtil,
    NObject,
    NEvent,
    NLog,
    NConfig,
    NEnvironment,
    NSystem,
    NDatabase,
    NSql,
    NIndexedDB,
    NStorage,
    NFile,
    NDirectory,
    NCache,
    NNetwork,
    NTableRequest,
    NRequestManager,
    NWorker,
    NManagedWorker,
    NWorkerManager,
    NServiceWorker
} from '@nlib/js-backend';

// Importation ciblée par sous-chemin
import { NUtil } from '@nlib/js-backend/utils/NUtil.js';
import { NServiceWorker } from '@nlib/js-backend/worker/NServiceWorker.js';
```

---

## 1. Dossier `core/`

Contient le socle orienté objet et le gestionnaire d'événements utilisés par les classes à cycle de vie.

---

### 1.1. Classe `NObject` (`core/NObject.js`)

Classe de base fournissant la gestion d'état interne (`#state`), un bus d'événements intégré (`this.event`), un cycle de vie (`initialize`, `destroy`), la sérialisation JSON et le clonage.

#### Constructeur
- `new NObject(options = {})`
  - `options.state` (`Object`) : État initial clé-valeur.
  - `options.autoInit` (`boolean`, défaut `true`) : Appelle automatiquement `initialize()` à la construction.

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `state` | `Object<string, any>` | Copie superficielle en lecture seule de l'état interne. |
| `event` | `NEvent` | Gestionnaire d'événements associé à l'instance (alloué au premier accès). |
| `className` | `string` | Nom de la classe de l'instance (`this.constructor.name`). |
| `util` | `typeof NUtil` | Référence directe vers la classe `NUtil`. |
| `isInitialized` | `boolean` | Indique si `initialize()` a été exécuté. |
| `isDestroyed` | `boolean` | Indique si `destroy()` a été exécuté. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `initialize` | `initialize()` | `this` | Initialise l'objet et émet l'événement `'init'`. |
| `destroy` | `destroy()` | `void` | Émet `'destroy'`, vide l'état et détache tous les écouteurs d'événements. |
| `hasState` | `hasState(key)` | `boolean` | Vérifie si une clé existe dans l'état interne. |
| `getState` | `getState(key, defaultValue = undefined)` | `any` | Récupère la valeur d'une clé d'état ou retourne `defaultValue`. |
| `setState` | `setState(keyOrObject, value)` | `this` | Définit une clé ou fusionne un objet dans l'état et émet `'stateChange'`. |
| `deleteState` | `deleteState(key)` | `boolean` | Supprime une clé de l'état et émet `'stateDelete'`. |
| `clearState` | `clearState()` | `this` | Vide toutes les clés de l'état et émet `'stateClear'`. |
| `toJSON` | `toJSON()` | `Object` | Sérialise l'objet sous la forme `{ className, isInitialized, state }`. |
| `fromJSON` | `fromJSON(json)` | `this` | Restaure l'état de l'instance à partir d'un objet ou d'une chaîne JSON. |
| `clone` | `clone()` | `NObject` | Crée une nouvelle instance de la même classe avec une copie de l'état. |
| `NObject.create` | `static create(options = {})` | `NObject` | Fabrique statique retournant une nouvelle instance. |

#### Exemple d'utilisation
```js
import { NObject } from '@nlib/js-backend';

const obj = new NObject({ state: { compteur: 1, actif: true } });

// Écouter les changements d'état
obj.event.on('stateChange', ({ changes }) => {
    console.log('Modifications :', changes);
});

// Modifier et lire l'état
obj.setState('compteur', 2);
obj.setState({ role: 'admin', niveau: 5 });

console.log(obj.getState('role'));       // 'admin'
console.log(obj.hasState('actif'));      // true
console.log(obj.toJSON());               // { className: 'NObject', isInitialized: true, state: { ... } }

// Cloner et détruire
const copie = obj.clone();
obj.destroy();
```

---

### 1.2. Classe `NEvent` (`core/NEvent.js`)

Gestionnaire d'événements synchrone et asynchrone permettant l'abonnement (`on`, `once`), la désinscription (`off`), l'émission (`emit`, `emitAsync`) et l'attente par promesse (`waitFor`).

#### Constructeur
- `new NEvent(target = null)`
  - `target` (`Object|null`) : Cible propriétaire associée aux événements émis.

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isEmpty` | `boolean` | `true` si aucun écouteur n'est enregistré. |
| `target` | `Object\|null` | Cible propriétaire associée à ce gestionnaire. |
| `util` | `typeof NUtil` | Référence vers `NUtil`. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `has` | `has(event)` | `boolean` | Indique si au moins un écouteur est enregistré pour `event`. |
| `hasListener` | `hasListener(event, callback)` | `boolean` | Vérifie si une fonction `callback` précise écoute `event`. |
| `listenerCount` | `listenerCount(event)` | `number` | Retourne le nombre d'écouteurs actifs pour `event` (ou le total si omis). |
| `eventNames` | `eventNames()` | `string[]` | Retourne la liste des noms d'événements écoutés. |
| `on` | `on(event, callback)` | `this` | Enregistre un écouteur sur un événement (ou plusieurs séparés par des espaces). |
| `once` | `once(event, callback)` | `this` | Enregistre un écouteur exécuté une seule fois puis retiré automatiquement. |
| `off` | `off(event, callback)` | `this` | Retire un écouteur précis ou tous les écouteurs d'un événement. |
| `emit` | `emit(event, ...args)` | `this` | Déclenche de manière synchrone tous les écouteurs de `event`. |
| `emitAsync` | `emitAsync(event, ...args)` | `Promise<any[]>` | Déclenche les écouteurs en attendant la résolution des promesses retournées. |
| `waitFor` | `waitFor(event, timeout = 0)` | `Promise<any>` | Retourne une promesse résolue à la prochaine émission de `event` (avec timeout optionnel en ms). |
| `clear` | `clear()` | `this` | Supprime tous les écouteurs de tous les événements. |

#### Exemple d'utilisation
```js
import { NEvent } from '@nlib/js-backend';

const bus = new NEvent();

// Abonnement multiple et unique
bus.on('connexion', (user) => console.log('Connecté :', user.nom));
bus.once('initialisation', () => console.log('Exécuté une seule fois'));

bus.emit('initialisation');
bus.emit('connexion', { nom: 'Alice' });

// Attente asynchrone d'un événement
setTimeout(() => bus.emit('pret', { statut: 'OK' }), 100);
const resultat = await bus.waitFor('pret', 2000);
console.log(resultat); // { statut: 'OK' }
```

---

## 2. Dossier `log/`

Fournit le système de journalisation centralisé avec historique circulaire en mémoire, niveaux de sévérité, capture de traces d'appels et exportation.

---

### 2.1. Classe `NLog` (`log/NLog.js`)

Accessible via `NUtil.log` ou par instanciation directe `new NLog(options)`.

#### Constantes Statiques
- `NLog.LEVEL` : `{ DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' }`

#### Constructeur
- `new NLog(options = {})`
  - `options.consoleEnabled` (`boolean`, défaut `true`) : Affiche les journaux dans la console système.
  - `options.traceEnabled` (`boolean`, défaut `true`) : Capture la pile d'appels (`stack`) sur les avertissements et erreurs.
  - `options.maxLogs` (`number`, défaut `500`) : Nombre maximal d'entrées conservées en mémoire.
  - `options.context` (`Object`, défaut `{}`) : Métadonnées globales ajoutées à chaque entrée.

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `event` | `NEvent` | Bus d'événements émettant `'log'`, `'debug'`, `'info'`, `'warn'`, `'error'`, `'clear'`. |
| `isConsoleEnabled` | `boolean` | État de la sortie console. |
| `isTraceEnabled` | `boolean` | État de la capture des traces d'exécution. |
| `maxLogs` | `number` | Capacité maximale du tampon mémoire. |
| `context` | `Object` | Copie du contexte global attaché aux logs. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `setConsoleEnabled` | `setConsoleEnabled(enabled)` | `this` | Active ou désactive l'affichage dans la console. |
| `setTraceEnabled` | `setTraceEnabled(enabled)` | `this` | Active ou désactive la capture de la stack trace. |
| `setMaxLogs` | `setMaxLogs(max)` | `this` | Modifie la capacité maximale de l'historique en mémoire. |
| `setContext` | `setContext(contextObj, merge = true)` | `this` | Définit ou fusionne des métadonnées globales (`app`, `version`, etc.). |
| `debug` | `debug(message, details = null)` | `NLogEntry` | Enregistre un message de niveau `debug`. |
| `info` | `info(message, details = null)` | `NLogEntry` | Enregistre un message de niveau `info`. |
| `warn` | `warn(message, details = null)` | `NLogEntry` | Enregistre un avertissement de niveau `warn`. |
| `error` | `error(message, details = null)` | `NLogEntry` | Enregistre une erreur de niveau `error`. |
| `write` | `write(level, message, details = null)` | `NLogEntry` | Enregistre une entrée selon le niveau spécifié. |
| `captureException` | `captureException(err, customMessage = null, extraDetails = {})` | `NLogEntry` | Extrait `name`, `message`, `code`, `stack` et `cause` d'une erreur et l'enregistre. |
| `getLogs` | `getLogs(filter = null)` | `NLogEntry[]` | Retourne l'historique filtré par niveau (`string`), par prédicat (`Function`) ou par objet `{ level, search, limit, since }`. |
| `getLastLog` | `getLastLog(level = null)` | `NLogEntry\|null` | Retourne la dernière entrée enregistrée (optionnellement filtrée par niveau). |
| `count` | `count(level = null)` | `number` | Compte le nombre total d'entrées (ou pour un niveau donné). |
| `export` | `export(pretty = true)` | `string` | Exporte l'historique des journaux au format JSON. |
| `import` | `import(jsonOrArray, append = true)` | `number` | Importe un historique de journaux et retourne le nombre d'entrées ajoutées. |
| `clear` | `clear()` | `this` | Vide l'historique des journaux en mémoire. |
| `destroy` | `destroy()` | `void` | Vide les journaux, le contexte et les écouteurs d'événements. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

// Définir un contexte global
NUtil.log.setContext({ module: 'Paiement', version: '2.1.0' });

// Enregistrer des journaux
NUtil.log.info('Initialisation du terminal', { terminalId: 'T-01' });
NUtil.log.warn('Latence réseau élevée', { pingMs: 850 });
NUtil.log.error('Échec de débit', { code: 'ERR_CARD_DECLINED', montant: 15000 });

// Filtrer et exporter les erreurs
const erreurs = NUtil.log.getLogs({ level: 'error', limit: 10 });
console.log('Dernière erreur :', NUtil.log.getLastLog('error'));
const jsonLogs = NUtil.log.export(true);
```

---

## 3. Dossier `config/`

Gère la configuration applicative en mémoire avec typage fort, valeurs par défaut, chargement d'environnement (`.env` / `process.env`) et verrouillage (`freeze`).

---

### 3.1. Classe `NConfig` (`config/NConfig.js`)

Accessible via `NUtil.config` ou par instanciation directe `new NConfig(initialValues, defaults)`.

#### Constructeur
- `new NConfig(initialValues = {}, defaults = {})`

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isFrozen` | `boolean` | `true` si la configuration a été verrouillée via `freeze()`. |
| `isEmpty` | `boolean` | `true` si aucune clé de configuration n'est définie. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `has` | `has(path)` | `boolean` | Vérifie si une clé ou un chemin (`'api.timeout'` ou `['api', 'timeout']`) existe. |
| `get` | `get(path, fallback = undefined)` | `any` | Récupère la valeur brute d'une clé (recherche dans la config active puis dans les défauts). |
| `getString` | `getString(path, fallback = '')` | `string` | Récupère une valeur convertie en chaîne de caractères. |
| `getNumber` | `getNumber(path, fallback = 0)` | `number` | Récupère une valeur convertie en nombre fini. |
| `getInt` | `getInt(path, fallback = 0)` | `number` | Récupère une valeur convertie en entier. |
| `getFloat` | `getFloat(path, fallback = 0.0)` | `number` | Récupère une valeur convertie en nombre flottant. |
| `getBoolean` | `getBoolean(path, fallback = false)` | `boolean` | Convertit intelligemment (`true`, `'true'`, `'1'`, `'yes'`, `'on'`) en booléen. |
| `getArray` | `getArray(path, fallback = [])` | `Array` | Récupère un tableau (décode aussi les chaînes JSON `'[...]'` ou listes CSV `'a,b,c'`). |
| `getObject` | `getObject(path, fallback = {})` | `Object` | Récupère un objet (ou décode une chaîne JSON `'{"a":1}'`). |
| `set` | `set(path, value)` | `this` | Définit une valeur à une clé ou un chemin hiérarchique (si non gelé). |
| `setDefaults` | `setDefaults(defaultsObj)` | `this` | Fusionne un dictionnaire de valeurs par défaut. |
| `merge` | `merge(configObj)` | `this` | Fusionne profondément un objet dans la configuration active. |
| `delete` | `delete(path)` | `boolean` | Supprime une clé de la configuration active. |
| `reset` | `reset()` | `this` | Réinitialise la configuration active avec les valeurs par défaut. |
| `clear` | `clear()` | `this` | Vide toutes les valeurs actives et par défaut (et déverrouille). |
| `freeze` | `freeze()` | `this` | Verrouille la configuration contre toute modification ultérieure. |
| `require` | `require(keys)` | `{ valid: boolean, missing: string[] }` | Vérifie la présence d'une liste de clés obligatoires. |
| `loadFromDotEnv` | `loadFromDotEnv(envContent, prefix = '')` | `this` | Parse le contenu texte d'un fichier `.env` et charge les variables. |
| `loadFromProcess` | `loadFromProcess(prefix = '')` | `this` | Charge les variables depuis `process.env` (si disponible en Node.js). |
| `toObject` | `toObject()` | `Object` | Retourne une copie profonde fusionnant défauts et valeurs actives. |
| `toJSON` | `toJSON(pretty = false)` | `string` | Sérialise la configuration complète en chaîne JSON. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

// Définir des valeurs par défaut et charger un contenu .env
NUtil.config.setDefaults({
    api: { url: 'https://api.nlib.dev', timeout: 10000 },
    debug: false
});

NUtil.config.loadFromDotEnv(`
APP_NAME="Mon Application"
DEBUG=true
ALLOWED_HOSTS=localhost,127.0.0.1
`);

// Lectures typées
console.log(NUtil.config.getString('APP_NAME'));        // 'Mon Application'
console.log(NUtil.config.getBoolean('DEBUG'));          // true
console.log(NUtil.config.getArray('ALLOWED_HOSTS'));    // ['localhost', '127.0.0.1']
console.log(NUtil.config.getInt(['api', 'timeout']));   // 10000

// Vérification de clés requises et verrouillage
const check = NUtil.config.require(['APP_NAME', ['api', 'url']]);
console.log(check.valid); // true
NUtil.config.freeze();
```

---

## 4. Dossier `environment/`

Détecte les caractéristiques de l'environnement d'exécution (navigateur, Web Worker, WebView native, Node.js, système d'exploitation, connectivité et préférences d'affichage).

---

### 4.1. Classe `NEnvironment` (`environment/NEnvironment.js`)

Accessible via `NUtil.env` ou par instanciation directe `new NEnvironment()`.

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `type` | `'browser'\|'worker'\|'node'\|'unknown'` | Type de contexte d'exécution JS. |
| `isBrowser` | `boolean` | `true` si exécuté dans un navigateur avec DOM (`window` et `document`). |
| `isNode` | `boolean` | `true` si exécuté sous Node.js. |
| `isWorker` | `boolean` | `true` si exécuté dans un Web Worker ou Service Worker. |
| `os` | `'Windows'\|'macOS'\|'iOS'\|'Android'\|'HarmonyOS'\|'Linux'\|'Unknown'` | Système d'exploitation détecté. |
| `isAndroid` | `boolean` | `true` sur Android. |
| `isHarmonyOS` | `boolean` | `true` sur HarmonyOS. |
| `isIOS` | `boolean` | `true` sur iOS / iPadOS. |
| `isWindows` | `boolean` | `true` sur Windows. |
| `isMacOS` | `boolean` | `true` sur macOS. |
| `isLinux` | `boolean` | `true` sur Linux. |
| `browser` | `'Chrome'\|'Firefox'\|'Safari'\|'Edge'\|'Opera'\|'Unknown'` | Navigateur détecté. |
| `isMobile` | `boolean` | `true` sur smartphone. |
| `isTablet` | `boolean` | `true` sur tablette. |
| `isDesktop` | `boolean` | `true` sur ordinateur de bureau. |
| `isTouch` | `boolean` | `true` si l'écran supporte le tactile. |
| `isWebView` | `boolean` | `true` si exécuté dans un conteneur applicatif natif / WebView (`window.NLibNative`, `ReactNativeWebView`, `webkit.messageHandlers`, `chrome.webview`, `electron`, etc.). |
| `isOnline` | `boolean` | `true` si l'appareil est connecté au réseau. |
| `isOffline` | `boolean` | `true` si l'appareil est hors-ligne. |
| `isSecureContext` | `boolean` | `true` si le contexte est sécurisé (HTTPS ou `localhost`). |
| `isDarkMode` | `boolean` | `true` si le thème sombre système est actif (`prefers-color-scheme: dark`). |
| `language` | `string` | Code langue courant (ex: `'fr-FR'`). |
| `timezone` | `string` | Fuseau horaire IANA (ex: `'Africa/Ouagadougou'`, `'Europe/Paris'`). |
| `userAgent` | `string` | Chaîne `User-Agent` brute. |
| `info` | `Object` | Objet récapitulatif complet de toutes les propriétés d'environnement. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.env.type);       // 'browser'
console.log(NUtil.env.os);         // 'Windows'
console.log(NUtil.env.isOnline);   // true
console.log(NUtil.env.isWebView);  // false
console.log(NUtil.env.timezone);   // 'UTC' ou fuseau local
console.log(NUtil.env.info);       // Snapshot complet de l'environnement
```

---

## 5. Dossier `system/`

Fournit les informations matérielles (CPU, RAM, écran, batterie, stockage, réseau), les mesures de performance haute précision, le presse-papiers et la passerelle de communication avec le conteneur natif (`invokeNative`).

---

### 5.1. Classe `NSystem` (`system/NSystem.js`)

Accessible via `NUtil.sys` (ou `NUtil.system`) et par instanciation directe `new NSystem()`.

#### Propriétés et Getters
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `cpuCores` | `number` | Nombre de cœurs logiques du processeur (`navigator.hardwareConcurrency` ou `os.cpus()`). |
| `arch` | `string` | Architecture matérielle (`'x64'`, `'arm64'`, `'x86'`, `'unknown'`). |
| `deviceMemory` | `number\|null` | Mémoire RAM approximative de l'appareil en Go. |
| `memory` | `Object\|null` | Détails d'utilisation mémoire du processus JS (`used`, `total`, `limit`, `formattedUsed`). |
| `screen` | `{ width, height, availWidth, availHeight, pixelRatio, colorDepth, orientation }` | Dimensions et densité de pixels de l'écran. |
| `network` | `{ online, effectiveType, downlink, rtt, saveData }` | État et qualité de la connexion réseau. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `uptime` | `uptime()` | `number` | Temps écoulé en millisecondes depuis le démarrage de la page ou du processus. |
| `hrtime` | `hrtime()` | `number` | Horodatage haute résolution en millisecondes (`performance.now()`). |
| `measure` | `measure(fn, label = 'operation')` | `Promise<{ result, durationMs, label }>` | Exécute une fonction synchrone ou asynchrone et mesure sa durée d'exécution. |
| `getBattery` | `getBattery()` | `Promise<{ supported, charging, level, chargingTime, dischargingTime }>` | Récupère l'état de la batterie de l'appareil. |
| `getStorageQuota` | `getStorageQuota()` | `Promise<{ supported, usage, quota, free, percentUsed, formattedUsage, formattedQuota, formattedFree }>` | Calcule l'espace disque utilisé et disponible pour l'origine. |
| `copyToClipboard` | `copyToClipboard(text)` | `Promise<boolean>` | Copie une chaîne de caractères dans le presse-papiers système. |
| `readFromClipboard` | `readFromClipboard()` | `Promise<string\|null>` | Lit le texte contenu dans le presse-papiers système. |
| `watchNetwork` | `watchNetwork(callback)` | `Function` | Écoute les changements de connectivité (`online`/`offline`) et retourne une fonction de désabonnement. |
| `invokeNative` | `invokeNative(payload)` | `Promise<any>` | Envoie une commande au pont natif OS (ou la relaie via `NWorker.requestMain('invokeNative', payload)` si appelé depuis un Web Worker). |
| `getSnapshot` | `getSnapshot()` | `Promise<Object>` | Retourne un rapport complet matériel, mémoire, écran, réseau, batterie et stockage. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log('Cœurs CPU :', NUtil.sys.cpuCores);
console.log('Écran :', NUtil.sys.screen);

// Mesurer le temps d'exécution d'une fonction
const { result, durationMs } = await NUtil.sys.measure(async () => {
    await NUtil.sleep(50);
    return 42;
}, 'calcul_test');
console.log(`Résultat: ${result} en ${durationMs} ms`);

// Vérifier le quota de stockage
const quota = await NUtil.sys.getStorageQuota();
console.log('Espace libre :', quota.formattedFree);
```

---

## 6. Dossier `utils/`

Regroupe le point d'accès central `NUtil` et les 11 classes utilitaires spécialisées (cryptographie, chaînes, nombres, dates, montants, e-mails, téléphones, URLs, JSON, mots de passe et tableaux).

---

### 6.1. Classe `NUtil` (`utils/NUtil.js`)

Point d'entrée statique centralisant l'accès paresseux (lazy singletons) à tous les services et utilitaires du paquet, ainsi que des fonctions générales (identifiants uniques, temporisation, contrôle de flux).

#### Accesseurs Statiques (Singletons paresseux)
| Accesseur | Instance retournée | Description |
| :--- | :--- | :--- |
| `NUtil.str` | `NString` | Manipulation de chaînes de caractères. |
| `NUtil.num` | `NNumber` | Calculs, conversions et formatages numériques. |
| `NUtil.date` | `NDateTime` | Manipulation, calcul et formatage de dates/heures. |
| `NUtil.amount` | `NAmount` | Calculs financiers, taxes, remises et devises. |
| `NUtil.email` | `NEmail` | Validation, parsing et masquage d'adresses e-mail. |
| `NUtil.phone` | `NPhoneNumber` | Validation et formatage international/national de numéros de téléphone. |
| `NUtil.crypto` | `NCryptography` | Cryptographie locale (synchrone/asynchrone) et hybride client-serveur. |
| `NUtil.url` | `NUrl` | Manipulation d'URLs, Query Strings et obfuscation d'IDs. |
| `NUtil.json` | `NJson` | Sérialisation sécurisée, clonage et accès par chemin sur objets/tableaux. |
| `NUtil.password` | `NPassword` | Génération, évaluation de robustesse et hachage PBKDF2 de mots de passe. |
| `NUtil.arr` | `NArray` | Manipulation avancée de tableaux et collections d'objets. |
| `NUtil.env` | `NEnvironment` | Détection de l'environnement d'exécution. |
| `NUtil.config` | `NConfig` | Configuration applicative globale. |
| `NUtil.sys` / `NUtil.system` | `NSystem` | Informations matérielles, système et pont natif. |
| `NUtil.worker` | `NWorkerManager` | Gestionnaire centralisé de Web Workers et pools. |
| `NUtil.network` / `NUtil.net` | `NNetwork` | Client HTTP/HTTPS et WebSocket avec chiffrement. |
| `NUtil.database` / `NUtil.db` | `NDatabase` | Gestionnaire unifié de bases de données (`sql`, `idb`, `store`). |
| `NUtil.file` | `NFile` | Gestionnaire de fichiers multiplateforme. |
| `NUtil.dir` / `NUtil.directory` | `NDirectory` | Gestionnaire de répertoires multiplateforme. |
| `NUtil.cache` | `NCache` | Gestionnaire de cache à moteur unique automatique. |
| `NUtil.log` | `NLog` | Gestionnaire de journalisation. |

#### Méthodes Statiques Directes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | `static uuid()` | `string` | Génère un identifiant unique universel UUID v4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). |
| `uid` | `static uid(prefix = '')` | `string` | Génère un identifiant court horodaté et aléatoire avec préfixe optionnel (ex: `'req_m5k9...'`). |
| `getType` | `static getType(value)` | `string` | Retourne le type exact en minuscules (`'null'`, `'undefined'`, `'array'`, `'date'`, `'regexp'`, `'object'`, `'string'`, etc.). |
| `isEmpty` | `static isEmpty(value)` | `boolean` | Vérifie si une valeur est vide (`null`, `undefined`, `''`, `'   '`, `[]`, `{}` sans clés, `Map`/`Set` de taille 0, `NaN`). |
| `isDefined` | `static isDefined(value)` | `boolean` | Retourne `true` si la valeur n'est ni `null` ni `undefined`. |
| `isEqual` | `static isEqual(a, b)` | `boolean` | Compare profondément deux valeurs (primitives, Dates, RegExp, tableaux, objets). |
| `toBoolean` | `static toBoolean(value)` | `boolean` | Convertit une valeur (`true`, `1`, `'1'`, `'true'`, `'yes'`, `'on'`, `'oui'`) en booléen. |
| `sleep` | `static sleep(ms)` | `Promise<void>` | Pause asynchrone de `ms` millisecondes. |
| `setTimeout` | `static setTimeout(callback, ms = 0, ...args)` | `any` | Planifie l'exécution différée et sécurisée d'une fonction. |
| `clearTimeout` | `static clearTimeout(timerId)` | `void` | Annule un minuteur créé avec `setTimeout`. |
| `debounce` | `static debounce(fn, delay = 300)` | `Function` | Retarde l'exécution de `fn` tant qu'elle est rappelée avant `delay` ms (dotée de `.cancel()`). |
| `throttle` | `static throttle(fn, limit = 300)` | `Function` | Limite l'exécution de `fn` à au plus une fois toutes les `limit` ms. |
| `retry` | `static retry(fn, options = {})` | `Promise<any>` | Réessaie une fonction asynchrone en cas d'échec (`{ retries: 3, delay: 500, backoff: 2, onRetry }`). |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const id = NUtil.uuid();
const courtId = NUtil.uid('cmd_');

console.log(NUtil.isEmpty([]));                          // true
console.log(NUtil.isEqual({ a: [1, 2] }, { a: [1, 2] })); // true
console.log(NUtil.toBoolean('oui'));                     // true

await NUtil.sleep(100);
```

---

### 6.2. Classe `NCryptography` (`utils/NCryptography.js`)

Centralise tous les systèmes de chiffrement et de hachage du paquet :
1. **Chiffrement local sans clé externe (`encryptLocal` / `decryptLocal` et `encryptLocalSync` / `decryptLocalSync`)** : dérive automatiquement une clé de 256 bits à partir de l'empreinte interne du navigateur/appareil sans jamais stocker de clé en persistant. Utilisé notamment par `NIndexedDB` (asynchrone) et `NStorage` (synchrone).
2. **Chiffrement hybride client-serveur (`RSA-OAEP` + `AES-GCM`)** et **chiffrement symétrique (`PBKDF2` + `AES-GCM`)** : utilisé par `NNetwork` pour sécuriser les échanges HTTP/WebSocket.
3. **Hachage et signatures (`sha256`, `sha256Sync`, `hmacSha256Sync`)**.

Accessible via `NUtil.crypto` ou `new NCryptography()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `encryptLocal` | `encryptLocal(data)` | `Promise<string>` | Chiffre localement (AES-GCM 256 bits via Web Crypto, ou repli local) une donnée sans clé à fournir (liée au navigateur courant). |
| `decryptLocal` | `decryptLocal(cipherPayload, options = {})` | `Promise<any>` | Déchiffre une donnée chiffrée avec `encryptLocal` (ou `encryptLocalSync`). Si `options.parseJson !== false`, reconstruit automatiquement les objets/tableaux JSON. |
| `encryptLocalSync` | `encryptLocalSync(data)` | `string` | Chiffre localement et de manière **synchrone** une donnée sans clé à fournir (`NLOC1:...`, flux XOR256 + HMAC-SHA256 liés au navigateur). |
| `decryptLocalSync` | `decryptLocalSync(cipherPayload, options = {})` | `any` | Vérifie l'intégrité HMAC-SHA256 et déchiffre de manière **synchrone** une donnée produite par `encryptLocalSync`. |
| `sha256` | `sha256(data)` | `Promise<string>` | Calcule l'empreinte SHA-256 hexadécimale (64 caractères) d'une chaîne ou d'un `Uint8Array`. |
| `sha256Sync` | `sha256Sync(data)` | `string` | Calcule de manière synchrone l'empreinte SHA-256 hexadécimale. |
| `hmacSha256Sync` | `hmacSha256Sync(message, key)` | `Uint8Array` | Calcule de manière synchrone le code d'authentification HMAC-SHA256 (32 octets). |
| `generateKeyPair` | `generateKeyPair()` | `Promise<{ publicKey: CryptoKey, privateKey: CryptoKey }\|null>` | Génère une paire de clés asymétriques RSA-OAEP (2048 bits, SHA-256). |
| `exportPublicKeyToPem` | `exportPublicKeyToPem(publicKey)` | `Promise<string>` | Exporte une clé publique `CryptoKey` au format PEM (`-----BEGIN PUBLIC KEY-----`). |
| `exportPrivateKeyToPem` | `exportPrivateKeyToPem(privateKey)` | `Promise<string>` | Exporte une clé privée `CryptoKey` au format PEM (`-----BEGIN PRIVATE KEY-----`). |
| `importPublicKeyFromPem` | `importPublicKeyFromPem(pem)` | `Promise<CryptoKey\|null>` | Importe une clé publique RSA-OAEP depuis une chaîne PEM. |
| `importPrivateKeyFromPem` | `importPrivateKeyFromPem(pem)` | `Promise<CryptoKey\|null>` | Importe une clé privée RSA-OAEP depuis une chaîne PEM. |
| `encrypt` | `encrypt(plainText, publicKey)` | `Promise<string>` | Chiffrement hybride RSA-OAEP + AES-256-GCM pour la communication client-serveur (format `<encryptedAesKeyB64>:<ivB64>:<cipherB64>`). |
| `decrypt` | `decrypt(encryptedPayload, privateKey)` | `Promise<string>` | Déchiffre un payload hybride RSA-OAEP + AES-256-GCM avec la clé privée RSA. |
| `encryptSymmetric` | `encryptSymmetric(plainText, secretKey)` | `Promise<string>` | Chiffre avec une clé secrète partagée via PBKDF2 (100 000 itérations) + AES-256-GCM (`<saltB64>:<ivB64>:<cipherB64>`). |
| `decryptSymmetric` | `decryptSymmetric(encryptedPayload, secretKey)` | `Promise<string>` | Déchiffre un payload symétrique PBKDF2 + AES-256-GCM. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

// 1. Chiffrement local asynchrone (sans clé externe, lié au navigateur)
const jetonLocal = await NUtil.crypto.encryptLocal({ userId: 42, role: 'admin' });
const objetRestaure = await NUtil.crypto.decryptLocal(jetonLocal);
console.log(objetRestaure); // { userId: 42, role: 'admin' }

// 2. Chiffrement local synchrone
const chiffreSync = NUtil.crypto.encryptLocalSync('Secret Local Synchrone');
const clairSync = NUtil.crypto.decryptLocalSync(chiffreSync);
console.log(clairSync); // 'Secret Local Synchrone'

// 3. Chiffrement hybride Client <-> Serveur (RSA-OAEP + AES-GCM)
const pair = await NUtil.crypto.generateKeyPair();
const pubPem = await NUtil.crypto.exportPublicKeyToPem(pair.publicKey);
const pubKeyImportee = await NUtil.crypto.importPublicKeyFromPem(pubPem);

const messageChiffre = await NUtil.crypto.encrypt('Payload confidentiel', pubKeyImportee);
const messageDechiffre = await NUtil.crypto.decrypt(messageChiffre, pair.privateKey);
console.log(messageDechiffre); // 'Payload confidentiel'
```

---

### 6.3. Classe `NString` (`utils/NString.js`)

Service de manipulation, comparaison, transformation de casse, nettoyage et formatage de chaînes de caractères. Accessible via `NUtil.str` ou `new NString()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isString` | `isString(value)` | `boolean` | Vérifie si `value` est de type `string`. |
| `isEmpty` | `isEmpty(text, trim = true)` | `boolean` | Vérifie si une chaîne est vide (ou ne contient que des espaces). |
| `isNotEmpty` | `isNotEmpty(text, trim = true)` | `boolean` | Vérifie qu'une chaîne contient au moins un caractère significatif. |
| `length` | `length(text, trim = false)` | `number` | Retourne la longueur de la chaîne. |
| `equals` | `equals(textA, textB, options = {})` | `boolean` | Compare deux chaînes avec options (`caseSensitive`, `ignoreAccents`, `ignoreSpecialChars`, `ignoreSpaces`, `trim`). |
| `contains` | `contains(text, search, options = {})` | `boolean` | Vérifie si `text` contient `search` selon les options de comparaison. |
| `startsWith` | `startsWith(text, prefix, options = {})` | `boolean` | Vérifie si `text` commence par `prefix`. |
| `endsWith` | `endsWith(text, suffix, options = {})` | `boolean` | Vérifie si `text` se termine par `suffix`. |
| `toUpperCase` | `toUpperCase(text)` | `string` | Convertit en majuscules. |
| `toLowerCase` | `toLowerCase(text)` | `string` | Convertit en minuscules. |
| `capitalize` | `capitalize(text, lowerRest = true)` | `string` | Met la première lettre en majuscule. |
| `capitalizeWords` | `capitalizeWords(text)` | `string` | Met la première lettre de chaque mot en majuscule. |
| `toCamelCase` | `toCamelCase(text)` | `string` | Convertit en `camelCase`. |
| `toPascalCase` | `toPascalCase(text)` | `string` | Convertit en `PascalCase`. |
| `toSnakeCase` | `toSnakeCase(text)` | `string` | Convertit en `snake_case`. |
| `toKebabCase` | `toKebabCase(text)` | `string` | Convertit en `kebab-case`. |
| `trim` | `trim(text, chars = null)` | `string` | Retire les espaces ou les caractères `chars` aux extrémités. |
| `cleanSpaces` | `cleanSpaces(text)` | `string` | Remplace les espaces multiples par un seul espace et retire ceux aux extrémités. |
| `removeAccents` | `removeAccents(text)` | `string` | Retire tous les accents et signes diacritiques (`é` -> `e`, `œ` -> `oe`). |
| `slugify` | `slugify(text, separator = '-')` | `string` | Convertit un texte en identifiant d'URL normalisé (`slug`). |
| `escapeHtml` | `escapeHtml(text)` | `string` | Échappe `&`, `<`, `>`, `"`, `'`. |
| `unescapeHtml` | `unescapeHtml(text)` | `string` | Décode les entités HTML `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`. |
| `split` | `split(text, separator = ' ', limit)` | `string[]` | Découpe une chaîne selon un séparateur. |
| `splitAt` | `splitAt(text, separator, index, defaultValue = null)` | `string\|any` | Découpe et retourne directement l'élément à `index` (supporte les index négatifs comme `-1`). |
| `insertEvery` | `insertEvery(text, step = 2, separator = ' ', fromEnd = false)` | `string` | Insère `separator` tous les `step` caractères. |
| `truncate` | `truncate(text, maxLength, suffix = '...')` | `string` | Tronque la chaîne à `maxLength` caractères avec suffixe. |
| `padStart` | `padStart(text, length, padChar = ' ')` | `string` | Complète la chaîne à gauche. |
| `padEnd` | `padEnd(text, length, padChar = ' ')` | `string` | Complète la chaîne à droite. |
| `repeat` | `repeat(text, count)` | `string` | Répète la chaîne `count` fois. |
| `reverse` | `reverse(text)` | `string` | Inverse l'ordre des caractères Unicode. |
| `replaceAll` | `replaceAll(text, search, replacement)` | `string` | Remplace toutes les occurrences de `search`. |
| `template` | `template(text, data = {})` | `string` | Interpole les variables `{cle}` ou `{{cle}}` depuis `data`. |
| `mask` | `mask(text, options = {})` | `string` | Masque une chaîne (`{ visibleStart: 0, visibleEnd: 4, maskChar: '*' }`). |
| `countOccurrences` | `countOccurrences(text, subString, options = {})` | `number` | Compte le nombre d'occurrences d'une sous-chaîne. |
| `wordCount` | `wordCount(text)` | `number` | Compte le nombre de mots. |
| `random` | `random(length = 16, charset)` | `string` | Génère une chaîne aléatoire. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.str.slugify('Facture N° 2026 - Édition Spéciale')); // 'facture-n-2026-edition-speciale'
console.log(NUtil.str.equals('Éléphant', 'elephant', { caseSensitive: false, ignoreAccents: true })); // true
console.log(NUtil.str.splitAt('a/b/c/fichier.pdf', '/', -1)); // 'fichier.pdf'
console.log(NUtil.str.template('Bonjour {nom}, solde : {solde}', { nom: 'Ali', solde: '5 000 FCFA' }));
```

---

### 6.4. Classe `NNumber` (`utils/NNumber.js`)

Validation, conversion, calculs mathématiques et formatage de nombres, devises et tailles d'octets. Accessible via `NUtil.num` ou `new NNumber()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isNumber` | `isNumber(value)` | `boolean` | Vérifie si `value` est un `number` fini. |
| `isNumeric` | `isNumeric(value)` | `boolean` | Vérifie si `value` est un nombre ou une chaîne numérique (`'12,50'`, `'42'`). |
| `isInteger` | `isInteger(value)` | `boolean` | Vérifie si `value` est un nombre entier. |
| `isFloat` | `isFloat(value)` | `boolean` | Vérifie si `value` est un nombre comportant une partie décimale non nulle. |
| `isPositive` | `isPositive(value, strict = false)` | `boolean` | Vérifie si le nombre est positif (`>= 0` ou `> 0` si `strict = true`). |
| `isNegative` | `isNegative(value, strict = true)` | `boolean` | Vérifie si le nombre est négatif (`< 0` ou `<= 0`). |
| `isEven` | `isEven(value)` | `boolean` | Vérifie si l'entier est pair. |
| `isOdd` | `isOdd(value)` | `boolean` | Vérifie si l'entier est impair. |
| `isBetween` | `isBetween(value, min, max, inclusive = true)` | `boolean` | Vérifie si un nombre est compris entre `min` et `max`. |
| `equals` | `equals(a, b, epsilon = Number.EPSILON)` | `boolean` | Compare deux nombres avec une tolérance flottante `epsilon`. |
| `toNumber` | `toNumber(value, defaultValue = 0)` | `number` | Convertit une valeur (y compris `'1 250,50'`) en nombre ou retourne `defaultValue`. |
| `toInt` | `toInt(value, defaultValue = 0, radix = 10)` | `number` | Convertit en nombre entier. |
| `toFloat` | `toFloat(value, defaultValue = 0.0)` | `number` | Convertit en nombre flottant. |
| `round` | `round(value, decimals = 2)` | `number` | Arrondit à `decimals` décimales. |
| `floor` | `floor(value, decimals = 0)` | `number` | Arrondit à l'inférieur à `decimals` décimales. |
| `ceil` | `ceil(value, decimals = 0)` | `number` | Arrondit au supérieur à `decimals` décimales. |
| `clamp` | `clamp(value, min, max)` | `number` | Contraint un nombre dans l'intervalle `[min, max]`. |
| `percentage` | `percentage(part, total, decimals = 2)` | `number` | Calcule quel pourcentage `part` représente par rapport à `total`. |
| `percentageOf` | `percentageOf(percent, total, decimals = 2)` | `number` | Calcule `percent` % de `total`. |
| `sum` | `sum(numbers = [])` | `number` | Somme d'un tableau de nombres. |
| `average` | `average(numbers = [], decimals = 2)` | `number` | Moyenne arithmétique d'un tableau de nombres. |
| `min` | `min(numbers = [])` | `number\|null` | Plus petite valeur d'un tableau. |
| `max` | `max(numbers = [])` | `number\|null` | Plus grande valeur d'un tableau. |
| `randomInt` | `randomInt(min = 0, max = 100)` | `number` | Entier aléatoire entre `min` et `max` inclus. |
| `randomFloat` | `randomFloat(min = 0, max = 1, decimals = 2)` | `number` | Flottant aléatoire entre `min` et `max`. |
| `format` | `format(value, options = {})` | `string` | Formate un nombre (`{ decimals: 0, thousandsSeparator: ' ', decimalSeparator: ',' }`). |
| `formatCurrency` | `formatCurrency(value, options = {})` | `string` | Formate un montant avec devise (`{ symbol: '$', position: 'after', decimals: 0 }`). |
| `formatBytes` | `formatBytes(bytes, decimals = 2)` | `string` | Formate une taille en octets (`'1.5 Mo'`, `'512 Ko'`). |
| `pad` | `pad(value, length = 2)` | `string` | Complète un entier avec des zéros en tête (`'07'`, `'00042'`). |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.num.toFloat('1 250,75'));                      // 1250.75
console.log(NUtil.num.format(1250000.5, { decimals: 2 }));       // '1 250 000,50'
console.log(NUtil.num.percentage(25, 200));                      // 12.5
console.log(NUtil.num.formatBytes(1048576));                     // '1 Mo'
```

---

### 6.5. Classe `NDateTime` (`utils/NDateTime.js`)

Création, validation, extraction de composants, arithmétique calendaire, calculs d'écarts et formatage de dates/heures. Accessible via `NUtil.date` ou `new NDateTime()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `now` | `now()` | `Date` | Retourne la date et l'heure courantes. |
| `timestamp` | `timestamp(inSeconds = false)` | `number` | Retourne le timestamp actuel en millisecondes (ou en secondes si `inSeconds = true`). |
| `create` | `create(year, month = 1, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0)` | `Date\|null` | Crée une date avec un mois humain de `1` (Janvier) à `12` (Décembre). |
| `toDate` | `toDate(value, defaultValue = null)` | `Date\|null` | Convertit une `Date`, un timestamp ou une chaîne (`ISO`, `YYYY-MM-DD`, `DD/MM/YYYY`) en instance `Date`. |
| `isValid` | `isValid(value)` | `boolean` | Vérifie si la valeur représente une date valide. |
| `isLeapYear` | `isLeapYear(yearOrDate = new Date())` | `boolean` | Vérifie si l'année est bissextile. |
| `isToday` | `isToday(value)` | `boolean` | Vérifie si la date correspond à aujourd'hui. |
| `isPast` | `isPast(value)` | `boolean` | Vérifie si la date est antérieure à maintenant. |
| `isFuture` | `isFuture(value)` | `boolean` | Vérifie si la date est postérieure à maintenant. |
| `isWeekend` | `isWeekend(value)` | `boolean` | Vérifie si la date tombe un samedi ou un dimanche. |
| `isSameDay` | `isSameDay(dateA, dateB)` | `boolean` | Vérifie si deux dates tombent le même jour calendaire. |
| `isBefore` | `isBefore(dateA, dateB)` | `boolean` | Vérifie si `dateA < dateB`. |
| `isAfter` | `isAfter(dateA, dateB)` | `boolean` | Vérifie si `dateA > dateB`. |
| `isBetween` | `isBetween(value, start, end, inclusive = true)` | `boolean` | Vérifie si une date est comprise entre `start` et `end`. |
| `getYear` | `getYear(value)` | `number\|null` | Extrait l'année sur 4 chiffres. |
| `getMonth` | `getMonth(value)` | `number\|null` | Extrait le mois humain (`1` à `12`). |
| `getDay` | `getDay(value)` | `number\|null` | Extrait le jour du mois (`1` à `31`). |
| `getDayOfWeek` | `getDayOfWeek(value)` | `number\|null` | Extrait le jour ISO de la semaine (`1` = Lundi ... `7` = Dimanche). |
| `getHours` | `getHours(value)` | `number\|null` | Extrait les heures (`0` à `23`). |
| `getMinutes` | `getMinutes(value)` | `number\|null` | Extrait les minutes (`0` à `59`). |
| `getSeconds` | `getSeconds(value)` | `number\|null` | Extrait les secondes (`0` à `59`). |
| `daysInMonth` | `daysInMonth(yearOrDate, month)` | `number\|null` | Nombre de jours dans le mois (`28` à `31`). |
| `addYears` | `addYears(value, years)` | `Date\|null` | Ajoute ou soustrait des années. |
| `addMonths` | `addMonths(value, months)` | `Date\|null` | Ajoute ou soustrait des mois en gérant les fins de mois. |
| `addDays` | `addDays(value, days)` | `Date\|null` | Ajoute ou soustrait des jours. |
| `addHours` | `addHours(value, hours)` | `Date\|null` | Ajoute ou soustrait des heures. |
| `addMinutes` | `addMinutes(value, minutes)` | `Date\|null` | Ajoute ou soustrait des minutes. |
| `addSeconds` | `addSeconds(value, seconds)` | `Date\|null` | Ajoute ou soustrait des secondes. |
| `startOfDay` | `startOfDay(value)` | `Date\|null` | Positionne la date à `00:00:00.000`. |
| `endOfDay` | `endOfDay(value)` | `Date\|null` | Positionne la date à `23:59:59.999`. |
| `startOfMonth` | `startOfMonth(value)` | `Date\|null` | Premier jour du mois à `00:00:00.000`. |
| `endOfMonth` | `endOfMonth(value)` | `Date\|null` | Dernier jour du mois à `23:59:59.999`. |
| `startOfYear` | `startOfYear(value)` | `Date\|null` | 1er janvier à `00:00:00.000`. |
| `endOfYear` | `endOfYear(value)` | `Date\|null` | 31 décembre à `23:59:59.999`. |
| `diffInSeconds` | `diffInSeconds(dateA, dateB, absolute = true)` | `number\|null` | Écart en secondes entre deux dates. |
| `diffInMinutes` | `diffInMinutes(dateA, dateB, absolute = true)` | `number\|null` | Écart en minutes entre deux dates. |
| `diffInHours` | `diffInHours(dateA, dateB, absolute = true)` | `number\|null` | Écart en heures entre deux dates. |
| `diffInDays` | `diffInDays(dateA, dateB, absolute = true)` | `number\|null` | Écart en jours entre deux dates. |
| `getAge` | `getAge(birthDate, referenceDate = new Date())` | `number\|null` | Calcule l'âge en années révolues. |
| `format` | `format(value, pattern = 'YYYY-MM-DD HH:mm:ss')` | `string` | Formate une date selon les jetons `YYYY`, `YY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`. |
| `toSql` | `toSql(value = new Date(), includeTime = true)` | `string` | Formate au standard SQL (`YYYY-MM-DD HH:mm:ss` ou `YYYY-MM-DD`). |
| `toIso` | `toIso(value = new Date())` | `string` | Formate au standard ISO 8601 UTC. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const echeance = NUtil.date.addDays('25/11/2026', 15);
console.log(NUtil.date.format(echeance, 'DD/MM/YYYY'));         // '10/12/2026'
console.log(NUtil.date.diffInDays('2026-11-01', '2026-11-25')); // 24
console.log(NUtil.date.toSql(NUtil.date.endOfMonth('2026-02-10'))); // '2026-02-28 23:59:59'
```

---

### 6.6. Classe `NAmount` (`utils/NAmount.js`)

Calculs monétaires exacts en centimes (sans erreurs de virgule flottante IEEE 754), gestion de la TVA (HT/TTC), des remises, des conversions de devises et du formatage monétaire. Accessible via `NUtil.amount` ou `new NAmount()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isValid` | `isValid(value, allowNegative = false)` | `boolean` | Vérifie si la valeur est un montant monétaire valide. |
| `parse` | `parse(value, fallback = 0)` | `number\|null` | Extrait la valeur numérique d'un montant formaté (`'12 500,50 FCFA'` -> `12500.5`). |
| `toCents` | `toCents(amount, decimals = 2)` | `number` | Convertit un montant décimal en sous-unités entières (centimes). |
| `fromCents` | `fromCents(cents, decimals = 2)` | `number` | Convertit un nombre entier de centimes en montant décimal. |
| `add` | `add(amountA, amountB, decimals = 2)` | `number` | Additionne exactement deux montants (`0.1 + 0.2 === 0.3`). |
| `subtract` | `subtract(amountA, amountB, decimals = 2)` | `number` | Soustrait exactement deux montants. |
| `multiply` | `multiply(amount, factor, decimals = 2)` | `number` | Multiplie un montant par un facteur ou une quantité. |
| `divide` | `divide(amount, divisor, decimals = 2)` | `number` | Divise un montant par un diviseur non nul. |
| `sum` | `sum(amounts = [], decimals = 2)` | `number` | Additionne une liste de montants avec précision exacte. |
| `allocate` | `allocate(amount, parts = 2, decimals = 2)` | `number[]` | Répartit un montant en `parts` parts égales sans perdre un seul centime. |
| `taxAmount` | `taxAmount(amountHT, taxRate, decimals = 2)` | `number` | Calcule le montant de la taxe (TVA) à partir du HT. |
| `addTax` | `addTax(amountHT, taxRate, decimals = 2)` | `number` | Calcule le montant TTC à partir du HT et du taux de TVA. |
| `extractTax` | `extractTax(amountTTC, taxRate, decimals = 2)` | `{ ht, tax, ttc }` | Extrait le HT et la TVA à partir d'un montant TTC. |
| `applyDiscount` | `applyDiscount(amount, discountPercent, decimals = 2)` | `number` | Applique un pourcentage de remise. |
| `convert` | `convert(amount, exchangeRate, decimals = 2)` | `number` | Convertit un montant selon un taux de change. |
| `format` | `format(amount, currency = '', options = {})` | `string` | Formate un montant avec devise (`'XOF'`, `'EUR'`, `'USD'`, `'GBP'`, etc.). |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.amount.add(0.1, 0.2));                  // 0.3
console.log(NUtil.amount.allocate(100, 3));               // [33.34, 33.33, 33.33]
console.log(NUtil.amount.extractTax(118000, 18, 0));      // { ht: 100000, tax: 18000, ttc: 118000 }
console.log(NUtil.amount.format(75000, 'XOF'));           // '75 000 FCFA'
console.log(NUtil.amount.format(1250.5, 'EUR'));          // '1 250,50 €'
```

---

### 6.7. Classe `NEmail` (`utils/NEmail.js`)

Validation, normalisation, détection des fournisseurs gratuits/jetables, extraction de composants et masquage d'adresses e-mail. Accessible via `NUtil.email` ou `new NEmail()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isValid` | `isValid(email)` | `boolean` | Vérifie la conformité syntaxique d'une adresse e-mail (RFC 5322). |
| `isFreeProvider` | `isFreeProvider(email)` | `boolean` | Vérifie si le domaine appartient à un fournisseur grand public (`gmail.com`, `yahoo.fr`, `outlook.com`, etc.). |
| `isDisposable` | `isDisposable(email)` | `boolean` | Vérifie si le domaine appartient à un service d'e-mail temporaire/jetable (`yopmail.com`, `mailinator.com`, etc.). |
| `isCorporate` | `isCorporate(email)` | `boolean` | Vérifie si l'adresse est professionnelle (valide, ni gratuite, ni jetable). |
| `normalize` | `normalize(email, options = {})` | `string` | Normalise l'adresse en minuscules (`{ stripPlusTag: false, normalizeGmailDots: false }`). |
| `equals` | `equals(emailA, emailB, options = {})` | `boolean` | Compare deux adresses e-mail après normalisation. |
| `parse` | `parse(email)` | `{ email, local, baseLocal, tag, domain, tld }\|null` | Décompose une adresse e-mail en ses composants. |
| `getLocalPart` | `getLocalPart(email, stripPlusTag = false)` | `string` | Extrait la partie située avant `@`. |
| `getDomain` | `getDomain(email)` | `string` | Extrait le nom de domaine situé après `@`. |
| `getTld` | `getTld(email)` | `string` | Extrait l'extension de premier niveau (TLD). |
| `mask` | `mask(email, options = {})` | `string` | Masque partiellement l'adresse pour l'affichage (`co****t@nlib.dev`). |
| `formatDisplay` | `formatDisplay(email, displayName = '')` | `string` | Formate au standard `'Nom Complet <email@domaine.com>'`. |
| `extractFromText` | `extractFromText(text, unique = true)` | `string[]` | Extrait toutes les adresses e-mail présentes dans un texte. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.email.isValid('contact@nlib.dev'));     // true
console.log(NUtil.email.isCorporate('contact@nlib.dev')); // true
console.log(NUtil.email.parse('client+vip@boutique.fr')); // { email: 'client+vip@boutique.fr', local: 'client+vip', baseLocal: 'client', tag: 'vip', domain: 'boutique.fr', tld: 'fr' }
console.log(NUtil.email.mask('contact@nlib.dev'));        // 'co****t@nlib.dev'
```

---

### 6.8. Classe `NPhoneNumber` (`utils/NPhoneNumber.js`)

Validation, nettoyage, parsing d'indicatifs internationaux, formatage (`E.164`, `international`, `national`, `RFC3966`) et masquage de numéros de téléphone. Accessible via `NUtil.phone` ou `new NPhoneNumber()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `clean` | `clean(phone, keepPlus = true)` | `string` | Supprime les espaces, tirets, points et parenthèses et convertit `00` initial en `+`. |
| `digitsOnly` | `digitsOnly(phone)` | `string` | Extrait uniquement les chiffres (`0-9`). |
| `isValid` | `isValid(phone, options = {})` | `boolean` | Vérifie la validité du numéro (`{ countryCode, minLength: 7, maxLength: 15 }`). |
| `equals` | `equals(phoneA, phoneB, defaultCountryCode = '')` | `boolean` | Compare deux numéros après normalisation E.164. |
| `parse` | `parse(phone, defaultCountryCode = '')` | `{ raw, e164, countryCode, nationalNumber, digits, isInternational }\|null` | Décompose un numéro en indicatif pays, numéro national et format E.164. |
| `toE164` | `toE164(phone, defaultCountryCode = '')` | `string` | Formate au standard international E.164 (`'+22670123456'`). |
| `format` | `format(phone, style = 'international', options = {})` | `string` | Formate selon le style `'e164'`, `'international'`, `'national'` ou `'rfc3966'` (`'tel:+...'`). |
| `mask` | `mask(phone, options = {})` | `string` | Masque le numéro en gardant le début et la fin visibles. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

console.log(NUtil.phone.toE164('70 12 34 56', '226'));               // '+22670123456'
console.log(NUtil.phone.format('+22670123456', 'international'));    // '+226 70 12 34 56'
console.log(NUtil.phone.format('+33612345678', 'national'));         // '06 12 34 56 78'
console.log(NUtil.phone.mask('+22670123456'));                       // '+226****3456'
```

---

### 6.9. Classe `NUrl` (`utils/NUrl.js`)

Validation, analyse, manipulation de paramètres de requête (`Query String`), construction d'URLs et masquage/obfuscation d'identifiants de tables pour les routes. Accessible via `NUtil.url` ou `new NUrl()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isValid` | `isValid(url, options = {})` | `boolean` | Vérifie la validité d'une URL (`{ requireHttps: false, allowRelative: false }`). |
| `isAbsolute` | `isAbsolute(url)` | `boolean` | Vérifie si l'URL possède un schéma explicite (`https://...`). |
| `isRelative` | `isRelative(url)` | `boolean` | Vérifie si la chaîne est un chemin relatif (`'/api/v1'`). |
| `isHttps` | `isHttps(url)` | `boolean` | Vérifie si le protocole est `https:`. |
| `isSameOrigin` | `isSameOrigin(urlA, urlB)` | `boolean` | Vérifie si deux URLs partagent exactement la même origine (`protocol + host + port`). |
| `parse` | `parse(url)` | `Object\|null` | Décompose une URL en `{ href, protocol, origin, host, hostname, port, pathname, search, query, hash, username, password, isRelative }`. |
| `getProtocol` | `getProtocol(url)` | `string` | Extrait le protocole sans les deux-points (`'https'`). |
| `getDomain` | `getDomain(url, stripWww = false)` | `string` | Extrait le nom de domaine (`hostname`). |
| `getPath` | `getPath(url)` | `string` | Extrait le chemin (`pathname`). |
| `getPathSegments` | `getPathSegments(url)` | `string[]` | Découpe le chemin en tableau de segments. |
| `getHash` | `getHash(url)` | `string` | Extrait l'ancre sans `#`. |
| `parseQueryString` | `parseQueryString(queryOrUrl)` | `Object` | Convertit une Query String en objet clé-valeur. |
| `stringifyQueryParams` | `stringifyQueryParams(params, prefixQuestionMark = false)` | `string` | Sérialise un objet de paramètres en Query String. |
| `getQueryParam` | `getQueryParam(url, paramName, fallback = null)` | `any` | Lit la valeur d'un paramètre dans une URL. |
| `setQueryParams` | `setQueryParams(url, params)` | `string` | Ajoute, modifie ou supprime (`null`/`undefined`) des paramètres dans une URL. |
| `removeQueryParams` | `removeQueryParams(url, paramNames)` | `string` | Supprime un ou plusieurs paramètres d'une URL. |
| `join` | `join(...segments)` | `string` | Joint proprement une base et des segments de chemin sans doubles slashs. |
| `build` | `build(parts = {})` | `string` | Construit une URL complète depuis `{ base, protocol, hostname, port, path, query, hash }`. |
| `normalize` | `normalize(url, options = {})` | `string` | Normalise une URL (domaine en minuscules, tri de la query, retrait du slash final). |
| `encode` | `encode(value)` | `string` | Encode un composant d'URL au standard strict RFC 3986. |
| `decode` | `decode(encodedValue)` | `string` | Décode un composant d'URL. |
| `encodeBase64Url` | `encodeBase64Url(text)` | `string` | Encode une chaîne en Base64URL (sans `+`, `/` ni `=`). |
| `decodeBase64Url` | `decodeBase64Url(base64Url)` | `string` | Décode une chaîne Base64URL. |
| `encodeId` | `encodeId(idOrValue, salt = 'nlib-url-key')` | `string` | Obfusque et signe un identifiant de base de données pour le passer dans une URL. |
| `decodeId` | `decodeId(token, salt = 'nlib-url-key', asNumber = false)` | `string\|number\|null` | Vérifie l'intégrité et décode un identifiant obfusqué avec `encodeId`. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const url = NUtil.url.build({
    base: 'https://api.nlib.dev',
    path: ['v1', 'commandes'],
    query: { page: 2, statut: 'valide' }
});
console.log(url); // 'https://api.nlib.dev/v1/commandes?page=2&statut=valide'

// Masquer un ID de base de données dans l'URL
const jeton = NUtil.url.encodeId(42, 'secret-route');
const idRestaure = NUtil.url.decodeId(jeton, 'secret-route', true);
console.log(idRestaure); // 42
```

---

### 6.10. Classe `NJson` (`utils/NJson.js`)

Validation, parsing et sérialisation JSON tolérante aux références circulaires (`BigInt`, `Map`, `Set`), clonage profond, fusion et lecture/écriture par chemin ou index sur les objets et les tableaux. Accessible via `NUtil.json` ou `new NJson()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isValid` | `isValid(jsonString)` | `boolean` | Vérifie si une chaîne est un JSON syntaxiquement valide. |
| `isPlainObject` | `isPlainObject(value)` | `boolean` | Vérifie si la valeur est un objet littéral `{}`. |
| `isValidObject` | `isValidObject(value)` | `boolean` | Vérifie si la valeur est un objet `{}` ou une chaîne JSON représentant un objet. |
| `isValidArray` | `isValidArray(value)` | `boolean` | Vérifie si la valeur est un tableau `[]` ou une chaîne JSON représentant un tableau. |
| `isEmpty` | `isEmpty(value)` | `boolean` | Vérifie si un objet ou un tableau (ou sa chaîne JSON) est vide. |
| `size` | `size(data)` | `number` | Retourne le nombre d'éléments d'un tableau ou de clés d'un objet. |
| `parse` | `parse(value, fallback = null, reviver = null)` | `any` | Parse une chaîne JSON en toute sécurité ou retourne `fallback`. |
| `stringify` | `stringify(value, options = {})` | `string` | Sérialise en JSON en gérant les références circulaires, `BigInt`, `Set`, `Map` (`{ pretty, indent, sortKeys, fallback }`). |
| `prettify` | `prettify(value, indent = 2)` | `string` | Formate une structure ou chaîne JSON avec indentation. |
| `minify` | `minify(value)` | `string` | Compacte une structure ou chaîne JSON sur une ligne. |
| `clone` | `clone(value)` | `any` | Crée une copie profonde indépendante. |
| `equals` | `equals(a, b)` | `boolean` | Compare profondément deux structures JSON indépendamment de l'ordre des clés. |
| `merge` | `merge(...objects)` | `Object` | Fusionne profondément plusieurs objets sans modifier les sources. |
| `get` | `get(data, path, fallback = undefined)` | `any` | Lit une valeur par clé littérale (`'cle'`), index (`1`, `-1`) ou tableau de chemin (`['users', 0, 'name']`). |
| `getNumber` | `getNumber(data, path, fallback = 0)` | `number\|null` | Lit une valeur et la convertit en nombre fini. |
| `getInt` | `getInt(data, path, fallback = 0)` | `number\|null` | Lit une valeur et la convertit en entier. |
| `getFloat` | `getFloat(data, path, fallback = 0.0)` | `number\|null` | Lit une valeur et la convertit en flottant. |
| `getString` | `getString(data, path, fallback = '')` | `string` | Lit une valeur et la convertit en chaîne. |
| `getArray` | `getArray(data, path, fallback = [])` | `Array` | Lit une valeur et garantit un tableau. |
| `getObject` | `getObject(data, path, fallback = {})` | `Object\|null` | Lit une valeur et garantit un objet `{}`. |
| `has` | `has(data, path)` | `boolean` | Vérifie l'existence d'une clé, d'un index ou d'un chemin. |
| `set` | `set(data, path, value)` | `Object\|Array` | Définit une valeur à une clé, un index ou un chemin hiérarchique en créant les intermédiaires. |
| `remove` | `remove(data, path)` | `boolean` | Supprime une propriété d'objet (`delete`) ou un index de tableau (`splice`). |
| `pick` | `pick(obj, keys = [])` | `Object` | Retourne un nouvel objet ne contenant que les clés listées. |
| `omit` | `omit(obj, keysToOmit = [])` | `Object` | Retourne un nouvel objet excluant les clés listées. |
| `flatten` | `flatten(obj, separator = '.', prefix = '')` | `Object` | Aplatit un objet imbriqué en clés à un seul niveau. |
| `unflatten` | `unflatten(flatObj, separator = '.')` | `Object` | Reconstruit un objet imbriqué à partir d'un objet aplati. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const doc = { utilisateurs: [{ id: 1, nom: 'Alice', secret: 'xyz' }] };

console.log(NUtil.json.getString(doc, ['utilisateurs', 0, 'nom'])); // 'Alice'
NUtil.json.set(doc, ['utilisateurs', 0, 'actif'], true);
console.log(NUtil.json.omit(doc.utilisateurs[0], ['secret']));      // { id: 1, nom: 'Alice', actif: true }
```

---

### 6.11. Classe `NPassword` (`utils/NPassword.js`)

Validation de règles de sécurité, calcul d'entropie et de score de robustesse, génération cryptographique de mots de passe/codes PIN et hachage sécurisé PBKDF2-HMAC-SHA256. Accessible via `NUtil.password` ou `new NPassword()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `validate` | `validate(password, rules = {})` | `{ valid, errors, checks }` | Valide un mot de passe selon `{ minLength: 8, maxLength: 128, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSymbol: true, disallowSpaces: false }`. |
| `isStrong` | `isStrong(password, rules = {})` | `boolean` | Retourne `true` si le mot de passe respecte toutes les règles. |
| `strength` | `strength(password)` | `{ score, label, entropyBits, length }` | Calcule un score de `0` à `4`, un label (`'very_weak'` à `'very_strong'`) et l'entropie en bits. |
| `generate` | `generate(length = 16, options = {})` | `string` | Génère un mot de passe aléatoire cryptographique (`{ uppercase, lowercase, numbers, symbols, excludeSimilar }`). |
| `generatePin` | `generatePin(length = 6)` | `string` | Génère un code PIN numérique aléatoire. |
| `hash` | `hash(password, iterations = 100000)` | `Promise<string>` | Hache un mot de passe avec PBKDF2-HMAC-SHA256 et sel aléatoire (`pbkdf2_sha256$<iterations>$<salt>$<hash>`). |
| `verify` | `verify(password, storedHash)` | `Promise<boolean>` | Vérifie un mot de passe en temps constant contre une empreinte produite par `hash()`. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const motDePasse = NUtil.password.generate(16);
console.log(NUtil.password.strength(motDePasse)); // { score: 4, label: 'very_strong', ... }

const empreinte = await NUtil.password.hash(motDePasse);
const estValide = await NUtil.password.verify(motDePasse, empreinte);
console.log(estValide); // true
```

---

### 6.12. Classe `NArray` (`utils/NArray.js`)

Manipulation immuable de tableaux et de collections d'objets (accès, filtrage, dédoublonnage, regroupement, tri, pagination, opérations ensemblistes). Accessible via `NUtil.arr` ou `new NArray()`.

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `isArray` | `isArray(value)` | `boolean` | Vérifie si `value` est un tableau. |
| `isEmpty` | `isEmpty(list)` | `boolean` | Vérifie si le tableau est vide (ou non-tableau). |
| `isNotEmpty` | `isNotEmpty(list)` | `boolean` | Vérifie que le tableau contient au moins un élément. |
| `toArray` | `toArray(value)` | `Array` | Convertit n'importe quelle valeur (`Set`, `Iterable`, valeur simple) en tableau. |
| `clone` | `clone(list)` | `Array` | Retourne une copie superficielle du tableau. |
| `equals` | `equals(listA, listB)` | `boolean` | Compare les éléments de deux tableaux dans l'ordre. |
| `first` | `first(list, count = 1, defaultValue = undefined)` | `any\|Array` | Retourne le premier élément (ou les `count` premiers). |
| `last` | `last(list, count = 1, defaultValue = undefined)` | `any\|Array` | Retourne le dernier élément (ou les `count` derniers). |
| `at` | `at(list, index, defaultValue = undefined)` | `any` | Accède à un élément par index positif ou négatif (`-1`). |
| `insertAt` | `insertAt(list, index, ...items)` | `Array` | Retourne un nouveau tableau avec les éléments insérés à `index`. |
| `removeAt` | `removeAt(list, index)` | `Array` | Retourne un nouveau tableau sans l'élément situé à `index`. |
| `removeValue` | `removeValue(list, valueToRemove)` | `Array` | Retourne un nouveau tableau sans toutes les occurrences de `valueToRemove`. |
| `compact` | `compact(list, keepZeroAndFalse = false)` | `Array` | Supprime les valeurs nulles/vides (`null`, `undefined`, `NaN`, `''`). |
| `unique` | `unique(list, key = undefined)` | `Array` | Dédoublonne un tableau de primitives ou d'objets (par propriété `key` ou fonction). |
| `flatten` | `flatten(list, depth = Infinity)` | `Array` | Aplatit un tableau imbriqué. |
| `pluck` | `pluck(list, key)` | `Array` | Extrait la valeur de la propriété `key` de chaque objet. |
| `groupBy` | `groupBy(list, keyOrFn)` | `Object<string, Array>` | Regroupe les éléments par clé ou fonction. |
| `keyBy` | `keyBy(list, key)` | `Object<string, Object>` | Indexe un tableau d'objets par une clé unique `{ [id]: obj }`. |
| `sortBy` | `sortBy(list, keyOrFn = null, order = 'asc')` | `Array` | Trie un tableau sans modifier l'original (`'asc'` ou `'desc'`). |
| `chunk` | `chunk(list, size = 2)` | `Array<Array>` | Découpe un tableau en sous-tableaux de taille `size`. |
| `paginate` | `paginate(list, page = 1, perPage = 10)` | `{ data, page, perPage, total, totalPages, hasNext, hasPrev }` | Extrait une page avec métadonnées de pagination. |
| `shuffle` | `shuffle(list)` | `Array` | Mélange aléatoirement une copie du tableau. |
| `sample` | `sample(list, count = 1)` | `any\|Array` | Tire aléatoirement `1` ou `count` éléments. |
| `intersection` | `intersection(listA, listB)` | `Array` | Éléments communs aux deux tableaux. |
| `difference` | `difference(listA, listB)` | `Array` | Éléments présents dans `listA` mais pas dans `listB`. |
| `union` | `union(...lists)` | `Array` | Fusion sans doublons de plusieurs tableaux. |
| `range` | `range(start, end, step = 1)` | `number[]` | Génère une séquence numérique de `start` à `end` inclus. |

#### Exemple d'utilisation
```js
import { NUtil } from '@nlib/js-backend';

const produits = [
    { id: 1, cat: 'Boisson', prix: 500 },
    { id: 2, cat: 'Snack', prix: 1200 },
    { id: 3, cat: 'Boisson', prix: 800 }
];

console.log(NUtil.arr.groupBy(produits, 'cat'));
console.log(NUtil.arr.sortBy(produits, 'prix', 'desc'));
console.log(NUtil.arr.paginate(produits, 1, 2));
```


---

## 7. Dossier `database/`

Ce dossier regroupe les moteurs de persistance locaux : une façade unifiée (`NDatabase`), une base relationnelle SQLite (`NSql`), une base NoSQL orientée objets (`NIndexedDB`) et un gestionnaire clé-valeur synchrone (`NStorage`).

### 7.1. Classe `NDatabase` (`database/NDatabase.js`)

Façade unifiant l'accès à `NSql`, `NIndexedDB` et `NStorage`, avec sauvegarde automatique de la base SQLite en mémoire vers IndexedDB dans le navigateur. Accessible via `NUtil.db` (ou `NUtil.database`) ou en instanciant `new NDatabase(options)`. Hérite de `NObject`.

#### Constructeur
- `new NDatabase({ name = 'NLibDB', version = 1, stores = {}, dbStructure = null, wasmPath = null, storagePrefix = 'nlib_', autoSave = true, autoSaveDelay = 300, state })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `context` | `string` | Contexte d'exécution détecté (`'native'`, `'worker'`, `'browser'`, `'node'`). |
| `name` | `string` | Nom de la base de données. |
| `version` | `number` | Version du schéma IndexedDB. |
| `isInitialized` | `boolean` | Indique si `init()` a été exécuté. |
| `autoSave` | `boolean` | Indique si la sauvegarde automatique du snapshot SQLite vers IndexedDB est active. |
| `autoSaveDelay` | `number` | Délai de debounce (en ms) avant chaque sauvegarde automatique. |
| `sql` | `NSql` | Instance du moteur relationnel SQLite. |
| `idb` / `indexed` | `NIndexedDB` | Instance du moteur IndexedDB. |
| `store` / `storage` | `NStorage` | Instance du moteur `localStorage` / `sessionStorage`. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `init` | `init(options = {})` | `Promise<boolean>` | Initialise les moteurs (`idb`, `sql`, `store`), restaure le snapshot SQLite s'il existe et crée les tables initiales. |
| `saveSql` | `saveSql(snapshotKey = '__nsql_snapshot__')` | `Promise<boolean>` | Exporte la base SQLite en binaire et l'enregistre dans IndexedDB. |
| `loadSql` | `loadSql(snapshotKey = '__nsql_snapshot__')` | `Promise<Uint8Array\|null>` | Charge le snapshot binaire SQLite depuis IndexedDB. |
| `flushAutoSave` | `flushAutoSave()` | `Promise<boolean>` | Force l'exécution immédiate d'une sauvegarde automatique en attente. |
| `cancelAutoSave` | `cancelAutoSave()` | `this` | Annule le timer de sauvegarde automatique en cours. |
| `clearAll` | `clearAll()` | `Promise<boolean>` | Vide simultanément `NSql`, `NIndexedDB` et `NStorage`. |
| `close` | `close()` | `Promise<boolean>` | Sauvegarde les données en attente et ferme les connexions SQLite et IndexedDB. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

await NUtil.db.init({
    name: 'MonAppDB',
    version: 1,
    dbStructure: {
        users: 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT)'
    }
});

// Insertion SQL (déclenche automatiquement l'autoSave vers IndexedDB)
await NUtil.db.sql.insert('users', { name: 'Alice', email: 'alice@exemple.com' });

// Forcer la sauvegarde immédiate et fermer
await NUtil.db.flushAutoSave();
```

---

### 7.2. Classe `NSql` (`database/NSql.js`)

Moteur de base de données relationnelle SQLite fonctionnant aussi bien via le pont natif qu'en WebAssembly (`sql.js`) dans le navigateur. Accessible via `NUtil.db.sql` ou en instanciant `new NSql(options)`.

#### Constructeur
- `new NSql({ name = 'main', wasmPath = null })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Nom de la base SQLite. |
| `isInitialized` | `boolean` | Indique si le moteur SQLite est initialisé. |
| `isOpen` | `boolean` | Indique si la base est ouverte et prête à recevoir des requêtes. |
| `isNative` | `boolean` | Indique si les requêtes sont déléguées au moteur SQLite natif. |
| `rawDatabase` | `Object\|null` | Instance interne de la base `sql.js` (en mode WebAssembly). |
| `util` | `NUtil` | Référence vers `NUtil`. |
| `event` | `NEvent` | Bus d'événements émettant `'change'`, `'insert'`, `'update'`, `'delete'`, `'createTable'`, `'insert:<table>'`, `'<table>:change'`, etc. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `init` | `init(options = {})` | `Promise<boolean>` | Initialise SQLite (accepte `wasmPath`, `data` binaire initial, `dbStructure`). |
| `close` | `close()` | `Promise<boolean>` | Ferme la base de données SQLite. |
| `createTable` | `createTable(tableName, sqlCreateTable)` | `Promise<boolean>` | Exécute une instruction `CREATE TABLE IF NOT EXISTS`. |
| `createTables` | `createTables(dbStructure)` | `Promise<boolean>` | Crée plusieurs tables à partir d'un objet `{ tableName: sqlCreate }`. |
| `query` | `query(sql, params = [])` | `Promise<any>` | Exécute n'importe quelle requête SQL (`SELECT` retourne les lignes, autres retournent un booléen). |
| `execute` | `execute(sql, params = [])` | `Promise<boolean>` | Exécute une commande SQL d'écriture (`INSERT`, `UPDATE`, `DELETE`, `DDL`). |
| `select` | `select(sql, params = [])` | `Promise<Array<Object>>` | Exécute un `SELECT` et retourne un tableau d'objets `{ colonne: valeur }`. |
| `selectOne` | `selectOne(sql, params = [])` | `Promise<Object\|null>` | Retourne uniquement la première ligne du résultat ou `null`. |
| `selectAll` | `selectAll(tableName)` | `Promise<Array<Object>>` | Retourne toutes les lignes de la table spécifiée. |
| `selectAsList` | `selectAsList(sql, params = [])` | `Promise<Array<Array>>` | Exécute un `SELECT` et retourne les lignes sous forme de tableaux de valeurs. |
| `countRows` | `countRows(tableName)` | `Promise<number>` | Retourne le nombre total de lignes d'une table (`COUNT(*)`). |
| `insert` | `insert(tableName, data)` | `Promise<string\|number\|boolean\|null>` | Insère un objet ou un tableau d'objets (génère automatiquement la clé primaire si absente). |
| `update` | `update(tableName, data, condition, params = [])` | `Promise<boolean>` | Met à jour les lignes correspondant à `condition` avec les champs de `data`. |
| `delete` | `delete(tableName, condition, params = [])` | `Promise<boolean>` | Supprime les lignes correspondant à `condition`. |
| `transaction` | `transaction(callback)` | `Promise<boolean>` | Exécute `callback(this)` à l'intérieur d'une transaction atomique (`BEGIN` / `COMMIT` / `ROLLBACK`). |
| `getTableFields` | `getTableFields(tableName)` | `Promise<Array<string>>` | Retourne la liste des noms de colonnes d'une table (`PRAGMA table_info`). |
| `getPrimaryKey` | `getPrimaryKey(tableName)` | `Promise<Object\|null>` | Retourne les métadonnées de la clé primaire (`{ name, type, isAutoIncrement }`). |
| `getNextId` | `getNextId(tableName)` | `Promise<number>` | Calcule le prochain identifiant numérique (`MAX(pk) + 1`). |
| `generatePrimaryKeyValue` | `generatePrimaryKeyValue(tableName)` | `Promise<string\|number\|null>` | Génère une valeur de clé primaire adaptée au type de la colonne (entier ou chaîne). |
| `getDbStruct` | `getDbStruct()` | `Promise<Object>` | Retourne la structure complète des tables et colonnes de la base. |
| `export` | `export()` | `Uint8Array\|null` | Exporte la base SQLite en mémoire sous forme de tableau d'octets. |
| `exportBase64` | `exportBase64()` | `string` | Exporte la base SQLite sous forme de chaîne Base64. |
| `clear` | `clear()` | `Promise<boolean>` | Vide toutes les tables utilisateur de la base. |
| `deleteDb` | `deleteDb()` | `Promise<boolean>` | Supprime ou réinitialise complètement la base de données. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

const sql = NUtil.db.sql;
await sql.init();

await sql.createTable('products', `
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        price REAL DEFAULT 0
    )
`);

// Écouter les insertions sur la table 'products'
sql.event.on('insert:products', ({ data }) => {
    console.log('Produit inséré :', data);
});

// Insertion simple et en lot
await sql.insert('products', { title: 'Clavier mécanique', price: 89.99 });
await sql.insert('products', [
    { title: 'Souris sans fil', price: 39.50 },
    { title: 'Écran 27 pouces', price: 249.00 }
]);

// Sélection avec paramètres préparés
const chers = await sql.select('SELECT * FROM products WHERE price > ?', [50]);
const unProduit = await sql.selectOne('SELECT * FROM products WHERE id = ?', [1]);

// Mise à jour et suppression
await sql.update('products', { price: 79.99 }, 'id = ?', [1]);
await sql.delete('products', 'price < ?', [40]);
```

---

### 7.3. Classe `NIndexedDB` (`database/NIndexedDB.js`)

Moteur NoSQL asynchrone basé sur IndexedDB avec création dynamique d'Object Stores et chiffrement local optionnel des valeurs et des clés via `NUtil.crypto.encryptLocal` / `decryptLocal`. Accessible via `NUtil.db.idb` (ou `NUtil.db.indexed`) ou en instanciant `new NIndexedDB(options)`.

#### Constructeur
- `new NIndexedDB({ name = 'NLibDB', version = 1, stores = {}, encrypt = false, encryptKey = false })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isAvailable` | `boolean` | Indique si l'API `indexedDB` est disponible dans l'environnement. |
| `isOpen` | `boolean` | Indique si la connexion à la base IndexedDB est ouverte. |
| `name` | `string` | Nom de la base IndexedDB. |
| `version` | `number` | Version actuelle de la base. |
| `storeNames` | `Array<string>` | Liste des Object Stores existants dans la base. |
| `encryptEnabled` | `boolean` | Indique si le chiffrement automatique des valeurs est actif par défaut. |
| `encryptKeyEnabled` | `boolean` | Indique si le chiffrement déterministe des clés est actif par défaut. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `configureEncryption` | `configureEncryption({ encrypt, encryptKey })` | `this` | Active ou désactive le chiffrement par défaut des valeurs et/ou des clés. |
| `open` | `open({ name, version, stores } = {})` | `Promise<boolean>` | Ouvre la base IndexedDB et crée les Object Stores configurés. |
| `ensureStore` | `ensureStore(storeName, storeConfig = { keyPath: 'id' })` | `Promise<boolean>` | Vérifie l'existence d'un store et met à niveau la version de la base pour le créer s'il manque. |
| `put` | `put(storeName, value, key, options = {})` | `Promise<any>` | Insère ou met à jour un enregistrement (options : `{ encrypt, encryptKey }`). |
| `putMany` | `putMany(storeName, items = [], options = {})` | `Promise<boolean>` | Insère ou met à jour plusieurs enregistrements en une seule transaction. |
| `get` | `get(storeName, key, options = {})` | `Promise<any>` | Récupère et déchiffre un enregistrement par sa clé (retourne `null` si introuvable). |
| `getAll` | `getAll(storeName, options = {})` | `Promise<Array<any>>` | Récupère et déchiffre tous les enregistrements d'un store. |
| `getAllKeys` | `getAllKeys(storeName, options = {})` | `Promise<Array<any>>` | Récupère toutes les clés d'un store (et les déchiffre si `encryptKey` est actif). |
| `find` | `find(storeName, predicate, options = {})` | `Promise<Array<any>>` | Filtre les enregistrements d'un store à l'aide d'une fonction `predicate(item)`. |
| `count` | `count(storeName)` | `Promise<number>` | Retourne le nombre d'enregistrements contenus dans un store. |
| `delete` | `delete(storeName, key, options = {})` | `Promise<boolean>` | Supprime un enregistrement par sa clé. |
| `clear` | `clear(storeName)` | `Promise<boolean>` | Vide tous les enregistrements d'un store. |
| `close` | `close()` | `void` | Ferme la connexion IndexedDB active. |
| `deleteDatabase` | `deleteDatabase(dbName = this.#dbName)` | `Promise<boolean>` | Supprime complètement la base IndexedDB du navigateur. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

const idb = NUtil.db.idb;

// Activer le chiffrement local (lié à l'empreinte du navigateur)
idb.configureEncryption({ encrypt: true, encryptKey: true });

// Stocker un objet avec clé explicite ou via keyPath 'id'
await idb.put('sessions', { id: 'sess_01', token: 'xyz-987', role: 'admin' });

// Lecture et déchiffrement transparents
const session = await idb.get('sessions', 'sess_01');
console.log(session); // { id: 'sess_01', token: 'xyz-987', role: 'admin' }

// Recherche par prédicat
const admins = await idb.find('sessions', (item) => item.role === 'admin');
```

---

### 7.4. Classe `NStorage` (`database/NStorage.js`)

Gestionnaire de stockage synchrone clé-valeur (`localStorage` / `sessionStorage` avec repli en mémoire), supportant l'expiration automatique (TTL), le préfixage des clés et le chiffrement local synchrone via `NUtil.crypto.encryptLocalSync` / `decryptLocalSync`. Accessible via `NUtil.db.store` (ou `NUtil.db.storage`) ou en instanciant `new NStorage(options)`.

#### Constructeur
- `new NStorage({ prefix = 'nlib_', type = 'local', encrypt = false, encryptKey = false })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isAvailable` | `boolean` | Indique si le stockage est opérationnel. |
| `isPersistent` | `boolean` | `true` si adossé à `localStorage`/`sessionStorage`, `false` si repli en mémoire. |
| `prefix` | `string` | Préfixe appliqué aux clés stockées. |
| `size` | `number` | Nombre d'entrées appartenant au préfixe actuel. |
| `encryptEnabled` | `boolean` | Indique si le chiffrement synchrone des valeurs est actif. |
| `encryptKeyEnabled` | `boolean` | Indique si le chiffrement déterministe des clés est actif. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `configureEncryption` | `configureEncryption({ encrypt, encryptKey })` | `this` | Configure le chiffrement synchrone par défaut des valeurs et des clés. |
| `setPrefix` | `setPrefix(prefix)` | `this` | Modifie le préfixe utilisé pour isoler les clés. |
| `useSessionStorage` | `useSessionStorage()` | `this` | Bascule le moteur vers `window.sessionStorage`. |
| `useLocalStorage` | `useLocalStorage()` | `this` | Bascule le moteur vers `window.localStorage`. |
| `set` | `set(key, value, ttlSeconds = 0, options = {})` | `boolean` | Enregistre une valeur avec une durée de vie optionnelle (en secondes) et options `{ encrypt, encryptKey }`. |
| `get` | `get(key, defaultValue = null, options = {})` | `any` | Récupère une valeur (retourne `defaultValue` si absente ou expirée). |
| `getString` | `getString(key, defaultValue = '', options = {})` | `string` | Récupère une valeur convertie en chaîne de caractères. |
| `getNumber` | `getNumber(key, defaultValue = 0, options = {})` | `number` | Récupère une valeur convertie en nombre. |
| `getBoolean` | `getBoolean(key, defaultValue = false, options = {})` | `boolean` | Récupère une valeur convertie en booléen. |
| `getObject` / `getJson` | `getObject(key, defaultValue = null, options = {})` | `Object\|Array\|null` | Récupère une valeur sous forme d'objet ou de tableau. |
| `has` | `has(key, options = {})` | `boolean` | Vérifie si une clé existe et n'est pas expirée. |
| `remove` | `remove(key, options = {})` | `boolean` | Supprime une clé du stockage. |
| `keys` | `keys(options = {})` | `Array<string>` | Liste toutes les clés (sans leur préfixe, déchiffrées si `encryptKey` est actif). |
| `clear` | `clear()` | `boolean` | Supprime uniquement les entrées portant le préfixe actuel. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

const store = NUtil.db.store;

// Activer le chiffrement synchrone local
store.configureEncryption({ encrypt: true, encryptKey: true });

// Stocker une préférence valable 1 heure (3600 secondes)
store.set('user_theme', { mode: 'dark', contrast: 'high' }, 3600);

// Lecture typée
const theme = store.getObject('user_theme', { mode: 'light' });
console.log(theme.mode); // 'dark'

// Lister les clés en clair et supprimer
console.log(store.keys()); // ['user_theme']
store.remove('user_theme');
```

---

## 8. Dossier `filesystem/`

Ce dossier fournit une abstraction complète du système de fichiers (`NFile` et `NDirectory`) sélectionnant automatiquement le meilleur moteur disponible :
1. `'native'` : pont natif de l'application hôte (`NUtil.sys.invokeNative`).
2. `'fs'` : Origin Private File System (OPFS via `navigator.storage.getDirectory()`).
3. `'idb'` : stockage virtuel dans `NIndexedDB`.

### 8.1. Classe `NFile` (`filesystem/NFile.js`)

Gestion de la lecture, de l'écriture, de la conversion et de la manipulation de fichiers. Accessible via `NUtil.file` ou en instanciant `new NFile()`.

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `driver` | `string` | Moteur actif sélectionné (`'native'`, `'fs'` ou `'idb'`). |
| `isNativeAvailable` | `boolean` | Indique si le système de fichiers natif est disponible. |
| `isFsApiAvailable` | `boolean` | Indique si l'API OPFS du navigateur est disponible. |

#### Méthodes d'analyse de chemins et conversions
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `normalizePath` | `normalizePath(path = '')` | `string` | Normalise un chemin (slashes `/`, résolution des `.` et `..`). |
| `joinPath` | `joinPath(...segments)` | `string` | Concatène et normalise plusieurs segments de chemin. |
| `splitPath` | `splitPath(path)` | `Object` | Décompose un chemin en `{ fullPath, dir, fileName, baseName, ext, extWithDot }`. |
| `getDirName` | `getDirName(path)` | `string` | Retourne le dossier parent du chemin. |
| `getFileName` | `getFileName(path)` | `string` | Retourne le nom du fichier avec son extension. |
| `getBaseName` | `getBaseName(path)` | `string` | Retourne le nom du fichier sans son extension. |
| `getExtension` | `getExtension(path, includeDot = false)` | `string` | Retourne l'extension en minuscules (avec ou sans le point). |
| `getMimeType` | `getMimeType(pathOrExt, fallback)` | `string` | Déduit le type MIME à partir d'un chemin ou d'une extension. |
| `toUint8Array` | `toUint8Array(data)` | `Promise<Uint8Array>` | Convertit `string`, `ArrayBuffer`, `Blob`, ou `Array` en `Uint8Array`. |
| `toText` | `toText(data, encoding = 'utf-8')` | `Promise<string>` | Convertit des données binaires ou `Blob` en texte. |
| `toBase64` | `toBase64(data)` | `Promise<string>` | Encode des données en chaîne Base64. |
| `fromBase64` | `fromBase64(base64OrDataUrl)` | `Uint8Array` | Décode une chaîne Base64 ou Data URL en `Uint8Array`. |
| `toDataUrl` | `toDataUrl(data, mimeType)` | `Promise<string>` | Convertit des données en Data URL (`data:<mime>;base64,...`). |
| `toBlob` | `toBlob(data, mimeType)` | `Promise<Blob\|null>` | Convertit des données en instance `Blob`. |

#### Méthodes d'opérations sur les fichiers
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `exists` | `exists(path, options = {})` | `Promise<boolean>` | Vérifie si le fichier existe. |
| `stat` / `info` | `stat(path, options = {})` | `Promise<Object\|null>` | Retourne les métadonnées (`{ path, name, size, mimeType, createdAt, updatedAt, driver }`). |
| `write` | `write(path, data, options = {})` | `Promise<boolean>` | Écrit des données dans un fichier (crée les dossiers parents si nécessaire). |
| `writeText` | `writeText(path, text = '', options = {})` | `Promise<boolean>` | Écrit une chaîne de caractères UTF-8 dans un fichier. |
| `writeJson` | `writeJson(path, value, options = {})` | `Promise<boolean>` | Sérialise et écrit un objet JSON dans un fichier. |
| `writeBytes` | `writeBytes(path, bytes, options = {})` | `Promise<boolean>` | Écrit des octets (`Uint8Array` / `ArrayBuffer`) dans un fichier. |
| `writeBase64` | `writeBase64(path, base64OrDataUrl, options = {})` | `Promise<boolean>` | Décode une chaîne Base64/DataURL et l'écrit dans un fichier. |
| `append` | `append(path, data, options = {})` | `Promise<boolean>` | Ajoute des données à la fin d'un fichier existant (ou le crée). |
| `read` / `readBytes` | `read(path, options = {})` | `Promise<Uint8Array\|null>` | Lit le contenu binaire brut d'un fichier. |
| `readText` | `readText(path, options = {})` | `Promise<string\|null>` | Lit le contenu d'un fichier sous forme de texte. |
| `readJson` | `readJson(path, options = {})` | `Promise<any>` | Lit et parse un fichier JSON (retourne `options.defaultValue` si invalide). |
| `readBase64` | `readBase64(path, options = {})` | `Promise<string\|null>` | Lit un fichier et retourne son contenu en Base64. |
| `readDataUrl` | `readDataUrl(path, options = {})` | `Promise<string\|null>` | Lit un fichier et retourne son contenu sous forme de Data URL. |
| `readBlob` | `readBlob(path, options = {})` | `Promise<Blob\|null>` | Lit un fichier et retourne une instance `Blob`. |
| `delete` / `remove` | `delete(path, options = {})` | `Promise<boolean>` | Supprime un fichier. |
| `copy` | `copy(sourcePath, destinationPath, options = {})` | `Promise<boolean>` | Copie un fichier vers un nouvel emplacement (`overwrite: true` par défaut). |
| `move` | `move(sourcePath, destinationPath, options = {})` | `Promise<boolean>` | Déplace un fichier vers un nouvel emplacement. |
| `rename` | `rename(path, newFileName, options = {})` | `Promise<boolean>` | Renomme un fichier dans son dossier actuel. |
| `checksum` | `checksum(path, options = {})` | `Promise<string\|null>` | Calcule l'empreinte cryptographique (`SHA-256` par défaut) du fichier. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

// Écriture et lecture JSON
await NUtil.file.writeJson('config/settings.json', { version: 2, offline: true });
const settings = await NUtil.file.readJson('config/settings.json');

// Ajout de texte et calcul de checksum
await NUtil.file.writeText('logs/app.log', 'Démarrage\n');
await NUtil.file.append('logs/app.log', 'Connexion établie\n');

const info = await NUtil.file.stat('logs/app.log');
const hash = await NUtil.file.checksum('logs/app.log');
console.log(info.size, hash);
```

---

### 8.2. Classe `NDirectory` (`filesystem/NDirectory.js`)

Gestion de l'arborescence des répertoires (création, parcours, recherche, copie, taille). Accessible via `NUtil.dir` (ou `NUtil.directory`) ou en instanciant `new NDirectory()`.

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `driver` | `string` | Moteur actif sélectionné (`'native'`, `'fs'` ou `'idb'`). |
| `isNativeAvailable` | `boolean` | Indique si le système de fichiers natif est disponible. |
| `isFsApiAvailable` | `boolean` | Indique si l'API OPFS du navigateur est disponible. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `normalizePath` | `normalizePath(path = '')` | `string` | Normalise le chemin d'un dossier. |
| `joinPath` | `joinPath(...segments)` | `string` | Concatène plusieurs segments de chemin. |
| `getName` | `getName(path)` | `string` | Retourne le nom du dossier final. |
| `getParent` | `getParent(path)` | `string` | Retourne le chemin du dossier parent. |
| `exists` | `exists(path = '', options = {})` | `Promise<boolean>` | Vérifie si un dossier existe. |
| `create` / `mkdir` / `ensure` | `create(path, options = {})` | `Promise<boolean>` | Crée un dossier ainsi que tous ses dossiers parents (`recursive: true`). |
| `stat` / `info` | `stat(path = '', options = {})` | `Promise<Object\|null>` | Retourne les informations du dossier (`{ path, name, isDirectory, filesCount, directoriesCount, size }`). |
| `list` | `list(path = '', options = {})` | `Promise<Array<Object>>` | Liste les entrées du dossier (`options.recursive = true` pour tout parcourir). |
| `listFiles` | `listFiles(path = '', options = {})` | `Promise<Array<Object>>` | Liste uniquement les fichiers contenus dans le dossier. |
| `listDirectories` | `listDirectories(path = '', options = {})` | `Promise<Array<Object>>` | Liste uniquement les sous-dossiers. |
| `tree` | `tree(path = '', options = {})` | `Promise<Object>` | Génère une structure arborescente complète avec `children`. |
| `find` | `find(path = '', criteria = {})` | `Promise<Array<Object>>` | Recherche des entrées selon `{ name, ext, type, filter, recursive }`. |
| `size` | `size(path = '', options = {})` | `Promise<number>` | Calcule la taille totale en octets de tous les fichiers du dossier. |
| `clear` | `clear(path, options = {})` | `Promise<boolean>` | Vide le contenu d'un dossier sans supprimer le dossier lui-même. |
| `delete` / `rmdir` | `delete(path, options = {})` | `Promise<boolean>` | Supprime un dossier (`recursive: true` par défaut). |
| `copy` | `copy(sourcePath, destinationPath, options = {})` | `Promise<boolean>` | Copie récursivement un dossier et tous ses fichiers vers une destination. |
| `move` | `move(sourcePath, destinationPath, options = {})` | `Promise<boolean>` | Déplace un dossier et son contenu vers une nouvelle destination. |
| `rename` | `rename(path, newDirectoryName, options = {})` | `Promise<boolean>` | Renomme un dossier dans son répertoire parent. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

// Créer une arborescence et y ajouter des fichiers
await NUtil.dir.ensure('projets/2026/rapports');
await NUtil.file.writeText('projets/2026/rapports/bilan.txt', 'Contenu du bilan');

// Rechercher tous les fichiers .txt récursivement
const fichiersTxt = await NUtil.dir.find('projets', { ext: 'txt', recursive: true });
console.log(fichiersTxt);

// Obtenir l'arborescence complète et la taille
const arborescence = await NUtil.dir.tree('projets');
const tailleTotale = await NUtil.dir.size('projets');
```

---

## 9. Dossier `cache/`

### 9.1. Classe `NCache` (`cache/NCache.js`)

Système de mise en cache unifié utilisant un seul moteur actif selon la priorité suivante :
1. `'native'` : pont natif (`type: ['app', 'cache', action]`).
2. `'caches'` : API `CacheStorage` du navigateur / Service Worker (`caches.open`).
3. `'idb'` : base `NIndexedDB`.
4. `'store'` : stockage `NStorage` (`localStorage`).
5. `'memory'` : cache LRU en mémoire vive.

Accessible via `NUtil.cache` ou en instanciant `new NCache(options)`.

#### Constructeur
- `new NCache({ maxMemoryEntries = 500, defaultTtl = 0, namespace = 'default', cacheStorageName = 'nlib-cache-v1' })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `driver` | `string` | Moteur unique utilisé (`'native'`, `'caches'`, `'idb'`, `'store'` ou `'memory'`). |
| `isNativeAvailable` | `boolean` | Indique si le moteur natif est disponible. |
| `isCacheStorageAvailable` | `boolean` | Indique si l'API `CacheStorage` est disponible. |
| `isIdbAvailable` | `boolean` | Indique si `NIndexedDB` est disponible. |
| `isStoreAvailable` | `boolean` | Indique si `NStorage` est disponible. |
| `stats` | `Object` | Statistiques d'utilisation (`{ driver, hits, misses, totalRequests, hitRate }`). |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `set` | `set(key, value, options = {})` | `Promise<boolean>` | Met en cache une valeur (options : `{ ttl, namespace, tags, mimeType }`). |
| `get` | `get(key, options = {})` | `Promise<any>` | Récupère une valeur en cache (retourne `options.defaultValue` si absente ou expirée). |
| `has` | `has(key, options = {})` | `Promise<boolean>` | Vérifie si une entrée valide existe dans le cache. |
| `remember` / `getOrSet` | `remember(key, ttlOrOptions, factoryFn)` | `Promise<any>` | Retourne la valeur en cache si elle existe, sinon exécute `factoryFn()`, met le résultat en cache et le retourne. |
| `delete` / `remove` | `delete(key, options = {})` | `Promise<boolean>` | Supprime une entrée du cache. |
| `clearByTag` | `clearByTag(tag, options = {})` | `Promise<number>` | Supprime toutes les entrées associées à un tag et retourne le nombre d'éléments supprimés. |
| `prune` | `prune(options = {})` | `Promise<number>` | Supprime toutes les entrées dont le TTL a expiré. |
| `keys` | `keys(options = {})` | `Promise<Array<string>>` | Liste toutes les clés actives d'un `namespace`. |
| `clear` | `clear(options = {})` | `Promise<boolean>` | Vide toutes les entrées d'un `namespace` (ou tout le cache si `options.all = true`). |
| `putResponse` | `putResponse(url, responseOrData, options = {})` | `Promise<boolean>` | Met en cache une `Response` HTTP ou des données associées à une URL. |
| `matchUrl` | `matchUrl(url, options = {})` | `Promise<any>` | Recherche une réponse mise en cache pour une URL (`options.rawResponse = true` pour obtenir une `Response`). |
| `cacheUrl` | `cacheUrl(url, options = {})` | `Promise<any>` | Récupère une URL sur le réseau (ou sert le cache si déjà présent) et l'enregistre. |
| `deleteUrl` | `deleteUrl(url, options = {})` | `Promise<boolean>` | Supprime une URL mise en cache. |
| `cacheFile` | `cacheFile(keyOrPath, data, options = {})` | `Promise<boolean>` | Met en cache un fichier binaire, texte ou `Blob` avec son type MIME. |
| `getFile` | `getFile(keyOrPath, options = {})` | `Promise<any>` | Récupère un fichier du cache au format souhaité (`as: 'bytes' \| 'text' \| 'base64' \| 'dataUrl' \| 'blob'`). |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

// Mise en cache avec tags et TTL de 5 minutes (300s)
await NUtil.cache.set('profil_42', { id: 42, nom: 'Jean' }, {
    ttl: 300,
    tags: ['utilisateurs', 'equipe_a']
});

// Patron remember (calcule uniquement en cas de cache miss)
const stats = await NUtil.cache.remember('dashboard_stats', 60, async () => {
    return { ventes: 128, visiteurs: 4500 };
});

// Invalidation par tag
await NUtil.cache.clearByTag('equipe_a');
```

---

## 10. Dossier `requests/`

Ce dossier gère les communications réseau HTTP/WebSocket chiffrées (`NNetwork`), la synchronisation entre tables SQLite locales et serveur distant (`NTableRequest`), ainsi que l'orchestration multi-tables (`NRequestManager`).

### 10.1. Classe `NNetwork` (`requests/NNetwork.js`)

Client HTTP (`fetch` / pont natif) et WebSocket intégrant nativement le chiffrement client-serveur de `NUtil.crypto` (hybride asymétrique `RSA-OAEP` + `AES-GCM` ou symétrique `AES-GCM`) avec sauvegarde automatique des clés chiffrées localement dans `NUtil.db.idb`. Accessible via `NUtil.net` (ou `NUtil.network`) ou en instanciant `new NNetwork(options)`.

#### Constructeur
- `new NNetwork({ baseUrl = '', timeout = 30000, headers = {}, encryption = null })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isOnline` | `boolean` | Indique si l'appareil est connecté au réseau. |
| `baseUrl` | `string` | URL de base préfixée aux requêtes relatives. |
| `defaultTimeout` | `number` | Délai d'expiration par défaut des requêtes (en ms). |
| `defaultHeaders` | `Object` | En-têtes HTTP envoyés par défaut à chaque requête. |
| `isEncryptionEnabled` | `boolean` | Indique si le chiffrement automatique des requêtes/réponses est activé. |
| `encryptionMode` | `string` | Mode de chiffrement configuré (`'asymmetric'` ou `'symmetric'`). |
| `hasEncryptionKeys` | `boolean` | Indique si les clés nécessaires au mode de chiffrement choisi sont chargées. |
| `activeSocketCount` | `number` | Nombre de connexions WebSocket actuellement ouvertes. |

#### Méthodes de configuration et de chiffrement
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `setBaseUrl` | `setBaseUrl(url = '')` | `this` | Définit l'URL de base du serveur. |
| `setDefaultTimeout` | `setDefaultTimeout(ms)` | `this` | Définit le timeout par défaut en millisecondes. |
| `setDefaultHeader` | `setDefaultHeader(name, value)` | `this` | Ajoute ou remplace un en-tête HTTP par défaut. |
| `removeDefaultHeader` | `removeDefaultHeader(name)` | `this` | Supprime un en-tête HTTP par défaut. |
| `setBearerToken` | `setBearerToken(token)` | `this` | Définit ou supprime l'en-tête `Authorization: Bearer <token>`. |
| `configureEncryption` | `configureEncryption(config = {})` | `Promise<this>` | Configure le chiffrement (`{ enabled, mode, serverPublicKey, clientPublicKey, clientPrivateKey, sharedSecret, persistKeys }`). |
| `generateClientKeyPair` | `generateClientKeyPair(options = {})` | `Promise<Object\|null>` | Génère une paire de clés RSA client via `NUtil.crypto.generateKeyPair`, la sauvegarde dans IndexedDB et retourne `{ publicKey, privateKey }` en PEM. |
| `setServerPublicKey` | `setServerPublicKey(publicKeyOrPem, persist = true)` | `Promise<boolean>` | Importe et enregistre la clé publique RSA du serveur pour chiffrer les requêtes sortantes. |
| `setClientKeyPair` | `setClientKeyPair({ publicKey, privateKey }, persist = true)` | `Promise<boolean>` | Importe et enregistre la paire de clés RSA du client pour déchiffrer les réponses entrantes. |
| `setSharedSecret` | `setSharedSecret(secretKey, persist = true)` | `Promise<boolean>` | Définit le secret partagé pour le mode `'symmetric'` (`AES-GCM`). |
| `loadKeysFromStorage` | `loadKeysFromStorage()` | `Promise<boolean>` | Recharge les clés depuis `NUtil.db.idb` (chiffrées localement). |
| `clearEncryptionKeys` | `clearEncryptionKeys(removeFromStorage = true)` | `Promise<boolean>` | Efface les clés en mémoire et optionnellement dans IndexedDB. |
| `encryptPayload` | `encryptPayload(data)` | `Promise<string\|null>` | Chiffre une charge utile selon le mode actif (`NUtil.crypto.encrypt` ou `encryptSymmetric`). |
| `decryptPayload` | `decryptPayload(encryptedPayload, parseJson = true)` | `Promise<any>` | Déchiffre une charge utile reçue du serveur (`NUtil.crypto.decrypt` ou `decryptSymmetric`). |

#### Méthodes HTTP et WebSocket
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `request` | `request(options = {})` | `Promise<Object>` | Exécute une requête complète et retourne `{ ok, status, statusText, headers, data, raw, url, duration, encrypted }`. |
| `get` | `get(url, options = {})` | `Promise<Object>` | Exécute une requête `GET` (supporte `options.params`, `options.cacheTtl`, `options.retries`). |
| `post` | `post(url, body = null, options = {})` | `Promise<Object>` | Exécute une requête `POST` (chiffre automatiquement `body` si le chiffrement est actif). |
| `put` | `put(url, body = null, options = {})` | `Promise<Object>` | Exécute une requête `PUT`. |
| `patch` | `patch(url, body = null, options = {})` | `Promise<Object>` | Exécute une requête `PATCH`. |
| `delete` | `delete(url, options = {})` | `Promise<Object>` | Exécute une requête `DELETE`. |
| `upload` | `upload(url, filesOrFields = {}, options = {})` | `Promise<Object>` | Envoie un `FormData` contenant des fichiers et des champs. |
| `download` | `download(url, options = {})` | `Promise<Object>` | Télécharge une ressource binaire (`Uint8Array`) et peut l'enregistrer directement via `NUtil.file` si `options.savePath` est fourni. |
| `connectWebSocket` | `connectWebSocket(url, options = {})` | `Object\|null` | Ouvre un WebSocket avec reconnexion automatique et chiffrement optionnel des messages. |
| `sendWebSocket` | `sendWebSocket(idOrUrl, data, options = {})` | `Promise<boolean>` | Envoie un message (chiffré ou non) sur un WebSocket ouvert. |
| `closeWebSocket` | `closeWebSocket(idOrUrl, code = 1000, reason)` | `boolean` | Ferme proprement une connexion WebSocket et stoppe sa reconnexion automatique. |
| `closeAllWebSockets` | `closeAllWebSockets()` | `void` | Ferme toutes les connexions WebSocket actives. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

NUtil.net.setBaseUrl('https://api.exemple.com');
NUtil.net.setBearerToken('mon-jwt-token');

// 1. Générer les clés RSA du client et configurer la clé publique du serveur
const clientPem = await NUtil.net.generateClientKeyPair();
await NUtil.net.configureEncryption({
    enabled: true,
    mode: 'asymmetric',
    serverPublicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----'
});

// 2. Envoyer une requête POST (le corps est chiffré avec la clé publique du serveur
// et la réponse chiffrée est déchiffrée avec la clé privée du client)
const res = await NUtil.net.post('/orders', { item: 'Laptop', qty: 1 });
if (res.ok) {
    console.log('Réponse déchiffrée :', res.data);
}
```

---

### 10.2. Classe `NTableRequest` (`requests/NTableRequest.js`)

Synchronisation bidirectionnelle d'une table SQLite locale (`NSql`) avec un serveur distant (`NNetwork`). Chaque opération peut cibler le serveur (`getData`, `insertData`, etc.) et mettre à jour automatiquement la base SQLite locale (`get`, `insert`, `update`, `delete`, `syncDatas`). Hérite de `NObject`.

#### Constructeur
- `new NTableRequest({ table = '', request = null, db = null, primaryKey = 'id', state })`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `table` | `string` | Nom de la table SQLite et de la ressource serveur. |
| `primaryKey` | `string` | Nom de la colonne clé primaire (`'id'` par défaut). |
| `db` | `NSql` | Instance SQLite utilisée (`NUtil.db.sql` par défaut). |
| `request` | `NNetwork` | Instance réseau utilisée (`NUtil.net` par défaut). |
| `isSyncing` | `boolean` | Indique si une synchronisation complète (`syncDatas`) est en cours. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `getData` | `getData(req = {})` | `Promise<Object\|null>` | Récupère un enregistrement unique depuis le serveur sans modifier la base locale. |
| `get` | `get(req = {})` | `Promise<Object\|null>` | Récupère un enregistrement depuis le serveur et l'insère/met à jour dans SQLite (repli sur SQLite si hors-ligne). |
| `getDatas` | `getDatas(req = {})` | `Promise<Array<Object>>` | Récupère une liste d'enregistrements depuis le serveur. |
| `gets` | `gets(req = {})` | `Promise<Array<Object>>` | Récupère une liste depuis le serveur, synchronise les lignes dans SQLite et retourne la liste (repli sur SQLite si hors-ligne). |
| `insertData` | `insertData(req = {})` | `Promise<Object\|null>` | Envoie une demande de création au serveur et retourne l'objet créé. |
| `insert` | `insert(req = {})` | `Promise<Object\|boolean\|null>` | Crée l'enregistrement sur le serveur puis l'insère dans la table SQLite locale (ou localement si `req.offline = true`). |
| `updateData` | `updateData(req = {})` | `Promise<Object\|boolean\|null>` | Envoie une demande de mise à jour au serveur. |
| `update` | `update(req = {})` | `Promise<boolean>` | Met à jour l'enregistrement sur le serveur puis dans la table SQLite locale. |
| `deleteData` | `deleteData(req = {})` | `Promise<boolean>` | Envoie une demande de suppression au serveur. |
| `delete` | `delete(req = {})` | `Promise<boolean>` | Supprime l'enregistrement sur le serveur puis dans la table SQLite locale. |
| `syncDatas` | `syncDatas(options = {})` | `Promise<boolean>` | Synchronise par lots (pagination `batchSize`) les données distantes avec la table SQLite locale et émet `'sync:progress'` / `'sync:complete'`. |
| `generateSqlSearch` | `generateSqlSearch(textSearch, arrayField)` | `string` | Génère une clause SQL `LIKE` multi-mots et multi-colonnes. |
| `generateSqlSearchParams` | `generateSqlSearchParams(textSearch, arrayField)` | `Object` | Génère une clause SQL paramétrée `{ clause, params }` sécurisée contre les injections. |
| `generateSqlLimited` | `generateSqlLimited(limit, offset = 0)` | `string` | Génère une clause `LIMIT <limit> OFFSET <offset>`. |

#### Exemple
```javascript
import { NTableRequest } from '@nlib/js-backend';

const clientsReq = new NTableRequest({
    table: 'clients',
    primaryKey: 'id'
});

// Écouter la progression de synchronisation
clientsReq.on('sync:progress', ({ synced }) => {
    console.log(`${synced} clients synchronisés...`);
});

// Synchroniser tous les clients par lots de 200
await clientsReq.syncDatas({ batchSize: 200 });

// Construire une recherche SQL sécurisée
const { clause, params } = clientsReq.generateSqlSearchParams('dupont paris', ['nom', 'ville']);
```

---

### 10.3. Classe `NRequestManager` (`requests/NRequestManager.js`)

Registre centralisant plusieurs instances de `NTableRequest` pour gérer et synchroniser facilement l'ensemble des tables d'une application.

#### Constructeur
- `new NRequestManager({ db = null, request = null } = {})`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `size` | `number` | Nombre de tables enregistrées dans le gestionnaire. |
| `tables` | `Array<string>` | Liste des noms de tables enregistrées. |
| `db` | `NSql` | Instance SQLite partagée par les tables. |
| `request` | `NNetwork` | Instance réseau partagée par les tables. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `register` | `register(tableName, instanceOrOptions = {})` | `NTableRequest\|null` | Enregistre une table dans le gestionnaire et retourne son instance `NTableRequest`. |
| `table` | `table(tableName, options = {})` | `NTableRequest\|null` | Récupère l'instance `NTableRequest` d'une table ou la crée automatiquement si elle n'existe pas encore. |
| `get` | `get(tableName)` | `NTableRequest\|null` | Récupère l'instance d'une table enregistrée (ou `null`). |
| `has` | `has(tableName)` | `boolean` | Vérifie si une table est enregistrée. |
| `unregister` | `unregister(tableName)` | `boolean` | Retire une table du gestionnaire. |
| `syncAll` | `syncAll(options = {})` | `Promise<Object>` | Lance `syncDatas` sur toutes les tables (en séquence ou en parallèle avec `options.parallel = true`). |
| `clear` | `clear()` | `void` | Vide le registre de toutes ses tables. |

#### Exemple
```javascript
import { NRequestManager } from '@nlib/js-backend';

const manager = new NRequestManager();

// Accès direct (création à la volée)
const usersTable = manager.table('users', { primaryKey: 'id' });
const invoicesTable = manager.table('invoices', { primaryKey: 'invoice_id' });

// Synchroniser toutes les tables en parallèle
const resultats = await manager.syncAll({ parallel: true, batchSize: 500 });
console.log(resultats); // { users: true, invoices: true }
```

---

## 11. Dossier `worker/`

Ce dossier regroupe les outils de calcul parallèle et d'interception réseau/hors-ligne : Web Workers bidirectionnels (`NWorker`, `NManagedWorker`, `NWorkerManager`) et Service Worker / mode hors-ligne (`NServiceWorker`).

### 11.1. Classe `NWorker` (`worker/NWorker.js`)

Encapsule un Web Worker avec un protocole de requêtes/réponses par promesses, suivi de progression (`onUpdate`), gestion de timeout et exécution de repli sur le thread principal lorsque l'API `Worker` n'est pas supportée. Hérite de `NObject`.

#### Constructeur
- `new NWorker({ name = 'worker', url = null, source = null, type = 'module', state } = {})`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Nom identifiant le worker. |
| `isRunning` | `boolean` | Indique si le Web Worker sous-jacent est actif. |
| `pendingCount` | `number` | Nombre de requêtes actuellement en attente de réponse. |

#### Méthodes d'instance (Thread principal & Worker)
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `request` | `request(action, params = {}, onUpdate = null, timeout = null)` | `Promise<any>` | Envoie une action au Worker et attend son résultat (`onUpdate` reçoit les notifications intermédiaires). |
| `onRequest` | `onRequest(action, params, onUpdate)` | `Promise<any>` | Méthode appelée lorsqu'une requête entrante est reçue (peut être surchargée dans une sous-classe). |
| `terminate` | `terminate()` | `void` | Arrête immédiatement le Web Worker et résout les requêtes en attente à `null`. |
| `destroy` | `destroy()` | `void` | Termine le worker et nettoie tous les écouteurs d'événements (`NObject`). |

#### Méthodes statiques (Exécutées à l'intérieur du Web Worker)
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `NWorker.addActionInstance` | `NWorker.addActionInstance(action, initFunction)` | `void` | Enregistre un gestionnaire d'action dans le contexte du Worker. |
| `NWorker.getActionInstance` | `NWorker.getActionInstance(action)` | `Function\|null` | Récupère la fonction associée à une action enregistrée. |
| `NWorker.requestMain` | `NWorker.requestMain(action, params = {}, onUpdate = null, timeout = null)` | `Promise<any>` | Envoie une requête depuis le Web Worker vers le thread principal. |

#### Exemple
```javascript
import { NWorker } from '@nlib/js-backend';

// Création d'un Worker à partir d'un code source inline
const workerCode = `
    self.onmessage = async (e) => {
        const { id, action, params } = e.data;
        if (action === 'calculLourd') {
            // Envoyer une progression
            self.postMessage({ id, type: 'update', data: { progress: 50 } });
            const total = (params.items || []).reduce((a, b) => a + b, 0);
            self.postMessage({ id, type: 'response', data: total });
        }
    };
`;

const monWorker = new NWorker({ name: 'calc', source: workerCode });

const resultat = await monWorker.request(
    'calculLourd',
    { items: [10, 20, 30, 40] },
    (update) => console.log('Progression :', update.progress + '%')
);
console.log('Total :', resultat); // 100
```

---

### 11.2. Classe `NManagedWorker` (`worker/NManagedWorker.js`)

Sous-classe de `NWorker` intégrée à `NWorkerManager`. Lorsqu'un Web Worker appelle `NWorker.requestMain(action, params)`, `NManagedWorker` délègue automatiquement l'exécution aux actions enregistrées dans son `NWorkerManager`.

#### Constructeur
- `new NManagedWorker(options = {}, manager = null)`

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `manager` | `NWorkerManager\|null` | Référence vers le gestionnaire parent. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `onRequest` | `onRequest(action, params, onUpdate)` | `Promise<any>` | Relaye toute requête entrante du worker vers `manager.executeAction(action, params, onUpdate)`. |

---

### 11.3. Classe `NWorkerManager` (`worker/NWorkerManager.js`)

Gestionnaire centralisé de Web Workers et de pools de workers (répartition de charge Round-Robin), préconfiguré avec les actions `'invokeNative'` et `'requestApp'` pour permettre aux workers d'invoquer le pont natif à travers le thread principal. Accessible via `NUtil.worker` ou en instanciant `new NWorkerManager()`.

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `isWorkerContext` | `boolean` | Indique si le code s'exécute actuellement dans un Web Worker. |
| `isSupported` | `boolean` | Indique si l'API `Worker` est disponible. |
| `size` | `number` | Nombre de workers ou pools enregistrés. |
| `names` | `Array<string>` | Liste des noms de tous les workers enregistrés. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `registerAction` | `registerAction(action, handler)` | `this` | Enregistre une action globale accessible par tous les `NManagedWorker` lorsqu'ils sollicitent le thread principal. |
| `unregisterAction` | `unregisterAction(action)` | `boolean` | Supprime une action enregistrée. |
| `hasAction` | `hasAction(action)` | `boolean` | Vérifie si une action est enregistrée. |
| `executeAction` | `executeAction(action, params = {}, onUpdate = null)` | `Promise<any>` | Exécute une action enregistrée sur le thread principal. |
| `create` | `create(name, options = {})` | `NManagedWorker` | Crée, enregistre et retourne un `NManagedWorker`. |
| `add` | `add(name, worker)` | `NWorker\|null` | Enregistre une instance existante de `NWorker`. |
| `createPool` | `createPool(name, options = {}, size = NUtil.sys.cpuCores)` | `Array<NManagedWorker>` | Crée un pool de plusieurs workers partageant la charge en Round-Robin. |
| `has` | `has(name)` | `boolean` | Vérifie si un worker ou un pool existe sous ce nom. |
| `get` | `get(name)` | `NWorker\|null` | Récupère un worker par son nom (ou le prochain worker disponible s'il s'agit d'un pool). |
| `request` | `request(name, action, params = {}, onUpdate = null, timeout = null)` | `Promise<any>` | Exécute une requête sur le worker ou le pool désigné par `name`. |
| `terminate` | `terminate(name)` | `boolean` | Termine et supprime un worker ou un pool complet. |
| `terminateAll` | `terminateAll()` | `void` | Termine tous les workers et pools gérés. |
| `toJSON` | `toJSON()` | `Object` | Retourne un état sérialisable des workers, pools et actions. |

#### Exemple
```javascript
import { NUtil } from '@nlib/js-backend';

// Enregistrer une action sur le thread principal accessible depuis n'importe quel worker
NUtil.worker.registerAction('lirePreference', async ({ cle }) => {
    return NUtil.db.store.get(cle);
});

// Créer un pool de 4 workers pour répartir les calculs
NUtil.worker.createPool('imagePool', { url: '/workers/image-processor.js' }, 4);

// Les appels successifs sont automatiquement distribués entre les 4 workers
const img1 = await NUtil.worker.request('imagePool', 'resize', { width: 800 });
const img2 = await NUtil.worker.request('imagePool', 'resize', { width: 400 });
```

---

### 11.4. Classe `NServiceWorker` (`worker/NServiceWorker.js`)

Système complet de gestion du mode hors-ligne (Offline), d'interception des requêtes HTTP, de mise en cache intelligente (`NUtil.cache` / `NUtil.file`), de point d'entrée unique (`entryPoint`) pour les applications monopages (SPA), et de repli automatique par **Monkey Patching** (`globalThis.fetch` et `XMLHttpRequest`) lorsque l'API `ServiceWorker` n'est pas disponible (WebView locale, HTTP non sécurisé, contexte restreint).

Cette classe est autonome et s'instancie directement via `new NServiceWorker(options)`.

#### Constructeur
- `new NServiceWorker({ swUrl = '/sw.js', scope = '/', entryPoint = '/index.html', defaultStrategy = 'network-first', defaultTtl = 0, precache = [], routes = [] } = {})`

#### Stratégies de cache supportées
- `'cache-first'` : Sert immédiatement depuis `NUtil.cache` (ou `NUtil.file`), sinon interroge le réseau et met en cache.
- `'network-first'` : Interroge le réseau en priorité, met à jour le cache, et bascule sur le cache en cas d'échec ou de mode hors-ligne.
- `'stale-while-revalidate'` : Sert immédiatement la version en cache tout en mettant à jour le cache en arrière-plan depuis le réseau.
- `'cache-only'` : Lit exclusivement depuis le cache ou les fichiers locaux (`NUtil.file`).
- `'network-only'` : Passe toujours par le réseau sans utiliser le cache.

#### Propriétés (Getters)
| Propriété | Type | Description |
| :--- | :--- | :--- |
| `event` | `NEvent` | Bus d'événements émettant `'enabled'`, `'disabled'`, `'precache'`, `'intercept'`, `'offlineFallback'` et `'updated'`. |
| `isNativeSupported` | `boolean` | Indique si `navigator.serviceWorker` est supporté par l'environnement. |
| `isServiceWorkerScope` | `boolean` | Indique si l'instance tourne à l'intérieur même du fichier `sw.js`. |
| `isEnabled` | `boolean` | Indique si le système est activé. |
| `isMonkeyPatched` | `boolean` | Indique si l'interception par Monkey Patching (`fetch` / `XHR`) est active. |
| `mode` | `string` | Mode de fonctionnement actuel (`'native-sw'`, `'worker-scope'`, `'monkey-patch'` ou `'inactive'`). |
| `entryPoint` | `string` | URL ou chemin du point d'entrée HTML servi pour les navigations de pages hors-ligne. |

#### Méthodes
| Méthode | Signature | Retour | Description |
| :--- | :--- | :--- | :--- |
| `configure` | `configure(options = {})` | `this` | Met à jour la configuration (`swUrl`, `scope`, `entryPoint`, `defaultStrategy`, `defaultTtl`, `precache`, `routes`). |
| `setEntryPoint` | `setEntryPoint(entryPointUrl)` | `this` | Définit le point d'entrée unique des pages (ex: `'/index.html'`) et l'ajoute à la liste de pré-cache. |
| `addRoute` | `addRoute(route)` | `this` | Ajoute une règle d'interception (`{ match, strategy, ttl, methods, handler }`) où `match` peut être une `string`, une `RegExp` ou une `Function`. |
| `clearRoutes` | `clearRoutes()` | `this` | Supprime toutes les règles d'interception personnalisées. |
| `enable` | `enable(options = {})` | `Promise<Object>` | Active le Service Worker natif (ou bascule automatiquement sur le Monkey Patching si indisponible ou si `options.forceMonkeyPatch = true`), puis pré-cache les ressources. Retourne `{ ok, mode }`. |
| `disable` | `disable(options = {})` | `Promise<boolean>` | Désactive le Monkey Patching et désenregistre le Service Worker si `options.unregister = true`. |
| `enableMonkeyPatch` | `enableMonkeyPatch()` | `boolean` | Intercepte directement `globalThis.fetch` et `XMLHttpRequest` pour faire fonctionner le cache et les fichiers hors-ligne sans Service Worker. |
| `disableMonkeyPatch` | `disableMonkeyPatch()` | `boolean` | Restaure les implémentations natives de `fetch` et `XMLHttpRequest`. |
| `precache` | `precache(urls = [], options = {})` | `Promise<Object>` | Télécharge et met en cache une liste d'URLs (ainsi que le `entryPoint`). Retourne `{ total, cached, failed }`. |
| `handleRequest` | `handleRequest(requestOrUrl, init = {})` | `Promise<Response>` | Exécute la logique complète de résolution d'une requête (règles de routes, stratégies de cache, fichiers locaux `NUtil.file` et repli sur `entryPoint`). |
| `resolveFileUrl` | `resolveFileUrl(urlOrPath, options = {})` | `Promise<string\|null>` | Retourne une URL utilisable (`Blob URL` ou `Data URL` depuis `NUtil.cache` / `NUtil.file`) pour afficher des images ou médias hors-ligne même sans Service Worker. |
| `installServiceWorkerListeners` | `installServiceWorkerListeners()` | `boolean` | Installe les écouteurs `install`, `activate` et `fetch` lorsque `NServiceWorker` est utilisé directement dans le fichier `sw.js`. |

#### Exemple 1 : Activation côté application avec routes et point d'entrée SPA
```javascript
import { NServiceWorker } from '@nlib/js-backend';

const sw = new NServiceWorker({
    swUrl: '/sw.js',
    entryPoint: '/index.html',
    defaultStrategy: 'network-first',
    precache: [
        '/index.html',
        '/assets/app.js',
        '/assets/styles.css',
        '/assets/logo.png'
    ]
});

// Cache-First pour toutes les images et polices (TTL de 7 jours)
sw.addRoute({
    match: /\.(png|jpg|jpeg|svg|webp|woff2)$/i,
    strategy: 'cache-first',
    ttl: 7 * 86400
});

// Stale-While-Revalidate pour les endpoints de catalogue
sw.addRoute({
    match: '/api/catalog',
    strategy: 'stale-while-revalidate',
    ttl: 3600
});

// Activer (utilise le Service Worker natif ou bascule automatiquement en Monkey Patching)
const status = await sw.enable();
console.log('Mode hors-ligne activé via :', status.mode);

// Résoudre un fichier local ou mis en cache pour une balise <img> même sans Service Worker
const logoUrl = await sw.resolveFileUrl('/assets/logo.png');
```

#### Exemple 2 : Utilisation à l'intérieur du fichier `sw.js`
```javascript
import { NServiceWorker } from '@nlib/js-backend';

const sw = new NServiceWorker({
    entryPoint: '/index.html',
    defaultStrategy: 'network-first',
    precache: ['/index.html', '/assets/app.js']
});

// Attache automatiquement les événements 'install', 'activate' et 'fetch' du Service Worker
sw.installServiceWorkerListeners();
```
