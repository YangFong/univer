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

import type { IAutoFilter, ICommand, IFilterColumn, IMutationInfo, Nullable } from '@univerjs/core';
import { CommandType, ICommandService, IUndoRedoService, IUniverInstanceService, sequenceExecute } from '@univerjs/core';
import type { ISheetCommandSharedParams } from '@univerjs/sheets';
import { SelectionManagerService } from '@univerjs/sheets';
import type { FilterColumn, IReCalcSheetsFilterMutationParams, ISetSheetsFilterConditionMutationParams, ISetSheetsFilterRangeMutationParams } from '@univerjs/sheets-filter';
import { ReCalcSheetsFilterMutation, RemoveSheetsFilterMutation, SetSheetsFilterConditionMutation, SetSheetsFilterRangeMutation, SheetsFilterService } from '@univerjs/sheets-filter';
import { expandToContinuousRange } from '@univerjs/sheets-ui/commands/commands/utils/selection-utils.js';
import { IMessageService } from '@univerjs/ui';
import type { IAccessor } from '@wendellhu/redi';

/**
 * This command is for toggling filter in the currently active Worksheet.
 */
export const SmartToggleSheetsFilterCommand: ICommand = {
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
            const autoFilter = filterModel?.serialize();
            const undoMutations = destructFilterModel(unitId, subUnitId, autoFilter);
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

export interface ISetSheetsFilterConditionCommandParams extends ISheetCommandSharedParams {
    condition: IFilterColumn;
}
/**
 * This command is for setting filter condition to a column in the targeting `FilterModel`.
 */
export const SetSheetsFilterConditionCommand: ICommand<ISetSheetsFilterConditionCommandParams> = {
    id: 'sheet.command.set-filter-condition',
    type: CommandType.COMMAND,
    handler: async (accessor: IAccessor, params: ISetSheetsFilterConditionCommandParams) => {
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const commandService = accessor.get(ICommandService);
        const undoRedoService = accessor.get(IUndoRedoService);

        const { unitId, subUnitId, condition } = params;

        const filterModel = sheetsFilterService.getFilterModel(unitId, subUnitId);
        if (!filterModel) {
            return false;
        }

        const range = filterModel.getRange();
        if (!range || range.startColumn + condition.colId > range.endColumn) {
            return false;
        }

        const filterColumn = filterModel.getFilterColumn(condition.colId);
        const undoMutation = destructFilterColumn(unitId, subUnitId, condition.colId, filterColumn);
        const redoMutation: IMutationInfo<ISetSheetsFilterConditionMutationParams> = {
            id: SetSheetsFilterConditionMutation.id,
            params: {
                unitId,
                subUnitId,
                colId: condition.colId,
                condition,
            },
        };

        const result = commandService.syncExecuteCommand(redoMutation.id, redoMutation.params);
        if (result) {
            undoRedoService.pushUndoRedo({
                unitID: unitId,
                undoMutations: [undoMutation],
                redoMutations: [redoMutation],
            });
        }

        return result;
    },
};

/**
 * This command is for clearing all filter conditions in the currently active `FilterModel`.
 */
export const ClearSheetsFilterConditionsCommand: ICommand = {
    id: 'sheet.command.clear-filter-conditions',
    type: CommandType.COMMAND,
    handler: (accessor: IAccessor) => {
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const undoRedoService = accessor.get(IUndoRedoService);
        const commandService = accessor.get(ICommandService);

        const currentFilterModel = sheetsFilterService.activeFilterModel;
        if (!currentFilterModel) {
            return false;
        }

        const { unitId, subUnitId } = currentFilterModel;
        const autoFilter = currentFilterModel.serialize();
        const undoMutations = destructFilterConditions(unitId, subUnitId, autoFilter);
        const redoMutations = generateRemoveConditionMutations(unitId, subUnitId, autoFilter);

        const result = sequenceExecute(redoMutations, commandService);
        if (result) {
            undoRedoService.pushUndoRedo({
                unitID: unitId,
                undoMutations,
                redoMutations,
            });
        }

        return true;
    },
};

/**
 * This command force the currently active `FilterModel` to re-calculate all filter conditions.
 */
export const ReCalcSheetsFilterConditionsCommand: ICommand = {
    id: 'sheet.command.re-calc-filter-conditions',
    type: CommandType.COMMAND,
    handler: (accessor: IAccessor) => {
        const sheetsFilterService = accessor.get(SheetsFilterService);
        const commandService = accessor.get(ICommandService);

        const currentFilterModel = sheetsFilterService.activeFilterModel;
        if (!currentFilterModel) {
            return false;
        }

        // No need to handle undo redo for this command.
        const { unitId, subUnitId } = currentFilterModel;
        return commandService.executeCommand(ReCalcSheetsFilterMutation.id, { unitId, subUnitId } as IReCalcSheetsFilterMutationParams);
    },
};

/**
 * Destruct a `FilterModel` to a list of mutations.
 * @param unitId the unit id of the Workbook
 * @param subUnitId the sub unit id of the Worksheet
 * @param autoFilter the to be destructed FilterModel
 * @returns a list of mutations those can be used to reconstruct the FilterModel
 */
function destructFilterModel(
    unitId: string,
    subUnitId: string,
    autoFilter: IAutoFilter
): IMutationInfo[] {
    const mutations: IMutationInfo[] = [];

    const setFilterMutation: IMutationInfo<ISetSheetsFilterRangeMutationParams> = {
        id: SetSheetsFilterRangeMutation.id,
        params: {
            unitId,
            subUnitId,
            range: autoFilter.ref,
        },
    };
    mutations.push(setFilterMutation);

    const conditionMutations = destructFilterConditions(unitId, subUnitId, autoFilter);
    conditionMutations.forEach((m) => mutations.push(m));

    return mutations;
}

export function destructFilterConditions(
    unitId: string,
    subUnitId: string,
    autoFilter: IAutoFilter
): IMutationInfo[] {
    const mutations: IMutationInfo[] = [];

    autoFilter.filterColumns?.forEach((filterColumn) => {
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

/** Generate mutations to remove all conditions on a `FilterModel` */
function generateRemoveConditionMutations(
    unitId: string,
    subUnitId: string,
    autoFilter: IAutoFilter
): IMutationInfo[] {
    const mutations: IMutationInfo[] = [];

    autoFilter.filterColumns?.forEach((filterColumn) => {
        const removeFilterConditionMutation: IMutationInfo<ISetSheetsFilterConditionMutationParams> = {
            id: SetSheetsFilterConditionMutation.id,
            params: {
                unitId,
                subUnitId,
                colId: filterColumn.colId,
                condition: null,
            },
        };
        mutations.push(removeFilterConditionMutation);
    });

    return mutations;
}

/**
 * Prepare the undo mutation, it should rollback to the old condition if there's already a `FilterColumn`,
 * or remove the filter condition when there is no `FilterColumn`.
 * @param unitId
 * @param subUnitId
 * @param colId
 * @param filterColumn
 * @returns the undo mutation
 */
function destructFilterColumn(
    unitId: string,
    subUnitId: string,
    colId: number,
    filterColumn: Nullable<FilterColumn>
): IMutationInfo<ISetSheetsFilterConditionMutationParams> {
    if (!filterColumn) {
        return {
            id: SetSheetsFilterConditionMutation.id,
            params: {
                unitId,
                subUnitId,
                colId,
                condition: null,
            },
        };
    }

    const serialize = filterColumn.serialize();
    return {
        id: SetSheetsFilterConditionMutation.id,
        params: {
            unitId,
            subUnitId,
            colId,
            condition: serialize,
        },
    };
}
