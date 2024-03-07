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
import { Disposable, IUniverInstanceService, LifecycleStages, OnLifecycle, ThemeService } from '@univerjs/core';
import { ISelectionRenderService, SelectionShape, SheetSkeletonManagerService } from '@univerjs/sheets-ui';
import { Inject } from '@wendellhu/redi';
import { SheetFilterService } from '@univerjs/sheets-filter';
import type { SpreadsheetSkeleton } from '@univerjs/engine-render';
import { IRenderManagerService } from '@univerjs/engine-render';
import type { ISelectionStyle } from '@univerjs/sheets';

const DEFAULT_Z_INDEX = 1000;

/**
 * This controller is for rendering **Filter**-related elements on the canvas, including:
 * - the filter range
 * - the open filter config panel button
 */
@OnLifecycle(LifecycleStages.Rendered, SheetFilterRenderController)
export class SheetFilterRenderController extends Disposable {
    private _filterRangeShape: SelectionShape | null = null;

    constructor(
        @Inject(SheetSkeletonManagerService) private readonly _sheetSkeletonManagerService: SheetSkeletonManagerService,
        @Inject(SheetFilterService) private readonly _sheetFilterService: SheetFilterService,
        @Inject(ThemeService) private readonly _themeService: ThemeService,
        @IUniverInstanceService private readonly _univerInstanceService: IUniverInstanceService,
        @IRenderManagerService private readonly _renderManagerService: IRenderManagerService,
        @ISelectionRenderService private readonly _selectionRenderService: ISelectionRenderService

    ) {
        super();

        this._initRenderer();
    }

    // TODO@wzhudev: render sheet filter range on the canvas
    // TODO@wzhudev: the next target is to render a filter range on the canvas
    private _initRenderer(): void {
        this._sheetSkeletonManagerService.currentSkeleton$.subscribe((skeletonParams) => {
            this._disposeRendering();

            if (!skeletonParams) {
                return;
            }

            const { unitId } = skeletonParams;
            const workbook = this._univerInstanceService.getUniverSheetInstance(unitId);
            const activeSheet = workbook?.getActiveSheet();
            if (!activeSheet) {
                return;
            }

            const filterModel = this._sheetFilterService.getFilterModel(unitId, activeSheet.getSheetId());
            if (!filterModel || !filterModel.getRange()) {
                return;
            }

            this._renderRange(skeletonParams.unitId, filterModel.getRange()!, skeletonParams.skeleton);
        });
    }

    private _renderRange(unitId: string, range: IRange, skeleton: SpreadsheetSkeleton): void {
        const renderer = this._renderManagerService.getRenderById(unitId);
        if (!renderer) {
            return;
        }

        const { scene } = renderer;
        const { rangeWithCoord, style } = this._selectionRenderService.convertSelectionRangeToData({
            range,
            primary: null,
            style: null,
        });

        const { rowHeaderWidth, columnHeaderHeight } = skeleton;
        const filterRangeShape = this._filterRangeShape = new SelectionShape(scene, DEFAULT_Z_INDEX, true, this._themeService);
        filterRangeShape.update(rangeWithCoord, rowHeaderWidth, columnHeaderHeight, {
            hasAutoFill: false,
            fill: 'rgba(0, 0, 0, 0.0)',
            ...style,
        } as ISelectionStyle);
    }

    private _disposeRendering(): void {
        this._filterRangeShape?.dispose();
        this._filterRangeShape = null;
    }
}
