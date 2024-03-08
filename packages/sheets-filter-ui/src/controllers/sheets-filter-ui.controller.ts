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

import { Disposable, ICommandService, LifecycleStages, OnLifecycle } from '@univerjs/core';
import type { IMenuItemFactory } from '@univerjs/ui';
import { IMenuService, IShortcutService } from '@univerjs/ui';
import { Inject, Injector } from '@wendellhu/redi';

import { SmartToggleFilterCommand } from '../commands/commands';
import { SmartToggleFilterShortcut } from './sheets-filter.shortcut';
import { ClearFilterConditionsMenuItemFactory, ReCalcFilterMenuItemFactory, SmartToggleFilterMenuItemFactory } from './sheets-filter.menu';

@OnLifecycle(LifecycleStages.Steady, SheetsFilterUIController)
export class SheetsFilterUIController extends Disposable {
    constructor(
        @Inject(Injector) private readonly _injector: Injector,
        @IShortcutService private readonly _shortcutService: IShortcutService,
        @ICommandService private readonly _commandService: ICommandService,
        @IMenuService private readonly _menuService: IMenuService

    ) {
        super();

        this._initCommands();
        this._initShortcuts();
        this._initMenuItems();
    }

    private _initShortcuts(): void {
        this.disposeWithMe(this._shortcutService.registerShortcut(SmartToggleFilterShortcut));
    }

    private _initCommands(): void {
        [SmartToggleFilterCommand].forEach((c) => this.disposeWithMe(this._commandService.registerCommand(c)));
    }

    private _initMenuItems(): void {
        ([
            SmartToggleFilterMenuItemFactory,
            ClearFilterConditionsMenuItemFactory,
            ReCalcFilterMenuItemFactory,
        ] as IMenuItemFactory[]).forEach((factory) => this._menuService.addMenuItem(this._injector.invoke(factory)));
    }
}
