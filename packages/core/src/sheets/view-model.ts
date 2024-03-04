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

import type { IDisposable } from '@wendellhu/redi';

import { remove } from '../common/array';
import type { Nullable } from '../common/type-utils';
import { Disposable, toDisposable } from '../shared/lifecycle';
import type { ICellDataForSheetInterceptor } from '../types/interfaces/i-cell-data';

/**
 * @intenal
 */
export interface ICellContentInterceptor {
    getCell(row: number, col: number): Nullable<ICellDataForSheetInterceptor>;
}

/**
 * @intenal
 */
export interface IRowFilteredInterceptor {
    getRowFiltered(row: number): boolean;
}

/**
 * @internal
 */
export class SheetViewModel extends Disposable {
    // NOTE: maybe we don't need arrays here, and they don't work like a real interceptor
    // they are actually callbacks

    private readonly _cellContentInterceptors: ICellContentInterceptor[] = [];
    private readonly _rowFilteredInterceptors: IRowFilteredInterceptor[] = [];

    override dispose(): void {
        super.dispose();

        this._cellContentInterceptors.length = 0;
        this._rowFilteredInterceptors.length = 0;
    }

    getCell(row: number, col: number): Nullable<ICellDataForSheetInterceptor> {
        for (const interceptor of this._cellContentInterceptors) {
            const result = interceptor.getCell(row, col);
            if (typeof result !== 'undefined') {
                return result;
            }
        }

        return null;
    }

    getRowFiltered(row: number): boolean {
        if (this._rowFilteredInterceptors.length) {
            for (const interceptor of this._rowFilteredInterceptors) {
                const result = interceptor.getRowFiltered(row);
                if (result) {
                    return true;
                }
            }
        }

        return false;
    }

    registerCellContentInterceptor(interceptor: ICellContentInterceptor): IDisposable {
        if (this._cellContentInterceptors.includes(interceptor)) {
            throw new Error('[SheetViewModel]: Interceptor already registered.');
        }

        this._cellContentInterceptors.push(interceptor);
        return toDisposable(() => remove(this._cellContentInterceptors, interceptor));
    }

    registerRowFilteredInterceptor(interceptor: IRowFilteredInterceptor): IDisposable {
        if (this._rowFilteredInterceptors.includes(interceptor)) {
            throw new Error('[SheetViewModel]: Interceptor already registered.');
        }

        this._rowFilteredInterceptors.push(interceptor);
        return toDisposable(() => remove(this._rowFilteredInterceptors, interceptor));
    }
}
