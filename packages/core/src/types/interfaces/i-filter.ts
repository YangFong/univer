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

import type { BooleanNumber } from '../enum';
import type { IRange } from './i-range';

export interface IAutoFilter {
    ref: IRange[];
    filterColumns: [];
}

export type IFilterColumn = IFilterColumnWithCustomFilters | IFilterColumnWithFilters;

export interface IFilterColumnWithFilters {
    col: number;
    filters?: string[];
}

export interface IFilterColumnWithCustomFilters {
    col: number;
    customFilters: ICustomFilters;
}

export interface ICustomFilters {
    and?: BooleanNumber;
    customFilters: ICustomFilter[];
}

export interface ICustomFilter {
    operator: string;
    value: string | number;
}
