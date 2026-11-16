# Règles de documentation NLib

- La documentation JSDoc des classes et méthodes doit décrire uniquement ce que la classe et chaque méthode font techniquement (rôle, algorithmes, entrées, sorties, comportement).
- Ne pas documenter ce que la classe ou les méthodes ne font pas (ex. éviter les mentions négatives ou méta-architecturales du type « Ne contient aucune propriété d'état interne », « empreinte mémoire nulle », « Ne lève aucune exception (`throw`) », « sans état interne »).
- Chaque méthode doit contenir au minimum deux exemples `@example` dans sa JSDoc.
