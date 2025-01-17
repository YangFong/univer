import createViteConfig from '@univerjs/shared/vite';
import pkg from './package.json';

export default ({ mode }) => createViteConfig({}, {
    mode,
    pkg,
    features: {
        dom: true, // FIXME: should not use dom here
    },
});
