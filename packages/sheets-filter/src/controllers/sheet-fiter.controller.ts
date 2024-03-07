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

import { Disposable, LifecycleStages, OnLifecycle } from '@univerjs/core';
import { INTERCEPTOR_POINT, SheetInterceptorService } from '@univerjs/sheets';
import { Inject } from '@wendellhu/redi';

import { SheetFilterService } from '../services/sheet-filter.service';

@OnLifecycle(LifecycleStages.Starting, SheetFilterController)
export class SheetFilterController extends Disposable {
    constructor(
        @Inject(SheetFilterService) private readonly _sheetFilterService: SheetFilterService,
        @Inject(SheetInterceptorService) private readonly _sheetInterceptorService: SheetInterceptorService
    ) {
        super();

        this._initRowFilteredInterceptor();
    }

    private _initRowFilteredInterceptor(): void {
        this.disposeWithMe(this._sheetInterceptorService.intercept(INTERCEPTOR_POINT.ROW_FILTERED, {
            handler: (filtered, rowLocation) => {
                if (filtered) return true;

                // NOTE@wzhudev: maybe we should use some cache or add some cache on the skeleton to improve performance
                const f = this._sheetFilterService
                    .getFilterModel(rowLocation.unitId, rowLocation.subUnitId)
                    ?.isRowFiltered(rowLocation.row);
                return f ?? false;
            },
        }));
    }
}
