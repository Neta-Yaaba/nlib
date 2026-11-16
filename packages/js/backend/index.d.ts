/**
 * @file index.d.ts
 * @package @nlib/js-backend
 * @description Déclarations TypeScript complètes du paquet `@nlib/js-backend`,
 * organisées dossier par dossier et classe par classe.
 */

/* ========================================================================== *
 * 1. DOSSIER core/ (NObject, NEvent)                                         *
 * ========================================================================== */

export interface NObjectOptions {
    state?: Record<string, any>;
}

export interface NObjectSerialized {
    className: string;
    state: Record<string, any>;
}

export type NEventCallback = (...args: any[]) => any;

/**
 * Gestionnaire d'événements synchrone et asynchrone (`core/NEvent.js`).
 */
export class NEvent {
    constructor(target?: object | null);

    readonly isEmpty: boolean;
    readonly target: object | null;
    readonly util: typeof NUtil;

    has(event: string): boolean;
    hasListener(event: string, callback: NEventCallback): boolean;
    listenerCount(event?: string): number;
    eventNames(): string[];
    on(event: string, callback: NEventCallback): this;
    once(event: string, callback: NEventCallback): this;
    off(event?: string, callback?: NEventCallback): this;
    emit(event: string, ...args: any[]): this;
    waitFor<T = any>(event: string, timeout?: number): Promise<T | null>;
    clear(): this;

    static create(target?: object | null): NEvent;
    static registerUtil(util: typeof NUtil): typeof NEvent;
}

/**
 * Classe de base fournissant la gestion d'état interne, un bus d'événements intégré
 * et un cycle de vie (`core/NObject.js`).
 */
export class NObject {
    constructor(options?: NObjectOptions);

    readonly state: Record<string, any>;
    readonly event: NEvent;
    readonly className: string;
    readonly util: typeof NUtil;
    readonly isDestroyed: boolean;

    destroy(): void;
    hasState(key: string): boolean;
    getState<T = any>(key: string, defaultValue?: T): T;
    setState(keyOrObject: string | Record<string, any>, value?: any): this;
    toString(): string;
    toJSON(): NObjectSerialized;
    fromJSON(json: string | Record<string, any>): this;
    clone(): this;

    static create<T extends NObject = NObject>(options?: NObjectOptions): T;
    static isNObject(value: any): value is NObject;
    static registerUtil(util: typeof NUtil): typeof NObject;
}

/* ========================================================================== *
 * 2. DOSSIER log/ (NLog)                                                     *
 * ========================================================================== */

export type NLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface NLogOptions {
    consoleEnabled?: boolean;
    traceEnabled?: boolean;
    maxLogs?: number;
    context?: Record<string, any>;
}

export interface NLogEntry {
    id: string;
    timestamp: string;
    level: NLogLevel;
    message: string;
    details: any;
    context: Record<string, any>;
    trace?: string | null;
}

export interface NLogFilter {
    level?: NLogLevel;
    search?: string;
    limit?: number;
    since?: Date | string | number;
}

/**
 * Gestionnaire de journalisation centralisé avec historique circulaire en mémoire (`log/NLog.js`).
 */
export class NLog extends NObject {
    constructor(options?: NLogOptions);

    readonly event: NEvent;
    readonly isConsoleEnabled: boolean;
    readonly isTraceEnabled: boolean;
    readonly maxLogs: number;
    readonly context: Record<string, any>;

    setConsoleEnabled(enabled: boolean): this;
    setTraceEnabled(enabled: boolean): this;
    setMaxLogs(max: number): this;
    setContext(contextObj: Record<string, any>, merge?: boolean): this;
    debug(message: string, details?: any): NLogEntry;
    info(message: string, details?: any): NLogEntry;
    warn(message: string, details?: any): NLogEntry;
    error(message: string, details?: any): NLogEntry;
    write(level: NLogLevel, message: string, details?: any): NLogEntry;
    captureException(err: unknown, customMessage?: string | null, extraDetails?: Record<string, any>): NLogEntry;
    getLogs(filter?: NLogLevel | ((entry: NLogEntry) => boolean) | NLogFilter | null): NLogEntry[];
    export(pretty?: boolean): string;
    import(jsonOrArray: string | NLogEntry[], append?: boolean): number;
    clear(): this;
    destroy(): void;

    static create(options?: NLogOptions): NLog;
}

/* ========================================================================== *
 * 3. DOSSIER config/ (NConfig)                                               *
 * ========================================================================== */

export type NConfigPath = string | Array<string | number>;

/**
 * Gestionnaire de configuration applicative en mémoire avec typage fort et valeurs par défaut (`config/NConfig.js`).
 */
export class NConfig extends NObject {
    constructor(initialValues?: Record<string, any>, defaults?: Record<string, any>);

    readonly isFrozen: boolean;
    readonly isEmpty: boolean;

    has(path: NConfigPath): boolean;
    get<T = any>(path: NConfigPath, fallback?: T): T;
    getString(path: NConfigPath, fallback?: string): string;
    getNumber(path: NConfigPath, fallback?: number): number;
    getInt(path: NConfigPath, fallback?: number): number;
    getFloat(path: NConfigPath, fallback?: number): number;
    getBoolean(path: NConfigPath, fallback?: boolean): boolean;
    getArray<T = any>(path: NConfigPath, fallback?: T[]): T[];
    getObject<T extends Record<string, any> = Record<string, any>>(path: NConfigPath, fallback?: T): T;
    set(path: NConfigPath, value: any): this;
    setDefaults(defaultsObj: Record<string, any>): this;
    merge(configObj: Record<string, any>): this;
    remove(path: NConfigPath): boolean;
    reset(): this;
    clear(): this;
    freeze(): this;
    require(keys: NConfigPath[]): { valid: boolean; missing: string[] };
    loadFromDotEnv(envContent: string, prefix?: string): this;
    loadFromProcess(prefix?: string): this;
    all(sectionPath?: string): Record<string, any>;
    toJSON(pretty?: boolean): string;
    destroy(): void;
}

/* ========================================================================== *
 * 4. DOSSIER environment/ (NEnvironment)                                     *
 * ========================================================================== */

export type NEnvironmentType = 'browser' | 'worker' | 'node' | 'unknown';
export type NEnvironmentOS = 'Windows' | 'macOS' | 'iOS' | 'Android' | 'HarmonyOS' | 'Linux' | 'Unknown';
export type NEnvironmentBrowser = 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'Opera' | 'Unknown';

export interface NEnvironmentInfo {
    type: NEnvironmentType;
    os: NEnvironmentOS;
    browser: NEnvironmentBrowser;
    isBrowser: boolean;
    isNode: boolean;
    isWorker: boolean;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isTouch: boolean;
    isWebView: boolean;
    isOnline: boolean;
    isSecureContext: boolean;
    isDarkMode: boolean;
    language: string;
    timezone: string;
    userAgent: string;
}

/**
 * Détection des caractéristiques de l'environnement d'exécution (`environment/NEnvironment.js`).
 */
export class NEnvironment extends NObject {
    constructor();

    readonly type: NEnvironmentType;
    readonly isBrowser: boolean;
    readonly isNode: boolean;
    readonly isWorker: boolean;
    readonly os: NEnvironmentOS;
    readonly isAndroid: boolean;
    readonly isHarmonyOS: boolean;
    readonly isIOS: boolean;
    readonly isWindows: boolean;
    readonly isMacOS: boolean;
    readonly isLinux: boolean;
    readonly browser: NEnvironmentBrowser;
    readonly isMobile: boolean;
    readonly isTablet: boolean;
    readonly isDesktop: boolean;
    readonly isTouch: boolean;
    readonly isWebView: boolean;
    readonly isOnline: boolean;
    readonly isOffline: boolean;
    readonly isSecureContext: boolean;
    readonly isDarkMode: boolean;
    readonly language: string;
    readonly timezone: string;
    readonly userAgent: string;
    readonly info: NEnvironmentInfo;
}

/* ========================================================================== *
 * 5. DOSSIER system/ (NSystem)                                               *
 * ========================================================================== */

export interface NSystemMemoryInfo {
    used: number;
    total: number;
    limit: number | null;
    formattedUsed: string;
    formattedTotal: string;
}

export interface NSystemScreenInfo {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    pixelRatio: number;
    colorDepth: number;
    orientation: string;
}

export interface NSystemNetworkInfo {
    online: boolean;
    effectiveType: string | null;
    downlink: number | null;
    rtt: number | null;
    saveData: boolean;
}

export interface NSystemBatteryInfo {
    supported: boolean;
    charging: boolean | null;
    level: number | null;
    chargingTime: number | null;
    dischargingTime: number | null;
}

export interface NSystemStorageQuota {
    supported: boolean;
    usage: number;
    quota: number;
    free: number;
    percentUsed: number;
    formattedUsage: string;
    formattedQuota: string;
    formattedFree: string;
}

/**
 * Informations matérielles, mesures de performance, presse-papiers et passerelle native (`system/NSystem.js`).
 */
export class NSystem extends NObject {
    constructor();

    readonly cpuCores: number;
    readonly arch: string;
    readonly deviceMemory: number | null;
    readonly memory: NSystemMemoryInfo | null;
    readonly screen: NSystemScreenInfo;
    readonly network: NSystemNetworkInfo;

    uptime(): number;
    hrtime(): number;
    measure<T = any>(fn: () => T | Promise<T>, label?: string): Promise<{ result: T; durationMs: number; label: string }>;
    getBattery(): Promise<NSystemBatteryInfo>;
    getStorageQuota(): Promise<NSystemStorageQuota>;
    copyToClipboard(text: string): Promise<boolean>;
    readFromClipboard(): Promise<string | null>;
    watchNetwork(callback: (state: NSystemNetworkInfo) => void): () => void;
    invokeNative<T = any>(payload: Record<string, any>): Promise<T>;
    getSnapshot(): Promise<Record<string, any>>;
    toJSON(): Record<string, any>;
    destroy(): void;
}

/* ========================================================================== *
 * 6. DOSSIER utils/ (NUtil + 11 classes utilitaires)                         *
 * ========================================================================== */

export interface NRetryOptions {
    retries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: any) => void;
}

export type NDebouncedFunction<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
    cancel: () => void;
};

/**
 * Point d'entrée statique centralisant l'accès aux singletons et utilitaires globaux (`utils/NUtil.js`).
 */
export class NUtil extends NObject {
    static readonly str: NString;
    static readonly num: NNumber;
    static readonly date: NDateTime;
    static readonly amount: NAmount;
    static readonly email: NEmail;
    static readonly phone: NPhoneNumber;
    static readonly crypto: NCryptography;
    static readonly url: NUrl;
    static readonly json: NJson;
    static readonly password: NPassword;
    static readonly arr: NArray;
    static readonly env: NEnvironment;
    static readonly config: NConfig;
    static readonly sys: NSystem;
    static readonly system: NSystem;
    static readonly worker: NWorkerManager;
    static readonly network: NNetwork;
    static readonly net: NNetwork;
    static readonly database: NDatabase;
    static readonly db: NDatabase;
    static readonly file: NFile;
    static readonly dir: NDirectory;
    static readonly directory: NDirectory;
    static readonly cache: NCache;
    static readonly log: NLog;

    static uuid(): string;
    static uid(prefix?: string): string;
    static getType(value: any): string;
    static isEmpty(value: any): boolean;
    static isDefined<T>(value: T | null | undefined): value is T;
    static toBoolean(value: any): boolean;
    static sleep(ms: number): Promise<void>;
    static setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): any;
    static clearTimeout(timerId: any): void;
    static debounce<T extends (...args: any[]) => any>(fn: T, delay?: number): NDebouncedFunction<T>;
    static throttle<T extends (...args: any[]) => any>(fn: T, limit?: number): (...args: Parameters<T>) => void;
    static retry<T = any>(fn: (attempt: number) => Promise<T> | T, options?: NRetryOptions): Promise<T | null>;
    static isUuid(value: any): boolean;
    static isBoolean(value: any): value is boolean;
    static isFunction(value: any): value is (...args: any[]) => any;
    static isPromise<T = any>(value: any): value is Promise<T>;
}

/**
 * Primitives cryptographiques Web Crypto pour le hachage SHA-256, l'encodage Base64
 * et le chiffrement symétrique, asymétrique, hybride et local (`utils/NCryptography.js`).
 */
export class NCryptography extends NObject {
    constructor();

    isWebCryptoAvailable(): boolean;
    randomBytes(length?: number): Uint8Array;
    bytesToBase64(bytes: Uint8Array | ArrayBuffer): string;
    base64ToBytes(base64: string): Uint8Array;
    encodeBase64(text: string): string;
    decodeBase64(base64: string): string;

    sha256(data: string | Uint8Array | any, outputFormat?: 'hex' | 'base64' | 'bytes'): Promise<string | Uint8Array>;

    generateKeyPair(options?: { modulusLength?: 2048 | 3072 | 4096; hash?: 'SHA-1' | 'SHA-256' }): Promise<CryptoKeyPair | null>;
    exportPublicKeyToPem(publicKey: CryptoKey): Promise<string>;
    importPublicKeyFromPem(pemKey: string): Promise<CryptoKey | null>;

    encrypt(
        data: any,
        publicKey?: CryptoKey | null
    ): Promise<{ type?: 'asymmetric' | 'hybrid'; data?: string; key?: string; iv?: string }>;
    decrypt(encryptedPayload: Record<string, any> | string, privateKey?: CryptoKey | null): Promise<string>;

    encryptSymmetric(
        data: any,
        secretKey: string
    ): Promise<{ type: 'aes-256-cbc'; iv: string; data: string } | null>;
    decryptSymmetric(payload: Record<string, any> | string, secretKey: string): Promise<string>;

    encryptLocal(data: any): Promise<string>;
    decryptLocal(encryptedData: string): Promise<string>;
}

export interface NStringCompareOptions {
    caseSensitive?: boolean;
    ignoreAccents?: boolean;
    ignoreSpecialChars?: boolean;
    ignoreSpaces?: boolean;
    trim?: boolean;
}

export interface NStringMaskOptions {
    visibleStart?: number;
    visibleEnd?: number;
    maskChar?: string;
}

/**
 * Manipulation, comparaison, transformation de casse et formatage de chaînes (`utils/NString.js`).
 */
export class NString extends NObject {
    constructor();

    isString(value: any): value is string;
    isEmpty(text: any, trim?: boolean): boolean;
    isEmail(text: string): boolean;
    isAlphanumeric(text: string): boolean;
    equals(textA: string, textB: string, options?: NStringCompareOptions): boolean;
    contains(text: string, search: string, options?: NStringCompareOptions): boolean;
    indexOf(text: string, search: string, options?: NStringCompareOptions): number;
    startsWith(text: string, prefix: string, options?: NStringCompareOptions): boolean;
    endsWith(text: string, suffix: string, options?: NStringCompareOptions): boolean;
    toUpper(text: string): string;
    toLower(text: string): string;
    capitalize(text: string, lowerRest?: boolean): string;
    toTitleCase(text: string): string;
    toCamelCase(text: string): string;
    toPascalCase(text: string): string;
    toSnakeCase(text: string): string;
    toKebabCase(text: string): string;
    trim(text: string, chars?: string | null): string;
    cleanSpaces(text: string): string;
    removeAccents(text: string): string;
    slugify(text: string, separator?: string): string;
    escapeHtml(text: string): string;
    unescapeHtml(text: string): string;
    split(text: string, separator?: string | RegExp, limit?: number): string[];
    splitAt<T = string | null>(text: string, separator: string | RegExp, index: number, defaultValue?: T): string | T;
    insertEvery(text: string, step?: number, separator?: string, fromEnd?: boolean): string;
    truncate(text: string, maxLength: number, suffix?: string): string;
    padStart(text: string | number, length: number, padChar?: string): string;
    padEnd(text: string | number, length: number, padChar?: string): string;
    repeat(text: string, count: number): string;
    reverse(text: string): string;
    replaceAll(text: string, search: string | RegExp, replacement: string): string;
    template(text: string, data?: Record<string, any>): string;
    mask(text: string, options?: NStringMaskOptions): string;
    countOccurrences(text: string, subString: string, options?: NStringCompareOptions): number;
    wordCount(text: string): number;
    random(length?: number, charset?: string): string;
}

export interface NNumberFormatOptions {
    decimals?: number;
    thousandsSeparator?: string;
    decimalSeparator?: string;
}

export interface NNumberCurrencyOptions extends NNumberFormatOptions {
    symbol?: string;
    position?: 'before' | 'after';
    space?: boolean;
}

/**
 * Validation, conversion, calculs mathématiques et formatage numérique (`utils/NNumber.js`).
 */
export class NNumber extends NObject {
    constructor();

    isNumber(value: any): value is number;
    isNumeric(value: any): boolean;
    isInteger(value: any): boolean;
    isFloat(value: any): boolean;
    isPositive(value: any, strict?: boolean): boolean;
    isNegative(value: any, strict?: boolean): boolean;
    isEven(value: any): boolean;
    isOdd(value: any): boolean;
    isBetween(value: any, min: number, max: number, inclusive?: boolean): boolean;
    equals(a: any, b: any, epsilon?: number): boolean;
    toInt(value: any, defaultValue?: number, radix?: number): number;
    toFloat(value: any, defaultValue?: number): number;
    round(value: any, decimals?: number): number;
    floor(value: any, decimals?: number): number;
    ceil(value: any, decimals?: number): number;
    clamp(value: any, min: number, max: number): number;
    percentage(part: any, total: any, decimals?: number): number;
    percentageOf(percent: any, total: any, decimals?: number): number;
    sum(numbers?: any[]): number;
    average(numbers?: any[], decimals?: number): number;
    min(numbers?: any[]): number | null;
    max(numbers?: any[]): number | null;
    randomInt(min?: number, max?: number): number;
    randomFloat(min?: number, max?: number, decimals?: number): number;
    format(value: any, options?: NNumberFormatOptions): string;
    formatCurrency(value: any, options?: NNumberCurrencyOptions): string;
    formatBytes(bytes: number, decimals?: number): string;
    pad(value: number | string, length?: number): string;
}

export type NDateInput = Date | string | number;

/**
 * Manipulation, arithmétique calendaire, calculs d'écarts et formatage de dates (`utils/NDateTime.js`).
 */
export class NDateTime extends NObject {
    constructor();

    now(): Date;
    nowDate(format?: string, utc?: boolean): string;
    nowTime(format?: string, utc?: boolean): string;
    timestamp(inSeconds?: boolean): number;
    create(year: number, month?: number, day?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
    toDate(value: NDateInput, defaultValue?: Date | null): Date | null;
    isValid(value: any): boolean;
    isLeapYear(yearOrDate?: number | NDateInput): boolean;
    isToday(value: NDateInput): boolean;
    isPast(value: NDateInput): boolean;
    isFuture(value: NDateInput): boolean;
    isWeekend(value: NDateInput): boolean;
    isWeekday(value: NDateInput): boolean;
    equals(dateA: NDateInput, dateB: NDateInput, options?: { unit?: string; ignoreTime?: boolean }): boolean;
    isBefore(dateA: NDateInput, dateB: NDateInput): boolean;
    isAfter(dateA: NDateInput, dateB: NDateInput): boolean;
    isBetween(value: NDateInput, start: NDateInput, end: NDateInput, inclusive?: boolean): boolean;
    getYear(value: NDateInput): number | null;
    getMonth(value: NDateInput): number | null;
    getDay(value: NDateInput): number | null;
    getDayOfWeek(value: NDateInput): number | null;
    getHours(value: NDateInput): number | null;
    getMinutes(value: NDateInput): number | null;
    getSeconds(value: NDateInput): number | null;
    daysInMonth(yearOrDate: number | NDateInput, month?: number): number | null;
    addYears(value: NDateInput, years: number): Date | null;
    addMonths(value: NDateInput, months: number): Date | null;
    addDays(value: NDateInput, days: number): Date | null;
    addHours(value: NDateInput, hours: number): Date | null;
    addMinutes(value: NDateInput, minutes: number): Date | null;
    addSeconds(value: NDateInput, seconds: number): Date | null;
    startOfDay(value: NDateInput): Date | null;
    endOfDay(value: NDateInput): Date | null;
    startOfMonth(value: NDateInput): Date | null;
    endOfMonth(value: NDateInput): Date | null;
    startOfYear(value: NDateInput): Date | null;
    endOfYear(value: NDateInput): Date | null;
    diffInSeconds(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    diffInMinutes(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    diffInHours(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    diffInDays(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    getAge(birthDate: NDateInput, referenceDate?: NDateInput): number | null;
    format(value: NDateInput, pattern?: string): string;
    toSql(value?: NDateInput, includeTime?: boolean): string;
    toIso(value?: NDateInput): string;
}

/**
 * Calculs monétaires exacts en centimes, TVA, remises et formatage de devises (`utils/NAmount.js`).
 */
export class NAmount extends NObject {
    constructor();

    isValid(value: any, allowNegative?: boolean): boolean;
    parse(value: any, fallback?: number | null): number | null;
    equals(amountA: any, amountB: any, decimals?: number): boolean;
    toMinorUnits(amount: any, decimals?: number): number;
    fromMinorUnits(minorUnits: number, decimals?: number): number;
    add(amountA: any, amountB: any, decimals?: number): number;
    subtract(amountA: any, amountB: any, decimals?: number): number;
    multiply(amount: any, factor: number, decimals?: number): number;
    divide(amount: any, divisor: number, decimals?: number): number;
    allocate(amount: any, parts?: number, decimals?: number): number[];
    taxAmount(amountHT: any, taxRate: number, decimals?: number): number;
    addTax(amountHT: any, taxRate: number, decimals?: number): number;
    extractTax(amountTTC: any, taxRate: number, decimals?: number): { ht: number; tax: number; ttc: number };
    applyDiscount(amount: any, discountPercent: number, decimals?: number): number;
    convert(amount: any, exchangeRate: number, decimals?: number): number;
    format(amount: any, currency?: string, options?: NNumberCurrencyOptions): string;
}

export interface NEmailParsed {
    email: string;
    local: string;
    baseLocal: string;
    tag: string;
    domain: string;
    tld: string;
}

export interface NEmailNormalizeOptions {
    stripPlusTag?: boolean;
    normalizeGmailDots?: boolean;
}

/**
 * Validation, normalisation, analyse et masquage d'adresses e-mail (`utils/NEmail.js`).
 */
export class NEmail extends NObject {
    constructor();

    isValid(email: any): boolean;
    isFreeProvider(email: string): boolean;
    isDisposable(email: string): boolean;
    isBusiness(email: string): boolean;
    hasDomain(email: string, allowedDomains: string | string[], allowSubdomains?: boolean): boolean;
    normalize(email: string, options?: NEmailNormalizeOptions): string;
    equals(emailA: string, emailB: string, options?: NEmailNormalizeOptions): boolean;
    parse(email: string): NEmailParsed | null;
    getLocalPart(email: string, stripPlusTag?: boolean): string;
    getDomain(email: string): string;
    getTld(email: string): string;
    mask(email: string, options?: { visibleStart?: number; visibleEnd?: number; maskChar?: string }): string;
    formatDisplay(email: string, displayName?: string): string;
    extractFromText(text: string, unique?: boolean): string[];
}

export interface NPhoneParsed {
    raw: string;
    e164: string;
    countryCode: string;
    nationalNumber: string;
    digits: string;
    isInternational: boolean;
}

/**
 * Validation, nettoyage, analyse et formatage de numéros de téléphone (`utils/NPhoneNumber.js`).
 */
export class NPhoneNumber extends NObject {
    constructor();

    clean(phone: string, keepPlus?: boolean): string;
    isValid(phone: any, options?: { countryCode?: string; minLength?: number; maxLength?: number }): boolean;
    isE164(phone: string): boolean;
    equals(phoneA: string, phoneB: string, defaultCountryCode?: string): boolean;
    toE164(phone: string, defaultCountryCode?: string): string;
    toNational(phone: string, countryCode?: string, nationalPrefix?: string): string;
    format(
        phone: string,
        style?: 'e164' | 'international' | 'national' | 'rfc3966',
        options?: { defaultCountryCode?: string; groupSize?: number; separator?: string }
    ): string;
    mask(phone: string, options?: NStringMaskOptions): string;
    toTelUri(phone: string, scheme?: string): string;
    toWhatsAppUrl(phone: string, message?: string): string;
}

export interface NUrlParsed {
    href: string;
    protocol: string;
    origin: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    query: Record<string, any>;
    hash: string;
    username: string;
    password: string;
    isRelative: boolean;
}

export interface NUrlBuildParts {
    base?: string;
    protocol?: string;
    hostname?: string;
    port?: string | number;
    path?: string | string[];
    query?: Record<string, any>;
    hash?: string;
}

/**
 * Manipulation d'URLs, Query Strings et obfuscation signée d'identifiants (`utils/NUrl.js`).
 */
export class NUrl extends NObject {
    constructor();

    isValid(url: any, options?: { requireHttps?: boolean; allowRelative?: boolean }): boolean;
    isAbsolute(url: string): boolean;
    isRelative(url: string): boolean;
    isHttps(url: string): boolean;
    isSameOrigin(urlA: string, urlB: string): boolean;
    equals(urlA: string, urlB: string, options?: Record<string, any>): boolean;
    parse(url: string): NUrlParsed | null;
    getProtocol(url: string): string;
    getDomain(url: string, stripWww?: boolean): string;
    getPath(url: string): string;
    getPathSegments(url: string): string[];
    getHash(url: string): string;
    parseQueryString(queryOrUrl: string): Record<string, any>;
    stringifyQueryParams(params: Record<string, any>, prefixQuestionMark?: boolean): string;
    getQueryParam<T = any>(url: string, paramName: string, fallback?: T): T;
    setQueryParams(url: string, params: Record<string, any>): string;
    removeQueryParams(url: string, paramNames: string | string[]): string;
    join(...segments: string[]): string;
    build(parts?: NUrlBuildParts): string;
    normalize(url: string, options?: { sortQuery?: boolean; stripTrailingSlash?: boolean; stripHash?: boolean }): string;
    encode(value: string): string;
    decode(encodedValue: string): string;
    encodeBase64Url(text: string): string;
    decodeBase64Url(base64Url: string): string;
    encodeId(idOrValue: string | number, salt?: string): string;
    decodeId(token: string, salt?: string, asNumber?: boolean): string | number | null;
}

export type NJsonPath = string | number | Array<string | number>;

/**
 * Sérialisation JSON tolérante aux cycles, clonage et lecture/écriture par chemin (`utils/NJson.js`).
 */
export class NJson extends NObject {
    constructor();

    isValid(jsonString: any): boolean;
    isPlainObject(value: any): value is Record<string, any>;
    isEmpty(value: any): boolean;
    size(data: any): number;
    count(value: any, path?: NJsonPath): number;
    parse<T = any>(value: any, fallback?: T, reviver?: ((key: string, value: any) => any) | null): T;
    stringify(
        value: any,
        options?: { pretty?: boolean; indent?: number; sortKeys?: boolean; fallback?: string }
    ): string;
    prettify(value: any, indent?: number): string;
    minify(value: any): string;
    clone<T = any>(value: T): T;
    equals(a: any, b: any): boolean;
    merge<T extends Record<string, any> = Record<string, any>>(...objects: Record<string, any>[]): T;
    get<T = any>(data: any, path: NJsonPath, fallback?: T): T;
    getNumber(data: any, path: NJsonPath, fallback?: number | null): number | null;
    getInt(data: any, path: NJsonPath, fallback?: number | null): number | null;
    getFloat(data: any, path: NJsonPath, fallback?: number | null): number | null;
    getString(data: any, path: NJsonPath, fallback?: string): string;
    getArray<T = any>(data: any, path: NJsonPath, fallback?: T[]): T[];
    getObject<T extends Record<string, any> = Record<string, any>>(data: any, path: NJsonPath, fallback?: T | null): T | null;
    has(data: any, path: NJsonPath): boolean;
    set<T = any>(data: T, path: NJsonPath, value: any): T;
    remove(data: any, path: NJsonPath): boolean;
    pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys?: K[]): Pick<T, K>;
    omit<T extends Record<string, any>, K extends keyof T>(obj: T, keysToOmit?: K[]): Omit<T, K>;
    flatten(obj: Record<string, any>, separator?: string, prefix?: string): Record<string, any>;
    unflatten(flatObj: Record<string, any>, separator?: string): Record<string, any>;
    forEach(
        data: any[] | Record<string, any> | string,
        callback: (value: any, keyOrIndex: string | number, source: any) => boolean | void
    ): boolean;
}

export interface NPasswordRules {
    minLength?: number;
    maxLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSymbol?: boolean;
    disallowSpaces?: boolean;
}

export interface NPasswordValidationResult {
    valid: boolean;
    errors: string[];
    checks: Record<string, boolean>;
}

export interface NPasswordStrengthResult {
    score: 0 | 1 | 2 | 3 | 4;
    label: 'very_weak' | 'weak' | 'medium' | 'strong' | 'very_strong';
    entropyBits: number;
    length: number;
}

/**
 * Validation, évaluation de robustesse, génération et hachage PBKDF2 de mots de passe (`utils/NPassword.js`).
 */
export class NPassword extends NObject {
    constructor();

    isValid(password: string, options?: NPasswordRules): boolean;
    evaluate(password: string, options?: NPasswordRules): NPasswordStrengthResult & { valid: boolean; errors: string[] };
    calculateEntropy(password: string): number;
    isCommon(password: string): boolean;
    generate(
        length?: number,
        options?: {
            uppercase?: boolean;
            lowercase?: boolean;
            numbers?: boolean;
            symbols?: boolean;
            excludeSimilar?: boolean;
        }
    ): string;
    generatePin(length?: number): string;
    hash(password: string, iterations?: number): Promise<string>;
    verify(password: string, storedHash: string): Promise<boolean>;
    timingSafeEquals(a: string, b: string): boolean;
}

export interface NPaginatedResult<T = any> {
    data: T[];
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

/**
 * Manipulation immuable de tableaux et de collections d'objets (`utils/NArray.js`).
 */
export class NArray extends NObject {
    constructor();

    isArray(value: any): value is any[];
    isEmpty(list: any): boolean;
    size<T = any>(list: T[], predicate?: (item: T) => boolean): number;
    count<T = any>(list: T[], predicate?: (item: T) => boolean): number;
    toArray<T = any>(value: any): T[];
    equals(listA: any[], listB: any[]): boolean;
    contains<T = any>(list: T[], target: any, key?: keyof T): boolean;
    get<T = any>(list: T[], index: number, fallback?: any): T | any;
    first<T = any>(list: T[], count?: number, defaultValue?: any): T | T[] | any;
    last<T = any>(list: T[], count?: number, defaultValue?: any): T | T[] | any;
    insertAt<T = any>(list: T[], index: number, ...items: T[]): T[];
    removeAt<T = any>(list: T[], index: number): T[];
    removeValue<T = any>(list: T[], valueToRemove: T): T[];
    compact<T = any>(list: T[], keepZeroAndFalse?: boolean): NonNullable<T>[];
    unique<T = any>(list: T[], key?: keyof T | ((item: T) => any)): T[];
    flatten<T = any>(list: any[], depth?: number): T[];
    pluck<T = any, K extends keyof T = keyof T>(list: T[], key: K): Array<T[K]>;
    groupBy<T = any>(list: T[], keyOrFn: keyof T | ((item: T) => string)): Record<string, T[]>;
    keyBy<T = any>(list: T[], key: keyof T | ((item: T) => string)): Record<string, T>;
    sortBy<T = any>(list: T[], keyOrFn?: keyof T | ((item: T) => any) | null, order?: 'asc' | 'desc'): T[];
    chunk<T = any>(list: T[], size?: number): T[][];
    paginate<T = any>(list: T[], page?: number, perPage?: number): NPaginatedResult<T>;
    shuffle<T = any>(list: T[]): T[];
    sample<T = any>(list: T[], count?: number): T | T[];
    intersection<T = any>(listA: T[], listB: T[]): T[];
    difference<T = any>(listA: T[], listB: T[]): T[];
    union<T = any>(...lists: T[][]): T[];
    range(start: number, end: number, step?: number): number[];
}


/* ========================================================================== *
 * 7. DOSSIER database/ (NDatabase, NSql, NIndexedDB, NStorage)               *
 * ========================================================================== */

export interface NIndexedDBStoreIndexConfig {
    name: string;
    keyPath: string | string[];
    unique?: boolean;
    multiEntry?: boolean;
}

export interface NIndexedDBStoreConfig {
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    indexes?: NIndexedDBStoreIndexConfig[];
}

export interface NDatabaseOptions extends NObjectOptions {
    name?: string;
    version?: number;
    stores?: Record<string, NIndexedDBStoreConfig>;
    dbStructure?: Record<string, string> | null;
    wasmPath?: string | null;
    storagePrefix?: string;
    autoSave?: boolean;
    autoSaveDelay?: number;
}

/**
 * Façade unifiant l'accès à `NSql`, `NIndexedDB` et `NStorage` (`database/NDatabase.js`).
 */
export class NDatabase extends NObject {
    constructor(options?: NDatabaseOptions);

    readonly context: 'native' | 'worker' | 'browser' | 'node';
    readonly name: string;
    readonly version: number;
    readonly isInitialized: boolean;
    readonly autoSave: boolean;
    readonly autoSaveDelay: number;
    readonly sql: NSql;
    readonly indexed: NIndexedDB;
    readonly idb: NIndexedDB;
    readonly storage: NStorage;
    readonly store: NStorage;
    readonly util: typeof NUtil;

    init(options?: NDatabaseOptions): Promise<boolean>;
    saveSql(snapshotKey?: string): Promise<boolean>;
    loadSql(snapshotKey?: string): Promise<Uint8Array | null>;
    scheduleAutoSave(delayMs?: number): void;
    flushAutoSave(): Promise<boolean>;
    cancelAutoSave(): this;
    clearAll(): Promise<boolean>;
    close(): Promise<boolean>;
    drop(): Promise<boolean>;
    destroy(): void;
}

export interface NSqlOptions {
    name?: string;
    wasmPath?: string | null;
    data?: Uint8Array | ArrayBuffer | number[] | null;
    dbStructure?: Record<string, string> | null;
}

export interface NSqlPrimaryKeyInfo {
    name: string;
    type: string;
    isAutoIncrement: boolean;
}

/**
 * Moteur de base de données relationnelle SQLite natif / WebAssembly (`database/NSql.js`).
 */
export class NSql extends NObject {
    constructor(options?: NSqlOptions);

    readonly name: string;
    readonly isInitialized: boolean;
    readonly isOpen: boolean;
    readonly isNative: boolean;
    readonly rawDatabase: any | null;
    readonly util: typeof NUtil;
    readonly event: NEvent;

    init(options?: NSqlOptions): Promise<boolean>;
    close(): Promise<boolean>;
    createTable(tableName: string, sqlCreateTable: string): Promise<boolean>;
    createTables(dbStructure: Record<string, string>): Promise<boolean>;
    query<T = any>(sql: string, params?: any[]): Promise<T>;
    execute(sql: string, params?: any[]): Promise<boolean>;
    select<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]>;
    selectOne<T = Record<string, any>>(sql: string, params?: any[]): Promise<T | null>;
    selectAll<T = Record<string, any>>(tableName: string): Promise<T[]>;
    selectAsList(sql: string, params?: any[]): Promise<any[][]>;
    countRows(tableName: string): Promise<number>;
    insert(tableName: string, data: Record<string, any> | Record<string, any>[]): Promise<string | number | boolean | null>;
    update(tableName: string, data: Record<string, any>, condition: string, params?: any[]): Promise<boolean>;
    delete(tableName: string, condition: string, params?: any[]): Promise<boolean>;
    transaction(callback: (sql: NSql) => Promise<any> | any): Promise<boolean>;
    getTableFields(tableName: string): Promise<string[]>;
    getPrimaryKey(tableName: string): Promise<NSqlPrimaryKeyInfo | null>;
    getNextId(tableName: string): Promise<number>;
    generatePrimaryKeyValue(tableName: string): Promise<string | number | null>;
    getDbStruct(): Promise<Record<string, any>>;
    export(): Uint8Array | null;
    exportBase64(): string;
    clear(): Promise<boolean>;
    deleteDb(): Promise<boolean>;
    buildSearchClause(queryText: string, fields: string[]): { where: string; order: string; params: Record<string, string> } | null;
    buildLimitClause(limit: number, offset?: number): string;
    destroy(): void;
}

export interface NIndexedDBEncryptionOptions {
    encryptKey?: boolean;
    encryptData?: boolean;
}

export interface NIndexedDBResponse<T = any> {
    ok: boolean;
    data?: T | null;
    error?: string | null;
    code?: string | null;
}

export interface NIndexedDBOptions extends NIndexedDBEncryptionOptions {
    name?: string;
    version?: number;
    stores?: Array<NIndexedDBStoreConfig>;
}

/**
 * Moteur NoSQL asynchrone basé sur IndexedDB avec chiffrement local optionnel (`database/NIndexedDB.js`).
 */
export class NIndexedDB extends NObject {
    constructor(options?: NIndexedDBOptions);

    readonly name: string;
    readonly version: number;
    readonly isOpen: boolean;
    readonly storeNames: string[];
    readonly isKeyEncrypted: boolean;
    readonly isDataEncrypted: boolean;
    readonly util: typeof NUtil;

    open(): Promise<NIndexedDBResponse<boolean>>;
    close(): void;
    deleteDatabase(): Promise<NIndexedDBResponse<boolean>>;
    add<T = any>(storeName: string, value: T, keyOrOptions?: IDBValidKey | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<IDBValidKey>>;
    put<T = any>(storeName: string, value: T, keyOrOptions?: IDBValidKey | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<IDBValidKey>>;
    get<T = any>(storeName: string, key: IDBValidKey, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<T | null>>;
    getAll<T = any>(storeName: string, query?: IDBKeyRange | IDBValidKey | NIndexedDBEncryptionOptions, count?: number | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<T[]>>;
    getAllKeys(storeName: string, query?: IDBKeyRange | IDBValidKey | NIndexedDBEncryptionOptions, count?: number | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<IDBValidKey[]>>;
    delete(storeName: string, key: IDBValidKey | IDBKeyRange, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<undefined>>;
    clear(storeName: string): Promise<NIndexedDBResponse<undefined>>;
    count(storeName: string, query?: IDBKeyRange | IDBValidKey): Promise<NIndexedDBResponse<number>>;
    getByIndex<T = any>(storeName: string, indexName: string, key: IDBValidKey, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<T | null>>;
    getAllByIndex<T = any>(storeName: string, indexName: string, query?: IDBKeyRange | IDBValidKey | NIndexedDBEncryptionOptions, count?: number | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<T[]>>;
    getAllKeysByIndex(storeName: string, indexName: string, query?: IDBKeyRange | IDBValidKey | NIndexedDBEncryptionOptions, count?: number | NIndexedDBEncryptionOptions, options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<IDBValidKey[]>>;
    countByIndex(storeName: string, indexName: string, query?: IDBKeyRange | IDBValidKey): Promise<NIndexedDBResponse<number>>;
    putMany<T = any>(storeName: string, items: T[], options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<number>>;
    deleteMany(storeName: string, keys: IDBValidKey[], options?: NIndexedDBEncryptionOptions): Promise<NIndexedDBResponse<number>>;
    cursor<T = any>(
        storeName: string,
        callback: (value: T, key: IDBValidKey, cursor: IDBCursorWithValue) => boolean | Promise<boolean | void> | void,
        options?: { query?: IDBKeyRange | IDBValidKey; direction?: IDBCursorDirection; mode?: 'readonly' | 'readwrite'; encryptKey?: boolean; encryptData?: boolean }
    ): Promise<NIndexedDBResponse<number>>;
    destroy(): void;
}

export interface NStorageOptions {
    driver?: 'auto' | 'localStorage' | 'sessionStorage';
    prefix?: string;
    context?: string;
    ttl?: number;
}

/**
 * Gestionnaire de stockage synchrone clé-valeur avec contextes et TTL (`database/NStorage.js`).
 */
export class NStorage extends NObject {
    constructor(options?: NStorageOptions);

    readonly driver: 'localStorage' | 'sessionStorage' | null;
    readonly isAvailable: boolean;
    readonly prefix: string;
    context: string;
    readonly length: number;
    readonly util: typeof NUtil;

    withContext(context: string): NStorage;
    set(key: string, value: any, optionsOrTtl?: number | NStorageOptions): boolean;
    get<T = any>(key: string, defaultValue?: T, options?: NStorageOptions): T;
    getString(key: string, defaultValue?: string, options?: NStorageOptions): string;
    getNumber(key: string, defaultValue?: number, options?: NStorageOptions): number;
    getBoolean(key: string, defaultValue?: boolean, options?: NStorageOptions): boolean;
    getJson<T = Record<string, any>>(key: string, defaultValue?: T, options?: NStorageOptions): T;
    getArray<T = any>(key: string, defaultValue?: T[], options?: NStorageOptions): T[];
    has(key: string, options?: NStorageOptions): boolean;
    remove(key: string, options?: NStorageOptions): boolean;
    clear(): boolean;
    keys(): string[];
    toObject(): Record<string, any>;
    destroy(): void;
}

/* ========================================================================== *
 * 8. DOSSIER filesystem/ (NFile, NDirectory)                                 *
 * ========================================================================== */

export type NFileSystemDriver = 'native' | 'fs' | 'idb';

export interface NFilePathParts {
    fullPath: string;
    dir: string;
    fileName: string;
    baseName: string;
    ext: string;
    extWithDot: string;
}

export interface NFileStat {
    path: string;
    name: string;
    size: number;
    mimeType: string;
    isFile: boolean;
    isDirectory: boolean;
    createdAt: number;
    updatedAt: number;
    driver: NFileSystemDriver;
}

export interface NFileOperationOptions {
    encoding?: string;
    mimeType?: string;
    overwrite?: boolean;
    defaultValue?: any;
    pretty?: boolean;
    indent?: number;
    algorithm?: 'SHA-256' | 'SHA-1' | 'SHA-384' | 'SHA-512';
}

/**
 * Gestionnaire de fichiers multiplateforme (`filesystem/NFile.js`).
 */
export class NFile extends NObject {
    constructor();

    readonly driver: NFileSystemDriver;
    readonly isNativeAvailable: boolean;
    readonly isFsApiAvailable: boolean;

    normalizePath(path?: string): string;
    joinPath(...segments: string[]): string;
    splitPath(path: string): NFilePathParts;
    getDirName(path: string): string;
    getFileName(path: string): string;
    getBaseName(path: string): string;
    getExtension(path: string, includeDot?: boolean): string;
    getMimeType(pathOrExt: string, fallback?: string): string;

    toUint8Array(data: string | ArrayBuffer | ArrayBufferView | Blob | number[]): Promise<Uint8Array>;
    toText(data: string | ArrayBuffer | ArrayBufferView | Blob, encoding?: string): Promise<string>;
    toBase64(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<string>;
    fromBase64(base64OrDataUrl: string): Uint8Array;
    toDataUrl(data: string | ArrayBuffer | ArrayBufferView | Blob, mimeType?: string): Promise<string>;
    toBlob(data: string | ArrayBuffer | ArrayBufferView | Blob, mimeType?: string): Promise<Blob | null>;

    exists(path: string, options?: NFileOperationOptions): Promise<boolean>;
    stat(path: string, options?: NFileOperationOptions): Promise<NFileStat | null>;
    info(path: string, options?: NFileOperationOptions): Promise<NFileStat | null>;

    write(path: string, data: any, options?: NFileOperationOptions): Promise<boolean>;
    writeText(path: string, text?: string, options?: NFileOperationOptions): Promise<boolean>;
    writeJson(path: string, value: any, options?: NFileOperationOptions): Promise<boolean>;
    writeBytes(path: string, bytes: Uint8Array | ArrayBuffer | number[], options?: NFileOperationOptions): Promise<boolean>;
    writeBase64(path: string, base64OrDataUrl: string, options?: NFileOperationOptions): Promise<boolean>;
    append(path: string, data: any, options?: NFileOperationOptions): Promise<boolean>;

    read(path: string, options?: NFileOperationOptions): Promise<Uint8Array | null>;
    readBytes(path: string, options?: NFileOperationOptions): Promise<Uint8Array | null>;
    readText(path: string, options?: NFileOperationOptions): Promise<string | null>;
    readJson<T = any>(path: string, options?: NFileOperationOptions): Promise<T | null>;
    readBase64(path: string, options?: NFileOperationOptions): Promise<string | null>;
    readDataUrl(path: string, options?: NFileOperationOptions): Promise<string | null>;
    readBlob(path: string, options?: NFileOperationOptions): Promise<Blob | null>;

    delete(path: string, options?: NFileOperationOptions): Promise<boolean>;
    remove(path: string, options?: NFileOperationOptions): Promise<boolean>;
    copy(sourcePath: string, destinationPath: string, options?: NFileOperationOptions): Promise<boolean>;
    move(sourcePath: string, destinationPath: string, options?: NFileOperationOptions): Promise<boolean>;
    rename(path: string, newFileName: string, options?: NFileOperationOptions): Promise<boolean>;
    checksum(path: string, options?: NFileOperationOptions): Promise<string | null>;
}

export interface NDirectoryEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
    isFile: boolean;
    isDirectory: boolean;
    size?: number;
    mimeType?: string;
    updatedAt?: number;
}

export interface NDirectoryTreeItem extends NDirectoryEntry {
    children?: NDirectoryTreeItem[];
}

export interface NDirectoryFindCriteria {
    name?: string | RegExp;
    ext?: string;
    type?: 'file' | 'directory';
    filter?: (entry: NDirectoryEntry) => boolean;
    recursive?: boolean;
}

/**
 * Gestionnaire de répertoires multiplateforme (`filesystem/NDirectory.js`).
 */
export class NDirectory extends NObject {
    constructor();

    readonly driver: NFileSystemDriver;
    readonly isNativeAvailable: boolean;
    readonly isFsApiAvailable: boolean;

    normalizePath(path?: string): string;
    joinPath(...segments: string[]): string;
    getName(path: string): string;
    getParent(path: string): string;

    exists(path?: string, options?: Record<string, any>): Promise<boolean>;
    create(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    ensure(path: string, options?: { recursive?: boolean }): Promise<boolean>;

    stat(path?: string, options?: Record<string, any>): Promise<Record<string, any> | null>;
    info(path?: string, options?: Record<string, any>): Promise<Record<string, any> | null>;

    list(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    listFiles(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    listDirectories(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    tree(path?: string, options?: Record<string, any>): Promise<NDirectoryTreeItem>;
    find(path?: string, criteria?: NDirectoryFindCriteria): Promise<NDirectoryEntry[]>;
    size(path?: string, options?: { recursive?: boolean }): Promise<number>;

    clear(path: string, options?: Record<string, any>): Promise<boolean>;
    delete(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    rmdir(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    copy(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<boolean>;
    move(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<boolean>;
    rename(path: string, newDirectoryName: string, options?: Record<string, any>): Promise<boolean>;
}

/* ========================================================================== *
 * 9. DOSSIER cache/ (NCache)                                                 *
 * ========================================================================== */

export type NCacheDriver = 'native' | 'caches' | 'idb' | 'store' | 'memory';

export interface NCacheConstructorOptions {
    maxMemoryEntries?: number;
    defaultTtl?: number;
    namespace?: string;
    cacheStorageName?: string;
}

export interface NCacheItemOptions {
    ttl?: number;
    namespace?: string;
    tags?: string[];
    mimeType?: string;
    defaultValue?: any;
    rawResponse?: boolean;
    as?: 'bytes' | 'text' | 'base64' | 'dataUrl' | 'blob';
    all?: boolean;
}

export interface NCacheStats {
    driver: NCacheDriver;
    hits: number;
    misses: number;
    totalRequests: number;
    hitRate: number;
}

/**
 * Système de mise en cache unifié à sélection automatique de moteur (`cache/NCache.js`).
 */
export class NCache extends NObject {
    constructor(options?: NCacheConstructorOptions);

    readonly driver: NCacheDriver;
    readonly isNativeAvailable: boolean;
    readonly isCacheStorageAvailable: boolean;
    readonly isIdbAvailable: boolean;
    readonly isStoreAvailable: boolean;
    readonly stats: NCacheStats;

    set(key: string, value: any, options?: NCacheItemOptions): Promise<boolean>;
    get<T = any>(key: string, options?: NCacheItemOptions): Promise<T>;
    has(key: string, options?: NCacheItemOptions): Promise<boolean>;
    remember<T = any>(key: string, ttlOrOptions: number | NCacheItemOptions, factoryFn: () => Promise<T> | T): Promise<T>;
    getOrSet<T = any>(key: string, ttlOrOptions: number | NCacheItemOptions, factoryFn: () => Promise<T> | T): Promise<T>;
    delete(key: string, options?: NCacheItemOptions): Promise<boolean>;
    remove(key: string, options?: NCacheItemOptions): Promise<boolean>;
    clearByTag(tag: string, options?: NCacheItemOptions): Promise<number>;
    prune(options?: NCacheItemOptions): Promise<number>;
    keys(options?: NCacheItemOptions): Promise<string[]>;
    clear(options?: NCacheItemOptions): Promise<boolean>;

    putResponse(url: string, responseOrData: Response | any, options?: NCacheItemOptions): Promise<boolean>;
    matchUrl<T = any>(url: string, options?: NCacheItemOptions): Promise<T | Response | null>;
    cacheUrl<T = any>(url: string, options?: NCacheItemOptions): Promise<T | Response | null>;
    deleteUrl(url: string, options?: NCacheItemOptions): Promise<boolean>;

    cacheFile(keyOrPath: string, data: any, options?: NCacheItemOptions): Promise<boolean>;
    getFile<T = Uint8Array | string | Blob | null>(keyOrPath: string, options?: NCacheItemOptions): Promise<T>;
    destroy(): void;
}

/* ========================================================================== *
 * 10. DOSSIER requests/ (NNetwork, NTableRequest, NRequestManager)           *
 * ========================================================================== */

export interface NNetworkOptions {
    driver?: 'auto' | 'fetch' | 'xhr' | 'native';
    baseUrl?: string;
    timeout?: number;
    headers?: Record<string, string>;
    serverPublicKey?: CryptoKey;
    clientPublicKey?: CryptoKey;
    clientPrivateKey?: CryptoKey;
    modulusLength?: 2048 | 3072 | 4096;
    hash?: 'SHA-1' | 'SHA-256';
    encrypt?: boolean;
    encrypted?: boolean;
    authUrl?: string;
}

export interface NNetworkRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | string;
    headers?: Record<string, string>;
    params?: Record<string, any>;
    body?: any;
    timeout?: number;
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
    encrypt?: boolean;
    encrypted?: boolean;
    driver?: 'auto' | 'fetch' | 'xhr' | 'native';
    serverPublicKey?: CryptoKey | string;
    clientPrivateKey?: CryptoKey;
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
    signal?: AbortSignal;
}

export interface NNetworkResponse<T = any> {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: T | null;
    raw?: any;
    url?: string;
    driver?: string;
}

/**
 * Client réseau HTTP/HTTPS avec chiffrement asymétrique et hybride RSA-OAEP + AES (`requests/NNetwork.js`).
 */
export class NNetwork extends NObject {
    static readonly CHUNK_SIZE: number;

    constructor(options?: NNetworkOptions);

    driver: 'auto' | 'fetch' | 'xhr' | 'native';
    baseUrl: string;

    request<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    get<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    post<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    put<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    patch<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    delete<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    head(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<any>>;

    requestAuthentication(url?: string | null, options?: { force?: boolean; hash?: 'SHA-1' | 'SHA-256' }): Promise<any>;
    generateClientKeyPair(options?: { modulusLength?: 2048 | 3072 | 4096; hash?: 'SHA-1' | 'SHA-256' }): Promise<CryptoKeyPair | null>;
    setClientKeyPair(publicKey: string | CryptoKey, privateKey: CryptoKey): Promise<boolean>;
    setServerPublicKey(publicKey: string | CryptoKey): Promise<boolean>;
    encryptPayload(data: any, options?: { serverPublicKey?: CryptoKey | string }): Promise<{ type?: 'asymmetric' | 'hybrid'; data?: string; key?: string; iv?: string }>;
    decryptPayload(encryptedPayload: Record<string, any> | string, options?: { clientPrivateKey?: CryptoKey }): Promise<string>;
    hasServerPublicKey(): boolean;
    getServerPublicKey(): CryptoKey | null;
    getClientKeyPair(): Promise<CryptoKeyPair | null>;
    clearCryptoSession(): Promise<void>;

    getFileInfo(url: string, options?: NNetworkRequestOptions): Promise<any>;
    getFilesInfo(urls: string[], options?: NNetworkRequestOptions): Promise<any[]>;
    downloadFile(url: string, options?: NNetworkRequestOptions): Promise<any>;
    downloadFiles(urls: string[], options?: NNetworkRequestOptions): Promise<any[]>;
    uploadFile(url: string, file: any, options?: NNetworkRequestOptions): Promise<any>;
    uploadFiles(url: string, files: any[], options?: NNetworkRequestOptions): Promise<any[]>;
    destroy(): void;
}

export interface NTableRequestSyncConfig {
    collection?: string;
    endpoint?: string;
    primaryKey?: string;
    versionField?: string;
    conflictStrategy?: NDataSyncConflictStrategy;
    mergeResolver?: (conflict: NDataSyncConflict) => Record<string, any>;
    batchSize?: number;
    pullLimit?: number;
    maxPages?: number;
    enabled?: boolean;
}

export interface NTableRequestOptions extends NObjectOptions {
    table?: string;
    request?: NRequestManager | null;
    db?: NDatabase | NSql | null;
    primaryKey?: string;
    sync?: boolean | NTableRequestSyncConfig;
    synchronizer?: NDataSynchronizer | null;
}

export interface NTableRequestQuery {
    type?: string | { table?: string; type?: string };
    sql?: string;
    sqlCount?: string;
    params?: any[] | Record<string, any>;
    paramsCount?: any[] | Record<string, any>;
    data?: Record<string, any>;
    where?: string;
    asList?: boolean;
    isLocalOnly?: boolean | number;
    requestCode?: string;
    [key: string]: any;
}

/**
 * Gestionnaire de requêtes de données sur une table avec persistance SQLite locale,
 * appels distants et synchronisation optionnelle via `NDataSynchronizer` (`requests/NTableRequest.js`).
 */
export class NTableRequest extends NObject {
    constructor(options?: NTableRequestOptions);

    table: string;
    primaryKey: string;
    request: NRequestManager | null;
    readonly db: any;
    readonly syncEnabled: boolean;
    readonly synchronizer: NDataSynchronizer | null;

    execute<T = any>(req?: NTableRequestQuery): Promise<T>;
    get<T = Record<string, any>>(req?: NTableRequestQuery): Promise<T | null>;
    getData<T = Record<string, any>>(req?: NTableRequestQuery): Promise<T | null>;
    getDataByPrimaryKey<T = Record<string, any>>(primaryKeyValue: any): Promise<T | null>;
    gets<T = Record<string, any>>(req?: NTableRequestQuery): Promise<{ dataList: T[]; countAll: number; totalRows: number; updated?: number }>;
    getDatas<T = Record<string, any>>(req?: NTableRequestQuery): Promise<{ dataList: T[]; countAll: number; totalRows: number; updated?: number }>;
    insert<T = Record<string, any>>(req?: NTableRequestQuery): Promise<T | null>;
    insertData<T = Record<string, any>>(req?: NTableRequestQuery): Promise<T | null>;
    update(req?: NTableRequestQuery): Promise<number>;
    updateData(req?: NTableRequestQuery): Promise<number>;
    delete(req?: NTableRequestQuery): Promise<number>;
    deleteData(req?: NTableRequestQuery): Promise<number>;
    enableSync(config?: NTableRequestSyncConfig): this;
    disableSync(): this;
    syncDatas(options?: { direction?: 'both' | 'push' | 'pull'; [key: string]: any }): Promise<boolean>;
    destroy(): void;
}

export interface NRequestManagerOptions extends NObjectOptions {
    tables?: Record<string, NTableRequest>;
    synchronizer?: NDataSynchronizer | NDataSynchronizerOptions;
}

/**
 * Registre centralisant plusieurs instances de `NTableRequest` et une instance de `NDataSynchronizer` (`requests/NRequestManager.js`).
 */
export class NRequestManager extends NObject {
    constructor(options?: NRequestManagerOptions);

    readonly tableNames: string[];
    readonly count: number;
    readonly synchronizer: NDataSynchronizer | null;

    addTableRequest(tableName: string, tableRequest: NTableRequest): NTableRequest | null;
    hasTableRequest(tableName: string): boolean;
    getTableRequest(tableName: string): NTableRequest | null;
    removeTableRequest(tableName: string): boolean;
    clear(): void;
    execute<T = any>(req?: NTableRequestQuery & { table?: string }): Promise<T>;
    sync(tableName?: string | null, options?: { direction?: 'both' | 'push' | 'pull' }): Promise<Record<string, any>>;
    destroy(): void;
}

export type NServiceDriver = 'native' | 'websocket' | 'sse' | 'polling';

export interface NServiceOptions extends NObjectOptions {
    id?: string;
    serviceId?: string;
    url?: string;
    driver?: 'auto' | NServiceDriver;
    lastId?: number;
    persistLastId?: boolean;
    pollingInterval?: number;
    reconnectDelay?: number;
}

/**
 * Gestionnaire de communication temps réel et périodique permettant de synchroniser
 * un identifiant d'événement entier (`lastId`, `int`) entre le serveur et le client
 * sur un moteur d'écoute unique (`native` -> `websocket` -> `sse` -> `polling`),
 * avec persistance locale dans `NIndexedDB` (`requests/NService.js`).
 */
export class NService extends NObject {
    constructor(options?: NServiceOptions);

    readonly serviceId: string;
    readonly url: string;
    readonly lastId: number;
    readonly isRunning: boolean;
    readonly activeDriver: NServiceDriver | null;
    readonly driver: NServiceDriver;
    readonly isNativeAvailable: boolean;
    readonly isWebSocketAvailable: boolean;
    readonly isSseAvailable: boolean;
    readonly isPollingAvailable: boolean;
    readonly pollingInterval: number;

    configure(options?: NServiceOptions): this;
    on(eventName: 'id' | 'change' | 'connected' | 'disconnected' | 'error' | string, callback: (payload: any) => void): this;
    once(eventName: string, callback: (payload: any) => void): this;
    off(eventName?: string, callback?: (payload: any) => void): this;

    loadLastId(): Promise<number>;
    saveLastId(id?: number): Promise<boolean>;
    resetLastId(newId?: number): Promise<number>;

    start(options?: NServiceOptions): Promise<{ ok: boolean; driver: NServiceDriver | null; lastId: number }>;
    stop(): Promise<boolean>;
    send(id?: number): Promise<boolean>;
    refreshId(customUrl?: string): Promise<number | null>;
    fetchId(customUrl?: string): Promise<number | null>;
    destroy(): void;
}

export type NDataSyncConflictStrategy = 'serverWins' | 'clientWins' | 'manual' | 'merge';

export interface NDataSyncCollectionConfig {
    endpoint: string;
    primaryKey?: string;
    versionField?: string;
    enabled?: boolean;
    conflictStrategy?: NDataSyncConflictStrategy;
    mergeResolver?: (conflict: any) => Promise<Record<string, any> | null> | Record<string, any> | null;
    batchSize?: number;
    pullLimit?: number;
    maxPages?: number;
}

export interface NDataSynchronizerOptions extends NObjectOptions {
    network?: NNetwork;
    metaDb?: NIndexedDB;
    metaDbName?: string;
    allowUnappliedPull?: boolean;
    retry?: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number };
    protocol?: {
        formatPushRequest?: (col: any, operations: any[]) => any;
        parsePushResponse?: (data: any, batch: any[]) => { confirmed: any[]; conflicts: any[]; failed: any[] };
        formatPullRequest?: (col: any, cursor: any, limit: number) => Record<string, any>;
        parsePullResponse?: (data: any) => { changes: any[]; nextCursor: any; hasMore: boolean };
    };
    autoSync?: boolean | {
        enabled?: boolean;
        onStart?: boolean;
        onOnline?: boolean;
        onLocalChange?: boolean;
        onLocalChangeDelay?: number;
        interval?: number;
    };
}

/**
 * Moteur générique de synchronisation bidirectionnelle offline-first (`requests/NDataSynchronizer.js`).
 */
export class NDataSynchronizer extends NObject {
    constructor(options?: NDataSynchronizerOptions);

    destroy(): void;

    on(eventName: string, callback: NEventCallback): this;
    off(eventName?: string, callback?: NEventCallback): this;

    register(collectionId: string, config: NDataSyncCollectionConfig): boolean;
    unregister(collectionId: string): boolean;
    configureAutoSync(autoSyncOptions?: boolean | NDataSynchronizerOptions['autoSync']): this;
    trackChange(
        collectionId: string,
        action: 'create' | 'update' | 'delete',
        recordOrKey: any,
        options?: { baseVersion?: any; operationId?: string; force?: boolean }
    ): Promise<Record<string, any> | null>;

    sync(collectionId?: string | null, options?: { direction?: 'both' | 'push' | 'pull' }): Promise<Record<string, any>>;
    push(collectionId?: string | null, options?: Record<string, any>): Promise<Record<string, any>>;
    pull(collectionId?: string | null, options?: Record<string, any>): Promise<Record<string, any>>;
    pause(collectionId?: string | null): this;
    resume(collectionId?: string | null): Promise<Record<string, any>>;
    stop(collectionId?: string | null): this;
    getStatus(): Record<string, any>;
    getCollectionStatus(collectionId: string): Record<string, any> | null;
    resolveConflict(conflictId: string, resolution: 'serverWins' | 'clientWins' | Record<string, any>): Promise<boolean>;
}

/* ========================================================================== *
 * 11. DOSSIER worker/ (NWorker, NWorkerManager, NServiceWorker)
 * ========================================================================== */

export interface NWorkerOptions extends NObjectOptions {
    name?: string;
    url?: string | URL | null;
    source?: string | (() => void) | null;
    type?: 'classic' | 'module';
}

export interface NWorkerResponse<T = unknown> {
    success: boolean;
    id?: string;
    action: string;
    params?: unknown;
    result?: T;
    error?: string | null;
    code?: string;
}

export type NWorkerUpdateCallback = (updateData: any) => void;
export type NWorkerActionHandler = (params: any, onUpdate?: NWorkerUpdateCallback) => Promise<any> | any;

/**
 * Encapsulation d'un Web Worker bidirectionnel avec suivi de progression (`worker/NWorker.js`).
 */
export class NWorker extends NObject {
    constructor(options?: NWorkerOptions);

    readonly name: string;
    readonly isRunning: boolean;
    readonly pendingCount: number;

    request<T = unknown>(action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null, timeout?: number | null): Promise<NWorkerResponse<T>>;
    onRequest(action: string, params: any, onUpdate?: NWorkerUpdateCallback): Promise<any>;
    terminate(): void;
    destroy(): void;

    static addActionInstance(action: string, initFunction: NWorkerActionHandler): void;
    static getActionInstance(action: string): NWorkerActionHandler | null;
    static requestMain<T = unknown>(action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null, timeout?: number | null): Promise<NWorkerResponse<T>>;
}

/**
 * Gestionnaire centralisé de Web Workers et de pools Round-Robin (`worker/NWorkerManager.js`).
 */
export class NWorkerManager extends NObject {
    constructor();

    readonly isWorkerContext: boolean;
    readonly isSupported: boolean;
    readonly size: number;
    readonly names: string[];

    registerAction(action: string, handler: NWorkerActionHandler): this;
    unregisterAction(action: string): boolean;
    hasAction(action: string): boolean;
    executeAction<T = any>(action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null): Promise<T | null>;

    create(name: string, options?: NWorkerOptions): NWorker;
    add(name: string, worker: NWorker): NWorker | null;
    createPool(name: string, options?: NWorkerOptions, size?: number): NWorker[];
    has(name: string): boolean;
    get(name: string): NWorker | null;
    request<T = unknown>(name: string, action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null, timeout?: number | null): Promise<NWorkerResponse<T>>;
    terminate(name: string): boolean;
    terminateAll(): void;
    toJSON(): Record<string, any>;
    destroy(): void;
}

export type NServiceWorkerStrategy =
    | 'cache-first'
    | 'network-first'
    | 'stale-while-revalidate'
    | 'cache-only'
    | 'network-only';

export type NServiceWorkerMode = 'native-sw' | 'worker-scope' | 'monkey-patch' | 'inactive';

export interface NServiceWorkerRoute {
    match: string | RegExp | ((url: string, request: { url: string; method: string; headers?: Record<string, string> }) => boolean);
    strategy?: NServiceWorkerStrategy;
    ttl?: number;
    methods?: string[];
    handler?: (context: { url: string; method: string; headers: Record<string, string>; request?: Request }) => Promise<Response | any> | Response | any;
}

export interface NServiceWorkerOptions {
    swUrl?: string;
    scope?: string;
    entryPoint?: string;
    defaultStrategy?: NServiceWorkerStrategy;
    defaultTtl?: number;
    precache?: string[];
    routes?: NServiceWorkerRoute[];
}

/**
 * Gestionnaire du mode hors-ligne (Offline), d'interception des requêtes avec cache,
 * de point d'entrée unique (`entryPoint`) et de repli par Monkey Patching (`worker/NServiceWorker.js`).
 */
export class NServiceWorker extends NObject {
    constructor(options?: NServiceWorkerOptions);

    readonly event: NEvent;
    readonly isNativeSupported: boolean;
    readonly isServiceWorkerScope: boolean;
    readonly isEnabled: boolean;
    readonly isMonkeyPatched: boolean;
    readonly mode: NServiceWorkerMode;
    readonly entryPoint: string;

    configure(options?: NServiceWorkerOptions): this;
    setEntryPoint(entryPointUrl: string): this;
    addRoute(route: NServiceWorkerRoute): this;
    clearRoutes(): this;

    enable(options?: NServiceWorkerOptions & { forceMonkeyPatch?: boolean; autoPrecache?: boolean }): Promise<{ ok: boolean; mode: NServiceWorkerMode }>;
    disable(options?: { unregister?: boolean }): Promise<boolean>;
    enableMonkeyPatch(): boolean;
    disableMonkeyPatch(): boolean;

    precache(urls?: string[], options?: { ttl?: number }): Promise<{ total: number; cached: number; failed: number }>;
    handleRequest(requestOrUrl: Request | string, init?: RequestInit): Promise<Response>;
    resolveFileUrl(urlOrPath: string, options?: { preferBlobUrl?: boolean; mimeType?: string }): Promise<string | null>;
    installServiceWorkerListeners(): boolean;
    destroy(): void;
}
