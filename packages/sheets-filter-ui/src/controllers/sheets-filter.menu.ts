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

import { getMenuHiddenObservable, MenuGroup, MenuItemType, MenuPosition } from '@univerjs/ui';
import type { IMenuButtonItem, IMenuSelectorItem } from '@univerjs/ui';
import type { IAccessor } from '@wendellhu/redi';
import { SheetsFilterService } from '@univerjs/sheets-filter';
import { UniverInstanceType } from '@univerjs/core';

import { ClearFilterConditionsCommand, ReCalcFilterConditionsCommand, SmartToggleFilterCommand } from '../commands/commands';

/**
 * This menu item can indicated if there is an activated filter in the focused Univer sheet.
 * @param accessor
 * @returns
 */
export function SmartToggleFilterMenuItemFactory(accessor: IAccessor): IMenuSelectorItem {
    const sheetsFilterService = accessor.get(SheetsFilterService);

    return {
        id: SmartToggleFilterCommand.id,
        group: MenuGroup.TOOLBAR_OTHERS,
        type: MenuItemType.BUTTON_SELECTOR,
        icon: 'BrushSingle',
        tooltip: 'filter.toolbar.smart-toggle-filter-tooltip',
        positions: [MenuPosition.TOOLBAR_START],
        hidden$: getMenuHiddenObservable(accessor, UniverInstanceType.SHEET),

        // TODO@jikkai: there is a missing feature
        // activated$: sheetsFilterService.activeFilterModel$.pipe(map((model) => !!model)),
    };
}

export function ClearFilterConditionsMenuItemFactory(accessor: IAccessor): IMenuButtonItem {
    const sheetsFilterService = accessor.get(SheetsFilterService);

    return {
        id: ClearFilterConditionsCommand.id,
        group: MenuGroup.TOOLBAR_OTHERS,
        type: MenuItemType.BUTTON,
        icon: 'ClearFilterCondition',
        title: 'filter.toolbar.clear-filter-conditions',
        positions: [SmartToggleFilterCommand.id],
    };
}

export function ReCalcFilterMenuItemFactory(accessor: IAccessor): IMenuButtonItem {
    const sheetsFilterService = accessor.get(SheetsFilterService);

    return {
        id: ReCalcFilterConditionsCommand.id,
        group: MenuGroup.TOOLBAR_OTHERS,
        type: MenuItemType.BUTTON,
        icon: 'ReCalcFilter',
        title: 'filter.toolbar.re-calc-filter-conditions',
        positions: [SmartToggleFilterCommand.id],
    };
}
