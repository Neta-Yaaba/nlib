/**
 * @file catalog.js
 * @package @nlib/website
 * @description Catalogue structuré des classes clés de `@nlib/js-backend` et `@nlib/js-frontend` pour l'explorateur interactif.
 */

export const NLIB_CATALOG = [
    {
        name: 'NObject',
        pkg: '@nlib/js-backend',
        category: 'core',
        summary: 'Classe mère universelle : gestion d\'état réactif (state), bus d\'événements paresseux (event), sérialisation JSON et cycle de vie (destroy).',
        example: `const user = new NObject({ state: { name: 'Amina', online: false } });
user.event.on('state:online', ({ value }) => console.log('En ligne :', value));
user.setState('online', true);`,
        methods: [
            { sig: 'setState(keyOrObj, value)', desc: 'Met à jour une ou plusieurs clés d\'état et émet state:<clé>.' },
            { sig: 'getState(key, fallback)', desc: 'Lit une variable d\'état avec valeur de repli optionnelle.' },
            { sig: 'on(event, callback)', desc: 'Abonne un écouteur sur le bus d\'événements NEvent.' },
            { sig: 'emit(event, payload)', desc: 'Déclenche un événement auprès des abonnés.' },
            { sig: 'destroy()', desc: 'Nettoie l\'état, les écouteurs et marque isDestroyed = true.' }
        ]
    },
    {
        name: 'NUtil',
        pkg: '@nlib/js-backend',
        category: 'utils',
        summary: 'Façade statique centrale donnant accès à tous les utilitaires (str, num, date, amount, email, url, json, crypto, sys, config, env, lang, worker).',
        example: `console.log(NUtil.str.capitalize('bonjour'));
console.log(NUtil.amount.format(15000, 'XOF'));
const id = NUtil.uuid();`,
        methods: [
            { sig: 'NUtil.uuid()', desc: 'Génère un identifiant UUID v4.' },
            { sig: 'NUtil.sleep(ms)', desc: 'Attend de façon asynchrone le délai indiqué.' },
            { sig: 'NUtil.sys', desc: 'Accès à l\'instance partagée NSystem.' },
            { sig: 'NUtil.config', desc: 'Accès à la configuration globale NConfig.' },
            { sig: 'NUtil.env', desc: 'Inspecte l\'environnement (Navigateur, WebView, Worker, Node.js).' }
        ]
    },
    {
        name: 'NSystem',
        pkg: '@nlib/js-backend',
        category: 'system',
        summary: 'Inspection matérielle (CPU, mémoire, écran, réseau), presse-papiers, navigation navigateur/WebView et pont natif OS via invokeNative().',
        example: `await NUtil.sys.copyToClipboard('Texte copié');
NUtil.sys.setBrowserTitle('Mon App');
const res = await NUtil.sys.invokeNative('vibrate', { duration: 100 });`,
        methods: [
            { sig: 'copyToClipboard(text)', desc: 'Copie un texte dans le presse-papiers.' },
            { sig: 'getBrowserUrl() / setBrowserUrl(url)', desc: 'Lit ou remplace l\'URL courante (et notifie la WebView si active).' },
            { sig: 'openUrl(url, target)', desc: 'Ouvre un lien dans le navigateur ou via invokeNative en WebView.' },
            { sig: 'share(data)', desc: 'Partage via Web Share API, OS natif ou copie de repli.' },
            { sig: 'invokeNative(action, payload)', desc: 'Exécute une commande sur le pont natif window.NLibNativeBridge.' }
        ]
    },
    {
        name: 'NWindow',
        pkg: '@nlib/js-frontend',
        category: 'dom',
        summary: 'Conteneur applicatif unique (extends NTag, div.n-window) attaché à document.body : routage par frames, historique, pull-to-refresh et cycle de vie.',
        example: `class AppWindow extends NWindow {
    getHomeLink() { return '/home'; }
    init() { this.registerFrame('home', HomeFrame); }
}
new AppWindow({ theme: 'auto', styleName: 'default' });`,
        methods: [
            { sig: 'NWindow.instance()', desc: 'Retourne l\'instance unique attachée à document.body.' },
            { sig: 'registerFrame(name, FrameClass)', desc: 'Associe un nom de route à une classe NFrame.' },
            { sig: 'navigate(linkOrParams)', desc: 'Crée ou réutilise la frame cible et l\'amène au premier plan.' },
            { sig: 'back(defaultLink)', desc: 'Revient à la frame précédente dans l\'historique.' },
            { sig: 'openInitialLink(defaultLink)', desc: 'Lance la navigation initiale au démarrage.' }
        ]
    },
    {
        name: 'NFrame',
        pkg: '@nlib/js-frontend',
        category: 'components/frames',
        summary: 'Classe de base des pages et vues applicatives gérées par NWindow (titre, lien, mode flottant, scroll, alerte d\'état, pull-to-refresh).',
        example: `class ProfileFrame extends NFrame {
    init() {
        this.setTitle('Profil');
        this.append(new NTag({ tagName: 'h1', text: 'Mon profil' }));
    }
}`,
        methods: [
            { sig: 'init()', desc: 'Point d\'extension appelé à la construction pour bâtir la vue.' },
            { sig: 'setTitle(title) / setLink(link)', desc: 'Configure le titre (synchronisé avec document.title) et la route.' },
            { sig: 'setFloating(true)', desc: 'Superpose la frame en mode modale par-dessus la vue courante.' },
            { sig: 'showAlert(msg, icon) / hideAlert()', desc: 'Affiche ou masque la zone d\'état vide ou d\'erreur.' },
            { sig: 'onActivate(params) / onDeactivate(params)', desc: 'Hooks appelés lors des transitions de navigation.' }
        ]
    },
    {
        name: 'NTag',
        pkg: '@nlib/js-frontend',
        category: 'elements',
        summary: 'Brique DOM universelle de NLib : encapsule un Element HTML avec gestion des classes, attributs, styles, événements DOM unifiés, thème et style visuel.',
        example: `const card = new NTag({ tagName: 'section', className: 'my-card' })
    .setTheme('dark')
    .append(new NTag({ tagName: 'p', text: 'Contenu' }));`,
        methods: [
            { sig: 'append(...nodes) / empty()', desc: 'Ajoute des enfants NTag/Node/texte ou vide le contenu.' },
            { sig: 'addClass(...names) / removeClass(...names)', desc: 'Manipule les classes CSS de l\'élément.' },
            { sig: 'on(event, callback) / off(event, cb)', desc: 'Écoute les événements DOM et personnalisés via un pont unifié.' },
            { sig: 'NTag.setGlobalTheme(theme)', desc: 'Applique \'light\', \'dark\', \'auto\' ou \'system\' sur <html>.' },
            { sig: 'NTag.setGlobalStyle(styleName)', desc: 'Applique un style global (\'default\', \'glass\', \'solid\', etc.).' }
        ]
    },
    {
        name: 'NButton & NInput',
        pkg: '@nlib/js-frontend',
        category: 'elements',
        summary: 'Contrôles interactifs normalisés : NButton (icône, état loading avec spinner, disabled) et NInput (validation, types texte/nombre/fichier/checkbox).',
        example: `const input = new NInput({ placeholder: 'Votre nom' });
const btn = new NButton({
    text: 'Valider',
    events: { click: () => NToast.show(input.value || 'Vide') }
});`,
        methods: [
            { sig: 'btn.setLoading(true)', desc: 'Affiche le spinner interne et bloque les clics.' },
            { sig: 'btn.setIcon({ type: "emoji", value: "🚀" })', desc: 'Ajoute une icône image ou emoji positionnable.' },
            { sig: 'input.value / input.setValue(v)', desc: 'Lit ou modifie la valeur du champ.' },
            { sig: 'input.isValid() / input.setCustomValidity(msg)', desc: 'Contrôle la validité HTML5 du champ.' }
        ]
    },
    {
        name: 'NToast & NProgress',
        pkg: '@nlib/js-frontend',
        category: 'components/panels',
        summary: 'Panneaux de retour utilisateur : NToast (notifications temporaires globales) et NProgress (superposition bloquante locale à un conteneur ou globale).',
        example: `NToast.show('Enregistré !', { type: 'success', duration: 2500 });
NProgress.show('Traitement...', 50);
NProgress.hide();`,
        methods: [
            { sig: 'NToast.show(message, options)', desc: 'Affiche un toast (type: info|success|warning|error, position: top|bottom).' },
            { sig: 'NToast.hide()', desc: 'Masque le toast actif.' },
            { sig: 'NProgress.show(msg, value)', desc: 'Affiche la progression globale sur document.body.' },
            { sig: 'progress.showProgress(msg, value)', desc: 'Bloque et recouvre uniquement le conteneur parent (NFrame, div, panel).' }
        ]
    }
];
