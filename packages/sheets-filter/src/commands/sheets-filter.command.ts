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

import { CommandType, type ICommand, type IRange } from '@univerjs/core';
import type { ISheetCommandSharedParams } from '@univerjs/sheets';

// TODO@wzhudev: command here may should be moved to @univerjs/sheets-filter-ui

export interface ISetSheetFilterCommandParams extends ISheetCommandSharedParams {
    range: IRange;
}

export const SetSheetFilterRangeCommand: ICommand<ISetSheetFilterCommandParams> = {
    id: 'sheet.command.set-filter-range',
    type: CommandType.COMMAND,
    handler: () => true,
};

export interface ISetSheetFilterConditionParams extends ISheetCommandSharedParams {}
export const SetSheetFilterConditionCommand: ICommand<ISetSheetFilterConditionParams> = {
    id: 'sheet.command.set-filter-condition',
    type: CommandType.COMMAND,
    handler: () => true,
};

export interface IRemoveSheetFilterCommandParams extends ISheetCommandSharedParams {}
export const RemoveSheetFilterCommand: ICommand<IRemoveSheetFilterCommandParams> = {
    id: 'sheet.command.remove-filter',
    type: CommandType.COMMAND,
    handler: () => true,
};
