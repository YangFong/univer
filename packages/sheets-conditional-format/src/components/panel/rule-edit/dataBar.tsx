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
import { Input, InputNumber, Radio, RadioGroup, Select } from '@univerjs/design';
import { useDependency } from '@wendellhu/redi/react-bindings';
import { LocaleService } from '@univerjs/core';
import { RuleType, ValueType } from '../../../base/const';
import type { IValueConfig } from '../../../models/type';
import { ColorPicker } from '../../color-picker';
import stylesBase from '../index.module.less';
import styles from './index.module.less';
import type { IStyleEditorProps } from './type';

const createOptionItem = (text: ValueType, localeService: LocaleService) => ({ label: localeService.t(`sheet.cf.valueType.${text}`), value: text });

const InputText = (props: { className: string; type: ValueType;value: string | number;onChange: (v: string | number) => void }) => {
    const { onChange, className, value, type } = props;
    if (type === ValueType.formula) {
        const v = String(props.value).startsWith('=') ? String(props.value) || '' : '=';
        return (
            <div className={className} style={{ display: 'flex', alignItems: 'center' }}>
                <Input
                    value={v}
                    onChange={(v) => {
                        onChange(v || '');
                    }}
                />
            </div>
        );
    }
    return (
        <InputNumber
            className={className}
            value={Number(value) || 0}
            onChange={(v) => {
                onChange(v || 0);
            }}
        />
    );
};
export const DataBarStyleEditor = (props: IStyleEditorProps) => {
    const { interceptorManager } = props;
    const localeService = useDependency(LocaleService);

    const rule = props.rule?.type === RuleType.dataBar ? props.rule : undefined;
    const [isGradient, isGradientSet] = useState(() => {
        const defaultV = '0';
        if (!rule) {
            return defaultV;
        }
        return rule.config.isGradient ? '1' : '0';
    });
    const [positiveColor, positiveColorSet] = useState(() => {
        const defaultV = '#ff0000';
        if (!rule) {
            return defaultV;
        }
        return rule.config.positiveColor || defaultV;
    });
    const [nativeColor, nativeColorSet] = useState(() => {
        const defaultV = '#0000ff';
        if (!rule) {
            return defaultV;
        }
        return rule.config.nativeColor || defaultV;
    });
    const commonOptions = [createOptionItem(ValueType.num, localeService), createOptionItem(ValueType.percent, localeService), createOptionItem(ValueType.percentile, localeService), createOptionItem(ValueType.formula, localeService)];
    const minOptions = [createOptionItem(ValueType.min, localeService), ...commonOptions];
    const maxOptions = [createOptionItem(ValueType.max, localeService), ...commonOptions];
    const [minValueType, minValueTypeSet] = useState<ValueType>(() => {
        const defaultV = minOptions[0].value as ValueType;
        if (!rule) {
            return defaultV;
        }
        return rule.config.min.type || defaultV;
    });
    const [maxValueType, maxValueTypeSet] = useState<ValueType>(() => {
        const defaultV = maxOptions[0].value as ValueType;
        if (!rule) {
            return defaultV;
        }
        return rule.config.max.type || defaultV;
    });
    const [minValue, minValueSet] = useState(() => {
        const defaultV = 0;
        if (!rule) {
            return defaultV;
        }
        const value = rule.config.min;
        if (value.type === ValueType.formula) {
            return value.value || '=';
        }
        return value.value || defaultV;
    });
    const [maxValue, maxValueSet] = useState(() => {
        const defaultV = 100;
        if (!rule) {
            return defaultV;
        }
        const value = rule.config.max;
        if (value.type === ValueType.formula) {
            return value.value || '=';
        }
        return value.value || defaultV;
    });

    const getResult = (option: { minValueType: ValueType ;
                                 minValue: number | string;
                                 maxValueType: ValueType ;
                                 maxValue: number | string;
                                 isGradient: string;
                                 positiveColor: string;
                                 nativeColor: string; }) => {
        const config: { min: IValueConfig;
                        max: IValueConfig;
                        isGradient: boolean;
                        positiveColor: string;
                        nativeColor: string; } = {
            min: { type: option.minValueType, value: option.minValue },
            max: { type: option.maxValueType, value: option.maxValue },
            isGradient: option.isGradient === '1',
            positiveColor: option.positiveColor,
            nativeColor: option.nativeColor,
        };
        return { config, type: RuleType.dataBar };
    };
    useEffect(() => {
        const dispose = interceptorManager.intercept(interceptorManager.getInterceptPoints().submit, {
            handler() {
                return getResult({ isGradient, minValue, minValueType, maxValue, maxValueType, positiveColor, nativeColor });
            },
        });
        return dispose as () => void;
    }, [isGradient, minValue, minValueType, maxValue, maxValueType, positiveColor, nativeColor, interceptorManager]);

    const _handleChange = (option: { minValueType: ValueType ;
                                     minValue: number | string;
                                     maxValueType: ValueType ;
                                     maxValue: number | string;
                                     isGradient: string;
                                     positiveColor: string;
                                     nativeColor: string; }) => {
        props.onChange(getResult(option));
    };

    const handlePositiveColorChange = (color: string) => {
        positiveColorSet(color);

        _handleChange({ isGradient, minValue, minValueType, maxValue, maxValueType, positiveColor: color, nativeColor });
    };
    const handleNativeColorChange = (color: string) => {
        nativeColorSet(color);
        _handleChange({ isGradient, minValue, minValueType, maxValue, maxValueType, positiveColor, nativeColor: color });
    };

    const isShowInput = (type: string) => {
        return commonOptions.map((item) => item.value).includes(type as ValueType);
    };

    return (
        <div>
            <div className={stylesBase.title}>
                {localeService.t('sheet.cf.panel.styleRule')}
            </div>

            <div>
                <div className={stylesBase.label}>
                    {localeService.t('sheet.cf.panel.fillType')}
                </div>

                <div className={`${stylesBase.mTSm} ${stylesBase.mLXxs}`}>
                    <RadioGroup
                        value={isGradient}
                        onChange={(v) => {
                            isGradientSet(v as string);
                            _handleChange({ isGradient: v as string, minValue, minValueType, maxValue, maxValueType, positiveColor, nativeColor });
                        }}
                    >
                        <Radio value="0">
                            {localeService.t('sheet.cf.panel.pureColor')}
                        </Radio>
                        <Radio value="1">
                            {localeService.t('sheet.cf.panel.gradient')}
                        </Radio>
                    </RadioGroup>
                </div>
            </div>
            <div>
                <div className={stylesBase.label}>{localeService.t('sheet.cf.panel.colorSet')}</div>
                <div className={`${stylesBase.labelContainer} ${stylesBase.mTSm} ${stylesBase.mLXxs}`}>
                    <div className={`${stylesBase.labelContainer}`}>
                        <div className={`${styles.text}`}>{localeService.t('sheet.cf.panel.native')}</div>
                        <ColorPicker
                            color={nativeColor}
                            onChange={handleNativeColorChange}
                        />
                    </div>
                    <div className={`${stylesBase.labelContainer} ${stylesBase.mLSm} `}>
                        <div className={`${styles.text} `}>{localeService.t('sheet.cf.panel.positive')}</div>
                        <ColorPicker
                            color={positiveColor}
                            onChange={handlePositiveColorChange}
                        />
                    </div>
                </div>

            </div>
            <div>
                <div className={stylesBase.label}>{localeService.t('sheet.cf.valueType.min')}</div>
                <div className={`${stylesBase.mTSm} ${stylesBase.labelContainer}`}>
                    <Select
                        className={stylesBase.inputWidth}
                        options={minOptions}
                        value={minValueType}
                        onChange={(v) => {
                            minValueTypeSet(v as ValueType);
                            _handleChange({ isGradient, minValue, minValueType: v as ValueType, maxValue, maxValueType, positiveColor, nativeColor });
                        }}
                    />
                    {isShowInput(minValueType) && (
                        <InputText
                            type={minValueType}
                            className={stylesBase.mLSm}
                            value={minValue}
                            onChange={(v) => {
                                minValueSet(v || 0);
                                _handleChange({ isGradient, minValue: v || 0, minValueType, maxValue, maxValueType, positiveColor, nativeColor });
                            }}
                        />
                    )}
                </div>
                <div className={stylesBase.label}>{localeService.t('sheet.cf.valueType.max')}</div>
                <div className={`${stylesBase.mTSm} ${stylesBase.labelContainer}`}>
                    <Select
                        className={stylesBase.inputWidth}
                        options={maxOptions}
                        value={maxValueType}
                        onChange={(v) => {
                            maxValueTypeSet(v as ValueType);
                            _handleChange({ isGradient, minValue, minValueType, maxValue, maxValueType: v as ValueType, positiveColor, nativeColor });
                        }}
                    />
                    {isShowInput(maxValueType) && (
                        <InputText
                            type={maxValueType}
                            className={stylesBase.mLSm}
                            value={maxValue}
                            onChange={(v) => {
                                maxValueSet(v || 0);
                                _handleChange({ isGradient, minValue, minValueType, maxValue: v || 0, maxValueType, positiveColor, nativeColor });
                            }}
                        />
                    )}
                </div>
            </div>

        </div>
    );
};
