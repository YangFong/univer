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

import { FUNCTION_NAMES_STATISTICAL } from '../../function-names';
import { Max } from '..';
import { BooleanValueObject, NullValueObject, NumberValueObject, StringValueObject } from '../../../../engine/value-object/primitive-object';
import { ArrayValueObject, transformToValueObject } from '../../../../engine/value-object/array-value-object';
import { ErrorType } from '../../../../basics/error-type';
import { ErrorValueObject } from '../../../..';

describe('Test max function', () => {
    const textFunction = new Max(FUNCTION_NAMES_STATISTICAL.MAX);

    describe('Max', () => {
        it('Var1 is number, var2 is number', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new NumberValueObject(2);
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(2);
        });
        it('Var1 is number, var2 is string', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new StringValueObject('test');
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(ErrorType.VALUE);
        });
        it('Var1 is number, var2 is string number', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new StringValueObject('2');
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(2);
        });
        it('Var1 is number, var2 is boolean', () => {
            const var1 = new NumberValueObject(2);

            let var2 = new BooleanValueObject(true);
            let result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(2);

            var2 = new BooleanValueObject(false);
            result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(2);
        });
        it('Var1 is number, var2 is null', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new NullValueObject(0);
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(1);
        });
        it('Var1 is number, var2 is error', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new ErrorValueObject(ErrorType.NA);
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(ErrorType.NA);
        });

        it('Var1 is number, var2 is array includes error', () => {
            const var1 = new NumberValueObject(1);
            const var2 = new ArrayValueObject({
                calculateValueList: transformToValueObject([
                    [1, null],
                    [0, ErrorType.VALUE],
                ]),
                rowCount: 2,
                columnCount: 2,
                unitId: '',
                sheetId: '',
                row: 0,
                column: 0,
            });
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(ErrorType.VALUE);
        });
        it('Var1 is array not includes error, ignore boolean value ', () => {
            const var1 = new ArrayValueObject({
                calculateValueList: transformToValueObject([
                    [-3, null],
                    [false, true],
                ]),
                rowCount: 2,
                columnCount: 2,
                unitId: '',
                sheetId: '',
                row: 0,
                column: 0,
            });
            const result = textFunction.calculate(var1);
            expect(result.getValue()).toBe(-3);
        });

        it('Var1 is number, var2 is array not includes error', () => {
            const var1 = new NumberValueObject(2);
            const var2 = new ArrayValueObject({
                calculateValueList: transformToValueObject([
                    [1, ' ', 1.23, true, false, null],
                    [0, '100', '2.34', 'test', -3, null],
                ]),
                rowCount: 2,
                columnCount: 6,
                unitId: '',
                sheetId: '',
                row: 0,
                column: 0,
            });
            const result = textFunction.calculate(var1, var2);
            expect(result.getValue()).toBe(100);
        });
    });
});
