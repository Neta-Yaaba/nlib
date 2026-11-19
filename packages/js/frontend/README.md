# @nlib/js-frontend

Moteur d'interface **100 % JavaScript** de NLib, basé sur `@nlib/js-backend` (`NObject`, `NEvent`, `NUtil`, `NLanguage`).

## Structure

```text
frontend/
├── dom/
│   ├── elements/
│   │   ├── NTag.js
│   │   ├── NImage.js
│   │   ├── NMedia.js
│   │   ├── NVideo.js
│   │   ├── NAudio.js
│   │   ├── NButton.js
│   │   └── NInput.js
│   └── components/
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

## Importation

```js
import {
    NTag,
    NImage,
    NMedia,
    NVideo,
    NAudio,
    NButton,
    NInput
} from '@nlib/js-frontend';
```

## Principes

- `dom/` crée et gère les éléments DOM (`NTag` et ses sous-classes) ; les classes CSS normalisées permettent aux utilisateurs de styler chaque composant de manière prévisible.
- Dépend de `@nlib/js-backend` (`NObject`, `NEvent`, `NUtil`, `NLanguage`). Le backend n'importe jamais le frontend.
- Les feuilles CSS du site de documentation restent dans `website/assets/css/` et ne font pas partie de ce package.

## Licence

MIT
