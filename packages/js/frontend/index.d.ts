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

export interface NInputOptions extends NTagOptions {
    type?: string;
    name?: string;
    value?: string | number;
    placeholder?: string;
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    autocomplete?: string;
    autofocus?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    minLength?: number;
    maxLength?: number;
    pattern?: string | RegExp;
    accept?: string | string[];
    multiple?: boolean;
}

/**
 * Composant champ de saisie universel (`<input>`) héritant de `NTag` (`dom/elements/NInput.js`).
 */
export class NInput extends NTag {
    constructor(options?: NInputOptions | string);

    type: string;
    name: string;
    value: string;
    checked: boolean;
    placeholder: string;
    text: string;

    setType(type: string): this;
    setText(text: string | number | null | undefined): this;
    setName(name: string | null | undefined): this;
    setValue(value: string | number | null | undefined): this;
    getValue(): string;
    getValueAsNumber(): number | null;
    setPlaceholder(placeholder: string | null | undefined): this;
    setChecked(checked?: boolean): this;
    isChecked(): boolean;
    toggleChecked(): this;
    setIndeterminate(indeterminate?: boolean): this;
    isIndeterminate(): boolean;
    setDisabled(disabled?: boolean): this;
    isDisabled(): boolean;
    setReadOnly(readonly?: boolean): this;
    isReadOnly(): boolean;
    setRequired(required?: boolean): this;
    isRequired(): boolean;
    setAutocomplete(value: string | null | undefined): this;
    setMin(min: string | number | null | undefined): this;
    setMax(max: string | number | null | undefined): this;
    setStep(step: string | number | null | undefined): this;
    setMinLength(length: number | null | undefined): this;
    setMaxLength(length: number | null | undefined): this;
    setPattern(pattern: string | RegExp | null | undefined): this;
    setAccept(accept: string | string[] | null | undefined): this;
    setMultiple(multiple?: boolean): this;
    getFiles(): File[];
    select(): this;
    isValid(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message?: string): this;
    getValidationMessage(): string;
    clear(): this;
}

export interface NFrameOptions extends NTagOptions {
    title?: string;
    link?: string;
    backLink?: string;
    floating?: boolean;
    pullToRefresh?: boolean;
}

export interface NFrameScrollParams {
    isBack?: boolean;
    isNew?: boolean;
    scrollTo?: { x?: number; y?: number };
    scrollToTag?: NTag;
}

export interface NFrameDescriptor<T extends NFrame = NFrame> {
    window: any;
    isNew: boolean;
    frame: T;
}

/**
 * Classe de base des vues et pages applicatives (`dom/components/frames/NFrame.js`).
 */
export class NFrame extends NTag {
    constructor(options?: NFrameOptions | string);

    init(): void;
    setTitle(title: string): this;
    getTitle(): string;
    setLink(link: string): this;
    getLink(): string;
    isLink(link: string): boolean;
    setBackLink(link: string): this;
    getBackLink(): string;
    canGoBack(): boolean;
    setFloating(floating?: boolean): this;
    isFloating(): boolean;
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

    static validateLink(windowInstance: any, params?: Record<string, any>): boolean;
    static isFloating(windowInstance: any, params?: Record<string, any>): boolean;
    static createFrame<T extends NFrame = NFrame>(windowInstance: any, params?: NFrameOptions): NFrameDescriptor<T>;
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

export interface NWindowOptions extends NTagOptions {
    config?: Record<string, any>;
    frames?: Record<string, typeof NFrame>;
}

export interface NWindowNavigateParams extends Record<string, any> {
    link?: string;
    path?: string;
    query?: Record<string, string>;
    frameName?: string;
    frameClass?: typeof NFrame;
    forceNew?: boolean;
    isBack?: boolean;
    target?: string;
}

export declare class NWindow extends NTag {
    constructor(options?: NWindowOptions);

    static instance(): NWindow | null;

    init(): void;

    getBaseUrl(): string;
    getFrames(): NFrame[];
    getCurrentFrame(): NFrame | null;
    getInitialLink(): string;
    openInitialLink(defaultLink?: string | null): NFrame | null;
    getHomeLink(): string | null;
    getWelcomeLink(): string | null;
    getFrame(link: string): NFrame | null;

    registerFrame(name: string, FrameClass: typeof NFrame): this;
    unregisterFrame(name: string): boolean;
    getFrameClass(name: string): typeof NFrame | null;

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
