import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/main.ts',
    output: {
        file: 'build/index.js',
        format: 'iife',
        name: 'index',
        footer: 'var InitModule = index.InitModule;'
    },
    plugins: [
        resolve(),
        commonjs(),
        typescript()
    ]
};
