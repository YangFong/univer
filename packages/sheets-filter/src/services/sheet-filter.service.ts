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

import type { Nullable, Workbook } from '@univerjs/core';
import { Disposable, ILogService, IUniverInstanceService, LifecycleStages, OnLifecycle, toDisposable } from '@univerjs/core';
import { BehaviorSubject } from 'rxjs';

import { FilterModel } from '../models/filter-model';

/**
 * This service is responsible for managing filter models, especially their lifecycle.
 */
@OnLifecycle(LifecycleStages.Starting, SheetsFilterService)
export class SheetsFilterService extends Disposable {
    private readonly _filterModels = new Map<string, Map<string, FilterModel>>();

    private readonly _activeFilterModel$ = new BehaviorSubject<Nullable<FilterModel>>(null);
    /** The current Workbook's active Worksheet's filter model (if there is one). An observable value. */
    readonly activeFilterModel$ = this._activeFilterModel$.asObservable();
    /** The current Workbook's active Worksheet's filter model (if there is one). */
    get activeFilterModel(): Nullable<FilterModel> { return this._activeFilterModel$.getValue(); }

    constructor(
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService,
        @ILogService private _logService: ILogService
    ) {
        super();

        this._initModel();
        this._initActiveFilterModel();
    }

    /**
     *
     * @param unitId
     * @param subUnitId
     */
    ensureFilterModel(unitId: string, subUnitId: string): FilterModel {
        const already = this.getFilterModel(unitId, subUnitId);
        if (already) {
            return already;
        }

        const workbook = this._univerInstanceService.getUniverSheetInstance(unitId);
        if (!workbook) {
            throw new Error(`[SheetsFilterService]: could not create "FilterModel" on a non-existing workbook ${unitId}!`);
        }

        const worksheet = workbook.getSheetBySheetId(subUnitId);
        if (!worksheet) {
            throw new Error(`[SheetsFilterService]: could not create "FilterModel" on a non-existing worksheet ${subUnitId}!`);
        }

        const filterModel = new FilterModel(unitId, subUnitId, worksheet);
        this._cacheFilterModel(unitId, subUnitId, filterModel);
        return filterModel;
    }

    getFilterModel(unitId: string, subUnitId: string): Nullable<FilterModel> {
        return this._filterModels.get(unitId)?.get(subUnitId) ?? null;
    }

    removeFilterModel(unitId: string, subUnitId: string): boolean {
        const already = this.getFilterModel(unitId, subUnitId);
        if (already) {
            already.dispose();
            this._filterModels.get(unitId)!.delete(subUnitId);
            return true;
        }

        return false;
    }

    private _initActiveFilterModel() {
        // Subscribe to the active
    }

    private _initModel() {
        const handlerWorkbookAdd = (workbook: Workbook) => {
            const unitId = workbook.getUnitId();
            const worksheets = workbook.getWorksheets();
            worksheets.forEach((worksheet) => {
                const autoFilter = worksheet.getSnapshot().autoFilter;
                if (autoFilter) {
                    const subUnitId = worksheet.getSheetId();
                    const filterModel = FilterModel.deserialize(unitId, subUnitId, worksheet, autoFilter);
                    this._cacheFilterModel(unitId, subUnitId, filterModel);
                }
            });
        };

        this.disposeWithMe(toDisposable(this._univerInstanceService.sheetAdded$.subscribe(handlerWorkbookAdd)));
        this.disposeWithMe(
            this._univerInstanceService.sheetDisposed$.subscribe((workbook: Workbook) => {
                const unitId = workbook.getUnitId();
                const allFilterModels = this._filterModels.get(unitId);
                if (allFilterModels) {
                    allFilterModels.forEach((model) => model.dispose());
                    this._filterModels.delete(unitId);
                }
            })
        );
    }

    private _cacheFilterModel(unitId: string, subUnitId: string, filterModel: FilterModel) {
        if (!this._filterModels.has(unitId)) {
            this._filterModels.set(unitId, new Map());
        }
        this._filterModels.get(unitId)!.set(subUnitId, filterModel);
    }
}
