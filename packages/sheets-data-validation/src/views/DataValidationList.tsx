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

import React, { useEffect, useState } from 'react';
import { useDependency } from '@wendellhu/redi/react-bindings';
import type { ISheetDataValidationRule } from '@univerjs/core';
import { DataValidationOperator, DataValidationType, ICommandService, IUniverInstanceService, Tools } from '@univerjs/core';
import { DataValidationModel, RemoveAllDataValidationCommand } from '@univerjs/data-validation';
import { Button } from '@univerjs/design';
import { SelectionManagerService } from '@univerjs/sheets';
import { AddSheetDataValidationCommand, type IAddSheetDataValidationCommandParams } from '..';
import { DataValidationItem } from './DataValidationItem';

export interface IDataValidationListProps {
    onActive: (rule: ISheetDataValidationRule) => void;
}

export const DataValidationList = (props: IDataValidationListProps) => {
    const { onActive } = props;
    const univerInstanceService = useDependency(IUniverInstanceService);
    const dataValidationModel = useDependency(DataValidationModel);
    const commandService = useDependency(ICommandService);
    const selectionManagerService = useDependency(SelectionManagerService);
    const workbook = univerInstanceService.getCurrentUniverSheetInstance();
    const worksheet = workbook.getActiveSheet();
    const unitId = workbook.getUnitId();
    const subUnitId = worksheet.getSheetId();
    const manager = dataValidationModel.getOrCreateManager(unitId, subUnitId);
    const [rules, setRules] = useState<ISheetDataValidationRule[]>(manager.getDataValidations());

    useEffect(() => {
        const subscription = manager.dataValidations$.subscribe((currentRules) => {
            setRules([...currentRules]);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [manager.dataValidations$]);

    const handleAddRule = async () => {
        const currentRanges = selectionManagerService.getSelectionRanges();
        const uid = Tools.generateRandomId(6);
        const rule = {
            uid,
            type: DataValidationType.DECIMAL,
            operator: DataValidationOperator.EQUAL,
            formula1: '100',
            ranges: currentRanges ?? [{ startColumn: 0, endColumn: 0, startRow: 0, endRow: 0 }],
        };
        const params: IAddSheetDataValidationCommandParams = {
            unitId,
            subUnitId,
            rule,
        };
        await commandService.executeCommand(AddSheetDataValidationCommand.id, params);
        onActive(rule);
    };

    const handleRemoveAll = () => {
        commandService.executeCommand(RemoveAllDataValidationCommand.id);
    };

    return (
        <div>
            {rules.map((rule) => (
                <DataValidationItem
                    unitId={unitId}
                    subUnitId={subUnitId}
                    onClick={() => onActive(rule)}
                    rule={rule}
                    key={rule.uid}
                />
            ))}
            <div>
                <Button type="primary" onClick={handleRemoveAll}>
                    Remove All
                </Button>
                <Button onClick={handleAddRule}>
                    Add Rule
                </Button>
            </div>
        </div>
    );
};
