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

import { Inject, Injector } from '@wendellhu/redi';
import { Range } from '@univerjs/core';
import { Subject } from 'rxjs';
import { ConditionalFormatService } from '../services/conditional-format.service';
import type { IConditionFormatRule } from './type';
import { ConditionalFormatViewModel } from './conditional-format-view-model';

type RuleOperatorType = 'delete' | 'set' | 'add' | 'sort';
export class ConditionalFormatRuleModel {
   //  Map<unitID ,<sheetId ,IConditionFormatRule[]>>
    private _model: Map<string, Map<string, IConditionFormatRule[]>> = new Map();
    private _ruleChange$ = new Subject<{ rule: IConditionFormatRule;unitId: string;subUnitId: string; type: RuleOperatorType }>();
    $ruleChange = this._ruleChange$.asObservable();

    constructor(@Inject(ConditionalFormatViewModel) private _conditionalFormatViewModel: ConditionalFormatViewModel,
        @Inject(Injector) private _injector: Injector

    ) {

    }

    private _ensureList(unitId: string, subUnitId: string) {
        let list = this.getSubunitRules(unitId, subUnitId);
        if (!list) {
            list = [];
            let unitMap = this._model.get(unitId);
            if (!unitMap) {
                unitMap = new Map<string, IConditionFormatRule[]>();
                this._model.set(unitId, unitMap);
            }
            unitMap.set(subUnitId, list);
        }
        return list;
    }

    getRule(unitId: string, subUnitId: string, cfId?: string) {
        const list = this.getSubunitRules(unitId, subUnitId);
        if (list) {
            return list.find((item) => item.cfId === cfId);
        }
        return null;
    }

    getSubunitRules(unitId: string, subUnitId: string) {
        const list = this._model.get(unitId)?.get(subUnitId);
        return list || null;
    }

    deleteRule(unitId: string, subUnitId: string, cfId: string) {
        const list = this.getSubunitRules(unitId, subUnitId);
        if (list) {
            const index = list.findIndex((e) => e.cfId === cfId);
            const rule = list[index];
            if (rule) {
                list.splice(index, 1);
                rule.ranges.forEach((range) => {
                    Range.foreach(range, (row, col) => {
                        this._conditionalFormatViewModel.deleteCellCf(unitId, subUnitId, row, col, rule.cfId);
                    });
                });
                this._ruleChange$.next({ rule, subUnitId, unitId, type: 'delete' });
            }
        }
    }

    setRule(unitId: string, subUnitId: string, rule: IConditionFormatRule) {
        const list = this._ensureList(unitId, subUnitId);
        const oldRule = list.find((item) => item.cfId === rule.cfId);
        if (oldRule) {
            const cfPriorityMap = list.map((item) => item.cfId).reduce((map, cur, index) => {
                map.set(cur, index);
                return map;
            }, new Map<string, number>());
            // After each setting, the cache needs to be cleared,
            // and this cleanup is deferred until the end of the calculation.
            // Otherwise the render will flash once
            const cloneRange = [...oldRule.ranges];
            const conditionalFormatService = this._injector.get(ConditionalFormatService);
            const dispose = conditionalFormatService.interceptorManager.intercept(conditionalFormatService.interceptorManager.getInterceptPoints().beforeUpdateRuleResult, {
                handler: (config) => {
                    if (unitId === config?.unitId && subUnitId === config.subUnitId && rule.cfId === config.cfId) {
                        cloneRange.forEach((range) => {
                            Range.foreach(range, (row, col) => {
                                this._conditionalFormatViewModel.deleteCellCf(unitId, subUnitId, row, col, oldRule.cfId);
                            });
                        });
                        rule.ranges.forEach((range) => {
                            Range.foreach(range, (row, col) => {
                                this._conditionalFormatViewModel.pushCellCf(unitId, subUnitId, row, col, rule.cfId);
                                this._conditionalFormatViewModel.sortCellCf(unitId, subUnitId, row, col, cfPriorityMap);
                            });
                        });
                        dispose();
                    }
                },
            });
            rule.ranges.forEach((range) => {
                Range.foreach(range, (row, col) => {
                    this._conditionalFormatViewModel.pushCellCf(unitId, subUnitId, row, col, rule.cfId);
                });
            });
            Object.assign(oldRule, rule);
            this._conditionalFormatViewModel.markRuleDirty(unitId, subUnitId, rule);
            this._ruleChange$.next({ rule, subUnitId, unitId, type: 'set' });
        }
    }

    addRule(unitId: string, subUnitId: string, rule: IConditionFormatRule) {
        const list = this._ensureList(unitId, subUnitId);
        const item = list.find((item) => item.cfId === rule.cfId);
        if (!item) {
            // The new conditional format has a higher priority
            list.unshift(rule);
        }
        const cfPriorityMap = list.map((item) => item.cfId).reduce((map, cur, index) => {
            map.set(cur, index);
            return map;
        }, new Map<string, number>());
        rule.ranges.forEach((range) => {
            Range.foreach(range, (row, col) => {
                this._conditionalFormatViewModel.pushCellCf(unitId, subUnitId, row, col, rule.cfId);
                this._conditionalFormatViewModel.sortCellCf(unitId, subUnitId, row, col, cfPriorityMap);
            });
        });
        this._conditionalFormatViewModel.markRuleDirty(unitId, subUnitId, rule);
        this._ruleChange$.next({ rule, subUnitId, unitId, type: 'add' });
    }

    /**
     * example [1,2,3,4,5,6],if you move behind 5 to 2, then cfId=5,targetId=2.
     * if targetId does not exist, it defaults to top
     */
    moveRulePriority(unitId: string, subUnitId: string, cfId: string, targetCfId?: string) {
        const list = this._ensureList(unitId, subUnitId);
        const curIndex = list.findIndex((item) => item.cfId === cfId);
        const rule = list[curIndex];
        if (rule) {
            list.splice(curIndex, 1);
            if (targetCfId) {
                const targetCfIndex = list.findIndex((item) => item.cfId === targetCfId);
                if (targetCfIndex === -1) {
                    return;
                }
                list.splice(targetCfIndex, 0, rule);
            } else {
                list.unshift(rule);
            }
            const cfPriorityMap = list.map((item) => item.cfId).reduce((map, cur, index) => {
                map.set(cur, index);
                return map;
            }, new Map<string, number>());
            rule.ranges.forEach((range) => {
                Range.foreach(range, (row, col) => {
                    this._conditionalFormatViewModel.sortCellCf(unitId, subUnitId, row, col, cfPriorityMap);
                });
            });
            this._ruleChange$.next({ rule, subUnitId, unitId, type: 'sort' });
        }
    }

    createCfId(unitId: string, subUnitId: string) {
        const list = this._model.get(unitId)?.get(subUnitId);
        return `${(list?.length || 0) + 1}`;
    }
}
