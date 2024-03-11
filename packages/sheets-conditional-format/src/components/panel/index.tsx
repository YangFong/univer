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

import React, { useState } from 'react';
import { LocaleService } from '@univerjs/core';
import { useDependency } from '@wendellhu/redi/react-bindings';
import type { IConditionFormatRule } from '../../models/type';
import styles from './index.module.less';
import { RuleList } from './rule-list';
import { RuleEdit } from './rule-edit';

interface IConditionFormatPanelProps { rule?: IConditionFormatRule };

export const ConditionFormatPanel = (props: IConditionFormatPanelProps) => {
    const localeService = useDependency(LocaleService);
    const [currentEditRule, currentEditRuleSet] = useState<IConditionFormatRule | undefined>(props.rule);
    const [isShowRuleEditor, isShowRuleEditorSet] = useState(!!props.rule);
    const createCfRule = () => {
        isShowRuleEditorSet(true);
    };
    const handleCancel = () => {
        isShowRuleEditorSet(false);
        currentEditRuleSet(undefined);
    };
    const handleRuleClick = (rule: IConditionFormatRule) => {
        currentEditRuleSet(rule);
        isShowRuleEditorSet(true);
    };
    return (
        <div className={styles.conditionalFormatWrap}>
            {isShowRuleEditor
                ? (
                    <RuleEdit onCancel={handleCancel} rule={currentEditRule} />
                )
                : (
                    <>
                        <RuleList onClick={handleRuleClick} />
                        <div onClick={createCfRule} className={styles.createRule}>
                            {localeService.t('sheet.cf.panel.createRule')}
                        </div>
                    </>
                )}

        </div>
    );
};
