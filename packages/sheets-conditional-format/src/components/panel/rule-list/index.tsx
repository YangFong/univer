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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@univerjs/design';

import { useDependency } from '@wendellhu/redi/react-bindings';
import { ICommandService, IUniverInstanceService, LocaleService, Rectangle } from '@univerjs/core';

import { SelectionManagerService } from '@univerjs/sheets';
import { serializeRange } from '@univerjs/engine-formula';
import { DeleteSingle, MoreFunctionSingle } from '@univerjs/icons';
import GridLayout from 'react-grid-layout';
import type { IDeleteCfCommandParams } from '../../../commands/commands/delete-cf.command';
import { deleteCfCommand } from '../../../commands/commands/delete-cf.command';
import type { IMoveCfCommand } from '../../../commands/commands/move-cf.command';
import { moveCfCommand } from '../../../commands/commands/move-cf.command';
import { ConditionalFormatRuleModel } from '../../../models/conditional-format-rule-model';
import panelStyle from '../index.module.less';
import type { IConditionFormatRule } from '../../../models/type';
import { RuleType, SubRuleType } from '../../../base/const';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Preview } from '../../preview';
import styles from './index.module.less';

interface IRuleListProps {
    onClick: (rule: IConditionFormatRule) => void;
};
const getRuleDescribe = (rule: IConditionFormatRule, localeService: LocaleService) => {
    const ruleConfig = rule.rule;
    switch (ruleConfig.type) {
        case RuleType.colorScale:{
            return localeService.t('sheet.cf.ruleType.colorScale');
        }
        case RuleType.dataBar:{
            return localeService.t('sheet.cf.ruleType.dataBar');
        }
        case RuleType.highlightCell:{
            switch (ruleConfig.subType) {
                case SubRuleType.average:{
                    const operator = ruleConfig.operator;
                    return localeService.t(`sheet.cf.preview.describe.${operator}`, localeService.t('sheet.cf.subRuleType.average'));
                }
                case SubRuleType.duplicateValues:{
                    return localeService.t('sheet.cf.subRuleType.duplicateValues');
                }
                case SubRuleType.uniqueValues:{
                    return localeService.t('sheet.cf.subRuleType.uniqueValues');
                }
                case SubRuleType.number:{
                    const operator = ruleConfig.operator;
                    return localeService.t(`sheet.cf.preview.describe.${operator}`, ...Array.isArray(ruleConfig.value) ? (ruleConfig.value.map((e) => String(e))) : [String(ruleConfig.value || '')]);
                }
                case SubRuleType.text:{
                    const operator = ruleConfig.operator;
                    return localeService.t(`sheet.cf.preview.describe.${operator}`, ruleConfig.value || '');
                }

                case SubRuleType.timePeriod:{
                    const operator = ruleConfig.operator;
                    return localeService.t(`sheet.cf.preview.describe.${operator}`);
                }
                case SubRuleType.rank:{
                    if (ruleConfig.isPercent) {
                        if (ruleConfig.isBottom) {
                            return localeService.t('sheet.cf.preview.describe.bottomNPercent', String(ruleConfig.value));
                        } else {
                            return localeService.t('sheet.cf.preview.describe.topNPercent', String(ruleConfig.value));
                        }
                    } else {
                        if (ruleConfig.isBottom) {
                            return localeService.t('sheet.cf.preview.describe.bottomN', String(ruleConfig.value));
                        } else {
                            return localeService.t('sheet.cf.preview.describe.topN', String(ruleConfig.value));
                        }
                    }
                }
            }
        }
    }
};
export const RuleList = (props: IRuleListProps) => {
    const { onClick } = props;
    const conditionalFormatRuleModel = useDependency(ConditionalFormatRuleModel);
    const univerInstanceService = useDependency(IUniverInstanceService);
    const selectionManagerService = useDependency(SelectionManagerService);
    const commandService = useDependency(ICommandService);
    const localeService = useDependency(LocaleService);

    const workbook = univerInstanceService.getCurrentUniverSheetInstance();
    const unitId = workbook.getUnitId();
    const worksheet = workbook.getActiveSheet();
    const subUnitId = worksheet.getSheetId();
    const [selectValue, selectValueSet] = useState('2');
    const [fetchRuleListId, fetchRuleListIdSet] = useState(0);
    const [layoutWidth, layoutWidthSet] = useState(0);
    const layoutContainerRef = useRef<HTMLDivElement>(null);
    const selectOption = [{ label: '整张工作表', value: '2' }, { label: '所选择单元格', value: '1' }];
    const ruleList = useMemo(() => {
        const ruleList = conditionalFormatRuleModel.getSubunitRules(unitId, subUnitId);
        if (!ruleList || !ruleList.length) {
            return [];
        }
        if (selectValue === '1') {
            const selection = selectionManagerService.getLast();
            if (!selection) {
                return [];
            }
            const range = selection.range;
            const _ruleList = ruleList.filter((rule) => {
                return rule.ranges.some((ruleRange) => Rectangle.intersects(ruleRange, range));
            });
            return _ruleList;
        } else if (selectValue === '2') {
            return ruleList;
        }
        return [];
    }, [selectValue, subUnitId, fetchRuleListId, selectionManagerService, conditionalFormatRuleModel, unitId]);

    useEffect(() => {
        const dispose = conditionalFormatRuleModel.$ruleChange.subscribe(() => {
            fetchRuleListIdSet(Math.random());
        });
        return () => dispose.unsubscribe();
    }, [conditionalFormatRuleModel]);

    useEffect(() => {
        // 8 is padding-left
        layoutWidthSet(Math.max(0, (layoutContainerRef.current?.getBoundingClientRect().width || 0) - 8));
    }, [selectValue, fetchRuleListId]);

    const handleDelete = (rule: IConditionFormatRule) => {
        const unitId = univerInstanceService.getCurrentUniverSheetInstance().getUnitId();
        const subUnitId = univerInstanceService.getCurrentUniverSheetInstance().getActiveSheet().getSheetId();
        commandService.executeCommand(deleteCfCommand.id, { unitId, subUnitId, cfId: rule.cfId } as IDeleteCfCommandParams);
    };

    const handleDragStop = (_layout: unknown, from: { y: number }, to: { y: number }) => {
        const unitId = univerInstanceService.getCurrentUniverSheetInstance().getUnitId();
        const subUnitId = univerInstanceService.getCurrentUniverSheetInstance().getActiveSheet().getSheetId();
        const getSaveIndex = (index: number) => {
            const length = ruleList.length;
            return Math.min(length - 1, Math.max(0, index));
        };
        const cfId = ruleList[getSaveIndex(from.y)].cfId;
        const targetCfId = ruleList[getSaveIndex(to.y)].cfId;
        commandService.executeCommand(moveCfCommand.id, { unitId, subUnitId, cfId, targetCfId } as IMoveCfCommand);
    };
    const layout = ruleList.map((rule, index) => ({ i: rule.cfId, x: 0, w: 12, y: index, h: 1, isResizable: false }));
    return (
        <>
            <div className={styles.cfRuleList}>
                <div>
                    管理
                    <span className={panelStyle.select}>
                        <Select options={selectOption} value={selectValue} onChange={(v) => { selectValueSet(v); }} />
                    </span>
                    的规则
                </div>
                <div ref={layoutContainerRef} className={styles.gridLayoutWrap}>
                    { layoutWidth
                        ? (
                            <GridLayout
                                onDragStop={handleDragStop}
                                layout={layout}
                                cols={12}
                                rowHeight={42}
                                width={layoutWidth}
                                margin={[0, 10]}
                                draggableHandle=".draggableHandle"
                            >
                                { ruleList.map((rule) => {
                                    return (
                                        <div key={`${rule.cfId}`} className={styles.reactGridItem}>
                                            <div className={styles.ruleItem} onClick={() => onClick(rule)}>
                                                <div
                                                    className={`${styles.draggableHandle} draggableHandle`}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreFunctionSingle />
                                                </div>
                                                <div className={styles.ruleDescribe}>
                                                    <div>{getRuleDescribe(rule, localeService)}</div>
                                                    <div>{rule.ranges.map((range) => serializeRange(range)).join(',')}</div>
                                                </div>
                                                <div className={styles.preview}><Preview rule={rule.rule} /></div>
                                                <div
                                                    className={styles.deleteItem}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(rule);
                                                    }}
                                                >
                                                    <DeleteSingle />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </GridLayout>
                        )
                        : null}

                </div>
            </div>
        </>
    );
};
