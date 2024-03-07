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

import { Disposable, mergeSets, Rectangle } from '@univerjs/core';
import type { CellValue, IAutoFilter, ICustomFilter, ICustomFilters, IFilterColumn, IRange, Nullable, Worksheet } from '@univerjs/core';
import { BehaviorSubject } from 'rxjs';
import type { Observable, SubscriptionLike } from 'rxjs';
import { getCustomFilterFn } from './custom-filter';

const EMPTY = () => new Set<number>();

/**
 * This is the in-memory model of filter.
 */
export class FilterModel extends Disposable {
    private readonly _filteredOutRows$ = new BehaviorSubject<Readonly<Set<number>>>(EMPTY());
    readonly filteredOutRows$: Observable<Readonly<Set<number>>> = this._filteredOutRows$.asObservable();

    private _range: Nullable<IRange> = null;

    private _filterColumnByOffset = new Map<number, FilterColumn>();
    private _subscriptionToFilterColumns: Nullable<SubscriptionLike> = null;

    private _alreadyFilteredOutRows = EMPTY();

    constructor(
        public readonly unitId: string,
        public readonly subUnitId: string,
        private readonly _worksheet: Worksheet
    ) {
        super();
    }

    override dispose(): void {
        super.dispose();

        this._filteredOutRows$.next(EMPTY());
        this._filteredOutRows$.complete();

        this._subscriptionToFilterColumns?.unsubscribe();
    }

    /**
     * Serialize this filter model to the JSON format representation.
     */
    serialize(): IAutoFilter {
        const result: IAutoFilter = {
            ref: this._range!,
            filterColumns: Array.from(this._filterColumnByOffset)
                .sort(([offset1], [offset2]) => offset1 - offset2)
                .map(([_, filterColumn]) => filterColumn.serialize()),
        };

        if (this._alreadyFilteredOutRows) {
            result.cachedFilteredOut = Array.from(this._alreadyFilteredOutRows).sort();
        }

        return result;
    }

    /**
     * Deserialize auto filter info to construct a `FilterModel` object.
     * @param unitId workbook id
     * @param subUnitId worksheet id
     * @param worksheet the Worksheet object
     * @param autoFilter auto filter data
     */
    static deserialize(
        unitId: string,
        subUnitId: string,
        worksheet: Worksheet,
        autoFilter: IAutoFilter
    ): FilterModel {
        const filterModel = new FilterModel(unitId, subUnitId, worksheet);
        filterModel._dump(autoFilter);
        return filterModel;
    }

    private _dump(autoFilter: IAutoFilter) {
        this.setRange(autoFilter.ref);

        autoFilter.filterColumns?.forEach((filterColumn) => this._setConditionWithoutReCalc(filterColumn.colId, filterColumn));

        if (autoFilter.cachedFilteredOut) {
            this._alreadyFilteredOutRows = new Set(autoFilter.cachedFilteredOut);
            this._emit();
        }
    }

    isRowFiltered(row: number): boolean {
        return this._alreadyFilteredOutRows.has(row);
    }

    getRange(): Nullable<IRange> {
        return this._range;
    }

    /**
     * Set range of the filter model, this would remove some `IFilterColumn`
     * if the new range not overlaps the old range.
     */
    setRange(range: IRange): void {
        this._range = range;

        // TODO@wzhudev: maybe we should remove the FilterColumn that is not in the new range!
        // TODO@wzhudev: when a column in the range is deleted, we may need to change some FilterColumns' offset

        // set range for each FilterColumn
        Array.from(this._filterColumnByOffset.entries())
            .forEach(([colOffset, filterColumn]) => {
                filterColumn.setRangeAndOffset({
                    startRow: range.startRow + 1,
                    endRow: range.endRow,
                    startColumn: range.startColumn + colOffset,
                    endColumn: range.startColumn + colOffset,
                }, colOffset);
            });
    }

    /**
     * Set or remove filter conditions on a specific row.
     */
    setCondition(col: number, condition: Nullable<IFilterColumn>): void {
        if (!this._range) {
            throw new Error('[FilterModel] could not set condition before a range is set!');
        }

        // TODO@wzhudev: implement removing FilterColumn

        this._setConditionWithoutReCalc(col, condition);
        this._rebuildAlreadyFilteredOutRowsCacheWithout(col);
        this._reCalcWithNoCacheColumns();
        this._emit();
    }

    getFilterColumn(offset: number): Nullable<FilterColumn> {
        return this._filterColumnByOffset.get(offset) ?? null;
    }

    private _setConditionWithoutReCalc(col: number, condition: Nullable<IFilterColumn>): void {
        const filterColumn = this._getFilterColumnOrInit(col);
        filterColumn.setCondition(condition);
    }

    reCalc(): void {
        this._reCalcAllColumns();
        this._emit();
    }

    private _emit(): void {
        this._filteredOutRows$.next(this._alreadyFilteredOutRows);
    }

    private _clearAlreadyFilteredOutRows(): void {
        this._alreadyFilteredOutRows = EMPTY();
    }

    private _rebuildAlreadyFilteredOutRowsCacheWithout(col: number): void {
        const newFilteredOutRows = Array.from(this._filterColumnByOffset.entries())
            .filter(([colOffset, filterColumn]) => colOffset !== col && filterColumn.hasCache)
            .reduce((acc, [_, filterColumn]) => mergeSets(acc, filterColumn.filteredOutRows!), new Set<number>());

        this._alreadyFilteredOutRows = newFilteredOutRows;
    }

    private _reCalcWithNoCacheColumns(): void {
        const noCacheFilteredOutRows = Array.from(this._filterColumnByOffset.values())
            .filter((filterColumn) => !filterColumn.hasCache());

        for (const filterColumn of noCacheFilteredOutRows) {
            const filteredRows = filterColumn.reCalc();
            if (filteredRows) {
                this._alreadyFilteredOutRows = mergeSets(this._alreadyFilteredOutRows, filteredRows);
            }
        }
    }

    private _reCalcAllColumns(): void {
        this._clearAlreadyFilteredOutRows();

        Array.from(this._filterColumnByOffset.entries())
            .sort(([colIndex1], [colIndex2]) => colIndex1 - colIndex2)
            .forEach(([_, filterColumn]) => filterColumn.reCalc());
    }

    private _getFilterColumnOrInit(col: number): FilterColumn {
        if (this._filterColumnByOffset.has(col)) {
            return this._filterColumnByOffset.get(col)!;
        }

        const newFilterColumn = new FilterColumn(this.unitId, this.subUnitId, this._worksheet, {
            getAlreadyFilteredOutRows: () => this._alreadyFilteredOutRows,
        });

        this._filterColumnByOffset.set(col, newFilterColumn);
        return newFilterColumn;
    }
}

interface IFilterColumnContext {
    getAlreadyFilteredOutRows(): Set<number>;
}

/**
 * This is the filter condition on a specific column.
 */
export class FilterColumn extends Disposable {
    private _filteredOutRows: Nullable<Set<number>> = null;
    get filteredOutRows(): Readonly<Nullable<Set<number>>> { return this._filteredOutRows; }

    /** Store the filter configuration. */
    private _filterColumn: Nullable<IFilterColumn> = null;
    /** Cache the filter function.  */
    private _filterFn: Nullable<FilterFn> = null;

    private _range: Nullable<IRange> = null;
    private _columnOffset: number = 0;

    constructor(
        public readonly unitId: string,
        public readonly subUnitId: string,
        private readonly _worksheet: Worksheet,
        private readonly _filterColumnContext: IFilterColumnContext
    ) {
        super();
    }

    override dispose(): void {
        super.dispose();

        this._filteredOutRows = null;
    }

    serialize(): IFilterColumn {
        if (!this._filterColumn) {
            throw new Error('[FilterColumn]: could not serialize without a filter column!');
        }

        return {
            ...this._filterColumn,
            colId: this._columnOffset,
        };
    }

    hasCache(): boolean {
        return this._filteredOutRows !== null;
    }

    // The first row should be omitted!
    setRangeAndOffset(range: IRange, offset: number): void {
        this._range = range;
        this._columnOffset = offset;
    }

    setCondition(condition: Nullable<IFilterColumn>): void {
        this._filterColumn = condition;
        this._generateFilterFn();

        // clear cache
        this._filteredOutRows = null;
    }

    /**
     * Trigger new calculation on this `FilterModel` instance.
     *
     * @external DO NOT EVER call this method from `FilterColumn` itself. The whole process heavily relies on
     * `filteredOutByOthers`, and it is more comprehensible if we let `FilterModel` take full control over the process.
     */
    reCalc(): Readonly<Nullable<Set<number>>> {
        if (!this._filterFn || !this._range) {
            return null;
        }

        const column = this._range.startColumn + this._columnOffset;
        const iterateRange = Rectangle.moveVertical(this._range, this._columnOffset);
        const filteredOutRows = new Set<number>();
        const filteredOutByOthers = this._filterColumnContext.getAlreadyFilteredOutRows();

        for (const range of this._worksheet.iterateByRow(iterateRange)) {
            const row = range.row;

            // if this row is already filtered out by others, we don't need to check it again
            if (filteredOutByOthers.has(row)) {
                continue;
            }

            // TODO@wzhudev: there are multiple details, listed as follows:
            // 1. merged cells
            // 2. boolean values
            // 3. dropdown values from data validation
            // 4. rich text values
            const value = this._worksheet.getCell(row, column)?.v;
            if (!this._filterFn(value)) {
                filteredOutRows.add(row);
            }
        }

        this._filteredOutRows = filteredOutRows;
        return this._filteredOutRows;
    }

    private _generateFilterFn(): void {
        if (!this._filterColumn) {
            return;
        }

        this._filterFn = generateFilterFn(this._filterColumn);
    }
}

/**
 * Filter function is a close function which received a cell's content and determine this value is considered as
 * "matched" and the corresponding row would not be filtered out.
 */
export type FilterFn = (value: Nullable<CellValue>) => boolean;

/**
 * This functions take a `IFilterColumn` as input and return a function that can be used to filter rows.
 * @param column
 * @returns the filter function that takes the cell's value and return a boolean.
 */
export function generateFilterFn(column: IFilterColumn): FilterFn {
    if (column.filters) {
        return filterByValuesFnFactory(column.filters);
    }

    if (column.customFilters) {
        return customFilterFnFactory(column.customFilters);
    }

    throw new Error('[FilterModel]: other types of filters are not supported yet.');
}

function filterByValuesFnFactory(values: string[]): FilterFn {
    return (value) => {
        const valuesSet = new Set(values);
        if (value === undefined) {
            return false;
        }

        return valuesSet.has(typeof value === 'string' ? value : `${value}`);
    };
}

function customFilterFnFactory(customFilters: ICustomFilters): FilterFn {
    const customFilterFns: FilterFn[] = customFilters.customFilters.map((filter) => generateCustomFilterFn(filter));
    if (isCompoundCustomFilter(customFilterFns)) {
        if (customFilters.and) {
            return AND(customFilterFns);
        }

        return OR(customFilterFns);
    }

    return customFilterFns[0];
}

function AND(filterFns: [FilterFn, FilterFn]): FilterFn {
    const [fn1, fn2] = filterFns;
    return (value) => fn1(value) && fn2(value);
}

function OR(filterFns: [FilterFn, FilterFn]): FilterFn {
    const [fn1, fn2] = filterFns;
    return (value) => fn1(value) || fn2(value);
}

function isCompoundCustomFilter(filter: FilterFn[]): filter is [FilterFn, FilterFn] {
    return filter.length === 2;
}

function generateCustomFilterFn(filter: ICustomFilter): FilterFn {
    const compare = filter.val;
    const customFilterFn = getCustomFilterFn(filter.operator);
    return (value) => customFilterFn.fn(value, compare);
}
