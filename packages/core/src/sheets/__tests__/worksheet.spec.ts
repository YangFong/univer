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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Univer } from '../../basics/univer';
import type { IWorkbookData } from '../../types/interfaces/i-workbook-data';
import { LocaleType } from '../../types/enum/locale-type';
import type { Worksheet } from '../worksheet';
import { type IRange, RANGE_TYPE } from '../../types/interfaces/i-range';
import { DisposableCollection } from '../../shared/lifecycle';
import { createCoreTestBed } from './create-core-test-bed';

describe('Test worksheet', () => {
    let univer: Univer;
    let worksheet: Worksheet;
    let caseDisposable: DisposableCollection;

    function prepare(workbookData?: IWorkbookData) {
        const testBed = createCoreTestBed(workbookData);
        univer = testBed.univer;
        worksheet = testBed.sheet.getActiveSheet();
    }

    afterEach(() => {
        univer.dispose();
        caseDisposable.dispose();
    });

    describe('Test "worksheet.iterateByRow"', () => {
        const TEST_WORKBOOK_DATA_WITH_MERGED_CELL: IWorkbookData = {
            id: 'test',
            appVersion: '3.0.0-alpha',
            sheets: {
                sheet1: {
                    id: 'sheet1',
                    mergeData: [
                        { startRow: 0, endRow: 0, startColumn: 1, endColumn: 2 },
                    ],
                    cellData: {
                        0: {
                            0: {
                                v: 'A1',
                            },
                            1: {
                                v: 'B1:C1',
                            },
                        },
                        1: {
                            // should skip over empty cells
                            // 0: {
                            //     v: 'A1',
                            // },
                            1: {
                                v: 'B2',
                            },
                            2: {
                                v: 'C2',
                            },
                        },
                    },
                },
            },
            locale: LocaleType.ZH_CN,
            name: 'TEST_WORKBOOK_DATA_WITH_MERGED_CELL',
            sheetOrder: ['sheet1'],
            styles: {},
        };

        beforeEach(() => {
            prepare(TEST_WORKBOOK_DATA_WITH_MERGED_CELL);
            caseDisposable = new DisposableCollection();
        });

        it('Should "iteratorByRow" work with merged cells', () => {
            // This interceptor just returns the raw cell data.
            worksheet.__interceptViewModel((viewModel) => {
                const cellInterceptorDisposable = viewModel.registerCellContentInterceptor({
                    getCell(row, col) {
                        return worksheet.getCellRaw(row, col);
                    },
                });

                caseDisposable.add(cellInterceptorDisposable);
            });

            const range: IRange = { startRow: 0, startColumn: 0, endRow: 1, endColumn: 2, rangeType: RANGE_TYPE.NORMAL };
            const iterator1 = worksheet.iterateByRow(range);

            const value1 = iterator1.next();
            expect(value1.done).toBeFalsy();
            expect(value1.value.value).toEqual({ v: 'A1' });

            const value2 = iterator1.next();
            expect(value2.done).toBeFalsy();
            expect(value2.value.value).toEqual({ v: 'B1:C1' });

            const value3 = iterator1.next();
            expect(value3.done).toBeFalsy();
            expect(value3.value.value).toEqual({ v: 'B2' });

            const value4 = iterator1.next();
            expect(value4.done).toBeFalsy();
            expect(value4.value.value).toEqual({ v: 'C2' });

            const value5 = iterator1.next();
            expect(value5.done).toBeTruthy();
            expect(value5.value).toBeUndefined();
        });
    });

    describe('Test "worksheet.iterateByColumn"', () => {
        const TEST_WORKBOOK_DATA_WITH_MERGED_CELL: IWorkbookData = {
            id: 'test',
            appVersion: '3.0.0-alpha',
            sheets: {
                sheet1: {
                    id: 'sheet1',
                    mergeData: [
                        { startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 },
                    ],
                    cellData: {
                        0: {
                            0: {
                                v: 'A1:B2',
                            },
                            2: {
                                v: 'C1',
                            },
                        },
                        1: {

                            2: {
                                v: 'C2',
                            },
                        },
                        2: {
                            0: {
                                v: 'A3',
                            },
                            1: {
                                v: 'B3',
                            },
                        },
                    },
                },
            },
            locale: LocaleType.ZH_CN,
            name: 'TEST_WORKBOOK_DATA_WITH_MERGED_CELL',
            sheetOrder: ['sheet1'],
            styles: {},
        };

        beforeEach(() => {
            prepare(TEST_WORKBOOK_DATA_WITH_MERGED_CELL);
            caseDisposable = new DisposableCollection();
        });

        it('Should "iterateByColumn" work with merged cells', () => {
            // This interceptor just returns the raw cell data.
            worksheet.__interceptViewModel((viewModel) => {
                const cellInterceptorDisposable = viewModel.registerCellContentInterceptor({
                    getCell(row, col) {
                        return worksheet.getCellRaw(row, col);
                    },
                });

                caseDisposable.add(cellInterceptorDisposable);
            });

            const range: IRange = { startRow: 0, startColumn: 0, endRow: 2, endColumn: 2, rangeType: RANGE_TYPE.NORMAL };
            const iterator1 = worksheet.iterateByColumn(range);

            const value1 = iterator1.next();
            expect(value1.done).toBeFalsy();
            expect(value1.value.value).toEqual({ v: 'A1:B2' });

            const value2 = iterator1.next();
            expect(value2.done).toBeFalsy();
            expect(value2.value.value).toEqual({ v: 'A3' });

            const value3 = iterator1.next();
            expect(value3.done).toBeFalsy();
            expect(value3.value.value).toEqual({ v: 'B3' });

            const value4 = iterator1.next();
            expect(value4.done).toBeFalsy();
            expect(value4.value.value).toEqual({ v: 'C1' });

            const value5 = iterator1.next();
            expect(value5.done).toBeFalsy();
            expect(value5.value.value).toEqual({ v: 'C2' });

            const value6 = iterator1.next();
            expect(value6.done).toBeTruthy();
            expect(value6.value).toBeUndefined();
        });
    });
});
