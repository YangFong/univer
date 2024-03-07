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

import { FilterModel } from '../models/filter-model';

const FILTER_SNAPSHOT_KEY = 'autoFilter';

/**
 * This service is responsible for managing filter models, especially their lifecycle.
 */
@OnLifecycle(LifecycleStages.Starting, SheetFilterService)
export class SheetFilterService extends Disposable {
    private readonly _filterModels = new Map<string, Map<string, FilterModel>>();

    constructor(
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService,
        @ILogService private _logService: ILogService
    ) {
        super();

        this._initModel();
    }

    /**
     *
     * @param unitId
     * @param subUnitId
     */
    ensureFilterModel(unitId: string, subUnitId: string): FilterModel {

    }

    getFilterModel(unitId: string, subUnitId: string): Nullable<FilterModel> {
        return this._filterModels.get(unitId)?.get(subUnitId) ?? null;
    }

    private _initModel() {
        const handlerWorkbookAdd = (workbook: Workbook) => {
            const unitId = workbook.getUnitId();
            const worksheets = workbook.getWorksheets();
            worksheets.forEach((worksheet) => {
                const autoFilter = worksheet.getSnapshot().autoFilter;
                if (autoFilter) {
                    const subUnitId = worksheet.getSheetId();
                    this._logService.warn('[SheetFilterService]: autoFilter is not null, but not implemented yet.');
                    const filterModel = FilterModel.deserialize(unitId, subUnitId, worksheet, autoFilter);
                    this._initFilterModel(unitId, subUnitId, filterModel);
                }
            });
        };

        this.disposeWithMe(toDisposable(this._univerInstanceService.sheetAdded$.subscribe(handlerWorkbookAdd)));
        this.disposeWithMe(
            this._univerInstanceService.sheetDisposed$.subscribe((workbook: Workbook) => {
                // TODO@wzhudev: clear all filter model of this workbook
            })
        );
    }

    private _initFilterModel(unitId: string, subUnitId: string, filterModel: FilterModel) {
        if (!this._filterModels.has(unitId)) {
            this._filterModels.set(unitId, new Map());
        }
        this._filterModels.get(unitId)!.set(subUnitId, filterModel);
    }
}
