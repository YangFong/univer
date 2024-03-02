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

import { CommandType, Disposable, fromCallback, groupBy, ICommandService, IContextService, ILogService, IUndoRedoService, IUniverInstanceService, LifecycleStages, ObjectMatrix, OnLifecycle, replaceInDocumentBody, rotate, Tools } from '@univerjs/core';
import type { ICellData, IObjectMatrixPrimitiveType, IRange, Nullable, Workbook, Worksheet } from '@univerjs/core';
import { IRenderManagerService, RENDER_RAW_FORMULA_KEY } from '@univerjs/engine-render';
import type { IFindComplete, IFindMatch, IFindMoveParams, IFindQuery, IFindReplaceProvider, IReplaceAllResult } from '@univerjs/find-replace';
import { FindBy, FindDirection, FindModel, FindScope, IFindReplaceService } from '@univerjs/find-replace';
import type { ISetRangeValuesCommandParams, ISetWorksheetActivateCommandParams, ISheetCommandSharedParams } from '@univerjs/sheets';
import { SelectionManagerService, SetRangeValuesCommand, SetWorksheetActivateCommand } from '@univerjs/sheets';
import type { IScrollToCellCommandParams } from '@univerjs/sheets-ui';
import { getCoordByCell, getSheetObject, ScrollToCellCommand, SheetSkeletonManagerService } from '@univerjs/sheets-ui';
import { type IDisposable, Inject, Injector } from '@wendellhu/redi';
import { filter, skip, Subject, throttleTime } from 'rxjs';

import type { ISheetFindReplaceHighlightShapeProps } from '../views/shapes/find-replace-highlight.shape';
import { SheetFindReplaceHighlightShape } from '../views/shapes/find-replace-highlight.shape';
import type { ISheetReplaceCommandParams, ISheetReplacement } from '../commands/commands/sheet-replace.command';
import { SheetReplaceCommand } from '../commands/commands/sheet-replace.command';
import { isBeforePositionWithColumnPriority, isBeforePositionWithRowPriority, isBehindPositionWithColumnPriority, isBehindPositionWithRowPriority, isSamePosition } from './utils';

@OnLifecycle(LifecycleStages.Steady, SheetsFindReplaceController)
export class SheetsFindReplaceController extends Disposable implements IDisposable {
    private _provider!: SheetsFindReplaceProvider;

    constructor(
        @Inject(Injector) private readonly _injector: Injector,
        @IFindReplaceService private readonly _findReplaceService: IFindReplaceService,
        @ICommandService private readonly _commandService: ICommandService
    ) {
        super();

        this._init();
        this._initCommands();
    }

    override dispose(): void {
        super.dispose();

        this._provider.dispose();
    }

    private _init(): void {
        const provider = this._injector.createInstance(SheetsFindReplaceProvider);
        this._provider = provider;

        this.disposeWithMe(this._findReplaceService.registerFindReplaceProvider(provider));
    }

    private _initCommands(): void {
        [SheetReplaceCommand].forEach((command) => this.disposeWithMe(this._commandService.registerCommand(command)));
    }
}

const SHEETS_FIND_REPLACE_PROVIDER_NAME = 'sheets-find-replace-provider';
const FIND_REPLACE_Z_INDEX = 10000;

export interface ISheetCellMatch extends IFindMatch {
    isFormula: boolean;
    provider: typeof SHEETS_FIND_REPLACE_PROVIDER_NAME;
    range: {
        subUnitId: string;
        range: IRange;
    };
}

/**
 * This class executes finding in a workbook and subscribe to the content change event so when its results changes
 * FindReplaceService would know that and update searching results. Also this class in responsible for
 * highlighting matched cells.
 */
export class SheetFindModel extends FindModel {
    // We can directly inject the `FindReplaceService` here, and call its methods instead of using the observables.
    private readonly _matchesUpdate$ = new Subject<ISheetCellMatch[]>();
    readonly matchesUpdate$ = this._matchesUpdate$.asObservable();

    private readonly _activelyChangingMatch$ = new Subject<ISheetCellMatch>();
    readonly activelyChangingMatch$ = this._activelyChangingMatch$.asObservable();

    /** Hold matches by the worksheet they are in. Make it easier to track the next (or previous) match when searching in the whole workbook. */
    private _matchesByWorksheet = new Map<string, ISheetCellMatch[]>();
    /** Hold all matches in the currently searching scope. */
    private _matches: ISheetCellMatch[] = [];
    /** `length` of _matches. */
    private _matchesCount = 0;
    /** Position of the current focused ISheetCellMatch, starting from 1. */
    private _matchesPosition = 0;

    private _activeHighlightIndex = -1;
    private _highlightShapes: SheetFindReplaceHighlightShape[] = [];
    private _currentHighlightShape: Nullable<SheetFindReplaceHighlightShape> = null;

    /** This properties holds the query params during this searching session. */
    private _query: Nullable<IFindQuery> = null;

    get unitId(): string {
        return this._workbook.getUnitId();
    }

    get matchesCount(): number {
        return this._matchesCount;
    }

    get matchesPosition(): number {
        return this._matchesPosition;
    }

    get currentMatch(): Nullable<ISheetCellMatch> {
        return this._matchesPosition > 0 ? this._matches[this._matchesPosition - 1] : null;
    }

    constructor(
        private readonly _workbook: Workbook,
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService,
        @IRenderManagerService private readonly _renderManagerService: IRenderManagerService,
        @ICommandService private readonly _commandService: ICommandService,
        @IContextService private readonly _contextService: IContextService,
        @ILogService private readonly _logService: ILogService,
        @IUndoRedoService private readonly _undoRedoService: IUndoRedoService,
        @Inject(SheetSkeletonManagerService) private readonly _sheetSkeletonManagerService: SheetSkeletonManagerService,
        @Inject(SelectionManagerService) private readonly _selectionManagerService: SelectionManagerService
    ) {
        super();
    }

    override dispose(): void {
        super.dispose();

        this._disposeHighlights();
        this._toggleDisplayRawFormula(false);
    }

    getMatches(): IFindMatch[] {
        return this._matches;
    }

    start(query: IFindQuery): void {
        this._query = query;

        if (query.findBy === FindBy.FORMULA) {
            this._toggleDisplayRawFormula(true);
        } else {
            this._toggleDisplayRawFormula(false);
        }

        switch (query.findScope) {
            case FindScope.UNIT:
                this.findInWorkbook(query);
                break;
            case FindScope.SUBUNIT:
                this.findInActiveWorksheet(query);
                break;
            case FindScope.SELECTION:
            default:
                this.findInDedicatedRange(query);
        }
    }

    private _toggleDisplayRawFormula(force: boolean): void {
        this._contextService.setContextValue(RENDER_RAW_FORMULA_KEY, force);
    }

    /**
     * Find all matches in the current workbook no matter which worksheet is activated.
     * @param query the query object
     * @returns the query complete event
     */
    findInWorkbook(query: IFindQuery): IFindComplete {
        const unitId = this._workbook.getUnitId();

        let complete: IFindComplete;
        let firstSearch = true;

        const findInWorkbook = () => {
            const allCompletes = this._workbook.getSheets().map((worksheet) => {
                const complete = this._findInWorksheet(worksheet, query, unitId);
                const sheetId = worksheet.getSheetId();

                const { results } = complete;
                if (results.length) {
                    this._matchesByWorksheet.set(sheetId, complete.results);
                } else {
                    this._matchesByWorksheet.delete(sheetId);
                }

                return complete;
            });

            this._matches = allCompletes.map((c) => c.results).flat();
            this._updateFindHighlight();

            if (firstSearch) {
                complete = { results: this._matches };
                firstSearch = false;
            } else {
                this._matchesUpdate$.next(this._matches);
            }
        };

        this.disposeWithMe(this._sheetSkeletonManagerService.currentSkeleton$.subscribe(() => this._updateFindHighlight()));
        this.disposeWithMe(this._workbook.activeSheet$.pipe(skip(1)).subscribe((activeSheet) => {
            if (!activeSheet) {
                return;
            }

            const activeSheetId = activeSheet.getSheetId();
            if (!this._matchesByWorksheet.has(activeSheetId)) {
                return;
            }

            const firstMatch = this._matchesByWorksheet.get(activeSheetId)![0];
            const matchIndex = this._matches.findIndex((match) => match === firstMatch);
            this._updateFindHighlight();
            this._updateCurrentHighlightShape(matchIndex);
            this._activelyChangingMatch$.next(firstMatch);
        }));

        // When the sheet model changes, we should re-search.
        this.disposeWithMe(
            fromCallback(this._commandService.onCommandExecuted)
                .pipe(
                    filter(([command]) => command.type === CommandType.MUTATION
                        && (command.params as ISheetCommandSharedParams).unitId === this._workbook.getUnitId()
                    ),
                    throttleTime(600, undefined, { leading: false, trailing: true })
                )
                .subscribe(() => findInWorkbook())
        );

        findInWorkbook();
        return complete!;
    }

    /**
     * Find all matches (only) in the currently activated worksheet.
     * @param query the query object
     * @returns the query complete event
     */
    findInActiveWorksheet(query: IFindQuery): IFindComplete {
        const unitId = this._workbook.getUnitId();

        let complete: IFindComplete;
        let firstSearch = true;

        const findInWorksheet = (): IFindComplete => {
            const currentWorksheet = this._workbook.getActiveSheet();
            const lastMatch = this.currentMatch;
            const newComplete = this._findInWorksheet(currentWorksheet, query, unitId);

            this._matches = newComplete.results;
            this._matchesCount = newComplete.results.length;
            this._matchesPosition = this._tryRestoreLastMatchesPosition(lastMatch, this._matches);

            if (firstSearch) {
                complete = newComplete;
                firstSearch = false;
            } else {
                this._matchesUpdate$.next(this._matches);
            }

            this._updateFindHighlight();
            return newComplete;
        };

        // When the skeleton changes, we should re-render the highlights.
        this.disposeWithMe(this._sheetSkeletonManagerService.currentSkeleton$.subscribe(() => this._updateFindHighlight()));
        // When the sheet model changes, we should re-search.
        this.disposeWithMe(
            fromCallback(this._commandService.onCommandExecuted)
                .pipe(
                    filter(([command]) => command.type === CommandType.MUTATION
                        && (command.params as ISheetCommandSharedParams).unitId === this._workbook.getUnitId()
                    ),
                    throttleTime(600, undefined, { leading: false, trailing: true })
                )
                .subscribe(() => findInWorksheet())
        );

        // activeSheet$ is a BehaviorSubject, so we don't need call findInWorksheet() once
        this.disposeWithMe(this._workbook.activeSheet$.subscribe(() => findInWorksheet()));

        return complete!;
    }

    /**
     * Find all matches in the currently selected range.
     * @param _query the query object
     * @returns the query complete event
     */
    findInDedicatedRange(_query: IFindQuery): IFindComplete {
        return {
            results: [],
        };
    }

    private _findInRange(worksheet: Worksheet, query: IFindQuery, range: IRange, unitId: string): IFindComplete<ISheetCellMatch> {
        const results: ISheetCellMatch[] = [];
        const subUnitId = worksheet.getSheetId();

        const iter = (query.findDirection === FindDirection.COLUMN ? worksheet.iterateByColumn : worksheet.iterateByRow).bind(worksheet)(range);
        while (true) {
            const { done, value } = iter.next();
            if (done) break;

            const { row, col, colSpan, rowSpan, value: cellData } = value;
            const { hit, replaceable, isFormula } = hitCell(worksheet, row, col, query, cellData);
            if (hit) {
                const result: ISheetCellMatch = {
                    provider: SHEETS_FIND_REPLACE_PROVIDER_NAME,
                    unitId,
                    replaceable,
                    isFormula,
                    range: {
                        subUnitId,
                        range: {
                            startRow: row,
                            startColumn: col,
                            endColumn: col + (colSpan ?? 1) - 1,
                            endRow: row + (rowSpan ?? 1) - 1,
                        },
                    },
                };

                results.push(result);
            }
        }

        return { results };
    }

    /** Find matches in a given worksheet. */
    private _findInWorksheet(worksheet: Worksheet, query: IFindQuery, unitId: string): IFindComplete<ISheetCellMatch> {
        const rowCount = worksheet.getRowCount();
        const colCount = worksheet.getColumnCount();
        const range: IRange = { startRow: 0, startColumn: 0, endRow: rowCount - 1, endColumn: colCount - 1 };

        return this._findInRange(worksheet, query, range, unitId);
    }

    private _disposeHighlights(): void {
        this._highlightShapes.forEach((shape) => {
            shape.dispose();
            shape.getScene().makeDirty();
        });

        this._highlightShapes = [];
        this._currentHighlightShape = null;
    }

    private _updateFindHighlight(): void {
        this._disposeHighlights();

        const skeleton = this._sheetSkeletonManagerService.getCurrent()?.skeleton;
        if (!skeleton) {
            return;
        }

        const sheetObjects = this._getSheetObject();
        if (!sheetObjects) {
            return;
        }

        const currentUnitId = this._univerInstanceService.getFocusedUniverInstance()?.getUnitId();
        if (currentUnitId !== this._workbook.getUnitId()) {
            return;
        }

        const unitId = this._workbook.getUnitId();
        const currentRender = this._renderManagerService.getRenderById(unitId);
        if (currentRender == null) {
            return;
        }

        const { scene } = currentRender;
        const matches = this._matches;

        const activeSheetId = this._workbook.getActiveSheet().getSheetId();
        const highlightShapes = matches.filter((match) => match.range.subUnitId === activeSheetId).map((find, index) => {
            const { startColumn, startRow, endColumn, endRow } = find.range.range;
            const startPosition = getCoordByCell(startRow, startColumn, scene, skeleton);
            const endPosition = getCoordByCell(endRow, endColumn, scene, skeleton);
            const { startX, startY } = startPosition;
            const { endX, endY } = endPosition;

            const width = endX - startX;
            const height = endY - startY; // if it is in the hidden area, should display at least 2 pixel
            const inHiddenRows = height === 0;
            const inHiddenColumns = width === 0;
            const inHiddenRange = inHiddenRows || inHiddenColumns;

            const props: ISheetFindReplaceHighlightShapeProps = {
                left: startX,
                top: startY,
                width: Math.max(width, 2),
                height: Math.max(height, 2),
                evented: false,
                inHiddenRange,
            };

            return new SheetFindReplaceHighlightShape(`find-highlight-${index}`, props);
        });

        scene.addObjects(highlightShapes, FIND_REPLACE_Z_INDEX);
        this._highlightShapes = highlightShapes;

        scene.makeDirty();
    }

    private _updateCurrentHighlightShape(matchIndex?: number): void {
        // de-highlight the current highlighted shape
        this._currentHighlightShape?.setShapeProps({ activated: false });

        if (matchIndex !== undefined) {
            const shape = this._highlightShapes[matchIndex];
            if (shape) {
                this._currentHighlightShape = shape;
                // TODO@wzhudev: we should check if it is is the hidden area
                // recalc top and left

                shape.setShapeProps({ activated: true });
            }
        } else {
            this._currentHighlightShape = null;
        }
    }

    private _getSheetObject() {
        return getSheetObject(this._univerInstanceService, this._renderManagerService);
    }

    private _focusMatch(match: ISheetCellMatch): void {
        const subUnitId = match.range.subUnitId;
        if (subUnitId !== this._workbook.getActiveSheet().getSheetId()) {
            this._commandService.syncExecuteCommand(SetWorksheetActivateCommand.id, {
                unitId: this._workbook.getUnitId(),
                subUnitId,
            } as ISetWorksheetActivateCommandParams);
        }

        this._commandService.syncExecuteCommand(ScrollToCellCommand.id, { range: match.range.range } as IScrollToCellCommandParams);
    }

    private _tryRestoreLastMatchesPosition(lastMatch: Nullable<ISheetCellMatch>, newMatches: ISheetCellMatch[]): number {
        if (!lastMatch) return 0;

        const { subUnitId: lastSubUnitId } = lastMatch.range;
        const { startColumn: lastStartColumn, startRow: lastStartRow } = lastMatch.range.range;
        const index = newMatches.findIndex((match) => {
            if (lastSubUnitId !== match.range.subUnitId) {
                return false;
            }

            const { startColumn, startRow } = match.range.range;
            return startColumn === lastStartColumn && startRow === lastStartRow;
        });

        return index > -1 ? index + 1 : 0;
    }

    override moveToNextMatch(params?: IFindMoveParams): ISheetCellMatch | null {
        if (!this._matches.length) {
            return null;
        }

        const loop = params?.loop ?? false;
        const stayIfOnMatch = params?.stayIfOnMatch ?? false;

        const matchToMove = this._findNextMatch(loop, stayIfOnMatch);
        if (matchToMove) {
            const [match, index] = matchToMove;
            this._matchesPosition = index + 1;

            if (this._query!.findScope === FindScope.UNIT) {
                this._activeHighlightIndex = this._matchesByWorksheet.get(match.range.subUnitId)!.findIndex((m) => m === match);
            } else {
                this._activeHighlightIndex = index;
            }

            this._focusMatch(match);
            this._updateCurrentHighlightShape(this._activeHighlightIndex);
            return match;
        }

        this._matchesPosition = 0;
        this._updateCurrentHighlightShape();
        return null;
    }

    override moveToPreviousMatch(params?: IFindMoveParams): ISheetCellMatch | null {
        if (!this._matches.length) {
            return null;
        }

        const loop = params?.loop ?? false;
        const stayIfOnMatch = params?.stayIfOnMatch ?? false;

        const matchToMove = this._findPreviousMatch(loop, stayIfOnMatch);
        if (matchToMove) {
            const [match, index] = matchToMove;
            this._matchesPosition = index + 1;

            if (this._query!.findScope === FindScope.UNIT) {
                this._activeHighlightIndex = this._matchesByWorksheet.get(match.range.subUnitId)!.findIndex((m) => m === match);
            } else {
                this._activeHighlightIndex = index;
            }

            this._focusMatch(match);
            this._updateCurrentHighlightShape(this._activeHighlightIndex);
            return match;
        }

        this._matchesPosition = 0;
        this._updateCurrentHighlightShape();
        return null;
    }

    private _findPreviousMatch(loop = false, stayIfOnMatch = false): [ISheetCellMatch, number] | null {
        // Technically speaking, there are eight different situations!
        // Case 1: if there is a current match and the process is very easy
        if (this.currentMatch) {
            const currentMatchIndex = this._matches.findIndex((match) => match === this.currentMatch);
            if (stayIfOnMatch) {
                return [this.currentMatch, currentMatchIndex];
            }

            const nextMatchIndex = currentMatchIndex - 1;
            if (!loop && nextMatchIndex < 0) {
                return null;
            }

            const length = this._matches.length;
            const modded = (nextMatchIndex + length) % length;
            return [this._matches[modded], modded];
        }

        // Case 2: if there is no current match, we should find the next match that is closest to the user's current selection.
        // Still need to handle `stayInOnMatch` here.
        const selections = this._selectionManagerService.getSelections();
        if (!selections?.length) {
            return [this._matches[0], 0];
        }

        if (this._query!.findScope !== FindScope.UNIT) {
            return this._findPreviousMatchBySelection(this._matches, selections[0].range);
        }

        const currentSheetId = this._workbook.getActiveSheet().getSheetId();
        const worksheetThatHasMatch = this._findPreviousWorksheetThatHasAMatch(currentSheetId, loop);
        if (!worksheetThatHasMatch) {
            return null;
        }

        return this._findPreviousMatchBySelection(this._matchesByWorksheet.get(worksheetThatHasMatch)!, selections[0].range);
    }

    private _findNextMatch(loop = false, stayIfOnMatch = false): [ISheetCellMatch, number] | null {
        // Technically speaking, there are eight different situations!
        // Case 1: if there is a current match and the process is very easy
        if (this.currentMatch) {
            const currentMatchIndex = this._matches.findIndex((match) => match === this.currentMatch);
            if (stayIfOnMatch) {
                return [this.currentMatch, currentMatchIndex];
            }

            const nextMatchIndex = currentMatchIndex + 1;
            const length = this._matches.length;
            if (!loop && nextMatchIndex >= length) {
                return null;
            }

            const modded = nextMatchIndex % length; // we don't need to add length here
            return [this._matches[modded], modded];
        }

        // Case 2: if there is no current match, we should find the next match that is closest to the user's current selection.
        // Still need to handle `stayInOnMatch` here.
        const selections = this._selectionManagerService.getSelections();
        if (!selections?.length) {
            return [this._matches[0], 0];
        }

        if (this._query!.findScope !== FindScope.UNIT) {
            return this._findNextMatchBySelection(this._matches, selections[0].range);
        }

        const currentSheetId = this._workbook.getActiveSheet().getSheetId();
        const worksheetThatHasMatch = this._findNextWorksheetThatHasAMatch(currentSheetId, loop);
        if (!worksheetThatHasMatch) {
            return null;
        }

        return this._findNextMatchBySelection(this._matchesByWorksheet.get(worksheetThatHasMatch)!, selections[0].range);
    }

    private _findPreviousWorksheetThatHasAMatch(currentWorksheet: string, loop = false): string | null {
        const rawWorksheetsInOrder = this._workbook.getSheetOrders();
        const currentSheetIndex = rawWorksheetsInOrder.findIndex((sheet) => sheet === currentWorksheet);
        const worksheetsToSearch = loop
            ? rotate(rawWorksheetsInOrder, currentSheetIndex + 1)
            : rawWorksheetsInOrder.slice(0, currentSheetIndex + 1);
        const first = worksheetsToSearch.findLast((worksheet) => this._matchesByWorksheet.has(worksheet));
        return first ?? null;
    }

    private _findNextWorksheetThatHasAMatch(currentWorksheet: string, loop = false): string | null {
        const rawWorksheetsInOrder = this._workbook.getSheetOrders();
        const currentSheetIndex = rawWorksheetsInOrder.findIndex((sheet) => sheet === currentWorksheet);
        const worksheetsToSearch = loop
            ? rotate(rawWorksheetsInOrder, currentSheetIndex)
            : rawWorksheetsInOrder.slice(currentSheetIndex);
        const first = worksheetsToSearch.find((worksheet) => this._matchesByWorksheet.has(worksheet));
        return first ?? null;
    }

    private _findNextMatchBySelection(matches: ISheetCellMatch[], range: IRange, stayIfOnMatch = false): [ISheetCellMatch, number] {
        const findByRow = this._query!.findDirection === FindDirection.ROW;
        let index = matches.findIndex((match) => {
            const matchRange = match.range.range;
            const isBehind = findByRow ? isBehindPositionWithRowPriority(range, matchRange) : isBehindPositionWithColumnPriority(range, matchRange);
            if (!isBehind) {
                return false;
            }

            const isSame = isSamePosition(range, matchRange);
            return stayIfOnMatch ? isSame : !isSame;
        });

        if (index === -1) {
            index = matches.length - 1;
        }

        const match = matches[index];
        return [match, this._matches.findIndex((m) => m === match)];
    }

    private _findPreviousMatchBySelection(matches: ISheetCellMatch[], range: IRange, stayIfOnMatch = false): [ISheetCellMatch, number] {
        const findByRow = this._query!.findDirection === FindDirection.ROW;
        let index = this._matches.findLastIndex((match) => {
            const matchRange = match.range.range;
            const isBefore = findByRow ? isBeforePositionWithRowPriority(range, matchRange) : isBeforePositionWithColumnPriority(range, matchRange);
            if (!isBefore) {
                return false;
            }

            const isSame = isSamePosition(range, matchRange);
            return stayIfOnMatch ? isSame : !isSame;
        });

        if (index === -1) {
            index = 0;
        }

        const match = matches[index];
        return [match, this._matches.findIndex((m) => m === match)];
    }

    async replace(): Promise<boolean> {
        if (this._matchesCount === 0 || !this.currentMatch || !this._query || !this.currentMatch.replaceable) {
            return false;
        }

        const range = this.currentMatch.range;
        const targetWorksheet = this._workbook.getSheetBySheetId(this.currentMatch.range.subUnitId)!;
        const newContent = this._getReplacedCellData(
            this.currentMatch,
            targetWorksheet,
            this._query.findBy === FindBy.FORMULA,
            this._query.findString,
            this._query.replaceString!,
            this._query.caseSensitive ? 'g' : 'ig'
        );

        // for single cell replace we just use SetRangeValuesCommand directly for simplicity
        return this._commandService.executeCommand(SetRangeValuesCommand.id, {
            unitId: this.currentMatch.unitId,
            subUnitId: range.subUnitId,
            value: {
                [range.range.startRow]: {
                    [range.range.startColumn]: newContent,
                },
            } as IObjectMatrixPrimitiveType<ICellData>,
        } as ISetRangeValuesCommandParams);
    }

    async replaceAll(): Promise<IReplaceAllResult> {
        const unitId = this._workbook.getUnitId();

        const { findString, replaceString, caseSensitive, findBy } = this._query!;
        const shouldReplaceFormula = findBy === FindBy.FORMULA;
        const replaceFlag = caseSensitive ? 'g' : 'ig';

        const replacements: ISheetReplacement[] = [];
        const matchesByWorksheet = groupBy(this._matches.filter((m) => m.replaceable), (match) => match.range.subUnitId);
        matchesByWorksheet.forEach((matches, subUnitId) => {
            const matrix = new ObjectMatrix<ICellData>();
            const worksheet = this._workbook.getSheetBySheetId(subUnitId)!;

            matches.forEach((match) => {
                const { startColumn, startRow } = match.range.range;
                const newCellData = this._getReplacedCellData(match, worksheet, shouldReplaceFormula, findString, replaceString!, replaceFlag);
                if (newCellData) {
                    matrix.setValue(startRow, startColumn, newCellData);
                }
            });

            replacements.push({
                count: matches.length,
                subUnitId,
                value: matrix.getMatrix(),
            });
        });

        return this._commandService.executeCommand(SheetReplaceCommand.id, {
            unitId,
            replacements,
        } as ISheetReplaceCommandParams);
    }

    private _getReplacedCellData(
        match: ISheetCellMatch,
        worksheet: Worksheet,
        shouldReplaceFormula: boolean,
        findString: string,
        replaceString: string,
        replaceFlag: string
    ): Nullable<ICellData> {
        const range = match.range.range;
        const { startRow, startColumn } = range;
        const currentContent = worksheet.getCellRaw(startRow, startColumn)!; // TODO: should not get it again, just hook to match item

        // replace formular
        if (match.isFormula) {
            if (!shouldReplaceFormula) {
                return null;
            }

            const newContent = currentContent!.f!.replace(new RegExp(findString, replaceFlag), replaceString);
            return { f: newContent, v: null };
        }

        // replace rich format text
        const isRichText = !!currentContent.p?.body;
        if (isRichText) {
            const newDocumentBody = replaceInDocumentBody(currentContent.p!.body!, findString, replaceString);
            const newContent = Tools.deepClone(currentContent);
            newContent.p!.body = newDocumentBody;
            return newContent;
        }

        // replace plain text
        const newContent = currentContent.v!.toString().replace(new RegExp(findString, replaceFlag), replaceString!);
        return { v: newContent };
    }
}

/**
 * This module is responsible for searching and replacing in the sheets.
 * It also adds the search results to the search view by highlighting them.
 */
class SheetsFindReplaceProvider extends Disposable implements IFindReplaceProvider {
    /**
     * Hold all find results in this kind of univer business instances (Workbooks).
     */
    private readonly _findModelsByUnitId = new Map<string, SheetFindModel>();

    constructor(
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService,
        @Inject(Injector) private readonly _injector: Injector
    ) {
        super();
    }

    async find(query: IFindQuery): Promise<SheetFindModel[]> {
        this._terminate();

        // NOTE: If there are multi Workbook instances then we should create `SheetFindModel` for each of them.
        // But we don't need to implement that in the foreseeable future.
        const currentWorkbook = this._univerInstanceService.getCurrentUniverSheetInstance();
        if (currentWorkbook) {
            const sheetFind = this._injector.createInstance(SheetFindModel, currentWorkbook);
            this._findModelsByUnitId.set(currentWorkbook.getUnitId(), sheetFind);
            const parsedQuery = this._preprocessQuery(query);
            sheetFind.start(parsedQuery);
            return [sheetFind];
        }

        return [];
    }

    terminate(): void {
        this._terminate();
    }

    private _terminate(): void {
        this._findModelsByUnitId.forEach((model) => model.dispose());
        this._findModelsByUnitId.clear();
    }

    /**
     * Parsed the query object before do actual searching in favor of performance.
     * @param query the raw query object
     * @returns the parsed query object
     */
    private _preprocessQuery(query: Readonly<IFindQuery>): IFindQuery {
        let findString = (query.caseSensitive || query.findBy === FindBy.FORMULA)
            ? query.findString
            : query.findString.toLowerCase();

        findString = findString.trim();

        return {
            ...query,
            findString,
        };
    }
}

// Use this object to pass results in avoid of GC.
interface IValuePassingObject {
    hit: boolean;
    replaceable: boolean;
    isFormula: boolean;
    rawData: Nullable<ICellData>;
}
const VALUE_PASSING_OBJECT: IValuePassingObject = { hit: false, replaceable: false, isFormula: false, rawData: null };

/**
 * This function determines if a cell's content matches what is searched for.
 * @param worksheet worksheet the Worksheet to search
 * @param row the row index
 * @param col the column index
 * @param query the parsed query object
 * @returns if the cell is hit, replaceable and is a formula
 */
function hitCell(worksheet: Worksheet, row: number, col: number, query: IFindQuery, cellData: ICellData): IValuePassingObject {
    const { findBy } = query;

    const rawData = worksheet.getCellRaw(row, col);
    VALUE_PASSING_OBJECT.rawData = rawData;

    // search formula
    const hasFormula = !!rawData?.f;
    if (findBy === FindBy.FORMULA && hasFormula && rawData.f!.toLowerCase().indexOf(query.findString) > -1) {
        VALUE_PASSING_OBJECT.hit = true;
        VALUE_PASSING_OBJECT.replaceable = true;
        VALUE_PASSING_OBJECT.isFormula = true;
        return VALUE_PASSING_OBJECT;
    }

    // if the cell does not match, we should not check the raw data
    if (!matchCellData(cellData, query)) {
        VALUE_PASSING_OBJECT.hit = false;
        return VALUE_PASSING_OBJECT;
    }

    if (!rawData) {
        VALUE_PASSING_OBJECT.hit = true;
        VALUE_PASSING_OBJECT.replaceable = false;
        VALUE_PASSING_OBJECT.isFormula = false;
        return VALUE_PASSING_OBJECT;
    }

    VALUE_PASSING_OBJECT.hit = true;
    // TODO@wzhudev: we may need to comply with data validation here
    VALUE_PASSING_OBJECT.replaceable = findBy !== FindBy.FORMULA && !hasFormula; // it is replaceable only it is not calculated
    VALUE_PASSING_OBJECT.isFormula = hasFormula;
    return VALUE_PASSING_OBJECT;
}

function matchCellData(cellData: ICellData, query: IFindQuery): boolean {
    let value = extractPureValue(cellData);
    if (!value) {
        return false;
    } else {
        value = value.trim();
    }

    if (query.matchesTheWholeCell) {
        return query.caseSensitive
            ? value === query.findString
            : value.toLowerCase() === query.findString;
    }
    return query.caseSensitive
        ? value.indexOf(query.findString) > -1
        : value.toLowerCase().indexOf(query.findString) > -1;
}

function extractPureValue(cell: ICellData): Nullable<string> {
    const rawValue = cell?.p?.body?.dataStream ?? cell?.v;

    if (typeof rawValue === 'number') {
        return `${rawValue}`;
    }

    if (typeof rawValue === 'boolean') {
        return rawValue ? '1' : '0';
    }

    return rawValue;
}
