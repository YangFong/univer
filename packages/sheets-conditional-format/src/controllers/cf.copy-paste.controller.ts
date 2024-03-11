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

import type { IRange, Nullable } from '@univerjs/core';
import {
    Disposable,
    IUniverInstanceService,
    LifecycleStages,
    ObjectMatrix,
    OnLifecycle,
    Range,
    Rectangle,
    Tools,
} from '@univerjs/core';
import {
    createTopMatrixFromMatrix, findAllRectangle,
} from '@univerjs/sheets';
import { COPY_TYPE, getRepeatRange, ISheetClipboardService, PREDEFINED_HOOK_NAME } from '@univerjs/sheets-ui';
import { Inject, Injector } from '@wendellhu/redi';
import { SHEET_CONDITION_FORMAT_PLUGIN } from '../base/const';
import { ConditionalFormatViewModel } from '../models/conditional-format-view-model';
import { ConditionalFormatRuleModel } from '../models/conditional-format-rule-model';
import type { IConditionalFormatRuleConfig, IConditionFormatRule } from '../models/type';
import type { IAddConditionalRuleMutationParams } from '../commands/mutations/addConditionalRule.mutation';
import { addConditionalRuleMutation, addConditionalRuleMutationUndoFactory } from '../commands/mutations/addConditionalRule.mutation';
import type { IDeleteConditionalRuleMutationParams } from '../commands/mutations/deleteConditionalRule.mutation';
import { deleteConditionalRuleMutation, deleteConditionalRuleMutationUndoFactory } from '../commands/mutations/deleteConditionalRule.mutation';
import type { ISetConditionalRuleMutationParams } from '../commands/mutations/setConditionalRule.mutation';
import { setConditionalRuleMutation, setConditionalRuleMutationUndoFactory } from '../commands/mutations/setConditionalRule.mutation';

@OnLifecycle(LifecycleStages.Rendered, ConditionalFormatCopyPasteController)
export class ConditionalFormatCopyPasteController extends Disposable {
    private _copyInfo: Nullable<{
        matrix: ObjectMatrix<string[]>;
        info: {
            unitId: string;
            subUnitId: string;
            cfMap: Record<string, IConditionalFormatRuleConfig>;
        };
    }>;

    constructor(
        @Inject(ISheetClipboardService) private _sheetClipboardService: ISheetClipboardService,
        @Inject(ConditionalFormatRuleModel) private _conditionalFormatRuleModel: ConditionalFormatRuleModel,
        @Inject(Injector) private _injector: Injector,
        @Inject(ConditionalFormatViewModel) private _conditionalFormatViewModel: ConditionalFormatViewModel,

        @Inject(IUniverInstanceService) private _univerInstanceService: IUniverInstanceService
    ) {
        super();
        this._initClipboardHook();
    }

    private _initClipboardHook() {
        this.disposeWithMe(
            this._sheetClipboardService.addClipboardHook({
                id: SHEET_CONDITION_FORMAT_PLUGIN,
                onBeforeCopy: (unitId, subUnitId, range) => this._collectConditionalRule(unitId, subUnitId, range),
                onPasteCells: (pasteFrom, pasteTo, data, payload) => {
                    const { copyType = COPY_TYPE.COPY, pasteType } = payload;
                    const { range: copyRange } = pasteFrom || {};
                    const { range: pastedRange } = pasteTo;
                    return this._generateConditionalFormatMutations(pastedRange, { copyType, pasteType, copyRange });
                },
            })
        );
    }

    private _collectConditionalRule(unitId: string, subUnitId: string, range: IRange) {
        const matrix = new ObjectMatrix<string[]>();
        const cfMap: Record<string, IConditionalFormatRuleConfig> = {};
        this._copyInfo = {
            matrix,
            info: {
                unitId,
                subUnitId,
                cfMap,
            },
        };
        const model = this._conditionalFormatViewModel.getMatrix(unitId, subUnitId);
        if (!model) {
            return;
        }
        const cfIdSet: Set<string> = new Set();
        Range.foreach(range, (row, col) => {
            const cellCfList = this._conditionalFormatViewModel.getCellCf(unitId, subUnitId, row, col, model);
            if (!cellCfList) {
                return;
            }
            const relativeRange = Rectangle.getRelativeRange(
                {
                    startRow: row,
                    endRow: row,
                    startColumn: col,
                    endColumn: col,
                },
                range
            );
            cellCfList.cfList.forEach((item) => cfIdSet.add(item.cfId));
            matrix.setValue(relativeRange.startRow, relativeRange.startColumn, cellCfList.cfList.map((item) => item.cfId));
        });
        cfIdSet.forEach((cfId) => {
            const rule = this._conditionalFormatRuleModel.getRule(unitId, subUnitId, cfId);
            if (rule) {
                cfMap[cfId] = rule.rule;
            }
        });
    }

    private _generateConditionalFormatMutations(
        pastedRange: IRange,
        copyInfo: {
            copyType: COPY_TYPE;
            copyRange?: IRange;
            pasteType: string;
        }
    ) {
        const workbook = this._univerInstanceService.getCurrentUniverSheetInstance();
        const sheet = workbook.getActiveSheet();
        const unitId = workbook.getUnitId();
        const subUnitId = sheet.getSheetId();
        if (copyInfo.copyType === COPY_TYPE.CUT) {
            // This do not need to deal with clipping.
            // move range had handle this case .
            // to see cf.ref-range.controller.ts
            this._copyInfo = null;
            return { redos: [], undos: [] };
        }
        if (!this._copyInfo || !copyInfo.copyRange) {
            return { redos: [], undos: [] };
        }

        if (
            [PREDEFINED_HOOK_NAME.SPECIAL_PASTE_COL_WIDTH, PREDEFINED_HOOK_NAME.SPECIAL_PASTE_VALUE].includes(
                copyInfo.pasteType
            )
        ) {
            return { redos: [], undos: [] };
        }
        const repeatRange = getRepeatRange(copyInfo.copyRange, pastedRange, true);
        const model = this._conditionalFormatViewModel.getMatrix(unitId, subUnitId);
        const effectedConditionalFormatRuleMatrix: Record<string, ObjectMatrix<1>> = {};
        Range.foreach(pastedRange, (row, col) => {
            const cellCfList = this._conditionalFormatViewModel.getCellCf(unitId, subUnitId, row, col, model!);
            if (cellCfList) {
                cellCfList.cfList.forEach((item) => {
                    if (!effectedConditionalFormatRuleMatrix[item.cfId]) {
                        const ruleMatrix = new ObjectMatrix<1>();
                        effectedConditionalFormatRuleMatrix[item.cfId] = ruleMatrix;
                        const rule = this._conditionalFormatRuleModel.getRule(unitId, subUnitId, item.cfId);
                        rule?.ranges.forEach((range) => {
                            Range.foreach(range, (row, col) => {
                                ruleMatrix.setValue(row, col, 1);
                            });
                        });
                    }
                    effectedConditionalFormatRuleMatrix[item.cfId].realDeleteValue(row, col);
                });
            }
        });

        const { matrix, info } = this._copyInfo;
        const waitAddRule: IConditionFormatRule[] = [];
        let nextCfId = this._conditionalFormatRuleModel.createCfId(unitId, subUnitId);
        const cacheCfIdMap: Record<string, IConditionFormatRule> = {};
        /**
         used to match the conditional format in the current worksheet with the same conditional format
         configuration in the copy range, and if this worksheet does not exist,
         a new cf is created based on the current worksheet.
         */
        const getCurrentSheetCfRule = (copyRangeCfId: string) => {
            if (cacheCfIdMap[copyRangeCfId]) {
                return cacheCfIdMap[copyRangeCfId];
            }
            const oldRule = info?.cfMap[copyRangeCfId];
            const targetRule = [...(this._conditionalFormatRuleModel.getSubunitRules(unitId, subUnitId) || []), ...waitAddRule].find((rule) => {
                return Tools.diffValue(rule.rule, oldRule);
            });
            if (targetRule) {
                cacheCfIdMap[copyRangeCfId] = targetRule;
                return targetRule;
            } else {
                const rule: IConditionFormatRule = {
                    rule: oldRule,
                    cfId: nextCfId,
                    ranges: [],
                    stopIfTrue: false,
                };
                cacheCfIdMap[copyRangeCfId] = rule;
                waitAddRule.push(rule);
                nextCfId = `${Number(nextCfId) + 1}`;
                return rule;
            }
        };

        repeatRange.forEach((item) => {
            matrix &&
            matrix.forValue((row, col, copyRangeCfIdList) => {
                const range = Rectangle.getPositionRange(
                    {
                        startRow: row,
                        endRow: row,
                        startColumn: col,
                        endColumn: col,
                    },
                    item.startRange
                );

                const _row = range.startRow;
                const _col = range.startColumn;
                copyRangeCfIdList.forEach((cfId) => {
                    if (!effectedConditionalFormatRuleMatrix[cfId]) {
                        const rule = getCurrentSheetCfRule(cfId);
                        const ruleMatrix = new ObjectMatrix<1>();
                        effectedConditionalFormatRuleMatrix[cfId] = ruleMatrix;
                        rule.ranges.forEach((range) => {
                            Range.foreach(range, (row, col) => {
                                ruleMatrix.setValue(row, col, 1);
                            });
                        });
                    }
                    effectedConditionalFormatRuleMatrix[cfId].setValue(_row, _col, 1);
                });
            });
        });
        const redos = [];
        const undos = [];
        for (const cfId in effectedConditionalFormatRuleMatrix) {
            const matrix = effectedConditionalFormatRuleMatrix[cfId];
            const ranges = findAllRectangle(createTopMatrixFromMatrix(matrix));
            if (!ranges.length) {
                const deleteParams: IDeleteConditionalRuleMutationParams = {
                    unitId, subUnitId, cfId,
                };
                redos.push({ id: deleteConditionalRuleMutation.id, params: deleteParams });
                undos.push(...deleteConditionalRuleMutationUndoFactory(this._injector, deleteParams));
            }
            if (waitAddRule.some((rule) => rule.cfId === cfId)) {
                const rule = getCurrentSheetCfRule(cfId);
                const addParams: IAddConditionalRuleMutationParams = {
                    unitId, subUnitId, rule: { ...rule, ranges },
                };
                redos.push({ id: addConditionalRuleMutation.id, params: addParams });
                undos.push(addConditionalRuleMutationUndoFactory(this._injector, addParams));
            } else {
                const rule = this._conditionalFormatRuleModel.getRule(unitId, subUnitId, cfId);
                if (!rule) {
                    continue;
                }
                const setParams: ISetConditionalRuleMutationParams = {
                    unitId, subUnitId, rule: { ...rule, ranges },
                };
                redos.push({ id: setConditionalRuleMutation.id, params: setParams });
                undos.push(...setConditionalRuleMutationUndoFactory(this._injector, setParams));
            }
        }
        return {
            redos,
            undos,
        };
    }
}
