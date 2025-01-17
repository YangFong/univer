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

import type { IUnitRange, Nullable } from '@univerjs/core';
import { Disposable } from '@univerjs/core';
import type { IDisposable } from '@wendellhu/redi';
import { createIdentifier } from '@wendellhu/redi';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';

export interface IRangeSelectorRange extends IUnitRange {
    sheetName: string;
}

export interface IRangeSelectorService {
    selectionChange$: Observable<IRangeSelectorRange[]>;

    setCurrentSelectorId(id: Nullable<string>): void;

    getCurrentSelectorId(): Nullable<string>;

    selectionChange(ranges: IRangeSelectorRange[]): void;
}

export class RangeSelectorService extends Disposable implements IRangeSelectorService, IDisposable {
    private _currentSelectorId: Nullable<string>;

    private readonly _selectionChange$ = new Subject<IRangeSelectorRange[]>();

    readonly selectionChange$ = this._selectionChange$.asObservable();

    setCurrentSelectorId(id: Nullable<string>) {
        this._currentSelectorId = id;
    }

    getCurrentSelectorId(): Nullable<string> {
        return this._currentSelectorId;
    }

    selectionChange(range: IRangeSelectorRange[]) {
        if (!this._currentSelectorId) {
            return;
        }
        this._selectionChange$.next(range);
    }
}

export const IRangeSelectorService = createIdentifier<IRangeSelectorService>(
    'univer.range-selector.service'
);
