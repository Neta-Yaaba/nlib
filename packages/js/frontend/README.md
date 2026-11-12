# @nlib/js-frontend

Moteur d'interface **100 % JavaScript** de NLib : le DOM et le style sont décrits en JS, sans HTML ni CSS écrits à la main.

> Statut : squelette. Les dossiers sont créés, les classes arrivent après la validation du backend.

## Structure

```text
frontend/
├── dom/      Balises HTML créées en JS (NElement, NWindow, ...)
├── style/    CSS en objets JS (NStyle, thèmes, ...)
└── package.json
```

## Principes

- `dom/` crée et gère les éléments du DOM ; chaque élément applique son style depuis `style/`.
- `style/` représente le CSS sous forme d'objets JS.
- Dépend de `@nlib/js-backend` (`NObject`, `NEvent`, `NUtil`, `NDatabase`). Le backend n'importe jamais le frontend.
- Les feuilles CSS du site de documentation restent dans `website/assets/css/` et ne font pas partie de ce package.

## Licence

MIT

