/**
 * @file index.d.ts
 * @package @nlib/js-frontend
 * @description Déclarations TypeScript publiques du package `@nlib/js-frontend`.
 */

import { NObject, NObjectOptions } from '../backend/index.js';

export interface NTagOptions extends NObjectOptions {
    tagName?: string;
    element?: Element | null;
    id?: string;
    classes?: string | string[];
    className?: string;
    attrs?: Record<string, any>;
    data?: Record<string, any>;
    style?: Record<string, string | number>;
    text?: string | number;
    html?: string;
    children?: Array<NTag | Node | string>;
    events?: Record<string, (ev: any) => void>;
    longClickDelay?: number;
}

/**
 * Classe de base universelle pour les balises DOM de `@nlib/js-frontend` (`dom/NTag.js`).
 */
export class NTag extends NObject {
    constructor(options?: NTagOptions | string);

    readonly tagName: string;
    readonly element: Element | null;
    readonly el: Element | null;
    readonly parent: NTag | null;
    readonly children: NTag[];
    id: string;
    text: string;
    html: string;

    setAttr(name: string, value: string | number | boolean | null | undefined): this;
    setAttrs(attrs?: Record<string, any>): this;
    getAttr(name: string): string | null;
    hasAttr(name: string): boolean;
    removeAttr(name: string): this;
    setData(key: string, value: string | number | boolean | null | undefined): this;
    getData(key: string): string | undefined;

    addClass(...names: string[]): this;
    removeClass(...names: string[]): this;
    toggleClass(name: string, force?: boolean): this;
    hasClass(name: string): boolean;
    setStyle(propOrObj: string | Record<string, string | number>, value?: string | number): this;
    getStyle(prop: string): string;

    setText(text: string | number | null | undefined): this;
    setHtml(html: string | null | undefined): this;
    show(display?: string): this;
    hide(): this;
    isShow(): boolean;
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
    empty(): this;
    mount(target: NTag | Element | string): this;
    unmount(): this;

    getRect(): { x: number; y: number; width: number; height: number; top: number; right: number; bottom: number; left: number };
    getBounds(): { x: number; y: number; width: number; height: number };
    getX(): number;
    getY(): number;
    getWidth(): number;
    getHeight(): number;

    on(event: string, callback: (data: any) => any): this;
    once(event: string, callback: (data: any) => any): this;
    off(event?: string, callback?: (data: any) => any): this;
    waitFor<T = any>(event: string, timeoutMs?: number): Promise<T | null>;
    clearEvents(): this;
    destroy(): void;
}
