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

import type { IUnitRange, Nullable } from '@univerjs/core';
import { IUniverInstanceService, LocaleService } from '@univerjs/core';
import { Button, Dialog, Input, Tooltip } from '@univerjs/design';
import { CloseSingle, DeleteSingle, SelectRangeSingle } from '@univerjs/icons';
import { useDependency } from '@wendellhu/redi/react-bindings';
import React, { useEffect, useRef, useState } from 'react';

import { deserializeRangeWithSheet, isReferenceString, serializeRange, serializeRangeWithSheet, serializeRangeWithSpreadsheet } from '@univerjs/engine-formula';
import { TextEditor } from '../editor/TextEditor';
import { IEditorService } from '../../services/editor/editor.service';
import { IRangeSelectorService } from '../../services/range-selector/range-selector.service';
import styles from './index.module.less';

export interface IRangeSelectorProps {
    id: string;
    value?: string; // default values.
    onChange?: (ranges: IUnitRange[]) => void; // Callback for changes in the selector value.
    onActive?: (state: boolean) => void; // Callback for editor active.
    onValid?: (state: boolean) => void; // input value validation
    isSingleChoice?: boolean; // Whether to restrict to only selecting a single region/area/district.
    isReadonly?: boolean; // Set the selector to read-only state.
    openForSheetUnitId?: Nullable<string>; //  Configuring which workbook the selector defaults to opening in determines whether the ref includes a [unitId] prefix.
    openForSheetSubUnitId?: Nullable<string>; // Configuring the default worksheet where the selector opens determines whether the ref includes a [unitId]sheet1 prefix.
}

export function RangeSelector(props: IRangeSelectorProps) {
    const { onChange, id, value = '', onActive, onValid, isSingleChoice = false, openForSheetUnitId, openForSheetSubUnitId, isReadonly = false } = props;

    const [rangeDataList, setRangeDataList] = useState<string[]>(['']);

    const addNewItem = (newValue: string) => {
        setRangeDataList((prevRangeDataList) => [...prevRangeDataList, newValue]);
    };

    const removeItem = (indexToRemove: number) => {
        setRangeDataList((prevRangeDataList) =>
            prevRangeDataList.filter((_, index) => index !== indexToRemove)
        );
    };

    const changeItem = (indexToChange: number, newValue: string) => {
        setRangeDataList((prevRangeDataList) =>
            prevRangeDataList.map((item, index) =>
                index === indexToChange ? newValue : item
            )
        );
    };

    const changeLastItem = (newValue: string) => {
        setRangeDataList((prevRangeDataList) => {
            const newList = [...prevRangeDataList];
            if (newList.length > 0) {
                newList[newList.length - 1] = newValue;
            }
            return newList;
        });
    };

    const editorService = useDependency(IEditorService);

    const rangeSelectorService = useDependency(IRangeSelectorService);

    const currentUniverService = useDependency(IUniverInstanceService);

    const [selectorVisible, setSelectorVisible] = useState(false);

    const localeService = useDependency(LocaleService);

    const [active, setActive] = useState(false);

    const [valid, setValid] = useState(true);

    const [rangeValue, setRangeValue] = useState(value);

    const [currentInputIndex, setCurrentInputIndex] = useState<number>(-1);

    const selectorRef = useRef<HTMLDivElement>(null);

    const currentInputIndexRef = useRef<number>(-1);

    const openForSheetUnitIdRef = useRef<Nullable<string>>(openForSheetUnitId);

    const openForSheetSubUnitIdRef = useRef<Nullable<string>>(openForSheetSubUnitId);

    const isSingleChoiceRef = useRef<Nullable<boolean>>(isSingleChoice);

    const isReadonlyRef = useRef<Nullable<boolean>>(isReadonly);

    useEffect(() => {
        const selector = selectorRef.current;

        if (!selector) {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            editorService.resize(id);
        });
        resizeObserver.observe(selector);

        let prevRangesCount = 1;
        const valueChangeSubscription = rangeSelectorService.selectionChange$.subscribe((ranges) => {
            if (rangeSelectorService.getCurrentSelectorId() !== id) {
                return;
            }

            if (ranges.length === 0) {
                prevRangesCount = 0;
                return;
            }

            const addItemCount = ranges.length - prevRangesCount;

            prevRangesCount = ranges.length;

            if (addItemCount < 0) {
                return;
            }

            const lastRange = ranges[ranges.length - 1];

            let rangeRef: string = '';

            if (lastRange.unitId === openForSheetUnitIdRef.current && lastRange.sheetId === openForSheetSubUnitIdRef.current) {
                rangeRef = serializeRange(lastRange.range);
            } else if (lastRange.unitId === openForSheetUnitIdRef.current) {
                rangeRef = serializeRangeWithSheet(lastRange.sheetName, lastRange.range);
            } else {
                rangeRef = serializeRangeWithSpreadsheet(lastRange.unitId, lastRange.sheetName, lastRange.range);
            }

            if (addItemCount >= 1 && !isSingleChoiceRef.current) {
                addNewItem(rangeRef);
                setCurrentInputIndex(-1);
            } else {
                if (currentInputIndexRef.current === -1) {
                    changeLastItem(rangeRef);
                } else {
                    changeItem(currentInputIndexRef.current, rangeRef);
                }
            }
        });

        // Clean up on unmount
        return () => {
            valueChangeSubscription.unsubscribe();
            resizeObserver.unobserve(selector);
        };
    }, []);

    useEffect(() => {
        openForSheetUnitIdRef.current = openForSheetUnitId;
        openForSheetSubUnitIdRef.current = openForSheetSubUnitId;
        isSingleChoiceRef.current = isSingleChoice;
        isReadonlyRef.current = isReadonly;
    }, [openForSheetUnitId, openForSheetSubUnitId, isSingleChoice, isReadonly]);

    useEffect(() => {
        currentInputIndexRef.current = currentInputIndex;
    }, [currentInputIndex]);

    function handleCloseModal() {
        setSelectorVisible(false);
        rangeSelectorService.setCurrentSelectorId(null);
    }

    function handleOpenModal() {
        if (isReadonlyRef.current === true) {
            return;
        }

        if (valid) {
            setRangeDataList(rangeValue.split(','));
        } else {
            setRangeDataList(['']);
        }

        editorService.closeRangePrompt();

        rangeSelectorService.setCurrentSelectorId(id);

        setSelectorVisible(true);
    }

    function onEditorActive(state: boolean) {
        setActive(state);
        onActive && onActive(state);
    }

    function onEditorValid(state: boolean) {
        setValid(state);
        onValid && onValid(state);
    }

    function handleConform() {
        if (isReadonlyRef.current === true) {
            handleCloseModal();
            return;
        }

        let result = '';
        const list = rangeDataList.filter((rangeRef) => {
            return isReferenceString(rangeRef.trim());
        });
        if (list.length === 1) {
            const rangeRef = list[0];
            if (isReferenceString(rangeRef.trim())) {
                result = rangeRef.trim();
            }
        } else {
            result = list.join(',');
        }

        editorService.setValue(result, id);

        handleCloseModal();
    }

    function handleAddRange() {
        addNewItem('');
        setCurrentInputIndex(-1);
    }

    function getSheetIdByName(name: string) {
        return currentUniverService.getCurrentUniverSheetInstance().getSheetBySheetName(name)?.getSheetId() || '';
    }

    function handleTextValueChange(value: Nullable<string>) {
        setRangeValue(value || '');

        const ranges = value?.split(',').map((ref) => {
            const unitRange = deserializeRangeWithSheet(ref);
            return {
                unitId: unitRange.unitId,
                sheetId: getSheetIdByName(unitRange.sheetName),
                range: unitRange.range,
            } as IUnitRange;
        });
        onChange && onChange(ranges || []);
    }

    let sClassName = styles.rangeSelector;
    if (!valid) {
        sClassName = `${styles.rangeSelector} ${styles.rangeSelectorError}`;
    } else if (active) {
        sClassName = `${styles.rangeSelector} ${styles.rangeSelectorActive}`;
    }

    return (
        <>
            <div className={sClassName} ref={selectorRef}>
                <TextEditor value={value} isReadonly={isReadonly} isSingleChoice={isSingleChoice} openForSheetUnitId={openForSheetUnitId} openForSheetSubUnitId={openForSheetSubUnitId} onValid={onEditorValid} onActive={onEditorActive} onChange={handleTextValueChange} id={id} onlyInputRange={true} canvasStyle={{ fontSize: 10 }} className={styles.rangeSelectorEditor} />
                <Tooltip title={localeService.t('rangeSelector.buttonTooltip')} placement="bottom">
                    <button className={styles.rangeSelectorIcon} onClick={handleOpenModal}>
                        <SelectRangeSingle />
                    </button>
                </Tooltip>
            </div>

            <Dialog
                width="300px"
                visible={selectorVisible}
                title={localeService.t('rangeSelector.title')}
                draggable
                closeIcon={<CloseSingle />}
                footer={(
                    <footer>
                        <Button size="small" onClick={handleCloseModal}>{localeService.t('rangeSelector.cancel')}</Button>
                        <Button style={{ marginLeft: 10 }} size="small" onClick={handleConform} type="primary">{localeService.t('rangeSelector.confirm')}</Button>
                    </footer>
                )}
                onClose={handleCloseModal}

            >
                <div className={styles.rangeSelectorModal}>
                    {rangeDataList.map((item, index) => (
                        <div key={index} className={styles.rangeSelectorModalContainer}>
                            <div style={{ display: rangeDataList.length === 1 ? '220px' : '200px' }} className={styles.rangeSelectorModalContainerInput}>
                                <Input key={`input${index}`} onClick={() => setCurrentInputIndex(index)} size="small" value={item} onChange={(value) => changeItem(index, value)} />
                            </div>
                            <div style={{ display: rangeDataList.length === 1 ? 'none' : 'inline-block' }} className={styles.rangeSelectorModalContainerButton}>
                                <DeleteSingle onClick={() => removeItem(index)} />
                            </div>
                        </div>
                    ))}

                    <div style={{ display: isSingleChoice ? 'none' : 'unset' }} className={styles.rangeSelectorModalAdd}>
                        <Button size="small" onClick={handleAddRange}>{localeService.t('rangeSelector.addAnotherRange')}</Button>
                    </div>
                </div>

            </Dialog>
        </>
    );
}
