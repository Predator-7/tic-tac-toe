import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/main.ts',
    output: {
        file: 'build/index.js',
        format: 'iife',
        name: 'index',
        footer: 'var g = (typeof globalThis !== "undefined") ? globalThis : (typeof self !== "undefined") ? self : (typeof global !== "undefined") ? global : this; if (g) { Object.assign(g, index); }'
    },
    plugins: [
        resolve(),
        commonjs(),
        typescript()
    ]
};
