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

// This file provides a ton of mutations to manipulate `FilterModel`. These models would be held on
// `SheetsFilterService`.

import { CommandType } from '@univerjs/core';
import type { IFilterColumn, IMutation, IRange, Nullable } from '@univerjs/core';
import type { ISheetCommandSharedParams } from '@univerjs/sheets';

import { SheetsFilterService } from '../services/sheet-filter.service';

export interface ISetSheetsFilterRangeMutationParams extends ISheetCommandSharedParams {
    range: IRange;
}

/**
 * Set filter range in a Worksheet. If the `FilterModel` does not exist, it will be created.
 */
export const SetSheetsFilterRangeMutation: IMutation<ISetSheetsFilterRangeMutationParams> = {
    id: 'sheet.mutation.set-filter-range',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { subUnitId, unitId, range } = params;
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const filterModel = sheetsFilterService.ensureFilterModel(unitId, subUnitId);
        filterModel.setRange(range);
        return true;
    },
};

export interface ISetSheetsFilterConditionMutationParams extends ISheetCommandSharedParams {
    colId: number;
    condition: Nullable<IFilterColumn>;
}
/**
 * Set filter condition of a Worksheet.
 */
export const SetSheetsFilterConditionMutation: IMutation<ISetSheetsFilterConditionMutationParams> = {
    id: 'sheet.mutation.set-filter-condition',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { subUnitId, unitId, condition, colId } = params;
        const sheetsFilterService = accessor.get(SheetsFilterService);

        const filterModel = sheetsFilterService.getFilterModel(unitId, subUnitId);
        if (!filterModel) {
            return false;
        }

        filterModel.setCondition(colId, condition);
        return true;
    },
};

export interface IRemoveSheetsFilterMutationParams extends ISheetCommandSharedParams {}
export const RemoveSheetsFilterMutation: IMutation<IRemoveSheetsFilterMutationParams> = {
    id: 'sheet.mutation.remove-filter',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { unitId, subUnitId } = params;
        const sheetsFilterService = accessor.get(SheetsFilterService);
        return sheetsFilterService.removeFilterModel(unitId, subUnitId);
    },
};

export interface IReCalcSheetsFilterMutation extends ISheetCommandSharedParams {}
export const ReCalcSheetsFilterMutation: IMutation<IReCalcSheetsFilterMutation> = {
    id: 'sheet.mutation.re-calc-filter',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { unitId, subUnitId } = params;
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const filterModel = sheetsFilterService.getFilterModel(unitId, subUnitId);
        if (!filterModel) {
            return false;
        }

        filterModel.reCalc();
        return true;
    },
};
