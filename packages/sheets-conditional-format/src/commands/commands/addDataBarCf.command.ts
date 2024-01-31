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

import type { ICommand, IRange } from '@univerjs/core';
import {
    CommandType,
    IUniverInstanceService,
} from '@univerjs/core';
import { ConditionalFormatRuleModel } from '../../models/conditional-format-rule-model';
import type { IConditionFormatRule, IDataBar } from '../../models/type';
import { RuleType } from '../../base/const';

interface IAddUniqueValuesConditionalRuleParams {
    ranges: IRange[];
    stopIfTrue?: boolean;
    min: IDataBar['config']['min'];
    max: IDataBar['config']['max'];
    nativeColor: IDataBar['config']['nativeColor'];
    positiveColor: IDataBar['config']['positiveColor'];
    isGradient: IDataBar['config']['isGradient'];

}
export const addDataBarConditionalRuleCommand: ICommand<IAddUniqueValuesConditionalRuleParams> = {
    type: CommandType.COMMAND,
    id: 'sheet.command.add-data-bar-conditional-rule',
    handler(accessor, params) {
        if (!params) {
            return false;
        }
        const { ranges, min, max, nativeColor, positiveColor, isGradient, stopIfTrue } = params;
        const conditionalFormatRuleModel = accessor.get(ConditionalFormatRuleModel);
        const univerInstanceService = accessor.get(IUniverInstanceService);
        const workbook = univerInstanceService.getCurrentUniverSheetInstance();
        const worksheet = workbook.getActiveSheet();
        const unitID = workbook.getUnitId();
        const sheetId = worksheet.getSheetId();
        const cfId = conditionalFormatRuleModel.createCfId(unitID, sheetId);
        const rule: IConditionFormatRule = { ranges, cfId, stopIfTrue: !!stopIfTrue,
                                             rule: {
                                                 type: RuleType.dataBar,
                                                 config: {
                                                     min, max, nativeColor, positiveColor, isGradient,
                                                 },
                                             } };
        conditionalFormatRuleModel.addRule(unitID, sheetId, rule);
        return true;
    },
};
