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

import type { ICellData, IRange, IWorkbookData, Nullable, Univer } from '@univerjs/core';
import { ICommandService, IUniverInstanceService, LocaleType, Tools } from '@univerjs/core';
import type { Injector } from '@wendellhu/redi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MergeCellController } from '../../../controllers/merge-cell.controller';
import { RefRangeService } from '../../../services/ref-range/ref-range.service';
import { NORMAL_SELECTION_PLUGIN_NAME, SelectionManagerService } from '../../../services/selection-manager.service';
import { AddWorksheetMergeMutation } from '../../mutations/add-worksheet-merge.mutation';
import { MoveRangeMutation } from '../../mutations/move-range.mutation';
import { RemoveWorksheetMergeMutation } from '../../mutations/remove-worksheet-merge.mutation';
import { SetSelectionsOperation } from '../../operations/selection.operation';
import { MoveRangeCommand } from '../move-range.command';
import { SetRangeValuesCommand } from '../set-range-values.command';
import { createCommandTestBed } from './create-command-test-bed';

describe('Test move range commands', () => {
    let univer: Univer;
    let get: Injector['get'];
    let commandService: ICommandService;

    beforeEach(() => {
        const testBed = createInsertRowColTestBed();
        univer = testBed.univer;
        get = testBed.get;
        get(MergeCellController);
        commandService = get(ICommandService);

        [
            AddWorksheetMergeMutation,
            RemoveWorksheetMergeMutation,
            SetRangeValuesCommand,
            MoveRangeCommand,
            MoveRangeMutation,
            SetSelectionsOperation,
        ].forEach((c) => commandService.registerCommand(c));
        const selectionManagerService = get(SelectionManagerService);
        selectionManagerService.setCurrentSelection({
            pluginName: NORMAL_SELECTION_PLUGIN_NAME,
            unitId: 'test',
            sheetId: 'sheet1',
        });
    });

    afterEach(() => univer.dispose());

    describe('move range', () => {
        it('move c2:d2 to g5', async () => {
            const fromRange: IRange = {
                startRow: 1,
                endRow: 1,
                startColumn: 2,
                endColumn: 3,
            };
            const toRange: IRange = {
                startRow: 1,
                endRow: 1,
                startColumn: 6,
                endColumn: 6,
            };
            const result = await commandService.executeCommand(MoveRangeCommand.id, { fromRange, toRange });
            expect(result).toBeTruthy();
            const mergeCell = getMergedInfo(1, 6);
            expect(getMergeData().length).toBe(2);
            expect(mergeCell).toEqual({ startRow: 1, endRow: 1, startColumn: 6, endColumn: 7 });
        });

        it('move a1 to c2 ', async () => {
            const fromRange: IRange = {
                startRow: 0,
                endRow: 0,
                startColumn: 0,
                endColumn: 0,
            };
            const toRange: IRange = {
                startRow: 1,
                endRow: 1,
                startColumn: 2,
                endColumn: 2,
            };
            const result = await commandService.executeCommand(MoveRangeCommand.id, { fromRange, toRange });
            expect(result).toBeFalsy();
        });

        it('move a1 to c2 ,should be stopped', async () => {
            const fromRange: IRange = {
                startRow: 0,
                endRow: 0,
                startColumn: 0,
                endColumn: 0,
            };
            const toRange: IRange = {
                startRow: 1,
                endRow: 1,
                startColumn: 2,
                endColumn: 2,
            };
            const result = await commandService.executeCommand(MoveRangeCommand.id, { fromRange, toRange });
            expect(result).toBeFalsy();
        });

        it('move c1:d2 to c3 ,should be replace', async () => {
            const fromRange: IRange = {
                startRow: 0,
                endRow: 1,
                startColumn: 2,
                endColumn: 3,
            };
            const toRange: IRange = {
                startRow: 2,
                endRow: 3,
                startColumn: 2,
                endColumn: 3,
            };
            const result = await commandService.executeCommand(MoveRangeCommand.id, { fromRange, toRange });
            expect(result).toBeTruthy();
            const mergeData = getMergeData();
            expect(mergeData.length).toBe(1);
            expect(mergeData[0]).toEqual({ startRow: 3, endRow: 3, startColumn: 2, endColumn: 3 });
        });
    });

    function getCellInfo(row: number, col: number): Nullable<ICellData> {
        const currentService = get(IUniverInstanceService);
        const workbook = currentService.getCurrentUniverSheetInstance();
        const worksheet = workbook.getActiveSheet();
        return worksheet.getCellMatrix().getValue(row, col);
    }

    function getMergedInfo(row: number, col: number): Nullable<IRange> {
        const currentService = get(IUniverInstanceService);
        const workbook = currentService.getCurrentUniverSheetInstance();
        const worksheet = workbook.getActiveSheet();
        return worksheet.getMergedCells(row, col)?.[0];
    }
    function getMergeData() {
        const currentService = get(IUniverInstanceService);
        const workbook = currentService.getCurrentUniverSheetInstance();
        const worksheet = workbook.getActiveSheet();
        return worksheet.getMergeData();
    }
});

const TEST_ROW_COL_INSERTION_DEMO: IWorkbookData = {
    id: 'test',
    appVersion: '3.0.0-alpha',
    sheets: {
        // 1
        //  2-3-
        // 	4
        //  |
        sheet1: {
            id: 'sheet1',
            cellData: {
                '0': {
                    '0': {
                        v: 'A1',
                        s: 's1',
                    },
                },
                '1': {
                    '1': {
                        v: 'B2',
                        s: 's2',
                    },
                    '4': {
                        v: 'E2',
                        s: 's3',
                    },
                },
                '2': {
                    '1': {
                        v: 'B3',
                        s: 's4',
                    },
                },
            },
            mergeData: [
                { startRow: 1, endRow: 1, startColumn: 2, endColumn: 3 },
                {
                    startRow: 2,
                    endRow: 3,
                    startColumn: 2,
                    endColumn: 2,
                },
            ],
            rowCount: 20,
            columnCount: 20,
        },
    },
    locale: LocaleType.ZH_CN,
    name: '',
    sheetOrder: [],
    styles: {},
};

function createInsertRowColTestBed() {
    return createCommandTestBed(Tools.deepClone(TEST_ROW_COL_INSERTION_DEMO), [
        [MergeCellController],
        [RefRangeService],
    ]);
}
