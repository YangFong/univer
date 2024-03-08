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

import type { FormulaInputType } from '@univerjs/data-validation';
import { CustomFormulaInput } from './custom-formula-input';

export const CUSTOM_FORMULA_INPUT_NAME = 'data-validation.custom-formula-input';

export const FORMULA_INPUTS: [string, FormulaInputType][] = [[
    CUSTOM_FORMULA_INPUT_NAME,
    CustomFormulaInput,
]];
