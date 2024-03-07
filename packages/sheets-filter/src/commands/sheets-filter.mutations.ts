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
// `SheetFilterService`.

import { CommandType } from '@univerjs/core';
import type { IFilterColumn, IMutation, IRange } from '@univerjs/core';
import type { ISheetCommandSharedParams } from '@univerjs/sheets';

import { SheetFilterService } from '../services/sheet-filter.service';

export interface ISetSheetFilterMutationParams extends ISheetCommandSharedParams {
    range: IRange;
}
/**
 * Set filter range of a Worksheet.
 */
export const SetSheetFilterRangeMutation: IMutation<ISetSheetFilterMutationParams> = {
    id: 'sheet.mutation.set-filter-range',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { subUnitId, unitId, range } = params;
        const sheetFilterService = accessor.get(SheetFilterService);
        const filterModel = sheetFilterService.ensureFilterModel(unitId, subUnitId);
        filterModel.setRange(range);
        return true;
    },
};

export interface ISetSheetFilterConditionMutationParams extends ISheetCommandSharedParams {
    condition: IFilterColumn;
}
/**
 * Set filter condition of a Worksheet.
 */
export const SetSheetFilterConditionMutation: IMutation<ISetSheetFilterConditionMutationParams> = {
    id: 'sheet.mutation.set-filter-condition',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const { subUnitId, unitId, condition } = params;
        const sheetFilterService = accessor.get(SheetFilterService);

        return true;
    },
};

export interface IRemoveSheetFilterMutationParams extends ISheetCommandSharedParams {

}
export const RemoveSheetFilterMutation: IMutation<IRemoveSheetFilterMutationParams> = {
    id: 'sheet.mutation.remove-filter',
    type: CommandType.MUTATION,
    handler: (accessor, params) => {
        const sheetFilterService = accessor.get(SheetFilterService);
        return true;
    },
};
