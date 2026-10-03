import { createRequire } from 'module';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

var require = createRequire(import.meta.url);
var module = { exports: {} };

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
