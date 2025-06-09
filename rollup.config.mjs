
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json';

export default {
  input: 'src/ui/server.js',
  output: {
    format: 'esm',
    file: 'gen/bundle.min.js'
  },
  plugins: [
    alias({
      entries: [
        { find: '../development.js', replacement: '../../gen/www.js' },
      ]
    }),
    replace({
      __dirname: "import.meta.dirname",
      __filename: "import.meta.filename",
      preventAssignment: true
    }),
    commonjs({
      
    }),
    resolve({
      preferBuiltins: true
    }),
    json()/*,
    terser({
      format: {
        comments: false
      }
    })*/
  ],
  external: ['better-sqlite3']
};