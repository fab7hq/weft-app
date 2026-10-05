// Copy words.json, the words Weft's TUI and this app share, from a weft
// checkout into the app's static files. WEFT names the checkout; ../weft by default.
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const weft = resolve(process.env.WEFT ?? '../weft');
copyFileSync(resolve(weft, 'crates/weft-core/words.json'), 'web/public/words.json');
console.log(`words.json from ${weft}`);
