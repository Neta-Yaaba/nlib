# NLib — Universal Cross-Platform Ecosystem

**NLib** est une architecture logicielle universelle, modulaire et multi-plateforme conçue selon les normes internationales. Elle fonctionne aussi bien **sans interface graphique (mode headless / backend / CLI)** qu'avec un **moteur d'interface Web 100 % JavaScript (zéro balise HTML écrite à la main)**, propulsée par des bases de données locales (**SQLite / sql.js**), des serveurs interchangeables (**PHP 8+**, **Node.js**, etc.) et des conteneurs natifs (**Android**, **Windows**, **iOS**, **macOS**, **Linux**, **HarmonyOS**).

---

## Architecture des Packages (100 % Indépendants)

Chaque package situé dans [`packages/`](./packages) est **totalement indépendant** et hérite de la philosophie de la classe de base universelle de `@nlib/core` :

| Package | Langage | Rôle & Description |
| :--- | :--- | :--- |
| [`@nlib/core`](./packages/core) | JS (ES6+) | **Fondation sans interface** : Classe de base universelle, cycle de vie, événements, sérialisation. |
| [`@nlib/bridge`](./packages/bridge) | JS (ES6+) | **Pont universel** : Communication JSON-RPC bidirectionnelle avec les OS natifs et les serveurs. |
| [`@nlib/sql`](./packages/sql) | JS (ES6+) | **Base de données unifiée** : Fonctionne hors-ligne dans le navigateur (`sql.js`) et en natif (`SQLite`). |
| [`@nlib/ui`](./packages/ui) | JS (ES6+) | **Moteur Frontend** : Création de balises en pur JS, moteur CSS orienté objet et gestion de fenêtres (`NWindow`). |
| [`nlib/server-php`](./packages/server-php) | PHP 8.2+ | **Serveur PHP (PSR-4)** : Miroir de la classe de base côté serveur, gestionnaire RPC et connecteur PDO/SQLite. |
| [`@nlib/server-node`](./packages/server-node) | JS (ES6+) | **Serveur JS** : Alternative serveur sans PHP (Node.js / Bun / Deno). |
| [`nlib-android`](./packages/os-android) | Java | **Android Natif** : `WebView` + accès natif Android + SQLite local. |
| [`nlib-windows`](./packages/os-windows) | C# / C++ | **Windows Natif** : `WebView2` + APIs système Windows + SQLite local. |
| [`nlib-ios`](./packages/os-ios) | Swift | **iOS Natif** : `WKWebView` + APIs système iOS + SQLite local. |
| [`nlib-macos`](./packages/os-macos) | Swift | **macOS Natif** : `WKWebView` + APIs système macOS + SQLite local. |
| [`nlib-linux`](./packages/os-linux) | C / C++ | **Linux Natif** : `GTK4` + `WebKitGTK` + APIs système Linux + SQLite3. |
| [`nlib-harmonyos`](./packages/os-harmonyos) | ArkTS | **HarmonyOS NEXT** : `ArkWeb` + APIs système OHOS + RelationStore SQLite. |

---

## Site Web de Documentation Complète

Le dossier [`website/`](./website) contient le site web complet en HTML/CSS/JS documentant **chaque package, chaque classe, chaque méthode et chaque variable** de l'écosystème NLib.

