# @nlib/js-frontend

Moteur d'interface **100 % JavaScript** de NLib, basé sur `@nlib/js-backend` (`NObject`, `NEvent`, `NUtil`, `NLanguage`).

## Structure

```text
frontend/
├── dom/
│   ├── NWindow.js
│   ├── elements/
│   │   ├── NTag.js
│   │   ├── NImage.js
│   │   ├── NMedia.js
│   │   ├── NVideo.js
│   │   ├── NAudio.js
│   │   ├── NButton.js
│   │   └── NInput.js
│   └── components/
│       ├── frames/
│       │   └── NFrame.js
│       └── panels/
│           ├── NToast.js
│           └── NProgress.js
├── styles/
├── tests/
├── index.js
├── index.d.ts
└── package.json
```

## Convention des classes CSS NLib

Toutes les classes CSS générées par les composants NLib suivent une convention uniforme inspirée de BEM avec le préfixe **`n-`** :

| Niveau | Syntaxe | Rôle | Exemple |
| :--- | :--- | :--- | :--- |
| **Bloc (racine)** | `n-<composant>` | Classe racine dérivée du nom de la classe (sans le `N`, en `kebab-case`) | `n-button`, `n-image`, `n-video`, `n-audio` |
| **Élément interne** | `n-<composant>__<partie>` | Sous-élément interne créé par le composant | `n-button__icon`, `n-button__text`, `n-button__spinner` |
| **Modificateur / État** | `n-<composant>--<etat>` | État ou option structurelle du composant | `n-button--disabled`, `n-button--loading`, `n-button--icon-only`, `n-button--icon-left` |

### Classes par composant

- **`NTag`** : classe de base générique sans classe CSS imposée par défaut.
- **`NImage`** : `n-image`
- **`NMedia`** : classe de base commune à `NVideo` et `NAudio` (`tagName: 'audio' | 'video'`, sans classe CSS propre).
- **`NVideo`** : `n-video`
- **`NAudio`** : `n-audio`
- **`NButton`** :
  - Racine : `n-button`
  - Enfants internes : `n-button__icon`, `n-button__text`, `n-button__spinner`
  - États / positions : `n-button--disabled`, `n-button--loading`, `n-button--icon-only`, `n-button--icon-left`, `n-button--icon-right`, `n-button--icon-top`, `n-button--icon-bottom`
- **`NInput`** :
  - Racine : `n-input`
  - États : `n-input--disabled`, `n-input--readonly`, `n-input--invalid`
- **`NWindow`** :
  - Racine : `n-window`
  - Enfants internes : `n-window__pull` (`n-window__pull--ready`, `n-window__pull--refreshing`)
- **`NFrame`** :
  - Racine : `n-frame`
  - États / enfants : `n-frame--floating`, `n-frame__alert`, `n-frame__alert-icon`, `n-frame__alert-text`
- **`NToast`** :
  - Racine : `n-toast`
  - Variantes / positions : `n-toast--info`, `n-toast--success`, `n-toast--warning`, `n-toast--error`, `n-toast--top`, `n-toast--bottom`
- **`NProgress`** :
  - Racine : `n-progress` (`n-progress--fixed`)
  - Enfants internes : `n-progress__box`, `n-progress__text`, `n-progress__track`, `n-progress__bar` (`n-progress__bar--indeterminate`)

## Importation

```js
import {
    NTag,
    NImage,
    NMedia,
    NVideo,
    NAudio,
    NButton,
    NInput,
    NFrame,
    NToast,
    NProgress,
    NWindow
} from '@nlib/js-frontend';
```

## Principes

- `dom/` crée et gère les éléments DOM (`NTag` et ses sous-classes) ; les classes CSS normalisées permettent aux utilisateurs de styler chaque composant de manière prévisible.
- Dépend de `@nlib/js-backend` (`NObject`, `NEvent`, `NUtil`, `NLanguage`). Le backend n'importe jamais le frontend.
- Les feuilles CSS du site de documentation restent dans `website/assets/css/` et ne font pas partie de ce package.

## Licence

MIT
