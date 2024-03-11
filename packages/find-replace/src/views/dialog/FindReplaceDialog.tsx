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

import { Button, Checkbox, FormLayout, Input, InputWithSlot, MessageType, Pager, Select } from '@univerjs/design';
import { ILayoutService, IMessageService, RangeSelector, useActiveWorkbook, useActiveWorksheet, useObservable } from '@univerjs/ui';
import type { IUnitRange, Nullable } from '@univerjs/core';
import { ICommandService, IContextService, IUniverInstanceService, LocaleService } from '@univerjs/core';
import type { IDisposable } from '@wendellhu/redi';
import { useDependency } from '@wendellhu/redi/react-bindings';
import type { ForwardedRef } from 'react';
import React, { forwardRef, Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { fromEvent } from 'rxjs';

import { FormDualColumnLayout } from '@univerjs/design/components/form-layout/FormLayout.js';
import { serializeRangeWithSpreadsheet } from '@univerjs/engine-formula';
import { FindBy, FindDirection, FindScope, IFindReplaceService } from '../../services/find-replace.service';
import { FIND_REPLACE_DIALOG_FOCUS, FIND_REPLACE_INPUT_FOCUS } from '../../services/context-keys';
import { ReplaceAllMatchesCommand, ReplaceCurrentMatchCommand } from '../../commands/command/replace.command';
import { SearchInput } from './SearchInput';

import styles from './FindReplaceDialog.module.less';

interface ISubFormRef {
    focus(): void;
    selectHasFocus(): boolean;
}

function useFindInputFocus(findReplaceService: IFindReplaceService, ref: ForwardedRef<unknown>): void {
    const focus = useCallback(() => {
        (document.querySelector('.univer-find-input input') as Nullable<HTMLInputElement>)?.focus();
    }, []);

    const selectHasFocus = useCallback(() => {
        const allInputs = document.querySelectorAll('.univer-find-replace-dialog-container .univer-select-selection-search-input');
        return Array.from(allInputs).some((input) => input === document.activeElement);
    }, []);

    useImperativeHandle(ref, () => ({ focus, selectHasFocus }));

    useEffect(() => {
        const subscription = findReplaceService.focusSignal$.subscribe(() => focus());
        return () => subscription.unsubscribe();
    }, [findReplaceService, focus]);
}

export const FindDialog = forwardRef(function FindDialogImpl(_props, ref) {
    const localeService = useDependency(LocaleService);
    const findReplaceService = useDependency(IFindReplaceService);

    const state = useObservable(findReplaceService.state$, undefined, true);
    const { findCompleted, findString, matchesCount, matchesPosition } = state;

    const revealReplace = useCallback(() => findReplaceService.revealReplace(), [findReplaceService]);

    const onFindStringChange = useCallback((findString: string) => findReplaceService.changeFindString(findString), [findReplaceService]);

    useFindInputFocus(findReplaceService, ref);

    return (
        <Fragment>
            <SearchInput
                findCompleted={findCompleted}
                className="univer-find-input"
                matchesCount={matchesCount}
                matchesPosition={matchesPosition}
                findReplaceService={findReplaceService}
                localeService={localeService}
                findString={findString}
                onChange={onFindStringChange}
            />
            <div className={styles.findReplaceExpandContainer}>
                <Button type="text" size="small" onClick={revealReplace}>
                    {localeService.t('find-replace.dialog.advanced-finding')}
                </Button>
            </div>
        </Fragment>
    );
});

export const ReplaceDialog = forwardRef(function ReplaceDIalogImpl(_props, ref) {
    const findReplaceService = useDependency(IFindReplaceService);
    const localeService = useDependency(LocaleService);
    const commandService = useDependency(ICommandService);
    const messageService = useDependency(IMessageService);
    const univerInstanceService = useDependency(IUniverInstanceService);

    const currentMatch = useObservable(findReplaceService.currentMatch$, undefined, true);
    const replaceables = useObservable(findReplaceService.replaceables$, undefined, true);
    const state = useObservable(findReplaceService.state$, undefined, true);
    const {
        matchesCount,
        matchesPosition,
        findString,
        inputtingFindString,
        replaceString,
        caseSensitive,
        matchesTheWholeCell,
        findDirection,
        findScope,
        findBy,
        findCompleted,
        dedicatedRange,
    } = state;

    const findDisabled = inputtingFindString.length === 0 || (findScope === FindScope.RANGE && !dedicatedRange);
    const replaceDisabled = matchesCount === 0 || !currentMatch?.replaceable;
    const replaceAllDisabled = !findCompleted || replaceables.length === 0;

    const activeWorkbook = useActiveWorkbook();
    const activeWorksheet = useActiveWorksheet();
    const activeWorkbookId = activeWorkbook?.getUnitId();
    const activeWorkSheetId = activeWorksheet?.getSheetId();

    const onFindStringChange = useCallback(
        (newValue: string) => findReplaceService.changeInputtingFindString(newValue),
        [findReplaceService]
    );
    const onReplaceStringChange = useCallback(
        (replaceString: string) => findReplaceService.changeReplaceString(replaceString),
        [findReplaceService]
    );

    const onClickFindButton = useCallback(() => {
        if (findString === inputtingFindString) {
            findReplaceService.moveToNextMatch();
        } else {
            findReplaceService.changeFindString(inputtingFindString);
            findReplaceService.find();
        }
    }, [findString, inputtingFindString, findReplaceService]);
    const onClickReplaceButton = useCallback(() => commandService.executeCommand(ReplaceCurrentMatchCommand.id), [commandService]);
    const onClickReplaceAllButton = useCallback(() => commandService.executeCommand(ReplaceAllMatchesCommand.id), [commandService]);

    const onChangeFindRange = useCallback((unitRanges: IUnitRange[]) => {
        if (unitRanges.length && activeWorkbook && activeWorksheet) {
            const firstRange = unitRanges[0];
            const { range } = firstRange;
            const sheetName = activeWorksheet.getName();
            findReplaceService.changeDedicatedRange(serializeRangeWithSpreadsheet(activeWorkbook.getUnitId(), sheetName, range));
        }
    }, [findReplaceService, activeWorkbook, activeWorksheet]);
    const onChangeFindDirection = useCallback((findDirection: string) => {
        findReplaceService.changeFindDirection(findDirection as FindDirection);
    }, [findReplaceService]);
    const onChangeFindScope = useCallback((findScope: string) => {
        findReplaceService.changeFindScope(findScope as FindScope);
    }, [findReplaceService]);
    const onChangeFindBy = useCallback((findBy: string) => {
        findReplaceService.changeFindBy(findBy as FindBy);
    }, [findReplaceService]);

    const findScopeOptions = useFindScopeOptions(localeService);
    const findDirectionOptions = useFindDirectionOptions(localeService);
    const findByOptions = useFindByOptions(localeService);
    useFindInputFocus(findReplaceService, ref);

    useEffect(() => {
        const shouldDisplayNoMatchInfo = findCompleted && matchesCount === 0;

        let messageDisposable: Nullable<IDisposable> = null;
        if (shouldDisplayNoMatchInfo) {
            messageDisposable = messageService.show({
                content: localeService.t('find-replace.dialog.no-match'),
                type: MessageType.Warning,
                delay: 5000,
            });
        }

        return () => messageDisposable?.dispose();
    }, [findCompleted, matchesCount, messageService, localeService]);

    return (
        <Fragment>
            <FormLayout label={localeService.t('find-replace.dialog.find')}>
                <SearchInput
                    findCompleted={findCompleted}
                    className="univer-find-input"
                    matchesCount={matchesCount}
                    matchesPosition={matchesPosition}
                    findReplaceService={findReplaceService}
                    localeService={localeService}
                    findString={inputtingFindString}
                    onChange={onFindStringChange}
                />
            </FormLayout>
            <FormLayout label={localeService.t('find-replace.dialog.replace')}>
                <Input
                    placeholder={localeService.t('find-replace.dialog.replace-placeholder')}
                    value={replaceString}
                    onChange={(value) => onReplaceStringChange(value)}
                />
            </FormLayout>
            <FormLayout label={localeService.t('find-replace.dialog.find-direction.title')}>
                <Select value={findDirection} options={findDirectionOptions} onChange={onChangeFindDirection} />
            </FormLayout>

            {/* Find Scope Selections */}
            {findScope !== FindScope.RANGE
                ? (
                    <FormLayout label={localeService.t('find-replace.dialog.find-scope.title')}>
                        <Select value={findScope} options={findScopeOptions} onChange={onChangeFindScope}></Select>
                    </FormLayout>
                )
                : (
                    <FormDualColumnLayout>
                        <Fragment>
                            <FormLayout label={localeService.t('find-replace.dialog.find-scope.title')}>
                                <Select value={findScope} options={findScopeOptions} onChange={onChangeFindScope}></Select>
                            </FormLayout>
                            <FormLayout label={localeService.t('find-replace.dialog.find-scope.range-selector')}>
                                <RangeSelector
                                    id="sheet-find-replace"
                                    openForSheetUnitId={activeWorkbookId}
                                    openForSheetSubUnitId={activeWorkSheetId}
                                    onChange={onChangeFindRange}
                                    isSingleChoice
                                >
                                </RangeSelector>
                            </FormLayout>
                        </Fragment>
                    </FormDualColumnLayout>
                )}

            <FormLayout label={localeService.t('find-replace.dialog.find-by.title')}>
                <Select value={findBy} options={findByOptions} onChange={onChangeFindBy}></Select>
            </FormLayout>

            <FormDualColumnLayout>
                <Fragment>
                    <FormLayout>
                        <Checkbox
                            checked={caseSensitive}
                            value={caseSensitive}
                            onChange={(checked) => {
                                findReplaceService.changeCaseSensitive(checked as boolean);
                            }}
                        >
                            {localeService.t('find-replace.dialog.case-sensitive')}
                        </Checkbox>
                    </FormLayout>
                    <FormLayout>
                        <Checkbox
                            checked={matchesTheWholeCell}
                            value={matchesTheWholeCell}
                            onChange={(checked) => {
                                findReplaceService.changeMatchesTheWholeCell(checked as boolean);
                            }}
                        >
                            {localeService.t('find-replace.dialog.match-the-whole-cell')}
                        </Checkbox>
                    </FormLayout>
                </Fragment>
            </FormDualColumnLayout>
            <div className={styles.findReplaceButtonsGroup}>
                <Button type="primary" onClick={onClickFindButton} disabled={findDisabled}>{localeService.t('find-replace.dialog.find')}</Button>
                <span className={styles.findReplaceButtonsGroupRight}>
                    <Button disabled={replaceDisabled} onClick={onClickReplaceButton}>{localeService.t('find-replace.dialog.replace')}</Button>
                    <Button disabled={replaceAllDisabled} onClick={onClickReplaceAllButton}>{localeService.t('find-replace.dialog.replace-all')}</Button>
                </span>
            </div>
        </Fragment>
    );
});

export function FindReplaceDialog() {
    const findReplaceService = useDependency(IFindReplaceService);
    const layoutService = useDependency(ILayoutService);
    const contextService = useDependency(IContextService);

    const state = useObservable(findReplaceService.state$, undefined, true);

    const dialogContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let disposable: IDisposable | undefined;
        if (dialogContainerRef.current) {
            disposable = layoutService.registerContainerElement(dialogContainerRef.current);
        }

        return () => disposable?.dispose();
    }, [layoutService]);

    const focusRef = useRef<ISubFormRef>(null);
    const setDialogContainerFocus = useCallback(
        (focused: boolean) => contextService.setContextValue(FIND_REPLACE_DIALOG_FOCUS, focused),
        [contextService]);
    const setDialogInputFocus = useCallback(
        (focused: boolean) => contextService.setContextValue(FIND_REPLACE_INPUT_FOCUS, focused)
        , [contextService]);

    useEffect(() => {
        const focusSubscription = fromEvent(document, 'focusin').subscribe((event) => {
            if (event.target && dialogContainerRef.current?.contains(event.target as Node)) {
                setDialogContainerFocus(true);
            } else {
                setDialogContainerFocus(false);
            }

            if (!focusRef.current || !focusRef.current.selectHasFocus()) {
                setDialogInputFocus(true);
            } else {
                setDialogInputFocus(false);
            }
        });

        // Focus the input element the first time we open the find replace dialog.
        focusRef.current?.focus();

        setDialogContainerFocus(true);
        setDialogInputFocus(true);

        return () => {
            focusSubscription.unsubscribe();
            setDialogContainerFocus(false);
        };
    }, [setDialogContainerFocus, setDialogInputFocus]);

    return (
        <div className={styles.findReplaceDialogContainer} ref={dialogContainerRef}>
            {!state.replaceRevealed ? <FindDialog ref={focusRef} /> : <ReplaceDialog ref={focusRef} />}
        </div>
    );
}

function useFindScopeOptions(localeService: LocaleService): Array<{ label: string; value: string }> {
    const locale = localeService.getCurrentLocale();
    const options = useMemo(() => {
        return [
            { label: localeService.t('find-replace.dialog.find-scope.current-sheet'), value: FindScope.SUBUNIT },
            { label: localeService.t('find-replace.dialog.find-scope.workbook'), value: FindScope.UNIT },
            { label: localeService.t('find-replace.dialog.find-scope.range'), value: FindScope.RANGE },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale]);

    return options;
}

function useFindDirectionOptions(localeService: LocaleService): Array<{ label: string; value: string }> {
    const locale = localeService.getCurrentLocale();
    const options = useMemo(() => {
        return [
            { label: localeService.t('find-replace.dialog.find-direction.row'), value: FindDirection.ROW },
            { label: localeService.t('find-replace.dialog.find-direction.column'), value: FindDirection.COLUMN },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale]);

    return options;
}

function useFindByOptions(localeService: LocaleService): Array<{ label: string; value: string }> {
    const locale = localeService.getCurrentLocale();
    const options = useMemo(() => {
        return [
            { label: localeService.t('find-replace.dialog.find-by.value'), value: FindBy.VALUE },
            { label: localeService.t('find-replace.dialog.find-by.formula'), value: FindBy.FORMULA },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale]);

    return options;
}
