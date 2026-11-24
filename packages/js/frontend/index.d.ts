/**
 * @file index.d.ts
 * @package @nlib/js-frontend
 * @description Déclarations TypeScript publiques du package `@nlib/js-frontend`.
 */

import { NObject, NObjectOptions } from '../backend/index.js';

export type NThemeName = 'light' | 'dark' | 'auto' | 'system';
export type NStyleName =
    | 'default'
    | 'solid'
    | 'outline'
    | 'flat'
    | 'fluent'
    | 'glass'
    | 'material'
    | 'minimal'
    | 'neumorphism';

export interface NTagOptions extends NObjectOptions {
    tagName?: string;
    id?: string;
    classes?: string | string[];
    className?: string;
    attrs?: Record<string, any>;
    data?: Record<string, any>;
    style?: Record<string, string | number>;
    theme?: NThemeName | null;
    styleName?: NStyleName | string | null;
    text?: string | number;
    html?: string;
    children?: Array<NTag | Node | string>;
    events?: Record<string, (ev: any) => void>;
    longClickDelay?: number;
    language?: string;
    applyLanguage?: (tag: NTag) => void;
}

/**
 * Classe de base universelle pour les balises DOM de `@nlib/js-frontend` (`dom/elements/NTag.js`).
 */
export class NTag extends NObject {
    static readonly THEMES: readonly ['light', 'dark', 'auto', 'system'];
    static readonly STYLES: readonly NStyleName[];

    constructor(options?: NTagOptions | string);

    readonly tagName: string;
    readonly element: Element | null;
    readonly el: Element | null;
    readonly parent: NTag | null;
    readonly children: NTag[];
    id: string;
    text: string;
    html: string;

    getWindow(): NWindow | null;

    setAttr(name: string, value: string | number | boolean | object | null | undefined): this;
    setAttrs(attrs?: Record<string, any>): this;
    getAttr(name: string): string | null;
    hasAttr(name: string): boolean;
    removeAttr(name: string): this;
    setProperty(name: string, value: any): this;
    getProperty(name: string): any;
    setData(key: string, value: string | number | boolean | object | null | undefined): this;
    getData(key: string): string | undefined;

    addClass(...names: string[]): this;
    removeClass(...names: string[]): this;
    toggleClass(name: string, force?: boolean): this;
    hasClass(name: string): boolean;
    setStyle(propOrObj: string | Record<string, string | number | null | undefined>, value?: string | number | null): this;
    getStyle(prop: string): string;
    removeStyle(...props: string[]): this;

    setText(text: string | number | null | undefined, destroyChildren?: boolean | { destroy?: boolean }): this;
    setHtml(html: string | null | undefined, destroyChildren?: boolean | { destroy?: boolean }): this;
    setLanguage(language: string | null): this;
    applyLanguage(): this;
    setTheme(theme: NThemeName | null): this;
    getTheme(): 'light' | 'dark' | null;
    setStyleName(styleName: NStyleName | string | null): this;
    getStyleName(): string | null;
    show(display?: string): this;
    hide(): this;
    isShow(): boolean;
    isVisible(): boolean;
    isVisibleInScreen(): boolean;
    isConnected(): boolean;
    focus(): this;
    blur(): this;
    scrollIntoView(options?: boolean | ScrollIntoViewOptions): this;
    requestAnimationFrame(callback: (timestamp: number, tag: this) => void): any;

    getIndex(): number;
    setIndex(index: number): this;
    getChildCount(): number;
    getChildAt(index: number): NTag | null;
    find(selector: string): NTag | null;
    findAll(selector: string): NTag[];
    addTag(tags: NTag | Node | string | Array<NTag | Node | string>, position?: number | NTag | Node | null): this;
    append(...nodes: Array<NTag | Node | string>): this;
    prepend(...nodes: Array<NTag | Node | string>): this;
    removeChild(child: NTag | Node): this;
    empty(destroyChildren?: boolean | { destroy?: boolean }): this;
    mount(target: NTag | Element | string): this;
    unmount(): this;

    getRect(): { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number };
    getBounds(): { x: number; y: number; width: number; height: number };
    getX(): number;
    getY(): number;
    getWidth(): number;
    getHeight(): number;

    on(event: string, callback: (data: any) => any): this;
    off(event: string, callback?: (data: any) => any): this;
    clearEvents(): this;
    destroy(): void;

    static setGlobalTheme(theme: NThemeName | null): typeof NTag;
    static getGlobalTheme(): 'light' | 'dark' | null;
    static setGlobalStyle(styleName: NStyleName | string | null): typeof NTag;
    static getGlobalStyle(): string | null;
}

export interface NImageOptions extends NTagOptions {
    src?: string;
    alt?: string;
    fallbackSrc?: string | null;
    loading?: 'lazy' | 'eager';
    decoding?: 'async' | 'sync' | 'auto';
    crossOrigin?: string | null;
    width?: number | string;
    height?: number | string;
}

/**
 * Composant image (`<img>`) héritant de `NTag` (`dom/elements/NImage.js`).
 */
export class NImage extends NTag {
    constructor(options?: NImageOptions | string);

    src: string;
    alt: string;
    text: string;

    setText(text: string | number | null | undefined): this;
    setSrc(src: string | null | undefined): this;
    setAlt(alt: string | null | undefined): this;
    setFallbackSrc(src: string | null | undefined): this;
    setLoading(mode: 'lazy' | 'eager'): this;
    setDecoding(mode: 'async' | 'sync' | 'auto'): this;
    setCrossOrigin(value: 'anonymous' | 'use-credentials' | string | null | undefined): this;
    isLoaded(): boolean;
    getNaturalSize(): { width: number; height: number };
    decode(): Promise<this>;
    destroy(): void;
}

export interface NMediaSource {
    src: string;
    type?: string;
}

export interface NMediaOptions extends NTagOptions {
    tagName?: 'audio' | 'video';
    src?: string;
    controls?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    preload?: 'none' | 'metadata' | 'auto';
    volume?: number;
    playbackRate?: number;
    crossOrigin?: string | null;
    sources?: Array<NMediaSource | string>;
}

/**
 * Classe de base média (`HTMLMediaElement`) héritant de `NTag` (`dom/elements/NMedia.js`).
 */
export class NMedia extends NTag {
    constructor(options?: NMediaOptions | string);

    src: string;
    currentTime: number;
    readonly duration: number;
    volume: number;
    playbackRate: number;

    setSrc(src: string | null | undefined): this;
    addSource(src: string, type?: string): this;
    setControls(enabled?: boolean): this;
    setAutoplay(enabled?: boolean): this;
    setLoop(enabled?: boolean): this;
    setMuted(enabled?: boolean): this;
    setPreload(mode: 'none' | 'metadata' | 'auto'): this;
    setCrossOrigin(value: 'anonymous' | 'use-credentials' | string | null | undefined): this;
    setVolume(value: number): this;
    setPlaybackRate(rate: number): this;
    seek(seconds: number): this;
    play(): Promise<void>;
    pause(): this;
    stop(): this;
    togglePlay(): Promise<void> | this;
    load(): this;
    isReady(minReadyState?: number): boolean;
    isPaused(): boolean;
    isEnded(): boolean;
    isMuted(): boolean;
    destroy(): void;
}

export type NVideoSource = NMediaSource;

export interface NVideoOptions extends NMediaOptions {
    poster?: string;
    playsInline?: boolean;
    width?: number | string;
    height?: number | string;
}

/**
 * Composant vidéo (`<video>`) héritant de `NMedia` (`dom/elements/NVideo.js`).
 */
export class NVideo extends NMedia {
    constructor(options?: NVideoOptions | string);

    poster: string;

    setPoster(poster: string | null | undefined): this;
    setPlaysInline(enabled?: boolean): this;
    getVideoSize(): { width: number; height: number };
}

export type NAudioSource = NMediaSource;
export type NAudioOptions = NMediaOptions;

/**
 * Composant audio (`<audio>`) héritant de `NMedia` (`dom/elements/NAudio.js`).
 */
export class NAudio extends NMedia {
    constructor(options?: NAudioOptions | string);
}

export type NButtonType = 'button' | 'submit' | 'reset';
export type NButtonPosition = 'left' | 'right' | 'top' | 'bottom';

export type NButtonIconConfig =
    | string
    | ({ type?: 'image' | 'emoji'; value: string } & Partial<NImageOptions>)
    | NImageOptions;

export interface NButtonOptions extends NTagOptions {
    text?: string;
    icon?: NButtonIconConfig | null;
    iconPosition?: NButtonPosition;
    disabled?: boolean;
    loading?: boolean;
    type?: NButtonType;
}

/**
 * Composant bouton (`<button>`) héritant de `NTag` (`dom/elements/NButton.js`).
 */
export class NButton extends NTag {
    constructor(options?: NButtonOptions | string);

    setText(text: string | number | null | undefined): this;
    getText(): string;
    setIcon(icon: NButtonIconConfig | null | undefined): this;
    setIconPosition(position: NButtonPosition): this;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setLoading(loading?: boolean): this;
    isLoading(): boolean;
    setType(type: NButtonType): this;
    destroy(): void;
}

export interface NCheckBoxOptions extends NTagOptions {
    name?: string;
    value?: string | number;
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    required?: boolean;
    autofocus?: boolean;
}

export class NCheckBox extends NTag {
    constructor(options?: NCheckBoxOptions);
    name: string;
    value: string;
    checked: boolean;
    indeterminate: boolean;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    setChecked(checked?: boolean): this;
    isChecked(): boolean;
    toggleChecked(): this;
    setIndeterminate(indeterminate?: boolean): this;
    isIndeterminate(): boolean;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NRadioBoxOptions extends NTagOptions {
    name?: string;
    value?: string | number;
    checked?: boolean;
    disabled?: boolean;
    required?: boolean;
    autofocus?: boolean;
}

export class NRadioBox extends NTag {
    constructor(options?: NRadioBoxOptions);
    name: string;
    value: string;
    checked: boolean;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    setChecked(checked?: boolean): this;
    isChecked(): boolean;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NTextareaOptions extends NTagOptions {
    name?: string;
    value?: string;
    placeholder?: string;
    rows?: number;
    cols?: number;
    wrap?: 'soft' | 'hard' | 'off';
    minLength?: number;
    maxLength?: number;
    autocomplete?: string;
    autofocus?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
}

export class NTextarea extends NTag {
    constructor(options?: NTextareaOptions);
    name: string;
    value: string;
    placeholder: string;
    rows: number;
    cols: number;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    setPlaceholder(placeholder: string | null | undefined): this;
    setRows(rows: number | null | undefined): this;
    setCols(cols: number | null | undefined): this;
    setWrap(wrap: 'soft' | 'hard' | 'off' | null | undefined): this;
    setMinLength(length: number | null | undefined): this;
    setMaxLength(length: number | null | undefined): this;
    setAutocomplete(value: string | null | undefined): this;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setReadOnly(readonly?: boolean): this;
    isReadOnly(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    select(): this;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NEditTextOptions extends NTagOptions {
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
    name?: string;
    value?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    autocomplete?: string;
    autofocus?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
}

export class NEditText extends NTag {
    constructor(options?: NEditTextOptions);
    type: string;
    name: string;
    value: string;
    placeholder: string;
    setType(type: string): this;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    setPlaceholder(placeholder: string | null | undefined): this;
    setMinLength(length: number | null | undefined): this;
    setMaxLength(length: number | null | undefined): this;
    setPattern(pattern: string | null | undefined): this;
    setAutocomplete(value: string | null | undefined): this;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setReadOnly(readonly?: boolean): this;
    isReadOnly(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    select(): this;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NEditNumberOptions extends NTagOptions {
    type?: 'number' | 'range';
    name?: string;
    value?: number | string;
    placeholder?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    autocomplete?: string;
    autofocus?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
}

export class NEditNumber extends NTag {
    constructor(options?: NEditNumberOptions);
    type: string;
    name: string;
    value: string;
    placeholder: string;
    setType(type: string): this;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    getValueAsNumber(): number | null;
    setPlaceholder(placeholder: string | null | undefined): this;
    setMin(min: number | string | null | undefined): this;
    setMax(max: number | string | null | undefined): this;
    setStep(step: number | string | null | undefined): this;
    setAutocomplete(value: string | null | undefined): this;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setReadOnly(readonly?: boolean): this;
    isReadOnly(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    select(): this;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NEditTagOptions extends NTagOptions {
    editable?: boolean | 'true' | 'false' | 'plaintext-only';
    value?: string;
    placeholder?: string;
    spellcheck?: boolean;
    autofocus?: boolean;
}

export class NEditTag extends NTag {
    constructor(options?: NEditTagOptions | string);
    editable: string;
    value: string;
    placeholder: string;
    setEditable(mode?: boolean | 'true' | 'false' | 'plaintext-only'): this;
    isEditable(): boolean;
    setValue(value: any): this;
    getValue(): string;
    setPlaceholder(placeholder: string | null | undefined): this;
    setSpellcheck(enabled?: boolean): this;
    selectAll(): this;
    clear(): this;
}

export interface NFilePickerOptions extends NTagOptions {
    name?: string;
    accept?: string;
    multiple?: boolean;
    disabled?: boolean;
    required?: boolean;
    autofocus?: boolean;
}

export class NFilePicker extends NTag {
    constructor(options?: NFilePickerOptions);
    name: string;
    setName(name: string | null | undefined): this;
    setAccept(accept: string | null | undefined): this;
    setMultiple(multiple?: boolean): this;
    getFiles(): File[];
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NSelectOptionItem {
    value: string;
    label?: string;
    disabled?: boolean;
    selected?: boolean;
}

export interface NSelectOptions extends NTagOptions {
    name?: string;
    options?: Array<string | NSelectOptionItem>;
    value?: string | string[];
    multiple?: boolean;
    size?: number;
    disabled?: boolean;
    required?: boolean;
    autofocus?: boolean;
}

export class NSelect extends NTag {
    constructor(options?: NSelectOptions);
    name: string;
    value: string;
    setName(name: string | null | undefined): this;
    setValue(value: any): this;
    getValue(): string;
    setMultiple(multiple?: boolean): this;
    setSize(size: number | null | undefined): this;
    addOption(value: string, label?: string, opts?: { disabled?: boolean; selected?: boolean }): this;
    removeOption(value: string): this;
    clearOptions(): this;
    getSelectedOptions(): HTMLOptionElement[];
    getSelectedValues(): string[];
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NItemOptions extends NTagOptions {
    itemId?: string | number | null;
    primaryKey?: string;
    data?: Record<string, any> | null;
    autoUpdate?: boolean;
    loading?: boolean;
    selected?: boolean;
    disabled?: boolean;
    syncParams?: Record<string, any> | string | null;
}

export class NItem extends NTag {
    constructor(options?: NItemOptions | string);
    itemId: string | number | null;
    primaryKey: string;
    setItemId(id: string | number | null): this;
    getItemId(): string | number | null;
    setPrimaryKey(key: string): this;
    getPrimaryKey(): string;
    setAutoUpdate(autoUpdate?: boolean): this;
    isAutoUpdate(): boolean;
    setData(dataOrKey: Record<string, any> | string | null, value?: any): this;
    getData(key?: string): any;
    updateData(partial: Record<string, any>): this;
    requestData(params?: Record<string, any> | any[] | null): Promise<Record<string, any> | null>;
    matchesData(data: Record<string, any>): boolean;
    displayData(data?: Record<string, any> | null): this;
    applyLanguage(): this;
    setLoading(loading?: boolean): this;
    isLoading(): boolean;
    setSelected(selected?: boolean): this;
    isSelected(): boolean;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setSyncParams(params: Record<string, any> | string | null): this;
    getSyncParams(): Record<string, any> | string | null;
    getLastEventId(): string | number | null;
    notifyChange(eventId: string | number, payload?: any): this;
    destroy(): void;
}

export interface NFrameOptions extends NTagOptions {
    title?: string;
    url?: string;
    backUrl?: string;
    overlay?: boolean;
    pullToRefresh?: boolean;
}

export interface NFrameGuardResult {
    status: 'allow' | 'deny' | 'redirect';
    url?: string;
    params?: Record<string, any>;
    reason?: string;
}

export interface NFrameScrollParams {
    isBack?: boolean;
    isNew?: boolean;
    scrollTo?: { x?: number; y?: number };
    scrollToTag?: NTag;
}

/**
 * Classe de base des vues et pages applicatives (`dom/components/frames/NFrame.js`).
 */
export class NFrame extends NTag {
    static overlay: boolean;

    constructor(options?: NFrameOptions | string);

    protected _init(): void;
    setTitle(title: string): this;
    getTitle(): string;
    setUrl(url: string): this;
    getUrl(): string;
    matchesUrl(url: string): boolean;
    setBackUrl(url: string): this;
    getBackUrl(): string;
    canGoBack(): boolean;
    setOverlay(overlay?: boolean): this;
    isOverlay(): boolean;
    setPullToRefresh(enabled?: boolean): this;
    isPullToRefresh(): boolean;
    onPullToRefresh(): this;
    initAlert(parentTag?: NTag): this;
    showAlert(message: string, icon?: string | null): this;
    hideAlert(): this;
    verifyAlert(data: any, emptyMessage?: string): boolean;
    saveScrollPosition(scrollX?: number, scrollY?: number): this;
    restoreScrollPosition(params?: NFrameScrollParams): this;
    scrollTo(scrollX?: number, scrollY?: number): this;
    onActivate(params?: Record<string, any>): this;
    onDeactivate(params?: Record<string, any>): this;
    onResume(): this;
    onPause(): this;
    onFocus(): this;
    onBlur(): this;
    destroy(): void;

    static canActivate(params?: Record<string, any>): NFrameGuardResult | boolean;
    static create<T extends NFrame = NFrame>(params?: NFrameOptions): T | null;
}

export interface NToastOptions extends NTagOptions {
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    position?: 'bottom' | 'top';
}

export declare class NToast extends NTag {
    constructor(options?: NTagOptions);

    static show(message: string, options?: NToastOptions): NToast;
    static hide(): void;

    showMessage(message: string, options?: NToastOptions): this;
    hideMessage(): this;
    destroy(): void;
}

export interface NProgressOptions extends NTagOptions {
    fixed?: boolean;
}

export declare class NProgress extends NTag {
    constructor(options?: NProgressOptions);

    static show(message?: string, value?: number | null, options?: NProgressOptions): NProgress;
    static set(value: number | null, message?: string): void;
    static hide(): void;

    showProgress(message?: string, value?: number | null): this;
    setProgress(value: number | null, message?: string): this;
    hideProgress(): this;
    destroy(): void;
}

export interface NWindowRegisterOptions {
    overlay?: boolean;
    includes?: boolean;
}

export type NWindowRoutePattern = string;
export type NWindowRoutes = NWindowRoutePattern | Array<NWindowRoutePattern>;
export type NWindowFrameEntry =
    | [NWindowRoutes, typeof NFrame, (boolean | NWindowRegisterOptions)?]
    | { routes?: NWindowRoutes; route?: NWindowRoutes; url?: NWindowRoutes; FrameClass?: typeof NFrame; frame?: typeof NFrame; overlay?: boolean; includes?: boolean };

export interface NWindowOptions extends NTagOptions {
    config?: Record<string, any>;
    withWorker?: boolean;
    withService?: boolean;
    frames?: Array<NWindowFrameEntry> | Record<string, typeof NFrame | [typeof NFrame, (boolean | NWindowRegisterOptions)?] | { FrameClass?: typeof NFrame; frame?: typeof NFrame; routes?: NWindowRoutes; route?: NWindowRoutes; overlay?: boolean; includes?: boolean }>;
}

export interface NWindowNavigateParams extends Record<string, any> {
    link?: string;
    path?: string;
    query?: Record<string, string>;
    frameClass?: typeof NFrame;
    forceNew?: boolean;
    isBack?: boolean;
    target?: string;
}

export declare class NWindow extends NTag {
    constructor(options?: NWindowOptions);

    static instance(): NWindow | null;

    protected _init(): void;
    initLanguage(options?: Record<string, any> | null, workerIsInit?: boolean): this;
    initWorker(options?: Record<string, any> | null): Promise<boolean>;
    initDatabase(options?: Record<string, any> | null, workerIsInit?: boolean): Promise<boolean>;
    initService(options?: Record<string, any> | null): Promise<boolean>;
    getService(): any | null;
    initServiceWorker(options?: Record<string, any> | null): Promise<boolean>;
    getServiceWorker(): any | null;

    getBaseUrl(): string;
    getFrames(): NFrame[];
    getCurrentFrame(): NFrame | null;
    setInitialUrl(url: string): this;
    getInitialUrl(): string;
    openInitialLink(defaultLink?: string | null): NFrame | null;
    getHomeUrl(): string | null;
    getWelcomeUrl(): string | null;
    getFrame(link: string): NFrame | null;

    registerFrame(routes: NWindowRoutes, FrameClass: typeof NFrame, options?: boolean | NWindowRegisterOptions): this;
    unregisterFrame(frameClassOrRoute: typeof NFrame | NWindowRoutePattern): boolean;
    getFrameClasses(): Array<typeof NFrame>;
    resolveFrame(urlOrParams: string | Record<string, any>): { FrameClass: typeof NFrame; params: Record<string, any>; overlay: boolean } | null;

    linkToParams(linkOrParams: string | Record<string, any>): Record<string, any>;
    navigate(linkOrParams: string | NWindowNavigateParams): NFrame | null;
    bringToFront(frame: NFrame, params?: NWindowNavigateParams): this;
    back(defaultLink?: string | null): boolean;
    removeFrame(frame: NFrame, destroyFrame?: boolean): boolean;
    getHistory(): string[];
    clearHistory(): this;
    scrollTo(scrollX?: number | ScrollToOptions, scrollY?: number): this;

    onResume(): this;
    onPause(): this;
    onFocus(): this;
    onBlur(): this;

    on(event: string, callback: (data: any) => any): this;
    off(event?: string, callback?: (data: any) => any): this;
    destroy(): void;
}
