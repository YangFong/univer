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

import { describe, expect, it } from 'vitest';

import { FUNCTION_NAMES_INFORMATION } from '../../function-names';
import { ArrayValueObject, transformToValue, transformToValueObject } from '../../../../engine/value-object/array-value-object';
import { ErrorType } from '../../../../basics/error-type';
import { Isnumber } from '..';
import { NumberValueObject } from '../../../../engine/value-object/primitive-object';

describe('Test isnumber function', () => {
    const textFunction = new Isnumber(FUNCTION_NAMES_INFORMATION.ISNUMBER);

    describe('Isnumber', () => {
        it('value number', () => {
            const value = new NumberValueObject(1);
            const result = textFunction.calculate(value);
            expect(result.getValue()).toBe(true);
        });

        it('value array', () => {
            const value = new ArrayValueObject({
                calculateValueList: transformToValueObject([
                    [1, ' ', 1.23, true, false, null, ErrorType.NA, ErrorType.DIV_BY_ZERO, ErrorType.SPILL, ErrorType.NULL],
                    [0, '100', '2.34', 'test', -3, ErrorType.VALUE, ErrorType.REF, ErrorType.NUM, ErrorType.NAME, null],
                ]),
                rowCount: 2,
                columnCount: 10,
                unitId: '',
                sheetId: '',
                row: 0,
                column: 0,
            });
            const result = textFunction.calculate(value);
            expect(transformToValue(result.getArrayValue())).toStrictEqual([
                [true, false, true, false, false, false, false, false, false, false],
                [true, true, true, false, true, false, false, false, false, false],
            ]);
        });
    });
});
