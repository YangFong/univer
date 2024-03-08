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

import type { ICommand, IMutationInfo } from '@univerjs/core';
import { CommandType, ICommandService, IUndoRedoService, IUniverInstanceService } from '@univerjs/core';
import { SelectionManagerService } from '@univerjs/sheets';
import type { FilterModel, ISetSheetsFilterConditionMutationParams, ISetSheetsFilterRangeMutationParams } from '@univerjs/sheets-filter';
import { RemoveSheetsFilterMutation, SetSheetsFilterConditionMutation, SetSheetsFilterRangeMutation, SheetsFilterService } from '@univerjs/sheets-filter';
import { expandToContinuousRange } from '@univerjs/sheets-ui/commands/commands/utils/selection-utils.js';
import { IMessageService } from '@univerjs/ui';
import type { IAccessor } from '@wendellhu/redi';

export const SmartToggleFilterCommand: ICommand = {
    id: 'sheet.command.smart-toggle-filter',
    type: CommandType.COMMAND,
    handler: async (accessor: IAccessor) => {
        const univerInstanceService = accessor.get(IUniverInstanceService);
        const messageService = accessor.get(IMessageService);
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const commandService = accessor.get(ICommandService);
        const undoRedoService = accessor.get(IUndoRedoService);

        const currentWorkbook = univerInstanceService.getCurrentUniverSheetInstance();
        const currentWorksheet = currentWorkbook.getActiveSheet();

        const unitId = currentWorkbook.getUnitId();
        const subUnitId = currentWorksheet.getSheetId();

        // If there is a filter model, we should remove it and prepare undo redo.
        const filterModel = sheetsFilterService.getFilterModel(unitId, subUnitId);
        if (filterModel) {
            const undoMutations = destructFilterModelToMutations(unitId, subUnitId, filterModel);
            const result = commandService.syncExecuteCommand(RemoveSheetsFilterMutation.id, { unitId, subUnitId });
            if (result) {
                undoRedoService.pushUndoRedo({
                    unitID: unitId,
                    undoMutations,
                    redoMutations: [{ id: RemoveSheetsFilterMutation.id, params: { unitId, subUnitId } }],
                });
            }

            return result;
        }

        // If there is no filter model, we should create a new filter according to the current selection.
        // If there is single cell, we should
        const selectionManager = accessor.get(SelectionManagerService);
        const lastSelection = selectionManager.getLast();
        if (!lastSelection) {
            return false;
        }

        const startRange = lastSelection.range;
        const targetFilterRange = expandToContinuousRange(startRange, { left: true, right: true, up: true, down: true }, currentWorksheet);

        // If the target filter range is a single cell (merged cell is also a single cell), we should show a warning message.
        // if () {
        //     messageService.show({
        //         type: MessageType.Warning,
        //         content: '',
        //     });

        //     return false;
        // }

        // NOTE@wzhudev: we should check permission on this worksheet

        // Finally, we should create a new filter model and prepare undo redo.
        const redoMutation = { id: SetSheetsFilterRangeMutation.id, params: { unitId, subUnitId, range: targetFilterRange } };
        const result = commandService.syncExecuteCommand(redoMutation.id, redoMutation.params);
        if (result) {
            undoRedoService.pushUndoRedo({
                unitID: unitId,
                undoMutations: [{ id: RemoveSheetsFilterMutation.id, params: { unitId, subUnitId } }],
                redoMutations: [redoMutation],
            });
        }

        return result;
    },
};

export const ClearFilterConditionsCommand: ICommand = {
    id: 'sheet.command.clear-filter-conditions',
    type: CommandType.COMMAND,
    handler: () => true,
};

export const ReCalcFilterConditionsCommand: ICommand = {
    id: 'sheet.command.re-calc-filter-conditions',
    type: CommandType.COMMAND,
    handler: () => true,
};

/**
 * Destruct a `FilterModel` to a list of mutations.
 * @param unitId the unit id of the Workbook
 * @param subUnitId the sub unit id of the Worksheet
 * @param filterModel the to be destructed FilterModel
 * @returns a list of mutations those can be used to reconstruct the FilterModel
 */
function destructFilterModelToMutations(
    unitId: string,
    subUnitId: string,
    filterModel: FilterModel
): IMutationInfo[] {
    const serialized = filterModel.serialize();
    const mutations: IMutationInfo[] = [];

    const setFilterMutation: IMutationInfo<ISetSheetsFilterRangeMutationParams> = {
        id: SetSheetsFilterRangeMutation.id,
        params: {
            unitId,
            subUnitId,
            range: serialized.ref,
        },
    };
    mutations.push(setFilterMutation);

    serialized.filterColumns?.forEach((filterColumn) => {
        const setFilterConditionMutation: IMutationInfo<ISetSheetsFilterConditionMutationParams> = {
            id: SetSheetsFilterConditionMutation.id,
            params: {
                unitId,
                subUnitId,
                colId: filterColumn.colId,
                condition: filterColumn,
            },
        };
        mutations.push(setFilterConditionMutation);
    });

    return mutations;
}
