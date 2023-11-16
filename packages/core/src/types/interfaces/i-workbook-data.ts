import { IKeyType, Nullable } from '../../shared/types';
import { LocaleType } from '../enum';
import { IExtraModelConfig } from './i-extra-model-config';
import { IStyleData } from './i-style-data';
import { IWorksheetConfig } from './i-worksheet-data';

/**
 * Properties of a workbook's configuration
 */
export interface IWorkbookConfig extends IExtraModelConfig {
    /**
     * unit id
     */
    id: string;

    /** Revision of this document. Would be used in collaborated editing. Starts from one. */
    rev?: number;
    creator: string;
    name: string;
    sheetOrder: string[]; // sheet id order list ['xxxx-sheet3', 'xxxx-sheet1','xxxx-sheet2']
    createdTime: string;
    appVersion: string;
    modifiedTime: string;
    timeZone: string;
    lastModifiedBy: string;
    locale: LocaleType;

    sheets: { [sheetId: string]: Partial<IWorksheetConfig> };

    styles: IKeyType<Nullable<IStyleData>>;
}
