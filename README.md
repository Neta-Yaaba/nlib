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
