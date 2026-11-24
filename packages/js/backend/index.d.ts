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
    constructor(target?: any);

    readonly isEmpty: boolean;
    readonly target: any;
    readonly util: typeof NUtil;

    has(event: string, callback?: NEventCallback): boolean;
    hasListener(event: string, callback?: NEventCallback): boolean;
    listenerCount(event?: string): number;
    eventNames(): string[];
    on(event: string, callback: NEventCallback): this;
    off(event: string, callback?: NEventCallback): this;
    emit(event: string, data?: any): this;
    clear(): this;

    static create(target?: any): NEvent;
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

    on(event: string, callback: NEventCallback): this;
    off(event: string, callback?: NEventCallback): this;
    emit(event: string, data?: any): this;
    hasListener(event: string, callback?: NEventCallback): boolean;
    listenerCount(event?: string): number;
    eventNames(): string[];
    clearEvents(): this;

    protected _init(): void;
    destroy(): void;
    hasState(key: string): boolean;
    getState<T = any>(key: string, defaultValue?: T): T;
    setState(keyOrObject: string | Record<string, any>, value?: any): this;
    toString(): string;
    toJSON(): NObjectSerialized;
    fromJSON(data?: Partial<NObjectSerialized> | Record<string, any>): this;
    clone(): this;

    static create<T extends NObject = NObject>(options?: NObjectOptions): T;
    static isNObject(value: any): value is NObject;
    static registerUtil(util: typeof NUtil): typeof NObject;
    static registerIdb(idb: typeof NIndexedDB): typeof NObject;
    static registerConfig(config: typeof NConfig): typeof NObject;
    static registerSql(sql: typeof NSql): typeof NObject;
    static registerStorage(storage: typeof NStorage): typeof NObject;
    static registerLang(lang: typeof NLang): typeof NObject;
    readonly idb: NIndexedDB | null;
    readonly config: NConfig | null;
    readonly sql: NSql | null;
    readonly storage: typeof NStorage | null;
    readonly lang: typeof NLang | null;
}

/* ========================================================================== *
 * 2. DOSSIER log/ (NLog)                                                     *
 * ========================================================================== */

export type NLogLevel = 'debug' | 'info' | 'warn' | 'warning' | 'error' | 'none';
export type NLogLevelLabel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
export type NLogContext = string | Record<string, any> | null;

export interface NLogOptions extends NObjectOptions {
    consoleEnabled?: boolean;
    traceEnabled?: boolean;
    maxLogs?: number;
    context?: NLogContext;
}

export interface NLogEntry {
    id: number;
    timestamp: string;
    level: NLogLevelLabel;
    levelNum: number;
    message: string;
    context: NLogContext;
    caller: string | null;
    details: any;
    code: any;
    stack: string | null;
}

export interface NLogFilter {
    level?: NLogLevel | number;
    context?: string;
    search?: string;
    limit?: number;
}

export interface NLogExceptionResult {
    success: boolean;
    message: string;
    code: any;
    log: NLogEntry;
}

export interface NLogImportOptions {
    merge?: boolean;
}

export interface NLogImportResult {
    success: boolean;
    count: number;
}

/**
 * Gestionnaire de journalisation centralisé avec historique circulaire en mémoire (`log/NLog.js`).
 */
export class NLog {
    static readonly LEVEL: Readonly<{
        DEBUG: 0;
        INFO: 1;
        WARN: 2;
        ERROR: 3;
        NONE: 99;
    }>;

    static readonly event: NEvent;
    static readonly isConsoleEnabled: boolean;
    static readonly isTraceEnabled: boolean;
    static readonly maxLogs: number;

    static configure(options?: NLogOptions): typeof NLog;
    static setConsoleEnabled(enabled?: boolean): typeof NLog;
    static setTraceEnabled(enabled?: boolean): typeof NLog;
    static setMaxLogs(max: number): typeof NLog;
    static debug(message: string, details?: any, context?: NLogContext): NLogEntry;
    static info(message: string, details?: any, context?: NLogContext): NLogEntry;
    static warn(message: string, details?: any, context?: NLogContext): NLogEntry;
    static error(message: string, errorOrDetails?: Error | any, context?: NLogContext): NLogEntry;
    static write(
        level: NLogLevel | number,
        message: string,
        details?: any,
        context?: NLogContext,
        extra?: { stack?: string | null; code?: any; caller?: string | null }
    ): NLogEntry;
    static captureException(error: unknown, additionalContext?: Record<string, any>): NLogExceptionResult;
    static getLogs(filter?: NLogFilter | null): NLogEntry[];
    static export(format?: 'json' | 'text' | 'raw'): string | NLogEntry[];
    static import(data: string | Array<Partial<NLogEntry>>, options?: NLogImportOptions): NLogImportResult;
    static clear(): typeof NLog;
    static destroy(): void;
}

/* ========================================================================== *
 * 3. DOSSIER config/ (NConfig)                                               *
 * ========================================================================== */

export type NConfigPath = string | number | Array<string | number>;

export interface NConfigOptions extends NObjectOptions {
    defaults?: Record<string, any>;
    data?: Record<string, any>;
    dotEnv?: string;
    loadProcessEnv?: boolean;
    freeze?: boolean;
}

/**
 * Gestionnaire de configuration applicative en mémoire avec typage fort et valeurs par défaut (`config/NConfig.js`).
 */
export class NConfig extends NObject {
    static instance(options?: NConfigOptions): NConfig;
    constructor(options?: NConfigOptions);

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
    setDefaults(defaultsObject: Record<string, any>): this;
    merge(configObject: Record<string, any>): this;
    remove(path: NConfigPath): boolean;
    reset(): this;
    clear(): this;
    freeze(): this;
    require(requiredPaths?: NConfigPath[]): boolean;
    loadFromDotEnv(dotEnvContent: string): this;
    loadFromProcess(overwrite?: boolean, prefix?: string): this;
    all(sectionPath?: string): Record<string, any>;
    toJSON(): { frozen: boolean; data: Record<string, any> };
    destroy(): void;
}

/* ========================================================================== *
 * 4. DOSSIER environment/ (NEnv)                                             *
 * ========================================================================== */

export type NEnvironmentType = 'browser' | 'worker' | 'node' | 'unknown';
export type NEnvironmentOS = 'android' | 'harmonyos' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown';
export type NEnvironmentBrowser = 'edge' | 'opera' | 'firefox' | 'chrome' | 'safari' | 'unknown';

export interface NEnvironmentInfo {
    type: NEnvironmentType;
    os: NEnvironmentOS;
    browser: NEnvironmentBrowser;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isTouch: boolean;
    isOnline: boolean;
    isWebView: boolean;
    isSecureContext: boolean;
    isDarkMode: boolean;
    language: string;
    timezone: string;
}

/**
 * Détection des caractéristiques de l'environnement d'exécution (`environment/NEnv.js`).
 */
export class NEnv {
    static readonly type: NEnvironmentType;
    static readonly isBrowser: boolean;
    static readonly isNode: boolean;
    static readonly isWorker: boolean;
    static readonly os: NEnvironmentOS;
    static readonly isAndroid: boolean;
    static readonly isHarmonyOS: boolean;
    static readonly isIOS: boolean;
    static readonly isWindows: boolean;
    static readonly isMacOS: boolean;
    static readonly isLinux: boolean;
    static readonly browser: NEnvironmentBrowser;
    static readonly isMobile: boolean;
    static readonly isTablet: boolean;
    static readonly isDesktop: boolean;
    static readonly isTouch: boolean;
    static readonly isWebView: boolean;
    static readonly isOnline: boolean;
    static readonly isOffline: boolean;
    static readonly isSecureContext: boolean;
    static readonly isDarkMode: boolean;
    static readonly language: string;
    static readonly timezone: string;
    static readonly userAgent: string;
    static readonly info: NEnvironmentInfo;
}

/* ========================================================================== *
 * 5. DOSSIER system/ (NSys)                                                    *
 * ========================================================================== */

export interface NSystemOptions extends NObjectOptions {
    watchNetwork?: boolean;
    onOnline?: (networkInfo: NSystemNetworkInfo) => void;
    onOffline?: (networkInfo: NSystemNetworkInfo) => void;
}

export interface NSystemMemoryInfo {
    used: number;
    total: number;
    limit: number;
    usagePercent: number;
    formattedUsed: string;
    formattedTotal: string;
}

export interface NSystemScreenInfo {
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    pixelRatio: number;
    colorDepth: number;
    orientation: 'landscape' | 'portrait';
}

export interface NSystemNetworkInfo {
    online: boolean;
    effectiveType: string;
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean;
}

export interface NSystemBatteryInfo {
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
}

export interface NSystemStorageQuota {
    usage: number;
    quota: number;
    usagePercent: number;
    formattedUsage: string;
    formattedQuota: string;
}

export interface NSystemMeasureResult<T = any> {
    success: boolean;
    label: string;
    durationMs: number;
    result: T | null;
    code?: string;
    error?: string;
}

/**
 * Informations matérielles, mesures de performance, presse-papiers et passerelle native (`system/NSys.js`).
 */
export class NSys {
    static readonly cpuCores: number;
    static readonly arch: string;
    static readonly deviceMemory: number | null;
    static readonly memory: NSystemMemoryInfo;
    static readonly screen: NSystemScreenInfo;
    static readonly network: NSystemNetworkInfo;

    static uptime(inSeconds?: boolean): number;
    static hrtime(): number;
    static measure<T = any>(label: string, fn: () => T | Promise<T>): Promise<NSystemMeasureResult<T>>;
    static getBattery(): Promise<NSystemBatteryInfo | null>;
    static getStorageQuota(): Promise<NSystemStorageQuota>;
    static copyToClipboard(text: string): Promise<boolean>;
    static readFromClipboard(): Promise<string>;
    static getBrowserUrl(): string;
    static setBrowserTitle(title: string): Promise<any> | void;
    static setBrowserUrl(url: string, state?: any): Promise<any> | void;
    static pushBrowserUrl(url: string, state?: any): Promise<any> | void;
    static browserBack(): Promise<any> | void;
    static openUrl(url: string, target?: string): Promise<any> | Window | null;
    static loadUrl(url: string): Promise<any> | void;
    static share(data?: { title?: string; text?: string; url?: string }): Promise<boolean>;
    static watchNetwork(
        enable?: boolean,
        callbacks?: {
            onOnline?: (networkInfo: NSystemNetworkInfo) => void;
            onOffline?: (networkInfo: NSystemNetworkInfo) => void;
        }
    ): typeof NSys;
    static invokeNative<T = any>(actionOrParams: string | Record<string, any>, payloadOrOptions?: Record<string, any>): Promise<T>;
    static getSnapshot(): Promise<Record<string, any>>;
    static toJSON(): Record<string, any>;
}

/* ========================================================================== *
 * 6. DOSSIER utils/ (NUtil + 11 classes utilitaires)                         *
 * ========================================================================== */

export interface NRetryOptions<T = any> {
    attempts?: number;
    delayMs?: number;
    exponential?: boolean;
    fallback?: T;
}

export type NDebouncedFunction<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
    cancel: () => void;
};

/**
 * Classe statique regroupant les méthodes utilitaires transversales (`utils/NUtil.js`).
 */
export class NUtil {
    static uuid(): string;
    static uid(prefix?: string, randomLength?: number): string;
    static getType(value: any): string;
    static isEmpty(value: any): boolean;
    static isDefined<T>(value: T | null | undefined): value is T;
    static toBoolean(value: any, fallback?: boolean): boolean;
    static sleep(ms?: number): Promise<void>;
    static setTimeout(callback: (...args: any[]) => void, delayOrTarget?: number | Record<string, any>, ...args: any[]): any;
    static clearTimeout(timerOrId: any): void;
    static debounce<T extends (...args: any[]) => any>(fn: T, waitMs?: number): NDebouncedFunction<T>;
    static throttle<T extends (...args: any[]) => any>(fn: T, limitMs?: number): (...args: Parameters<T>) => void;
    static retry<T = any>(fn: (attempt: number) => Promise<T> | T, options?: NRetryOptions<T>): Promise<T | { success: false; code: string; error: string; attempts: number }>;
    static isUuid(value: any): boolean;
    static isBoolean(value: any): value is boolean;
    static isFunction(value: any): value is (...args: any[]) => any;
    static isPromise<T = any>(value: any): value is Promise<T>;
}

/**
 * Primitives cryptographiques Web Crypto pour le hachage SHA-256, l'encodage Base64
 * et le chiffrement symétrique, asymétrique, hybride et local (`utils/NCrypto.js`).
 */
export class NCrypto {
    static isWebCryptoAvailable(): boolean;
    static randomBytes(length?: number): Uint8Array;
    static bytesToBase64(bytes: Uint8Array | ArrayBuffer): string;
    static base64ToBytes(base64: string): Uint8Array;
    static encodeBase64(text: string): string;
    static decodeBase64(base64: string): string;

    static sha256(data: string | Uint8Array | any, outputFormat?: 'hex' | 'base64' | 'bytes'): Promise<string | Uint8Array>;

    static generateKeyPair(options?: { modulusLength?: 2048 | 3072 | 4096; hash?: 'SHA-1' | 'SHA-256' }): Promise<CryptoKeyPair | null>;
    static exportPublicKeyToPem(publicKey: CryptoKey): Promise<string>;
    static importPublicKeyFromPem(pemKey: string): Promise<CryptoKey | null>;

    static encrypt(
        data: any,
        publicKey?: CryptoKey | null
    ): Promise<{ type?: 'asymmetric' | 'hybrid'; data?: string; key?: string; iv?: string }>;
    static decrypt(encryptedPayload: Record<string, any> | string, privateKey?: CryptoKey | null): Promise<string>;

    static encryptSymmetric(
        data: any,
        secretKey: string
    ): Promise<{ type: 'aes-256-cbc'; iv: string; data: string } | null>;
    static decryptSymmetric(payload: Record<string, any> | string, secretKey: string): Promise<string>;

    static encryptLocal(data: any): Promise<string>;
    static decryptLocal(encryptedData: string): Promise<string>;
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
 * Manipulation, comparaison, transformation de casse et formatage de chaînes (`utils/NStr.js`).
 */
export class NStr {
    static isString(value: any): value is string;
    static isEmpty(text: any): boolean;
    static isEmail(text: string): boolean;
    static isAlphanumeric(text: string): boolean;
    static equals(textA: string, textB: string, options?: NStringCompareOptions): boolean;
    static contains(text: string, search: string, options?: NStringCompareOptions): boolean;
    static indexOf(text: string, search: string, options?: NStringCompareOptions): number;
    static startsWith(text: string, prefix: string, options?: NStringCompareOptions): boolean;
    static endsWith(text: string, suffix: string, options?: NStringCompareOptions): boolean;
    static toUpper(text: string): string;
    static toLower(text: string): string;
    static capitalize(text: string): string;
    static toTitleCase(text: string): string;
    static toCamelCase(text: string): string;
    static toPascalCase(text: string): string;
    static toSnakeCase(text: string): string;
    static toKebabCase(text: string): string;
    static trim(text: string, chars?: string | null): string;
    static cleanSpaces(text: string): string;
    static removeAccents(text: string): string;
    static slugify(text: string, separator?: string): string;
    static escapeHtml(text: string): string;
    static unescapeHtml(text: string): string;
    static split(text: string, separator?: string | RegExp, limit?: number): string[];
    static splitAt<T = string | null>(text: string, separator: string | RegExp, index: number, defaultValue?: T): string | T;
    static insertEvery(text: string, step?: number, separator?: string, fromEnd?: boolean): string;
    static truncate(text: string, maxLength: number, suffix?: string): string;
    static padStart(text: string | number, length: number, padChar?: string): string;
    static padEnd(text: string | number, length: number, padChar?: string): string;
    static repeat(text: string, count: number): string;
    static reverse(text: string): string;
    static replaceAll(text: string, search: string | RegExp, replacement: string): string;
    static template(text: string, data?: Record<string, any>): string;
    static mask(text: string, options?: NStringMaskOptions): string;
    static countOccurrences(text: string, subString: string, options?: NStringCompareOptions): number;
    static wordCount(text: string): number;
    static random(length?: number, charset?: string): string;
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
 * Validation, conversion, calculs mathématiques et formatage numérique (`utils/NNum.js`).
 */
export class NNum {
    static isNumber(value: any): value is number;
    static isNumeric(value: any): boolean;
    static isInteger(value: any): boolean;
    static isFloat(value: any): boolean;
    static isPositive(value: any, includeZero?: boolean): boolean;
    static isNegative(value: any, includeZero?: boolean): boolean;
    static isEven(value: any): boolean;
    static isOdd(value: any): boolean;
    static isBetween(value: any, min: number, max: number, inclusive?: boolean): boolean;
    static equals(numA: any, numB: any, tolerance?: number): boolean;
    static toInt(value: any, defaultValue?: number, radix?: number): number;
    static toFloat(value: any, defaultValue?: number): number;
    static round(value: any, decimals?: number): number;
    static floor(value: any, decimals?: number): number;
    static ceil(value: any, decimals?: number): number;
    static clamp(value: any, min: number, max: number): number;
    static percentage(part: any, total: any, decimals?: number): number;
    static percentageOf(percent: any, total: any, decimals?: number): number;
    static sum(numbers?: any[]): number;
    static average(numbers?: any[], decimals?: number): number;
    static min(numbers?: any[]): number | null;
    static max(numbers?: any[]): number | null;
    static randomInt(min?: number, max?: number): number;
    static randomFloat(min?: number, max?: number, decimals?: number): number;
    static format(value: any, options?: NNumberFormatOptions): string;
    static formatCurrency(value: any, options?: NNumberCurrencyOptions): string;
    static formatBytes(bytes: number, decimals?: number): string;
    static pad(value: number | string, length?: number): string;
}

export type NDateInput = Date | string | number;

/**
 * Manipulation, arithmétique calendaire, calculs d'écarts et formatage de dates (`utils/NDate.js`).
 */
export class NDate {
    static now(): Date;
    static nowDate(format?: string, utc?: boolean): string;
    static nowTime(format?: string, utc?: boolean): string;
    static timestamp(inSeconds?: boolean): number;
    static create(year: number, month?: number, day?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
    static toDate(value: NDateInput): Date | null;
    static isValid(value: any): boolean;
    static isLeapYear(yearOrDate?: number | NDateInput): boolean;
    static isToday(value: NDateInput): boolean;
    static isPast(value: NDateInput, reference?: NDateInput): boolean;
    static isFuture(value: NDateInput, reference?: NDateInput): boolean;
    static isWeekend(value: NDateInput): boolean;
    static isWeekday(value: NDateInput): boolean;
    static equals(dateA: NDateInput, dateB: NDateInput, options?: { unit?: string; ignoreTime?: boolean }): boolean;
    static isBefore(dateA: NDateInput, dateB: NDateInput): boolean;
    static isAfter(dateA: NDateInput, dateB: NDateInput): boolean;
    static isBetween(value: NDateInput, start: NDateInput, end: NDateInput, inclusive?: boolean): boolean;
    static getYear(value: NDateInput): number | null;
    static getMonth(value: NDateInput): number | null;
    static getDay(value: NDateInput): number | null;
    static getDayOfWeek(value: NDateInput): number | null;
    static getHours(value: NDateInput): number | null;
    static getMinutes(value: NDateInput): number | null;
    static getSeconds(value: NDateInput): number | null;
    static daysInMonth(yearOrDate: number | NDateInput, month?: number): number | null;
    static addYears(value: NDateInput, years: number): Date | null;
    static addMonths(value: NDateInput, months: number): Date | null;
    static addDays(value: NDateInput, days: number): Date | null;
    static addHours(value: NDateInput, hours: number): Date | null;
    static addMinutes(value: NDateInput, minutes: number): Date | null;
    static addSeconds(value: NDateInput, seconds: number): Date | null;
    static startOfDay(value: NDateInput): Date | null;
    static endOfDay(value: NDateInput): Date | null;
    static startOfMonth(value: NDateInput): Date | null;
    static endOfMonth(value: NDateInput): Date | null;
    static startOfYear(value: NDateInput): Date | null;
    static endOfYear(value: NDateInput): Date | null;
    static diffInSeconds(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    static diffInMinutes(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    static diffInHours(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    static diffInDays(dateA: NDateInput, dateB: NDateInput, absolute?: boolean): number | null;
    static getAge(birthDate: NDateInput, referenceDate?: NDateInput): number | null;
    static format(value: NDateInput, pattern?: string): string;
    static toSql(value?: NDateInput, includeTime?: boolean): string;
    static toIso(value?: NDateInput): string;
}

export interface NAmountValidOptions {
    allowNegative?: boolean;
    allowZero?: boolean;
}

/**
 * Calculs monétaires exacts en centimes, TVA, remises et formatage de devises (`utils/NAmount.js`).
 */
export class NAmount {
    static isValid(value: any, options?: NAmountValidOptions): boolean;
    static parse(value: any, fallback?: number | null): number | null;
    static equals(amountA: any, amountB: any, decimals?: number): boolean;
    static toMinorUnits(amount: any, decimals?: number): number;
    static fromMinorUnits(minorUnits: number, decimals?: number): number;
    static add(amountA: any, amountB?: any, decimals?: number): number;
    static subtract(amountA: any, amountB: any, decimals?: number): number;
    static multiply(amount: any, factor: number, decimals?: number): number;
    static divide(amount: any, divisor: number, decimals?: number): number;
    static allocate(amount: any, partsOrRatios: number | number[], decimals?: number): number[];
    static taxAmount(amountHT: any, taxRate: number, decimals?: number): number;
    static addTax(amountHT: any, taxRate: number, decimals?: number): number;
    static extractTax(amountTTC: any, taxRate: number, decimals?: number): { ht: number; tax: number; ttc: number };
    static applyDiscount(amount: any, discountPercent: number, decimals?: number): number;
    static convert(amount: any, exchangeRate: number, decimals?: number): number;
    static format(amount: any, currency?: string, options?: NNumberCurrencyOptions): string;
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
export class NEmail {
    static isValid(email: any): boolean;
    static isFreeProvider(email: string, customProviders?: string[]): boolean;
    static isDisposable(email: string, customBlacklist?: string[]): boolean;
    static isBusiness(email: string): boolean;
    static hasDomain(email: string, allowedDomains: string | string[], allowSubdomains?: boolean): boolean;
    static normalize(email: string, options?: NEmailNormalizeOptions): string;
    static equals(emailA: string, emailB: string, options?: NEmailNormalizeOptions): boolean;
    static parse(email: string): NEmailParsed | null;
    static getLocalPart(email: string, stripPlusTag?: boolean): string;
    static getDomain(email: string): string;
    static getTld(email: string): string;
    static mask(email: string, options?: { visibleStart?: number; visibleEnd?: number; maskChar?: string }): string;
    static formatDisplay(email: string, displayName?: string): string;
    static extractFromText(text: string, unique?: boolean): string[];
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
 * Validation, nettoyage, analyse et formatage de numéros de téléphone (`utils/NPhone.js`).
 */
export class NPhone {
    static clean(phone: string | number, keepPlus?: boolean): string;
    static isValid(phone: any, options?: { countryCode?: string; minLength?: number; maxLength?: number }): boolean;
    static isE164(phone: string): boolean;
    static equals(phoneA: string | number, phoneB: string | number, defaultCountryCode?: string): boolean;
    static toE164(phone: string | number, defaultCountryCode?: string, stripLeadingZero?: boolean): string;
    static toNational(phone: string | number, countryCode?: string, nationalPrefix?: string): string;
    static format(
        phone: string | number,
        options?: { groupSize?: number; separator?: string; countryCode?: string | number }
    ): string;
    static mask(phone: string | number, options?: NStringMaskOptions): string;
    static toTelUri(phone: string | number, scheme?: string): string;
    static toWhatsAppUrl(phone: string | number, message?: string): string;
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
export class NUrl {
    static isValid(url: any, options?: { requireHttps?: boolean; allowRelative?: boolean }): boolean;
    static isAbsolute(url: string): boolean;
    static isRelative(url: string): boolean;
    static isHttps(url: string): boolean;
    static isSameOrigin(urlA: string, urlB: string): boolean;
    static equals(urlA: string, urlB: string, options?: Record<string, any>): boolean;
    static parse(url: string): NUrlParsed | null;
    static getProtocol(url: string): string;
    static getDomain(url: string, stripWww?: boolean): string;
    static getPath(url: string): string;
    static getPathSegments(url: string): string[];
    static getHash(url: string): string;
    static parseQueryString(queryOrUrl: string): Record<string, any>;
    static stringifyQueryParams(params: Record<string, any>, prefixQuestionMark?: boolean): string;
    static getQueryParam<T = any>(url: string, paramName: string, fallback?: T): T;
    static setQueryParams(url: string, params: Record<string, any>): string;
    static removeQueryParams(url: string, paramNames: string | string[]): string;
    static join(...segments: string[]): string;
    static build(parts?: NUrlBuildParts): string;
    static normalize(url: string, options?: { sortQuery?: boolean; stripTrailingSlash?: boolean; stripHash?: boolean }): string;
    static encode(value: string): string;
    static decode(encodedValue: string): string;
    static encodeBase64Url(text: string): string;
    static decodeBase64Url(base64Url: string): string;
    static encodeId(idOrValue: string | number, salt?: string): string;
    static decodeId(token: string, salt?: string, asNumber?: boolean): string | number | null;
}

export type NJsonPath = string | number | Array<string | number>;

/**
 * Sérialisation JSON tolérante aux cycles, clonage et lecture/écriture par chemin (`utils/NJson.js`).
 */
export class NJson {
    static isValid(str: any, options?: { requireObjectOrArray?: boolean }): boolean;
    static isPlainObject(value: any): value is Record<string, any>;
    static isEmpty(value: any): boolean;
    static size(value: any, path?: NJsonPath): number;
    static count(value: any, path?: NJsonPath): number;
    static parse<T = any>(value: any, fallback?: T, reviver?: ((key: string, value: any) => any) | null): T;
    static stringify(
        value: any,
        options?: { pretty?: boolean; indent?: number; sortKeys?: boolean; fallback?: string }
    ): string;
    static prettify(value: any, indent?: number): string;
    static minify(value: any): string;
    static clone<T = any>(value: T): T;
    static equals(a: any, b: any): boolean;
    static merge<T extends Record<string, any> = Record<string, any>>(...objects: Record<string, any>[]): T;
    static get<T = any>(data: any, path: NJsonPath, fallback?: T): T;
    static getNumber(data: any, path: NJsonPath, fallback?: number | null): number | null;
    static getInt(data: any, path: NJsonPath, fallback?: number | null): number | null;
    static getFloat(data: any, path: NJsonPath, fallback?: number | null): number | null;
    static getString(data: any, path: NJsonPath, fallback?: string): string;
    static getArray<T = any>(data: any, path: NJsonPath, fallback?: T[]): T[];
    static getObject<T extends Record<string, any> = Record<string, any>>(data: any, path: NJsonPath, fallback?: T | null): T | null;
    static has(data: any, path: NJsonPath): boolean;
    static set<T = any>(data: T, path: NJsonPath, value: any): T;
    static remove(data: any, path: NJsonPath): boolean;
    static pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys?: K[]): Pick<T, K>;
    static omit<T extends Record<string, any>, K extends keyof T>(obj: T, keysToOmit?: K[]): Omit<T, K>;
    static flatten(obj: Record<string, any>, separator?: string, prefix?: string): Record<string, any>;
    static unflatten(flatObj: Record<string, any>, separator?: string): Record<string, any>;
    static forEach(
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
    requireSpecial?: boolean;
    disallowSpaces?: boolean;
}

export interface NPasswordStrengthResult {
    score: number;
    level: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong';
    entropy: number;
    isValid: boolean;
    missingRules: string[];
}

/**
 * Validation, évaluation de robustesse, génération et hachage PBKDF2 de mots de passe (`utils/NPass.js`).
 */
export class NPass {
    static isValid(password: string, options?: NPasswordRules): boolean;
    static evaluate(password: string, options?: NPasswordRules): NPasswordStrengthResult;
    static calculateEntropy(password: string): number;
    static isCommon(password: string): boolean;
    static generate(
        length?: number,
        options?: {
            uppercase?: boolean;
            lowercase?: boolean;
            numbers?: boolean;
            symbols?: boolean;
            excludeSimilar?: boolean;
        }
    ): string;
    static generatePin(length?: number): string;
    static hash(password: string, options?: { iterations?: number; saltHex?: string }): Promise<string>;
    static verify(plainPassword: string, storedHash: string): Promise<boolean>;
    static timingSafeEquals(a: string, b: string): boolean;
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
 * Manipulation immuable de tableaux et de collections d'objets (`utils/NArr.js`).
 */
export class NArr {
    static isArray(value: any): value is any[];
    static isEmpty(list: any): boolean;
    static size<T = any>(list: T[], predicate?: (item: T) => boolean): number;
    static count<T = any>(list: T[], predicate?: (item: T) => boolean): number;
    static toArray<T = any>(value: any): T[];
    static equals(listA: any[], listB: any[], ignoreOrder?: boolean): boolean;
    static contains<T = any>(list: T[], target: any, key?: keyof T): boolean;
    static get<T = any>(list: T[], index: number, fallback?: any): T | any;
    static first<T = any>(list: T[], count?: number): T | T[] | undefined;
    static last<T = any>(list: T[], count?: number): T | T[] | undefined;
    static insertAt<T = any>(list: T[], index: number, ...items: T[]): T[];
    static removeAt<T = any>(list: T[], index: number): T[];
    static removeValue<T = any>(list: T[], valueToRemove: any, key?: keyof T): T[];
    static compact<T = any>(list: T[], removeFalsy?: boolean): NonNullable<T>[];
    static unique<T = any>(list: T[], key?: keyof T | ((item: T) => any)): T[];
    static flatten<T = any>(list: any[], depth?: number): T[];
    static pluck<T = any, K extends keyof T = keyof T>(list: T[], key: K): Array<T[K]>;
    static groupBy<T = any>(list: T[], keyOrFn: keyof T | ((item: T) => string)): Record<string, T[]>;
    static keyBy<T = any>(list: T[], key: keyof T | ((item: T) => string)): Record<string, T>;
    static sortBy<T = any>(list: T[], keyOrFn?: keyof T | ((item: T) => any) | null, order?: 'asc' | 'desc'): T[];
    static chunk<T = any>(list: T[], size?: number): T[][];
    static paginate<T = any>(list: T[], page?: number, perPage?: number): NPaginatedResult<T>;
    static shuffle<T = any>(list: T[]): T[];
    static sample<T = any>(list: T[], count?: number): T | T[];
    static intersection<T = any>(listA: T[], listB: T[]): T[];
    static difference<T = any>(listA: T[], listB: T[]): T[];
    static union<T = any>(...lists: T[][]): T[];
    static range(start: number, end: number, step?: number): number[];
}


/* ========================================================================== *
 * 7. DOSSIER database/ (NSql, NIndexedDB, NStorage)                          *
 * ========================================================================== */

export interface NIndexedDBStoreIndexConfig {
    name: string;
    keyPath: string | string[];
    unique?: boolean;
    multiEntry?: boolean;
}

export interface NIndexedDBStoreConfig {
    name?: string;
    keyPath?: string | string[] | null;
    autoIncrement?: boolean;
    indexes?: NIndexedDBStoreIndexConfig[];
}

export interface NSqlOptions {
    name?: string;
    context?: string;
    wasmPath?: string | null;
    data?: Uint8Array | ArrayBuffer | number[] | null;
    dbData?: Uint8Array | null;
    dbStructure?: Record<string, string> | null;
    autoSave?: boolean;
    autoSaveDelay?: number;
    loadFromIndexedDB?: boolean;
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
    static instance(options?: NSqlOptions): NSql;
    constructor(options?: NSqlOptions);

    readonly name: string;
    readonly isInitialized: boolean;
    readonly isOpen: boolean;
    readonly isNative: boolean;
    readonly rawDatabase: any | null;
    readonly util: typeof NUtil;
    readonly event: NEvent;
    autoSave: boolean;
    autoSaveDelay: number;

    init(options?: NSqlOptions): Promise<boolean>;
    close(): boolean;
    saveToIndexedDB(idbInstance?: NIndexedDB): Promise<{ ok: boolean; error?: string }>;
    loadFromIndexedDB(idbInstance?: NIndexedDB): Promise<Uint8Array | null>;
    scheduleAutoSave(delayMs?: number): void;
    cancelAutoSave(): boolean;
    flushAutoSave(): Promise<{ ok: boolean; error?: string } | null>;
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
    export(): Promise<Uint8Array | null>;
    exportBase64(): Promise<string>;
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
    static readonly instance: NIndexedDB;
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
export interface NStorageContext {
    readonly context: string;
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
}

/**
 * Gestionnaire statique de stockage synchrone clé-valeur avec contextes et TTL (`database/NStorage.js`).
 */
export class NStorage {
    static configure(options?: NStorageOptions): typeof NStorage;

    static readonly driver: 'localStorage' | 'sessionStorage' | null;
    static readonly isAvailable: boolean;
    static readonly prefix: string;
    static context: string;
    static readonly length: number;

    static withContext(context: string): NStorageContext;
    static set(key: string, value: any, optionsOrTtl?: number | NStorageOptions): boolean;
    static get<T = any>(key: string, defaultValue?: T, options?: NStorageOptions): T;
    static getString(key: string, defaultValue?: string, options?: NStorageOptions): string;
    static getNumber(key: string, defaultValue?: number, options?: NStorageOptions): number;
    static getBoolean(key: string, defaultValue?: boolean, options?: NStorageOptions): boolean;
    static getJson<T = Record<string, any>>(key: string, defaultValue?: T, options?: NStorageOptions): T;
    static getArray<T = any>(key: string, defaultValue?: T[], options?: NStorageOptions): T[];
    static has(key: string, options?: NStorageOptions): boolean;
    static remove(key: string, options?: NStorageOptions): boolean;
    static clear(options?: NStorageOptions): boolean;
    static keys(options?: NStorageOptions): string[];
    static toObject(options?: NStorageOptions): Record<string, any>;
    static destroy(): void;
}

/* ========================================================================== *
 * 8. DOSSIER filesystem/ (NFile, NDir)                                       *
 * ========================================================================== */

export type NFileSystemDriver = 'native' | 'fs' | 'idb';

export interface NFilePathParts {
    path: string;
    directory: string;
    name: string;
    baseName: string;
    extension: string;
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
export class NFile {
    static readonly driver: NFileSystemDriver;
    static readonly isNativeAvailable: boolean;
    static readonly isFsApiAvailable: boolean;

    static normalizePath(path?: string): string;
    static joinPath(...segments: string[]): string;
    static splitPath(path: string): NFilePathParts;
    static getDirName(path: string): string;
    static getFileName(path: string): string;
    static getBaseName(path: string): string;
    static getExtension(path: string, includeDot?: boolean): string;
    static getMimeType(pathOrExt: string, fallback?: string): string;

    static toUint8Array(data: string | ArrayBuffer | ArrayBufferView | Blob | number[]): Promise<Uint8Array>;
    static toText(data: string | ArrayBuffer | ArrayBufferView | Blob, encoding?: string): Promise<string>;
    static toBase64(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<string>;
    static fromBase64(base64OrDataUrl: string): Uint8Array;
    static toDataUrl(data: string | ArrayBuffer | ArrayBufferView | Blob, mimeType?: string): Promise<string>;
    static toBlob(data: string | ArrayBuffer | ArrayBufferView | Blob, mimeType?: string): Promise<Blob | null>;

    static exists(path: string, options?: NFileOperationOptions): Promise<boolean>;
    static stat(path: string, options?: NFileOperationOptions): Promise<NFileStat | null>;
    static info(path: string, options?: NFileOperationOptions): Promise<NFileStat | null>;

    static write(path: string, data: any, options?: NFileOperationOptions): Promise<boolean>;
    static writeText(path: string, text?: string, options?: NFileOperationOptions): Promise<boolean>;
    static writeJson(path: string, value: any, options?: NFileOperationOptions): Promise<boolean>;
    static writeBytes(path: string, bytes: Uint8Array | ArrayBuffer | number[], options?: NFileOperationOptions): Promise<boolean>;
    static writeBase64(path: string, base64OrDataUrl: string, options?: NFileOperationOptions): Promise<boolean>;
    static append(path: string, data: any, options?: NFileOperationOptions): Promise<boolean>;

    static read(path: string, options?: NFileOperationOptions): Promise<Uint8Array | null>;
    static readBytes(path: string, options?: NFileOperationOptions): Promise<Uint8Array | null>;
    static readText(path: string, options?: NFileOperationOptions): Promise<string | null>;
    static readJson<T = any>(path: string, options?: NFileOperationOptions): Promise<T | null>;
    static readBase64(path: string, options?: NFileOperationOptions): Promise<string | null>;
    static readDataUrl(path: string, options?: NFileOperationOptions): Promise<string | null>;
    static readBlob(path: string, options?: NFileOperationOptions): Promise<Blob | null>;

    static delete(path: string, options?: NFileOperationOptions): Promise<boolean>;
    static remove(path: string, options?: NFileOperationOptions): Promise<boolean>;
    static copy(sourcePath: string, destinationPath: string, options?: NFileOperationOptions): Promise<boolean>;
    static move(sourcePath: string, destinationPath: string, options?: NFileOperationOptions): Promise<boolean>;
    static rename(path: string, newFileName: string, options?: NFileOperationOptions): Promise<boolean>;
    static checksum(path: string, options?: NFileOperationOptions): Promise<string | null>;
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
 * Gestionnaire de répertoires multiplateforme (`filesystem/NDir.js`).
 */
export class NDir {
    static readonly driver: NFileSystemDriver;
    static readonly isNativeAvailable: boolean;
    static readonly isFsApiAvailable: boolean;

    static normalizePath(path?: string): string;
    static joinPath(...segments: string[]): string;
    static getName(path: string): string;
    static getParent(path: string): string;

    static exists(path?: string, options?: Record<string, any>): Promise<boolean>;
    static create(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    static mkdir(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    static ensure(path: string, options?: { recursive?: boolean }): Promise<boolean>;

    static stat(path?: string, options?: Record<string, any>): Promise<Record<string, any> | null>;
    static info(path?: string, options?: Record<string, any>): Promise<Record<string, any> | null>;

    static list(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    static listFiles(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    static listDirectories(path?: string, options?: { recursive?: boolean }): Promise<NDirectoryEntry[]>;
    static tree(path?: string, options?: Record<string, any>): Promise<NDirectoryTreeItem>;
    static find(path?: string, criteria?: NDirectoryFindCriteria): Promise<NDirectoryEntry[]>;
    static size(path?: string, options?: { recursive?: boolean }): Promise<number>;

    static clear(path: string, options?: Record<string, any>): Promise<boolean>;
    static delete(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    static rmdir(path: string, options?: { recursive?: boolean }): Promise<boolean>;
    static copy(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<boolean>;
    static move(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<boolean>;
    static rename(path: string, newDirectoryName: string, options?: Record<string, any>): Promise<boolean>;
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
    format?: 'bytes' | 'text' | 'base64' | 'dataUrl' | 'blob';
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
export class NCache {
    static readonly driver: NCacheDriver;
    static readonly isNativeAvailable: boolean;
    static readonly isCacheStorageAvailable: boolean;
    static readonly isIdbAvailable: boolean;
    static readonly isStoreAvailable: boolean;
    static readonly stats: NCacheStats;

    static set(key: string, value: any, options?: NCacheItemOptions): Promise<boolean>;
    static get<T = any>(key: string, options?: NCacheItemOptions): Promise<T>;
    static has(key: string, options?: NCacheItemOptions): Promise<boolean>;
    static remember<T = any>(key: string, ttlOrOptions: number | NCacheItemOptions, factoryFn: () => Promise<T> | T): Promise<T>;
    static getOrSet<T = any>(key: string, ttlOrOptions: number | NCacheItemOptions, factoryFn: () => Promise<T> | T): Promise<T>;
    static delete(key: string, options?: NCacheItemOptions): Promise<boolean>;
    static remove(key: string, options?: NCacheItemOptions): Promise<boolean>;
    static clearByTag(tag: string, options?: NCacheItemOptions): Promise<number>;
    static prune(options?: NCacheItemOptions): Promise<number>;
    static keys(options?: NCacheItemOptions): Promise<string[]>;
    static clear(options?: NCacheItemOptions): Promise<boolean>;

    static putResponse(url: string, responseOrData: Response | any, options?: NCacheItemOptions): Promise<boolean>;
    static matchUrl<T = any>(url: string, options?: NCacheItemOptions): Promise<T | Response | null>;
    static cacheUrl<T = any>(url: string, options?: NCacheItemOptions): Promise<T | Response | null>;
    static deleteUrl(url: string, options?: NCacheItemOptions): Promise<boolean>;

    static cacheFile(keyOrPath: string, data: any, options?: NCacheItemOptions): Promise<boolean>;
    static getFile<T = Uint8Array | string | Blob | null>(keyOrPath: string, options?: NCacheItemOptions): Promise<T>;
}

/* ========================================================================== *
 * 10. DOSSIER requests/ (NNet, NTableRequest, NRequestManager)              *
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
 * Client réseau HTTP/HTTPS avec chiffrement asymétrique et hybride RSA-OAEP + AES (`requests/NNet.js`).
 */
export class NNet {
    static readonly CHUNK_SIZE: number;

    static driver: 'auto' | 'fetch' | 'xhr' | 'native';
    static baseUrl: string;

    static request<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static get<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static post<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static put<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static patch<T = any>(url: string, body?: any, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static delete<T = any>(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<T>>;
    static head(url: string, options?: NNetworkRequestOptions): Promise<NNetworkResponse<any>>;

    static requestAuthentication(url?: string | null, options?: { force?: boolean; hash?: 'SHA-1' | 'SHA-256' }): Promise<any>;
    static generateClientKeyPair(options?: { modulusLength?: 2048 | 3072 | 4096; hash?: 'SHA-1' | 'SHA-256' }): Promise<CryptoKeyPair | null>;
    static setClientKeyPair(publicKey: string | CryptoKey, privateKey: CryptoKey): Promise<boolean>;
    static setServerPublicKey(publicKey: string | CryptoKey): Promise<boolean>;
    static encryptPayload(data: any, options?: { serverPublicKey?: CryptoKey | string }): Promise<{ type?: 'asymmetric' | 'hybrid'; data?: string; key?: string; iv?: string }>;
    static decryptPayload(encryptedPayload: Record<string, any> | string, options?: { clientPrivateKey?: CryptoKey }): Promise<string>;
    static hasServerPublicKey(): boolean;
    static getServerPublicKey(): CryptoKey | null;
    static getClientKeyPair(): Promise<CryptoKeyPair | null>;
    static clearCryptoSession(): Promise<void>;

    static getFileInfo(url: string, options?: NNetworkRequestOptions): Promise<any>;
    static getFilesInfo(urls: string[], options?: NNetworkRequestOptions): Promise<any[]>;
    static downloadFile(url: string, options?: NNetworkRequestOptions): Promise<any>;
    static downloadFiles(urls: string[], options?: NNetworkRequestOptions): Promise<any[]>;
    static uploadFile(url: string, file: any, options?: NNetworkRequestOptions): Promise<any>;
    static uploadFiles(url: string, files: any[], options?: NNetworkRequestOptions): Promise<any[]>;
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
    db?: NSql | null;
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

export interface NDataSyncConflict {
    conflictId?: string;
    collection?: string;
    recordId?: any;
    clientRecord?: Record<string, any> | null;
    serverRecord?: Record<string, any> | null;
    clientVersion?: any;
    serverVersion?: any;
    [key: string]: any;
}

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
    network?: typeof NNet;
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
 * 11. DOSSIER worker/ (NWorker, NWorkMgr, NServiceWorker)       
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
 * Gestionnaire centralisé de Web Workers et de pools Round-Robin (`worker/NWorkMgr.js`).
 */
export class NWorkMgr {
    static readonly isWorkerContext: boolean;
    static readonly isSupported: boolean;
    static readonly size: number;
    static readonly names: string[];

    static registerAction(action: string, handler: NWorkerActionHandler): typeof NWorkMgr;
    static unregisterAction(action: string): typeof NWorkMgr;
    static hasAction(action: string): boolean;
    static executeAction<T = any>(action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null): Promise<T | null>;

    static create(name: string, options?: NWorkerOptions): NWorker;
    static add(name: string, worker: NWorker): NWorker | null;
    static createPool(name: string, options?: NWorkerOptions, size?: number): NWorker[];
    static has(name: string): boolean;
    static get(name: string): NWorker | null;
    static request<T = unknown>(name: string, action: string, params?: any, onUpdate?: NWorkerUpdateCallback | null, timeout?: number | null): Promise<NWorkerResponse<T>>;
    static terminate(name: string): boolean;
    static terminateAll(): void;
    static toJSON(): Record<string, any>;
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

/* ========================================================================== *
 * 12. DOSSIER language/ (NLang)                                              *
 * ========================================================================== */

export interface NLangOptions {
    language?: string;
    fallback?: string | null;
    missingBehavior?: 'key' | 'empty';
    preserveUnknownParams?: boolean;
    logMissing?: boolean;
    logMissingParameters?: boolean;
    protectedLanguages?: string[];
    loader?: ((code: string) => Promise<Record<string, any> | string> | Record<string, any> | string) | null;
    languages?: Record<string, Record<string, any>>;
    persist?: boolean;
    storeName?: string;
}

export interface NLangMissingEntry {
    key: string;
    language: string;
    type: string;
    fallbackUsed: string | null;
    timestamp: number;
}

export interface NLangCheckReport {
    ok: boolean;
    languages: string[];
    totalKeys: number;
    missingByLanguage: Record<string, string[]>;
    missingEverywhere: string[];
    typeMismatches: Array<{ key: string; types: Record<string, string> }>;
    unusedKeys: string[];
}

/**
 * Moteur statique d'internationalisation (i18n) multi-environnements (`language/NLang.js`).
 */
export class NLang {
    static on(event: string, handler: (...args: any[]) => void, options?: Record<string, any>): () => void;
    static once(event: string, handler: (...args: any[]) => void): () => void;
    static off(event: string, handler: (...args: any[]) => void): typeof NLang;
    static emit(event: string, data?: any): boolean;

    static init(options?: NLangOptions): Promise<typeof NLang>;
    static getConfig(): Readonly<Required<Omit<NLangOptions, 'languages'>>>;

    static getLanguage(): string;
    static getFallbackLanguage(): string | null;
    static getLanguages(): string[];
    static hasLanguage(code: string): boolean;
    static addLanguage(code: string, dictionary?: Record<string, any>, options?: { merge?: boolean }): typeof NLang;
    static removeLanguage(code: string): boolean;
    static loadLanguage(code: string, options?: { force?: boolean }): Promise<boolean>;
    static unloadLanguage(code: string): boolean;
    static setLanguage(code: string): Promise<typeof NLang>;

    static get(
        key: string,
        params?: Record<string, any>,
        options?: { language?: string; fallback?: string | null; missingBehavior?: 'key' | 'empty' }
    ): string;
    static plural(
        key: string,
        params?: Record<string, any>,
        options?: { countParam?: string; language?: string; fallback?: string | null; missingBehavior?: 'key' | 'empty' }
    ): string;

    static getMissing(): NLangMissingEntry[];
    static clearMissing(): typeof NLang;
    static checkTranslations(referenceKeys?: string[] | null): NLangCheckReport;
    static destroy(): void;
}
