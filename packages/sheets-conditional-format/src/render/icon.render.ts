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

import type { IRange, IScale } from '@univerjs/core';
import { Range } from '@univerjs/core';
import type { SpreadsheetSkeleton, UniverRenderingContext } from '@univerjs/engine-render';
import { SheetExtension } from '@univerjs/engine-render';
import type { IIconType } from '../models/icon-map';
import { iconMap } from '../models/icon-map';
import type { IIconSetCellData } from './type';

export const IconUKey = 'sheet-conditional-rule-icon';
const EXTENSION_Z_INDEX = 35;

export class ConditionalFormatIcon extends SheetExtension {
    private _paddingRightAndLeft = 2;
    private _paddingTopAndBottom = 2;

    private _imageMap: Map<string, HTMLImageElement> = new Map();
    override uKey = IconUKey;

    override Z_INDEX = EXTENSION_Z_INDEX;
    _radius = 1;
    constructor() {
        super();
        this._init();
    }

    override draw(
        ctx: UniverRenderingContext,
        parentScale: IScale,
        spreadsheetSkeleton: SpreadsheetSkeleton,
        diffRanges?: IRange[]
    ) {
        const { rowHeightAccumulation, columnWidthAccumulation, worksheet, dataMergeCache } =
        spreadsheetSkeleton;
        if (!worksheet) {
            return false;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        Range.foreach(spreadsheetSkeleton.rowColumnSegment, (row, col) => {
            const cellData = worksheet.getCell(row, col) as IIconSetCellData;
            if (cellData?.iconSet) {
                const { iconType, iconId } = cellData.iconSet;
                const icon = this._imageMap.get(this._createKey(iconType, iconId));
                if (!icon) {
                    return;
                }
                const cellInfo = this.getCellIndex(row, col, rowHeightAccumulation, columnWidthAccumulation, dataMergeCache);
                let { isMerged, isMergedMainCell, mergeInfo, startY, endY, startX, endX } = cellInfo;
                if (isMerged) {
                    return;
                }
                if (isMergedMainCell) {
                    startY = mergeInfo.startY;
                    endY = mergeInfo.endY;
                    startX = mergeInfo.startX;
                    endX = mergeInfo.endX;
                }
                if (!this.isRenderDiffRangesByCell(mergeInfo, diffRanges)) {
                    return;
                }
                const borderWidth = endX - startX;
                const borderHeight = endY - startY;
                const width = Math.max(Math.min(borderWidth - this._paddingRightAndLeft * 2, borderHeight - this._paddingTopAndBottom * 2, 24), 0);
                // Highly centered processing
                const y = (borderHeight - width) / 2 + startY;
                width && ctx.drawImage(icon, startX + this._paddingRightAndLeft, y, width, width);
            }
        });
        ctx.restore();
    }

    private _init() {
        for (const type in iconMap) {
            const list = iconMap[type as IIconType];
            list.forEach((base64, index) => {
                const key = this._createKey(type as IIconType, String(index));
                const image = new Image();
                image.onload = () => {
                    this._imageMap.set(key, image);
                };
                image.src = base64;
            });
        }
    }

    private _createKey(iconType: IIconType, iconIndex: string) {
        return `${iconType}_${iconIndex}`;
    }
}
