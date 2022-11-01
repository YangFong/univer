import { Context, Plugin, PLUGIN_NAMES } from '@univer/core';

import { IOCContainer } from '@univer/core';
import { LexerTreeMaker } from './Analysis/Lexer';
import { FormulaEnginePluginObserver } from './Basics/Observer';
import { AstTreeMaker } from './Analysis/Parser';
import { Interpreter } from './Interpreter/Interpreter';

interface IFormulaEnginePlugin {}

interface IConfig {}

interface FormulaEngineConfig {}

export class FormulaEnginePlugin extends Plugin<FormulaEnginePluginObserver> {
    constructor(config?: IFormulaEnginePlugin) {
        super('pluginFormulaEngine');
    }

    calculate(formulaString: string) {
        this.getObserver('onBeforeFormulaCalculateObservable')?.notifyObservers(formulaString);
        const lexerTreeMaker = new LexerTreeMaker(formulaString);
        const lexerNode = lexerTreeMaker.treeMaker();
        lexerTreeMaker.suffixExpressionHandler(lexerNode); // suffix Express, 1+(3*4=4)*5+1 convert to 134*4=5*1++
        console.log('lexerNode', lexerNode.serialize());

        this.getObserver('onAfterFormulaLexerObservable')?.notifyObservers(lexerNode);

        const astTreeMaker = AstTreeMaker.create();

        const astNode = astTreeMaker.parse(lexerNode);

        console.log('astNode', astNode.serialize());

        const resultPromise = Interpreter.create().execute(astNode);

        resultPromise.then((value) => {
            console.log('formulaResult', value);
        });
    }

    initialize(): void {}

    onMapping(IOC: IOCContainer): void {}

    onMounted(ctx: Context): void {
        this.initialize();
    }

    onDestroy(): void {}

    static create(config?: IFormulaEnginePlugin) {
        return new FormulaEnginePlugin(config);
    }
}
