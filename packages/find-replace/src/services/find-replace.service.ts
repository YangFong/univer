/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Nullable } from '@univerjs/core';
import { Disposable, DisposableCollection, IContextService, IUniverInstanceService, toDisposable } from '@univerjs/core';
import { RENDER_RAW_FORMULA_KEY } from '@univerjs/engine-render';
import type { IDisposable } from '@wendellhu/redi';
import { createIdentifier, Inject, Injector } from '@wendellhu/redi';
import type { Observable } from 'rxjs';
import { BehaviorSubject, combineLatest, Subject, throttleTime } from 'rxjs';
import { FIND_REPLACE_REPLACE_REVEALED } from './context-keys';

export type FindProgressFn = () => void;

export interface IFindComplete<T extends IFindMatch = IFindMatch> {
    results: T[];
}

export interface IFindMatch<T = unknown> {
    provider: string;
    unitId: string;
    range: T;

    /** Indicates if the match could be replaced. */
    replaceable?: boolean;
}

export interface IFindMoveParams {
    /** Go to next (previous) matching in a loop. */
    loop?: boolean;

    /** If the the selection is on the match and then should stay on the match. */
    stayIfOnMatch?: boolean;
}

export interface IReplaceAllResult {
    success: number;
    failure: number;
}

export abstract class FindModel extends Disposable {
    abstract readonly unitId: string;

    /**
     * Find model should emit new matches from this observable if they changed no matter due to incremental
     * or document's content changes.
     */
    abstract readonly matchesUpdate$: Observable<IFindMatch[]>;
    abstract readonly activelyChangingMatch$: Observable<IFindMatch>;

    abstract getMatches(): IFindMatch[];

    abstract moveToNextMatch(params?: IFindMoveParams): IFindMatch | null;
    abstract moveToPreviousMatch(params?: IFindMoveParams): IFindMatch | null;

    /** Replace the currently focused matching if there is one. */
    abstract replace(): Promise<boolean>;

    /**
     * Replace all matches. This method would return how many
     */
    abstract replaceAll(): Promise<IReplaceAllResult>;
}

/**
 * A provider should be implemented by a business to provide the find results.
 */
export interface IFindReplaceProvider {
    find(query: IFindQuery): Promise<FindModel[]>;
    terminate(): void;
}

type IReplaceableMatch = IFindMatch & { replaceable: boolean };

/**
 * This service works as a core of the find & replace feature.
 */
export interface IFindReplaceService {
    readonly stateUpdates$: Observable<Partial<IFindReplaceState>>;
    readonly state$: Observable<IFindReplaceState>;

    readonly currentMatch$: Observable<Nullable<IFindMatch>>;
    /** An observable value of all matches those could be replaced. */
    readonly replaceables$: Observable<IReplaceableMatch[]>;

    readonly focusSignal$: Observable<void>;

    readonly revealed: boolean;
    readonly replaceRevealed: boolean;

    /**
     * Register a find replace provider to the service. The provider is the actual bearer to
     * perform the find in different kinds of documents or different environments.
     *
     * @param provider the find replace provider
     */
    registerFindReplaceProvider(provider: IFindReplaceProvider): IDisposable;

    /**
     * Get find string from the internal state.
     */
    getFindString(): string;

    /**
     * Start a find & replace session.
     *
     * @returns execution result
     */
    start(revealReplace?: boolean): boolean;

    /**
     * Terminate a find session and clear all caches.
     */
    terminate(): void;

    /**
     * Start searching with the current conditions.
     */
    find(): void;

    focusFindInput(): void;

    revealReplace(): void;

    changeFindString(value: string): void;
    changeInputtingFindString(value: string): void;
    changeReplaceString(value: string): void;
    changeCaseSensitive(sensitive: boolean): void;
    changeMatchesTheWholeCell(wholeCell: boolean): void;
    changeFindScope(scope: FindScope): void;
    changeFindDirection(direction: FindDirection): void;
    changeFindBy(findBy: FindBy): void;

    moveToNextMatch(): void;
    moveToPreviousMatch(): void;
    replace(): Promise<boolean>;
    replaceAll(): Promise<IReplaceAllResult>;
}
export const IFindReplaceService = createIdentifier<IFindReplaceService>('find-replace.service');

/**
 * The find query object with finding options.
 */
export interface IFindQuery extends Pick<
    IFindReplaceState,
    'findString' | 'replaceString' | 'caseSensitive' | 'findBy' | 'findDirection' | 'findScope' | 'matchesTheWholeCell'
> { }

function shouldStateUpdateTriggerResearch(statusUpdate: Partial<IFindReplaceState>): boolean {
    if (typeof statusUpdate.findString !== 'undefined') return true;
    if (typeof statusUpdate.inputtingFindString !== 'undefined') return true;
    if (typeof statusUpdate.findDirection !== 'undefined') return true;
    if (typeof statusUpdate.matchesTheWholeCell !== 'undefined') return true;
    if (typeof statusUpdate.caseSensitive !== 'undefined') return true;
    if (typeof statusUpdate.findScope !== 'undefined') return true;
    if (typeof statusUpdate.findBy !== 'undefined') return true;
    return false;
}

/**
 * This class stores find replace options state. These state are stored
 * here instead of the React component so we can change state from
 * operations.
 */
export class FindReplaceState {
    private readonly _stateUpdates$ = new Subject<Partial<IFindReplaceState>>();
    readonly stateUpdates$: Observable<Partial<IFindReplaceState>> = this._stateUpdates$.asObservable();

    private readonly _state$ = new BehaviorSubject<IFindReplaceState>(createInitFindReplaceState());
    readonly state$ = this._state$.asObservable();
    get state(): IFindReplaceState {
        return this._state$.getValue();
    }

    // TODO@wzhudev: put all state properties here
    private _findString: string = '';
    private _revealed = false;
    private _replaceRevealed = false;
    private _matchesPosition = 0;
    private _matchesCount = 0;

    get findString(): string {
        return this._findString;
    }

    changeState(changes: Partial<IFindReplaceState>): void {
        let changed = false;
        const changedState: Partial<IFindReplaceState> = {};

        if (typeof changes.findString !== 'undefined' && changes.findString !== this._findString) {
            this._findString = changes.findString;
            changedState.findString = this._findString;
            changed = true;
        }

        if (typeof changes.revealed !== 'undefined' && changes.revealed !== this._revealed) {
            this._revealed = changes.revealed;
            changedState.revealed = changes.revealed;
            changed = true;
        }

        if (typeof changes.replaceRevealed !== 'undefined' && changes.replaceRevealed !== this._replaceRevealed) {
            this._replaceRevealed = changes.replaceRevealed;
            changedState.replaceRevealed = changes.replaceRevealed;
            changed = true;
        }

        if (typeof changes.matchesCount !== 'undefined' && changes.matchesCount !== this._matchesCount) {
            this._matchesCount = changes.matchesCount;
            changedState.matchesCount = changes.matchesCount;
            changed = true;
        }

        if (typeof changes.matchesPosition !== 'undefined' && changes.matchesPosition !== this._matchesPosition) {
            this._matchesPosition = changes.matchesPosition;
            changedState.matchesPosition = changes.matchesPosition;
            changed = true;
            // TODO@wzhudev: maybe we should recalc matches position according to the current selections position
        }

        if (changed) {
            this._stateUpdates$.next(changedState);
            this._state$.next({
                findString: this._findString,
                revealed: this._revealed,
                replaceRevealed: this._replaceRevealed,
                matchesCount: this._matchesCount,
                matchesPosition: this._matchesPosition,
            });
        }
    }
}

/**
 * This class stores find replace results and provides methods to perform replace or something.
 *
 * It **only** live through a find-replace session and would be disposed when the user
 * close the find replace dialog (considered as session being terminated).
 */
export class FindReplaceModel extends Disposable {
    readonly currentMatch$ = new BehaviorSubject<Nullable<IFindMatch>>(null);
    readonly replaceables$ = new BehaviorSubject<IReplaceableMatch[]>([]);

    /** All find models returned by providers. */
    private _findModels: FindModel[] = [];

    /** The find model that the current match is from. */
    private _matchingModel: FindModel | null = null;

    private _matches: IFindMatch[] = [];

    private _currentSearchingDisposables: Nullable<DisposableCollection> = null;

    get searched(): boolean {
        return this._findModels.length > 0;
    }

    constructor(
        private readonly _state: FindReplaceState,
        private readonly _providers: Set<IFindReplaceProvider>,
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService
    ) {
        super();

        // should restart finding when the following conditions changed
        this.disposeWithMe(
            this._state.stateUpdates$.pipe(throttleTime(600, undefined, { leading: true, trailing: true })).subscribe((stateUpdate) => {
                const state = this._state.state;
                if (shouldStateUpdateTriggerResearch(stateUpdate)) {
                    if (state.findString !== '' && !state.replaceRevealed) {
                        this.startSearching();
                    } else if (stateUpdate.replaceRevealed !== true) {
                        this._stopSearching();
                    }
                }
            }));
    }

    override dispose(): void {
        super.dispose();

        this._stopSearching();

        this.currentMatch$.complete();
        this.replaceables$.complete();

        this._state.changeState({
            revealed: false,
            replaceRevealed: false,
            findString: '',
            replaceString: '',
            matchesCount: 0,
            matchesPosition: 0,
        });
    }

    /** Call this method to start a `searching`. */
    async startSearching(): Promise<IFindComplete> {
        if (!this._state.findString) {
            return { results: [] };
        }

        const providers = Array.from(this._providers);
        const findModels = (this._findModels = (
            await Promise.all(providers.map((provider) => provider.find({
                findString: this._state.findString,
                findDirection: this._state.findDirection,
                findScope: this._state.findScope,
                findBy: this._state.findBy,
                replaceString: this._state.replaceString,
                caseSensitive: this._state.caseSensitive,
                matchesTheWholeCell: this._state.matchesTheWholeCell,
            })))
        ).flat());

        const matches = this._matches = findModels.map((c) => c.getMatches()).flat();
        this._subscribeToModelsChanges(findModels);

        if (!matches.length) {
            this._state.changeState({ findCompleted: true });
            return { results: [] };
        }

        const index = this._moveToInitialMatch(findModels, matches);
        this._state.changeState({
            findCompleted: true,
            matchesCount: matches.length,
            matchesPosition: index + 1, //  the matches position start from 1
        });

        return { results: matches };
    }

    /** Terminate the current searching session, when searching string is empty. */
    private _stopSearching(): void {
        if (this._state.findCompleted) {
            this._providers.forEach((provider) => provider.terminate());
            this._findModels = [];
            this._matches = [];
            this._matchingModel = null;

            this._currentSearchingDisposables?.dispose();
            this._currentSearchingDisposables = null;

            this.currentMatch$.next(null);
            this.replaceables$.next([]);

            this._state.changeState({
                findCompleted: false,
                matchesCount: 0,
                matchesPosition: 0,
            });
        }
    }

    // When a document's content changes, we should reset all matches and try to move to the next match.
    private _subscribeToModelsChanges(models: FindModel[]): void {
        const disposables = this._currentSearchingDisposables = new DisposableCollection();

        const matchesUpdateSubscription = combineLatest(models.map((model) => model.matchesUpdate$))
            .pipe(throttleTime(600, undefined, { leading: true, trailing: true }))
            .subscribe(([...allMatches]) => {
                const newMatches = this._matches = allMatches.flat();
                if (newMatches.length) {
                    const index = this._moveToInitialMatch(this._findModels, newMatches);
                    this._state.changeState({ matchesCount: newMatches.length, matchesPosition: index + 1 });
                    this.replaceables$.next(newMatches.filter((m) => m.replaceable) as IReplaceableMatch[]);
                } else {
                    this._state.changeState({ matchesCount: 0, matchesPosition: 0 });
                    this.replaceables$.next([]);
                }
            });

        models.forEach((model) => disposables.add(toDisposable(model.activelyChangingMatch$.subscribe((match) => {
            const index = this._matches.findIndex((m) => m === match);
            this._state.changeState({ matchesPosition: index + 1 });
        }))));

        disposables.add(toDisposable(matchesUpdateSubscription));
    }

    async replace(): Promise<boolean> {
        if (!this._matchingModel) {
            return false;
        }

        return this._matchingModel.replace();
    }

    async replaceAll(): Promise<IReplaceAllResult> {
        return Promise.all(this._findModels.map((m) => m.replaceAll()))
            .then((results) => results.reduce((acc, cur) => {
                acc.success += cur.success;
                acc.failure += cur.failure;
                return acc;
            }, { success: 0, failure: 0 }));
    }

    getCurrentMatch(): Nullable<IFindMatch> {
        return this._state.matchesPosition > 0 ? this._matches[this._state.matchesPosition - 1] : null;
    }

    moveToNextMatch(): void {
        if (!this._matchingModel) {
            return;
        }

        const loopInCurrentUnit = this._findModels.length === 1;
        const nextMatch = this._matchingModel.moveToNextMatch({ loop: loopInCurrentUnit });
        if (nextMatch) {
            const index = this._matches.findIndex((value) => value === nextMatch);
            this.currentMatch$.next(nextMatch);
            this._state.changeState({
                matchesPosition: index + 1,
            });
        } else {
            // search in the next find model
            const indexOfPositionModel = this._findModels.findIndex((m) => m === this._matchingModel);
            const nextPositionModel = this._findModels[(indexOfPositionModel + 1) % this._findModels.length]; // TODO: always loop or not
            const nextMatch = nextPositionModel.moveToNextMatch();
            const index = this._matches.findIndex((value) => value === nextMatch);
            this.currentMatch$.next(nextMatch);
            this._matchingModel = nextPositionModel;
            this._state.changeState({
                matchesPosition: index + 1,
            });
        }
    }

    moveToPreviousMatch(): void {
        if (!this._matchingModel) {
            return;
        }

        const loopInCurrentUnit = this._findModels.length === 1;
        const nextMatch = this._matchingModel.moveToPreviousMatch({ loop: loopInCurrentUnit });
        if (nextMatch) {
            const index = this._matches.findIndex((value) => value === nextMatch);
            this.currentMatch$.next(nextMatch);
            this._state.changeState({
                matchesPosition: index + 1,
            });
        } else {
            const indexOfPositionModel = this._findModels.findIndex((m) => m === this._matchingModel);
            const nextPositionModel =
                this._findModels[(indexOfPositionModel - 1 + this._findModels.length) % this._findModels.length];
            const nextMatch = nextPositionModel.moveToPreviousMatch();
            const index = this._matches.findIndex((value) => value === nextMatch);
            this.currentMatch$.next(nextMatch);
            this._matchingModel = nextPositionModel;
            this._state.changeState({
                matchesPosition: index + 1,
            });
        }
    }

    private _moveToInitialMatch(findModels: FindModel[], results: IFindMatch[]): number {
        const focusedUnitId = this._univerInstanceService.getFocusedUniverInstance()?.getUnitId();
        if (!focusedUnitId) {
            return -1;
        }

        const findModelOnFocusUnit = findModels.find((model) => model.unitId === focusedUnitId);
        if (findModelOnFocusUnit) {
            this._matchingModel = findModelOnFocusUnit;
            const nextMatch = findModelOnFocusUnit.moveToNextMatch({ stayIfOnMatch: true });
            const index = results.findIndex((value) => value === nextMatch);
            this.currentMatch$.next(nextMatch);
            return index;
        }

        // otherwise we just simply match the first result
        this._matchingModel = findModels[0];
        const nextMatch = this._matchingModel.moveToNextMatch();
        const matchPosition = this._matches.findIndex((m) => m === nextMatch);
        this.currentMatch$.next(nextMatch);
        return matchPosition;
    }

    private _reset(): void {

    }
}

export enum FindDirection {
    /** Default. */
    ROW = 'row',
    COLUMN = 'column',
}

export enum FindBy {
    VALUE = 'value',
    FORMULA = 'formula',
}

export enum FindScope {
    /** Default. */
    SUBUNIT = 'subunit',
    /** Find the scope in the current unit. */
    UNIT = 'unit',
    /** Find only in the currently selected rages. */
    SELECTION = 'selection',
    // Not available yet.
    // PROJECT = 'project',
}

export interface IFindReplaceState {
    revealed: boolean;

    /** The string user inputs in the input box. */
    findString: string;
    inputtingFindString: string;
    replaceString?: string;

    /** Indicates if is in replacing mode. */
    replaceRevealed: boolean;

    /** The currently focused match's index (1-based). */
    matchesPosition: number;
    /** The number of all matches. */
    matchesCount: number;

    /** Indicates if a finding process is progressed. */
    findCompleted: boolean;

    // #region find options

    caseSensitive: boolean;
    findDirection: FindDirection;
    findScope: FindScope;
    findBy: FindBy;
    matchesTheWholeCell: boolean;

    // #endregion
}

function createInitFindReplaceState(): IFindReplaceState {
    return {
        revealed: true,
        findString: '',
        findCompleted: false,
        inputtingFindString: '',
        replaceRevealed: false,
        matchesPosition: 0,
        matchesCount: 0,
        caseSensitive: false,
        matchesTheWholeCell: false,
        findDirection: FindDirection.ROW,
        findBy: FindBy.VALUE,
        findScope: FindScope.SUBUNIT,
    };
}

// Since Univer' Find&Replace features works in a plugin manner,
// each `IFind&Replace` provider should have their own implementations
// of 'state' and 'model'.

export class FindReplaceService extends Disposable implements IFindReplaceService {
    private readonly _providers = new Set<IFindReplaceProvider>();
    private readonly _state = new FindReplaceState();
    private _model: Nullable<FindReplaceModel>;

    private readonly _currentMatch$ = new BehaviorSubject<Nullable<IFindMatch>>(null);
    readonly currentMatch$ = this._currentMatch$.asObservable();

    private readonly _replaceables$ = new BehaviorSubject<IReplaceableMatch[]>([]);
    readonly replaceables$ = this._replaceables$.asObservable();

    private readonly _focusSignal$ = new Subject<void>();
    readonly focusSignal$ = this._focusSignal$.asObservable();

    get stateUpdates$() { return this._state.stateUpdates$; }
    get state$() { return this._state.state$; }
    get revealed(): boolean { return this._state.revealed; }
    get replaceRevealed(): boolean { return this._state.replaceRevealed; }

    constructor(@Inject(Injector) private readonly _injector: Injector, @IContextService private readonly _contextService: IContextService) {
        super();
    }

    dispose(): void {
        super.dispose();

        this._currentMatch$.next(null);
        this._currentMatch$.complete();

        this._replaceables$.next([]);
        this._replaceables$.complete();

        this._focusSignal$.complete();
    }

    getCurrentMatch(): Nullable<IFindMatch> {
        return this._model?.getCurrentMatch();
    }

    getFindString(): string {
        return this._state.findString;
    }

    changeFindString(findString: string): void {
        this._state.changeState({ findString });
    }

    focusFindInput(): void {
        this._focusSignal$.next();
    }

    changeInputtingFindString(value: string): void {
        if (value) {
            this._state.changeState({ inputtingFindString: value });
        } else {
            this._state.changeState({ inputtingFindString: '', findString: '' });
        }
    }

    changeReplaceString(replaceString: string): void {
        this._state.changeState({ replaceString });
    }

    changeMatchesTheWholeCell(matchesTheWholeCell: boolean): void {
        this._state.changeState({ matchesTheWholeCell });
    }

    changeCaseSensitive(caseSensitive: boolean): void {
        this._state.changeState({ caseSensitive });
    }

    changeFindBy(findBy: FindBy): void {
        this._state.changeState({ findBy });
        this._toggleDisplayRawFormula(findBy === FindBy.FORMULA);
    }

    changeFindScope(scope: FindScope): void {
        this._state.changeState({ findScope: scope });
    }

    changeFindDirection(direction: FindDirection): void {
        this._state.changeState({ findDirection: direction });
    }

    moveToNextMatch(): void {
        if (!this._model) {
            return;
        }

        if (this._state.replaceRevealed && !this._model.searched) {
            this._state.changeState({ findString: this._state.inputtingFindString });
            this._model.startSearching();
        } else {
            this._model.moveToNextMatch();
        }
    }

    moveToPreviousMatch(): void {
        if (!this._model) {
            return;
        }

        if (this._state.replaceRevealed && !this._model.searched) {
            this._state.changeState({ findString: this._state.inputtingFindString });
            this._model.startSearching();
        } else {
            this._model.moveToPreviousMatch();
        }
    }

    async replace(): Promise<boolean> {
        if (!this._model) {
            return false;
        }

        return this._model.replace();
    }

    async replaceAll(): Promise<IReplaceAllResult> {
        if (!this._model) {
            throw new Error('[FindReplaceService] replaceAll: model is not initialized!');
        }

        return this._model.replaceAll();
    }

    revealReplace(): void {
        this._state.changeState({ replaceRevealed: true, inputtingFindString: this._state.findString });
        this._toggleRevealReplace(true);
    }

    start(revealReplace = false): boolean {
        if (this._providers.size === 0) {
            return false;
        }

        this._model = this._injector.createInstance(FindReplaceModel, this._state, this._providers);
        this._model.currentMatch$.subscribe((match) => this._currentMatch$.next(match));
        this._model.replaceables$.subscribe((replaceables) => this._replaceables$.next(replaceables));

        const newState = createInitFindReplaceState();
        if (revealReplace) {
            newState.replaceRevealed = true;
        }

        this._state.changeState(newState);
        this._toggleRevealReplace(revealReplace);
        return true;
    }

    find(): void {
        this._model?.startSearching();
    }

    terminate(): void {
        this._model?.dispose();
        this._model = null;

        this._toggleDisplayRawFormula(false);
        this._toggleRevealReplace(false);
    }

    registerFindReplaceProvider(provider: IFindReplaceProvider): IDisposable {
        this._providers.add(provider);
        return toDisposable(() => this._providers.delete(provider));
    }

    private _toggleRevealReplace(revealReplace: boolean): void {
        this._contextService.setContextValue(FIND_REPLACE_REPLACE_REVEALED, revealReplace);
    }

    private _toggleDisplayRawFormula(force: boolean): void {
        this._contextService.setContextValue(RENDER_RAW_FORMULA_KEY, force);
    }
}
