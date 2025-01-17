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

import type { IRange } from '@univerjs/core';

/**
 *
 *
 * @param {IRange} sourceRange
 * @param {IRange} targetRang
 * @param {boolean} [isStrictMode] if is true,the remainder of the row and column must all be 0 to be repeated
 * @return {*}
 */
export const getRepeatRange = (sourceRange: IRange, targetRang: IRange, isStrictMode = false) => {
    const getRowLength = (range: IRange) => range.endRow - range.startRow + 1;
    const getColLength = (range: IRange) => range.endColumn - range.startColumn + 1;
    const rowMod = getRowLength(targetRang) % getRowLength(sourceRange);
    const colMod = getColLength(targetRang) % getColLength(sourceRange);
    const repeatRelativeRange: IRange = {
        startRow: 0,
        endRow: getRowLength(sourceRange) - 1,
        startColumn: 0,
        endColumn: getColLength(sourceRange) - 1,
    };
    const repeatRow = Math.floor(getRowLength(targetRang) / getRowLength(sourceRange));
    const repeatCol = Math.floor(getColLength(targetRang) / getColLength(sourceRange));
    const repeatList: Array<{ startRange: IRange; repeatRelativeRange: IRange }> = [];
    if (!rowMod && !colMod) {
        for (let countRow = 1; countRow <= repeatRow; countRow++) {
            for (let countCol = 1; countCol <= repeatCol; countCol++) {
                const row = getRowLength(sourceRange) * (countRow - 1);
                const col = getColLength(sourceRange) * (countCol - 1);
                const startRange: IRange = {
                    startRow: row + targetRang.startRow,
                    endRow: row + targetRang.startRow,
                    startColumn: col + targetRang.startColumn,
                    endColumn: col + targetRang.startColumn,
                };

                repeatList.push({ repeatRelativeRange, startRange });
            }
        }
    } else if (!rowMod && colMod && !isStrictMode) {
        for (let countRow = 1; countRow <= repeatRow; countRow++) {
            const row = getRowLength(sourceRange) * (countRow - 1);
            const col = 0;
            const startRange: IRange = {
                startRow: row + targetRang.startRow,
                endRow: row + targetRang.startRow,
                startColumn: col + targetRang.startColumn,
                endColumn: col + targetRang.startColumn,
            };

            repeatList.push({ repeatRelativeRange, startRange });
        }
    } else if (rowMod && !colMod && !isStrictMode) {
        for (let countCol = 1; countCol <= repeatCol; countCol++) {
            const row = 0;
            const col = getColLength(sourceRange) * (countCol - 1);
            const startRange: IRange = {
                startRow: row + targetRang.startRow,
                endRow: row + targetRang.startRow,
                startColumn: col + targetRang.startColumn,
                endColumn: col + targetRang.startColumn,
            };

            repeatList.push({ repeatRelativeRange, startRange });
        }
    } else {
        const startRange: IRange = {
            startRow: targetRang.startRow,
            endRow: targetRang.startRow,
            startColumn: targetRang.startColumn,
            endColumn: targetRang.startColumn,
        };
        repeatList.push({ startRange, repeatRelativeRange });
    }
    return repeatList;
};

export async function clipboardItemIsFromExcel(html: string): Promise<boolean> {
    if (html) {
        const regex = /<td[^>]*class=".*?xl.*?"[^>]*>.*?<\/td>/;
        return regex.test(html);
    }

    return false;
}
