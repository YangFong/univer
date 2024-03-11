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

import { ColorKit, ObjectMatrix, Range } from '@univerjs/core';
import { isObject } from '@univerjs/engine-render';
import { RuleType } from '../../base/const';
import type { IColorScale, IConditionFormatRule } from '../../models/type';
import { ConditionalFormatFormulaService, FormulaResultStatus } from '../conditional-format-formula.service';
import { getCellValue, getValueByType, isNullable } from './utils';
import type { ICalculateUnit } from './type';

interface IRgbColor {
    b: number;

    g: number;

    r: number;

    a?: number;
}

const handleRgbA = (rgb: IRgbColor): Required<IRgbColor> => {
    if (rgb.a !== undefined) {
        return rgb as Required<IRgbColor>;
    } else {
        return { ...rgb, a: 1 };
    }
};

const emptyStyle = '';

export const colorScaleCellCalculateUnit: ICalculateUnit = {
    type: RuleType.colorScale,
    handle: async (rule: IConditionFormatRule, context) => {
        const ruleConfig = rule.rule as IColorScale;
        const conditionalFormatFormulaService = context.accessor.get(ConditionalFormatFormulaService);
        const { worksheet } = context;
        const matrix = new ObjectMatrix< number>();
        rule.ranges.forEach((range) => {
            Range.foreach(range, (row, col) => {
                const cell = worksheet?.getCellRaw(row, col);
                const v = cell && getCellValue(cell);
                if (!isNullable(v)) {
                    const _value = Number(v);
                    !Number.isNaN(_value) && matrix.setValue(row, col, _value);
                }
            });
        });

        const computeResult = new ObjectMatrix< string >();
        rule.ranges.forEach((range) => {
            Range.foreach(range, (row, col) => {
                computeResult.setValue(row, col, emptyStyle);
            });
        });

        const _colorList = [...ruleConfig.config].sort((a, b) => a.index - b.index).map((config) => {
            return {
                value: getValueByType(config.value, matrix, { ...context, cfId: rule.cfId }), color: new ColorKit(config.color),
            };
        });
         // If the formula triggers the calculation, wait for the result,
         // and use the previous style cache until the result comes out
        const isFormulaWithoutSuccess = _colorList.some((item) => isObject(item.value) ? item.value.status !== FormulaResultStatus.SUCCESS : false);
        if (isFormulaWithoutSuccess) {
            return conditionalFormatFormulaService.getCache(context.unitId, context.subUnitId, rule.cfId) ?? computeResult;
        }

        const colorList = _colorList.map((item) => {
            return { ...item, value: isObject(item.value) ? Number(item.value.result) ?? 0 : item.value ?? 0 };
        });

        const isNotValid = colorList.some((item, index) => {
            if (index + 1 < colorList.length) {
                const next = colorList[index + 1];
                if (!item.color.isValid) {
                    return true;
                }
                if (isNullable(item.value) || isNullable(next.value)) {
                    return next.value;
                }
                if (item.value >= next.value) {
                    return true;
                }
            }
            return false;
        }) || colorList.length <= 1;
        if (isNotValid) {
            return computeResult;
        }

        matrix.forValue((row, col, value) => {
            const index = colorList.findIndex((item) => item.value >= value);
            const preIndex = index - 1;
            if (index === 0) {
                computeResult.setValue(row, col, colorList[0].color.toRgbString());
            } else if (preIndex >= 0) {
                const minItem = colorList[preIndex];
                const maxItem = colorList[index];

                if (minItem.color.isValid && maxItem.color.isValid) {
                    const minRgb = handleRgbA(minItem.color.toRgb());
                    const maxRgb = handleRgbA(maxItem.color.toRgb());
                    const length = maxItem.value - minItem.value;
                    const v = (value - minItem.value) / length;
                    const rgbResult = ['r', 'g', 'b', 'a'].reduce((obj, key) => {
                        const minV = minRgb[key as unknown as keyof IRgbColor];
                        obj[key as unknown as keyof IRgbColor] = (maxRgb[key as unknown as keyof IRgbColor] - minV) * v + minV;
                        return obj;
                    }, {} as IRgbColor);
                    const result = new ColorKit(rgbResult).toRgbString();
                    computeResult.setValue(row, col, result);
                }
            } else {
                computeResult.setValue(row, col, colorList[colorList.length - 1].color.toRgbString());
            }
        });
        return computeResult;
    },

};
