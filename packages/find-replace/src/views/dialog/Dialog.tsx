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

import { Button, Checkbox, FormLayout, Input, InputWithSlot, Pager, Select } from '@univerjs/design';
import { ILayoutService, useObservable } from '@univerjs/ui';
import type { Nullable } from '@univerjs/core';
import { ICommandService, IContextService, LocaleService } from '@univerjs/core';
import type { IDisposable } from '@wendellhu/redi';
import { useDependency } from '@wendellhu/redi/react-bindings';
import type { ForwardedRef } from 'react';
import React, { forwardRef, Fragment, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { fromEvent } from 'rxjs';

import { FormDualColumnLayout } from '@univerjs/design/components/form-layout/FormLayout.js';
import { FindBy, FindDirection, FindScope, IFindReplaceService } from '../../services/find-replace.service';
import { FIND_REPLACE_INPUT_FOCUS } from '../../services/context-keys';
import { ReplaceAllMatchesCommand, ReplaceCurrentMatchCommand } from '../../commands/command/replace.command';
import styles from './Dialog.module.less';
import { SearchInput } from './SearchInput';

interface ISubFormRef {
    focus(): void;
}

function useFindInputFocus(findReplaceService: IFindReplaceService, ref: ForwardedRef<unknown>): void {
    const focus = useCallback(() => (document.querySelector('.univer-find-input input') as Nullable<HTMLInputElement>)?.focus(), []);
    useImperativeHandle(ref, () => ({ focus }));
    useEffect(() => {
        const subscription = findReplaceService.focusSignal$.subscribe(() => focus());
        return () => subscription.unsubscribe();
    }, [findReplaceService, focus]);
}

export const FindDialog = forwardRef(function FindDialogImpl(_props, ref) {
    const localeService = useDependency(LocaleService);
    const findReplaceService = useDependency(IFindReplaceService);

    const state = useObservable(findReplaceService.state$, undefined, true);
    const { findString, matchesCount, matchesPosition } = state;

    const revealReplace = useCallback(() => findReplaceService.revealReplace(), [findReplaceService]);

    const onFindStringChange = useCallback((findString: string) => findReplaceService.changeFindString(findString), [findReplaceService]);

    useFindInputFocus(findReplaceService, ref);

    return (
        <Fragment>
            <SearchInput
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

    const currentMatch = useObservable(findReplaceService.currentMatch$, undefined, true);
    const replcaeables = useObservable(findReplaceService.replaceables$, undefined, true);
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
    } = state;

    const findDisabled = inputtingFindString.length === 0;
    const replaceDisabled = matchesCount === 0 || !currentMatch?.replaceable;
    const replaceAllDisabled = !findCompleted || replcaeables.length === 0;

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

    return (
        <Fragment>
            <FormLayout label={localeService.t('find-replace.dialog.find')}>
                <SearchInput
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
            <FormDualColumnLayout>
                <Fragment>
                    <FormLayout label={localeService.t('find-replace.dialog.find-scope.title')}>
                        <Select value={findScope} options={findScopeOptions} onChange={onChangeFindScope}></Select>
                    </FormLayout>
                    <FormLayout label={localeService.t('find-replace.dialog.find-by.title')}>
                        <Select value={findBy} options={findByOptions} onChange={onChangeFindBy}></Select>
                    </FormLayout>
                </Fragment>
            </FormDualColumnLayout>
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
            <div className={styles.findReplaceNoMatch}>
                {findCompleted && matchesCount === 0 && <span>{localeService.t('find-replace.dialog.no-match')}</span>}
            </div>
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

    const dialogContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<ISubFormRef>(null);

    const state = useObservable(findReplaceService.state$, undefined, true);
    const { matchesCount, matchesPosition } = state;
    const revealReplace = useCallback(() => findReplaceService.revealReplace(), [findReplaceService]);

    const setFocusContext = useCallback(
        (focused: boolean) => contextService.setContextValue(FIND_REPLACE_INPUT_FOCUS, focused),
        [contextService]);

    useEffect(() => {
        let disposable: IDisposable | undefined;
        if (dialogContainerRef.current) {
            disposable = layoutService.registerContainerElement(dialogContainerRef.current);
        }

        return () => disposable?.dispose();
    }, [layoutService]);

    useEffect(() => {
        const focusSubscription = fromEvent(document, 'focusin').subscribe((event) => {
            if (event.target && dialogContainerRef.current?.contains(event.target as Node)) {
                setFocusContext(true);
            } else {
                setFocusContext(false);
            }
        });

        // Focus the input element the first time we open the find replace dialog.
        inputRef.current?.focus();
        setFocusContext(true);

        return () => {
            focusSubscription.unsubscribe();
            setFocusContext(false);
        };
    }, [setFocusContext]);

    return (
        <div className={styles.findReplaceDialogContainer} ref={dialogContainerRef}>
            {!state.replaceRevealed ? <FindDialog ref={inputRef} /> : <ReplaceDialog ref={inputRef} />}
        </div>
    );
}

function useFindScopeOptions(localeService: LocaleService): Array<{ label: string; value: string }> {
    const locale = localeService.getCurrentLocale();
    const options = useMemo(() => {
        return [
            { label: localeService.t('find-replace.dialog.find-scope.current-sheet'), value: FindScope.SUBUNIT },
            { label: localeService.t('find-replace.dialog.find-scope.workbook'), value: FindScope.UNIT },
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
