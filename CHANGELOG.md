# v1.29.0 (2026-09-03)

## What's Changed

### ✨ Features

- reorganize training profile and bookmark flows ([b1dda2e](https://github.com/drackp2m/chess-pecker/commit/b1dda2ef54a1551d03532dc9829aa7d03412ebcb)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.28.0...v1.29.0

# v1.28.0 (2026-09-03)

## What's Changed

### ✨ Features

- add Zod validation and fix API types ([b244b83](https://github.com/drackp2m/chess-pecker/commit/b244b8350c393ae7ad3524ee01f8480bd0799656)) by Marc Jovaní González
- migrate puzzle validation to zod ([ce8315c](https://github.com/drackp2m/chess-pecker/commit/ce8315c7dd75e5371dfbff162de99011ffa4f43a)) by Marc Jovaní González
- migrate training sync validation to zod ([9a82660](https://github.com/drackp2m/chess-pecker/commit/9a82660b9ffa0185fd7d96ea3ac2729597535381)) by Marc Jovaní González

### 🧪 Tests

- add gap-filling test for activity day series ([ba0a6a5](https://github.com/drackp2m/chess-pecker/commit/ba0a6a510f3d4ac039fb532710197509409504a2)) by Marc Jovaní González
- cover activity range months and heatmap grid padding and levels ([70f91e2](https://github.com/drackp2m/chess-pecker/commit/70f91e250583a6a5462e62f7c3243b56c4f8d2d1)) by Marc Jovaní González
- cover cycle pace series drift, single-day and future cycles ([0c293cf](https://github.com/drackp2m/chess-pecker/commit/0c293cfcef782fd61a2b08c6da547a77df2a223f)) by Marc Jovaní González
- cover every activity counter across month-crossing gaps ([1236c42](https://github.com/drackp2m/chess-pecker/commit/1236c423f922d379a2663f6c403adf538b3100bc)) by Marc Jovaní González
- cover extreme zones and DST seasons in zone day labels ([549ccd1](https://github.com/drackp2m/chess-pecker/commit/549ccd1416061186deb7b05093124fd7c97705aa)) by Marc Jovaní González
- cover month-crossing windows with leap February and year boundary ([34adb77](https://github.com/drackp2m/chess-pecker/commit/34adb77007b6a4b431cfd1435b5f29a6087796b9)) by Marc Jovaní González
- cover out-of-window filtering for activity series and filterActivityDays ([f569dc6](https://github.com/drackp2m/chess-pecker/commit/f569dc667e2ec6c5caa5cb7a1f7086feda82fb15)) by Marc Jovaní González
- cover totalDays edge cases for activity series and filter ([9bb4391](https://github.com/drackp2m/chess-pecker/commit/9bb439132dc01e1a961d31b37abea988dffb83b5)) by Marc Jovaní González

### ♻️ Code Refactoring

- close class-validator migration with zod ([1876a5d](https://github.com/drackp2m/chess-pecker/commit/1876a5d7fda8d2c5be5740f2562b40f9c7f24d38)) by Marc Jovaní González
- migrate environment validation to zod ([fa863c9](https://github.com/drackp2m/chess-pecker/commit/fa863c9b68abe9781babb579d37caead8e6b8487)) by Marc Jovaní González
- migrate simple modules validation to zod ([214053c](https://github.com/drackp2m/chess-pecker/commit/214053c99e3957442413cb1847b86eeb926e3663)) by Marc Jovaní González
- turn API definitions into a runtime package ([e7766f4](https://github.com/drackp2m/chess-pecker/commit/e7766f4aa3ce2e329c5e65eb37ecee77262cfde6)) by Marc Jovaní González
- window daily training chart on civil timezone days ([3d173e9](https://github.com/drackp2m/chess-pecker/commit/3d173e94245f5620419a2f761f8559ca6da2e15f)) by Marc Jovaní González

### 🐛 Bug Fixes

- align activity heatmap with user timezone ([6eef3ec](https://github.com/drackp2m/chess-pecker/commit/6eef3ecba8ca7e7d3ce627ed0fad194038878aa4)) by Marc Jovaní González
- align cycle pace charts with user timezone ([3f38d14](https://github.com/drackp2m/chess-pecker/commit/3f38d14a8c35874673234ea4ac712c7b51dc4026)) by Marc Jovaní González

### 🏗️‍ Build System

- update pnpm tu 11.25.0 ([184cc82](https://github.com/drackp2m/chess-pecker/commit/184cc820ddf2ddf26f8c02973606ba84b43c32d7)) by Marc Jovaní González

### 🎒 Chores

- update Angular cli / core to 22.1.4 ([a7ec442](https://github.com/drackp2m/chess-pecker/commit/a7ec442fc0754247fd4579c698454a9cf47da9e7)) by Marc Jovaní González
- update ngrx signals to 22.0.0 ([39a6468](https://github.com/drackp2m/chess-pecker/commit/39a64686d1258c7182c491e3abfeac0d159f2bc2)) by Marc Jovaní González
- upgrade to NestJS12 and MikroORM 7 (remove legacy decorators) ([2fa8a05](https://github.com/drackp2m/chess-pecker/commit/2fa8a05ea00ab6655c4b14f78fb913638901b41d)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.27.0...v1.28.0

# v1.27.0 (2026-09-02)

## What's Changed

### ✨ Features

- add configurable timezone setting ([d9974b5](https://github.com/drackp2m/chess-pecker/commit/d9974b5ad7494ab8de8034f887d0c9e484ae4e95)) by Marc Jovaní González
- add timezone date utilities ([9275ecc](https://github.com/drackp2m/chess-pecker/commit/9275ecc6dfd1cdb6978d9a5d27d9d67b30b92873)) by Marc Jovaní González
- aggregate activity from local attempts ([a289311](https://github.com/drackp2m/chess-pecker/commit/a289311651ba02051939ab2adfae8a65439781fe)) by Marc Jovaní González
- derive activity from local data ([8e6ef2a](https://github.com/drackp2m/chess-pecker/commit/8e6ef2a6b6debcd5e8898fc368867e3c267b41da)) by Marc Jovaní González
- query local attempts by completion date ([18906b1](https://github.com/drackp2m/chess-pecker/commit/18906b1dd66e5cfdbf8a0c9029c993d609dd2ddb)) by Marc Jovaní González

### ♻️ Code Refactoring

- remove legacy remote activity aggregation ([b133e0f](https://github.com/drackp2m/chess-pecker/commit/b133e0ff6fb59cb03d183715ac92341149e181ae)) by Marc Jovaní González

### 🐛 Bug Fixes

- put back a full stop the model dropped ([53ae624](https://github.com/drackp2m/chess-pecker/commit/53ae624a31547019020b45fc03dd21e8dbf11855)) by Marc Jovaní González
- score the forms check by dimension, not by duplicates ([fc75cda](https://github.com/drackp2m/chess-pecker/commit/fc75cdac7627cdc2ef91eb019309bcbe503c3023)) by Marc Jovaní González

### 🚀 Performance Improvements

- memoize local activity aggregation by month ([daee034](https://github.com/drackp2m/chess-pecker/commit/daee034c4fad5c293a454009a4dda55f3a50ac3c)) by Marc Jovaní González

### 🏗️‍ Build System

- index local attempts by update date ([d4f1526](https://github.com/drackp2m/chess-pecker/commit/d4f1526b68004497654d642f80731234fa080c55)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.26.0...v1.27.0

# v1.26.0 (2026-09-01)

## What's Changed

### ✨ Features

- add --bench, the model comparison harness ([609e19d](https://github.com/drackp2m/chess-pecker/commit/609e19da6260f535416b84dfc0275314dea35358)) by Marc Jovaní González
- add the big candidates and pin each pass to its prompt shape ([c1f7265](https://github.com/drackp2m/chess-pecker/commit/c1f7265232dd7d5ded9b41b6adb8d9c65ae2b08e)) by Marc Jovaní González
- add the gender setting and inject it into every translation ([4e2e56b](https://github.com/drackp2m/chess-pecker/commit/4e2e56b51caaff5631d86f423d8b0b7b6246a86e)) by Marc Jovaní González
- add the shared ICU parser behind leavesOf and buildFrom ([1d9ae46](https://github.com/drackp2m/chess-pecker/commit/1d9ae46e3cdb45787055507d0921e32116913514)) by Marc Jovaní González
- check the forms of a key against one another ([2356edd](https://github.com/drackp2m/chess-pecker/commit/2356eddfb8a1f854427957af75680d460846e297)) by Marc Jovaní González
- export one XLIFF unit per plural or gender form ([b587522](https://github.com/drackp2m/chess-pecker/commit/b58752254b587ea4816760cb11247c7d0bf030af)) by Marc Jovaní González
- file a finished exercise under one of four bookmark lists ([e0f3151](https://github.com/drackp2m/chess-pecker/commit/e0f3151bdba8f6c2c156075bbd91a79b5ffa9b7f)) by Marc Jovaní González
- fly every piece off the board, with a setting to stop it ([84ef04d](https://github.com/drackp2m/chess-pecker/commit/84ef04dcc99b25e756d2ef296270bfb12fed88fd)) by Marc Jovaní González
- import the forms of a key back as one ICU string ([b3bc4b5](https://github.com/drackp2m/chess-pecker/commit/b3bc4b5e8fc5e14549510e6ddc8c22aa79a127ad)) by Marc Jovaní González
- infer the params.ts types from the ICU argument ([4bfb8e5](https://github.com/drackp2m/chess-pecker/commit/4bfb8e59e46b9a84074277aedf863f56de58baab)) by Marc Jovaní González
- mark the flip board button while the board is inverted ([df33875](https://github.com/drackp2m/chess-pecker/commit/df33875f8612e1c9f942ce6e5c025198be56022f)) by Marc Jovaní González
- mirror sent puzzle shares into a local store ([4f028b1](https://github.com/drackp2m/chess-pecker/commit/4f028b18f0c83fd211edc1aaaa9c0a23285520b8)) by Marc Jovaní González
- open free play on a closed exercise, recording none of it ([22ff064](https://github.com/drackp2m/chess-pecker/commit/22ff064a395fa04473afcea3c145ac10f866b650)) by Marc Jovaní González
- prune the models and remember what a pass cost ([539b233](https://github.com/drackp2m/chess-pecker/commit/539b233b6bf51af57e96f63b3a525107c509e4de)) by Marc Jovaní González
- settle on gemma4-e4b-optiq and write the decision down ([d5f9745](https://github.com/drackp2m/chess-pecker/commit/d5f9745855938f4298a5289f9e9a2ad477ee2b7d)) by Marc Jovaní González
- share solved exercises as challenges between friends ([70e37d4](https://github.com/drackp2m/chess-pecker/commit/70e37d4a233728dd26246ad52b149d44f7bea92b)) by Marc Jovaní González
- show downloaded model sizes in --list-models ([4f6d2df](https://github.com/drackp2m/chess-pecker/commit/4f6d2df69a6e4bcdbf6498bf981d24d95e997c30)) by Marc Jovaní González
- teach i18n:check the ICU rules and the plural whitelist ([c11e239](https://github.com/drackp2m/chess-pecker/commit/c11e239c45337df14d1d52825421847c85b1c77a)) by Marc Jovaní González
- teach the catalogue ICU and swap in the messageformat transpiler ([cf89114](https://github.com/drackp2m/chess-pecker/commit/cf89114b8fba64b2237bd5e2377d9179a3a859d0)) by Marc Jovaní González
- tell the model what the general plural form is for ([6c69359](https://github.com/drackp2m/chess-pecker/commit/6c69359a5eae0bceee401680200f870d6da6e3b6)) by Marc Jovaní González
- tell the model which numbers select each plural form ([11bf637](https://github.com/drackp2m/chess-pecker/commit/11bf6375a57876c5806fe823d25df43d4c925333)) by Marc Jovaní González
- tell the model which person each gender form is for ([7a1b635](https://github.com/drackp2m/chess-pecker/commit/7a1b63506f40dfaffe8e8ce4c799f5f101fc0da1)) by Marc Jovaní González
- theme the multiple select with wrapped names and chips ([a297d9e](https://github.com/drackp2m/chess-pecker/commit/a297d9ef474298a742f696b59ca5c1c268c062f6)) by Marc Jovaní González
- theme the textarea with row, growth and resize controls ([e6ae6b8](https://github.com/drackp2m/chess-pecker/commit/e6ae6b8b5e62ff959a20cae965b9909af8d76cec)) by Marc Jovaní González

### 🎨 Styles

- brighten board colors, notifications under navbar ([fda3880](https://github.com/drackp2m/chess-pecker/commit/fda3880c432b1dcba20ab5fe58fed498895a1c02)) by Marc Jovaní González
- draw chess pieces from their own outlines, not a mask ([65aa8b5](https://github.com/drackp2m/chess-pecker/commit/65aa8b528160b0789b70857d3bd4d8db077a0f50)) by Marc Jovaní González
- lift a dragged piece instead of teleporting it ([b943a26](https://github.com/drackp2m/chess-pecker/commit/b943a2633696ae10d3214c1e6eb782085fec0fe6)) by Marc Jovaní González
- move textarea vertical padding to the label wrapper ([9e507b4](https://github.com/drackp2m/chess-pecker/commit/9e507b499a014c9d60e5dbae6fc0fefa43697ada)) by Marc Jovaní González
- theme the multiple select with wrapped names and chips ([c2f1e57](https://github.com/drackp2m/chess-pecker/commit/c2f1e57a4f48dac4ae811972ae8e8620bfeb4d3c)) by Marc Jovaní González
- write down why mistral-24b is a dead end here ([98c8a99](https://github.com/drackp2m/chess-pecker/commit/98c8a99dacceeb482f8608924fbd350ef720899c)) by Marc Jovaní González

### 🧪 Tests

- add the i18n translation bench with its gold set ([4eaa592](https://github.com/drackp2m/chess-pecker/commit/4eaa5929fad896c9384fea4414187deb473321fd)) by Marc Jovaní González
- assert the swallowed repair error instead of leaking it to stderr ([83e960c](https://github.com/drackp2m/chess-pecker/commit/83e960c8bc65c43bdf8025236123242965d7e0c3)) by Marc Jovaní González
- cover the fallback to the source language ([dcae1bd](https://github.com/drackp2m/chess-pecker/commit/dcae1bdb4f57ba656de5b6a0e84744ba73c8979b)) by Marc Jovaní González
- cover the plural whitelist and the finding columns ([4209aed](https://github.com/drackp2m/chess-pecker/commit/4209aedc2cc204e5cb850c5fde02e54e77fde880)) by Marc Jovaní González
- keep a failed i18n test from leaking the TestBed ([aaf9fa7](https://github.com/drackp2m/chess-pecker/commit/aaf9fa7f8606675beec2a48eafa9b414f8a7e9a9)) by Marc Jovaní González
- mock ShareStore in puzzle specs to silence IndexedDB noise ([8453c9c](https://github.com/drackp2m/chess-pecker/commit/8453c9c9d8c7995425945e6da7b073753d759f59)) by Marc Jovaní González
- move the bench corpus and its gold to ICU braces ([4a5b008](https://github.com/drackp2m/chess-pecker/commit/4a5b00843f006cc089bf93447d284c02a8a4cd4c)) by Marc Jovaní González

### ♻️ Code Refactoring

- decouple skip-prompt from the chosen bookmark list ([35786a3](https://github.com/drackp2m/chess-pecker/commit/35786a3beb1f93ae1d1abfb2dfed4119e6bfbc71)) by Marc Jovaní González
- group svg icons by their shared aspect ratio ([fd16603](https://github.com/drackp2m/chess-pecker/commit/fd16603c8ca1b4774e85206231476f7a8ac23022)) by Marc Jovaní González
- rename HF_TOKEN to HUGGINGFACE_TOKEN ([c6730b9](https://github.com/drackp2m/chess-pecker/commit/c6730b92c6285383211639d6b3d2268079f3d3d9)) by Marc Jovaní González
- split the ICU bench by the scope each key has ([e540755](https://github.com/drackp2m/chess-pecker/commit/e5407557dbeb235b50725c2cee1fc2ee21369e37)) by Marc Jovaní González
- split the selectable languages from the known ones ([99d9708](https://github.com/drackp2m/chess-pecker/commit/99d97082fbd621011248ad5557648b83f050536c)) by Marc Jovaní González
- unify the param regex into message.mjs ([d7b1004](https://github.com/drackp2m/chess-pecker/commit/d7b1004e90b151d42f77552f35710eb389cba993)) by Marc Jovaní González

### 🐛 Bug Fixes

- anchor every i18n finding where it can be fixed ([c50fb0e](https://github.com/drackp2m/chess-pecker/commit/c50fb0edcb2f5dfc1b7f3e31c12caf6e4402a89b)) by Marc Jovaní González
- anchor the LANGUAGES regex to its declaration ([82bc6d4](https://github.com/drackp2m/chess-pecker/commit/82bc6d4aaed0a97670096d81441127fb3fbb14d3)) by Marc Jovaní González
- choose the correct source sheet in the fan-out ([2840df8](https://github.com/drackp2m/chess-pecker/commit/2840df8e54df81892fed06b0154873bc7a72a1dc)) by Marc Jovaní González
- configurable settings, dedicated output channel to the ULID i18n extension ([681ea00](https://github.com/drackp2m/chess-pecker/commit/681ea00f7249242d0f60c5c0ddc60b36d90a95f2)) by Marc Jovaní González
- disable give up after it reveals the solution once ([131808b](https://github.com/drackp2m/chess-pecker/commit/131808b44c6623c315136d0f776568a0bc9ae65b)) by Marc Jovaní González
- don't select a piece from dropping a drag on an illegal square ([75ea818](https://github.com/drackp2m/chess-pecker/commit/75ea818f5281afc1dbe7cbb98e532b008e366b10)) by Marc Jovaní González
- fall back to the source language on a missing key ([19a7942](https://github.com/drackp2m/chess-pecker/commit/19a79428165bbf15a0148d329d4bf8accdc44ac9)) by Marc Jovaní González
- land a dragged piece from where the pointer dropped it ([fbea75c](https://github.com/drackp2m/chess-pecker/commit/fbea75ce46855d2f8f92c23c4ae03dc8e2ee8a00)) by Marc Jovaní González
- language codes ([dc03f29](https://github.com/drackp2m/chess-pecker/commit/dc03f297321d00da73c5004e1f16291cdd795549)) by Marc Jovaní González
- leave the catalogue alone on a round trip with no edits ([b7bda0c](https://github.com/drackp2m/chess-pecker/commit/b7bda0cd4f0e46baf1d6653d1c7a859c5d680f32)) by Marc Jovaní González
- order i18n findings list to match the table's scope and column order ([36b3b80](https://github.com/drackp2m/chess-pecker/commit/36b3b80722c84869993ed1f8b432aafc01556f5e)) by Marc Jovaní González
- pinpoint param drift findings to their exact source and declaration lines ([6974992](https://github.com/drackp2m/chess-pecker/commit/6974992e618072a2090c23d3ef928af24055e19c)) by Marc Jovaní González
- silence the i18n noise a pending source key causes ([9850fd7](https://github.com/drackp2m/chess-pecker/commit/9850fd778d66174fa7c213db6ffebb5e697d41a7)) by Marc Jovaní González
- stop pieces shuffling when the one beside them is raised ([c0abc03](https://github.com/drackp2m/chess-pecker/commit/c0abc039766ad9f02be64e53105fb9a530f9ec93)) by Marc Jovaní González

### 🏗️‍ Build System

- drop the tooling tests from the deploy workflow ([6141111](https://github.com/drackp2m/chess-pecker/commit/6141111881142a3291c66170b05ecd8537a1f24f)) by Marc Jovaní González
- report the tooling tests like Vitest ([23fbc7c](https://github.com/drackp2m/chess-pecker/commit/23fbc7c9ac7de71445dd827ae10426a6329c59a5)) by Marc Jovaní González
- run the tooling tests from the hook and CI ([7ace627](https://github.com/drackp2m/chess-pecker/commit/7ace627a3959b9898730cc1e00272653b27f865a)) by Marc Jovaní González

### 🎒 Chores

- blank the four languages pending translation ([a7eeae5](https://github.com/drackp2m/chess-pecker/commit/a7eeae57167feb64b128833ec827957584effac2)) by Marc Jovaní González
- give i18n export and import a --help text ([4e8bf53](https://github.com/drackp2m/chess-pecker/commit/4e8bf533ddf6eb48db8fc7c7467b5b157d78d8d9)) by Marc Jovaní González
- hide non-blocking i18n:check findings unless --verbose ([5c364be](https://github.com/drackp2m/chess-pecker/commit/5c364be5f30a0d83f649fc0acddc589fe4f9c23e)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.25.2...v1.26.0

# v1.25.2 (2026-08-25)

## What's Changed

### 🐛 Bug Fixes

- floor a cycle's expected items at its set size ([d5a2cfc](https://github.com/drackp2m/chess-pecker/commit/d5a2cfce34ac121f8b9e3577f0792f31c68e95b0)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.25.1...v1.25.2

# v1.25.1 (2026-08-25)

## What's Changed

### 🐛 Bug Fixes

- stop a half-uploaded cycle from passing as whole ([a0c8943](https://github.com/drackp2m/chess-pecker/commit/a0c894385b5f66708c2dfb390f60ea7d0da9c39c)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.25.0...v1.25.1

# v1.25.0 (2026-08-25)

## What's Changed

### ✨ Features

- add first-run intro flow with step indicator and progress tracking ([65dc938](https://github.com/drackp2m/chess-pecker/commit/65dc938721ecacb79505eff3d602f7b7fee843f1)) by Marc Jovaní González
- let a move be given while the rival is still moving ([273bef8](https://github.com/drackp2m/chess-pecker/commit/273bef89219afbfcba696e9ba8baa72b33dd0e78)) by Marc Jovaní González
- let a training start with no account and no network ([bbb7024](https://github.com/drackp2m/chess-pecker/commit/bbb702420890a6a2c88596b2df482b00062485b3)) by Marc Jovaní González
- stamp who this device belongs to, and empty it for anyone else ([45d4b83](https://github.com/drackp2m/chess-pecker/commit/45d4b8347b9c5b4af29d82dc4e5d2656053488a7)) by Marc Jovaní González

### 🧪 Tests

- cover who owns the device when a session opens ([927e171](https://github.com/drackp2m/chess-pecker/commit/927e171c175419a84f7d75e425e97a6e4b7d9825)) by Marc Jovaní González
- pin the contracts that let a device train without an account ([b0cae99](https://github.com/drackp2m/chess-pecker/commit/b0cae99e079cae3fbacc61d85bb2bcfff5628d3e)) by Marc Jovaní González

### ♻️ Code Refactoring

- all comments compressed and translated into english ([4ce4d02](https://github.com/drackp2m/chess-pecker/commit/4ce4d025f927440a1f9a1a12f7df225199ae31f1)) by Marc Jovaní González
- give every concept a single name in the glossary ([c971404](https://github.com/drackp2m/chess-pecker/commit/c9714047319722aec09d6f1fd7c0f8d7f90faf62)) by Marc Jovaní González
- settle activity verdict and free-play run naming ([4a567db](https://github.com/drackp2m/chess-pecker/commit/4a567db0303946d90c17144bdbd9b95de2dbf4f2)) by Marc Jovaní González

### 🐛 Bug Fixes

- keep one history entry so the back gesture lands nowhere ([016445a](https://github.com/drackp2m/chess-pecker/commit/016445a472b72df250f69a5d953a23908297b9eb)) by Marc Jovaní González
- keep the board closed while the opponent's move is still announcing ([519ad35](https://github.com/drackp2m/chess-pecker/commit/519ad3505dae77f17020f34fef8ad3a3e5d4a179)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.24.0...v1.25.0

# v1.24.0 (2026-08-23)

## What's Changed

### ✨ Features

- choose between the specialist and the one who sees the bigger picture ([9de8c35](https://github.com/drackp2m/chess-pecker/commit/9de8c35ffa49f9bd3555d54df931adc080f06ff8)) by Marc Jovaní González
- dress a radio group as a segmented control ([b54da24](https://github.com/drackp2m/chess-pecker/commit/b54da24d5d1226e9d51adc3f2399ba3a33123e36)) by Marc Jovaní González
- let a language go back to being untranslated ([052f808](https://github.com/drackp2m/chess-pecker/commit/052f8089876763f34399c45728e12faeab7554e7)) by Marc Jovaní González
- mark a translation stale when its source moves ([88f7333](https://github.com/drackp2m/chess-pecker/commit/88f7333452a8091c8f202555b33f7513df3feb1e)) by Marc Jovaní González
- send the translator a file that cannot cheat ([c936970](https://github.com/drackp2m/chess-pecker/commit/c936970f4651c4a0602fcd89c280ca5df6c50305)) by Marc Jovaní González
- split the translator and give it a second opinion ([48a35c8](https://github.com/drackp2m/chess-pecker/commit/48a35c847d3205e106ac0300bc3916ef078254a9)) by Marc Jovaní González
- tell the translator what the words mean ([f2d0574](https://github.com/drackp2m/chess-pecker/commit/f2d0574e7f5bcb087692b6a2ef7cc8337a3da55d)) by Marc Jovaní González

### 🎨 Styles

- unwrap the paragraphs of the i18n context ([9093dd4](https://github.com/drackp2m/chess-pecker/commit/9093dd48158e670d35b0ef1d5b740625bff43b9d)) by Marc Jovaní González

### 🧪 Tests

- lock what the board draws while a move crosses it ([2ffa633](https://github.com/drackp2m/chess-pecker/commit/2ffa63383542bb216d5b8e7a3de8dbb68e9bbb74)) by Marc Jovaní González

### ♻️ Code Refactoring

- give each i18n command its own drawer ([00bdb49](https://github.com/drackp2m/chess-pecker/commit/00bdb49f65728b8f287a0081aa9c2bcacf6e365a)) by Marc Jovaní González
- point the extension at the new module paths ([644d0cd](https://github.com/drackp2m/chess-pecker/commit/644d0cd62d667198f01342bac531c4962ab09fbc)) by Marc Jovaní González

### 🐛 Bug Fixes

- hold everything a move brings until the piece lands ([431b490](https://github.com/drackp2m/chess-pecker/commit/431b4902bbaa58a0960b67243400d5fd6835d44a)) by Marc Jovaní González
- settle how the board stacks and drop slides it left behind ([456305b](https://github.com/drackp2m/chess-pecker/commit/456305b6e136db9ce4bfcf85bf51efc7c3b61f9a)) by Marc Jovaní González

### 🎒 Chores

- give the translator its own home and env ([0b37878](https://github.com/drackp2m/chess-pecker/commit/0b37878e78ecc596fa8a00fdbb2f791fffa3a78c)) by Marc Jovaní González
- refresh the French training strings ([8d07136](https://github.com/drackp2m/chess-pecker/commit/8d071367930a2cb9ec299cbdaf2e6cdcf6291359)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.23.0...v1.24.0

# v1.23.0 (2026-08-18)

## What's Changed

### ✨ Features

- wait only for downloads, and upload as you solve ([1e2a82a](https://github.com/drackp2m/chess-pecker/commit/1e2a82ad004035de5ebe2e195b520c441865fae8)) by Marc Jovaní González

### 🧪 Tests

- pin a pass to the exercises that are its own ([a198190](https://github.com/drackp2m/chess-pecker/commit/a198190c416ceb7767b55aa6b8b31f9e045e92b7)) by Marc Jovaní González
- pin each state, the branch turned down and the tally ([e0fee67](https://github.com/drackp2m/chess-pecker/commit/e0fee67d4f77efd3b07de18529e7ff899594e496)) by Marc Jovaní González
- pin that a download waits for what has not gone up ([d3a58ad](https://github.com/drackp2m/chess-pecker/commit/d3a58ad245dc035ca09c8f9203633a44852b0957)) by Marc Jovaní González
- pin that a repeated push does not duplicate ([4712703](https://github.com/drackp2m/chess-pecker/commit/4712703a946a5d564a74d6fc90eb397a1601eb8a)) by Marc Jovaní González
- pin the gate that lets the app start ([6ca35c7](https://github.com/drackp2m/chess-pecker/commit/6ca35c705438a43eff9b3d80a4d5a7b5c9583c1c)) by Marc Jovaní González
- pin the marks a synced row carries ([3fdfc79](https://github.com/drackp2m/chess-pecker/commit/3fdfc79a830df8bbd9aa6b92737a9224e6c601fd)) by Marc Jovaní González
- pin the rekey whole and the seal to its manifest ([39d6a5e](https://github.com/drackp2m/chess-pecker/commit/39d6a5eea726bcee96f4f942760dfd311a0ead6d)) by Marc Jovaní González
- pin the tree order and what its budget leaves out ([78bd89c](https://github.com/drackp2m/chess-pecker/commit/78bd89c4666563bc6a153236cf28344c7ec034b8)) by Marc Jovaní González
- pin what a cut upload must not mark as lost ([1e604b0](https://github.com/drackp2m/chess-pecker/commit/1e604b053b7ff997cec6fce880f2a5cc9de0ff54)) by Marc Jovaní González

### ♻️ Code Refactoring

- dynamic languages on setting page ([75c24cd](https://github.com/drackp2m/chess-pecker/commit/75c24cd238681584fbfbc83121ddfc138cb9dfc6)) by Marc Jovaní González

### 🐛 Bug Fixes

- keep a crippled pass out of the next one ([2ac2c25](https://github.com/drackp2m/chess-pecker/commit/2ac2c25b7073ec48da9532820beb54bdfed8958b)) by Marc Jovaní González
- let an aborted transaction die without a scream ([8c84c73](https://github.com/drackp2m/chess-pecker/commit/8c84c73124486e07b10af8a25bba48b386e4791b)) by Marc Jovaní González
- open the gate even if the pass breaks ([8fba34e](https://github.com/drackp2m/chess-pecker/commit/8fba34e9c5f18df84ca9b139b722d226d0abe7a3)) by Marc Jovaní González
- say which migration blew up, and quiet the rest ([d124e56](https://github.com/drackp2m/chess-pecker/commit/d124e56943bc986a139f5c2cac420758012a8f33)) by Marc Jovaní González

### 🏗️‍ Build System

- add fake-indexeddb to test the local tree ([12fb6c1](https://github.com/drackp2m/chess-pecker/commit/12fb6c12c147f37057e4e4e38d1294911a1ee328)) by Marc Jovaní González

### 🎒 Chores

- split Angular app and unit test projects ([4b0524c](https://github.com/drackp2m/chess-pecker/commit/4b0524c61fbc6f89e4b62dc3d7884d3a48f22d96)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.22.1...v1.23.0

# v1.22.1 (2026-08-18)

## What's Changed

### 🐛 Bug Fixes

- page the attempt history by row, not by date ([41482ed](https://github.com/drackp2m/chess-pecker/commit/41482edf400e7f81c01a72e8fdcbd514be2d2346)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.22.0...v1.22.1

# v1.22.0 (2026-08-18)

## What's Changed

### ✨ Features

- add Russian language support ([97f07f9](https://github.com/drackp2m/chess-pecker/commit/97f07f9583fbd19c6c6d6c2e12b9440f2878cf33)) by Marc Jovaní González
- client refs and the training push contract ([325a7cc](https://github.com/drackp2m/chess-pecker/commit/325a7cccc9264de7065eeed10ee87fdb9c3eee4a)) by Marc Jovaní González
- download the training tree from the server ([9be7b10](https://github.com/drackp2m/chess-pecker/commit/9be7b10cc9dfb18ffad0616ad52eb3e549688951)) by Marc Jovaní González
- store sync state and sync status screen ([d05f8ae](https://github.com/drackp2m/chess-pecker/commit/d05f8aea214be225ef0ac28f7dba45cc5673e6ec)) by Marc Jovaní González
- sync cycle, boot gate and splash ([e20242d](https://github.com/drackp2m/chess-pecker/commit/e20242d6fe2ee863bc37959bb990919a84818d95)) by Marc Jovaní González
- sync summary endpoint and one cursor store ([6461b32](https://github.com/drackp2m/chess-pecker/commit/6461b32972129f43098756c6358f3e6dacb5234f)) by Marc Jovaní González
- upload to the server and pruning of flow endpoints ([313022f](https://github.com/drackp2m/chess-pecker/commit/313022f02c4f788d4e8d8392c3b3bb3ef75ba21c)) by Marc Jovaní González

### ♻️ Code Refactoring

- make IndexedDB the only write path ([ac9c041](https://github.com/drackp2m/chess-pecker/commit/ac9c041fc0a5a6b824adb525d3277b993e2893c6)) by Marc Jovaní González
- split the attempt draft into its own local store ([f5ea628](https://github.com/drackp2m/chess-pecker/commit/f5ea6283b9d56a1d2a7413c8c00155ff97255cc8)) by Marc Jovaní González

### 🐛 Bug Fixes

- refuse to train on a partial replica ([bda9299](https://github.com/drackp2m/chess-pecker/commit/bda9299b8df393614fd00ff3705be7a0168cbd5c)) by Marc Jovaní González

### 🚀 Performance Improvements

- trim the tree download with a since cursor ([1bf879d](https://github.com/drackp2m/chess-pecker/commit/1bf879d476f50c156f3624b30cd698cb97908ae3)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.21.0...v1.22.0

# v1.21.0 (2026-08-16)

## What's Changed

### ✨ Features

- local-first training, history restore, fix navigation ([59b1f1c](https://github.com/drackp2m/chess-pecker/commit/59b1f1ca2bdff4f84db1f85e43d7be2813d1a761)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.20.0...v1.21.0

# v1.20.0 (2026-08-16)

## What's Changed

### ✨ Features

- add playback runner over timeline programs ([6c92340](https://github.com/drackp2m/chess-pecker/commit/6c923407060ec8034effe8a7da86591b5c8caed0)) by Marc Jovaní González
- restore puzzle board from saved attempt on reload ([ea6d48f](https://github.com/drackp2m/chess-pecker/commit/ea6d48fff0875e70485f1e0b060c01b969eda5c3)) by Marc Jovaní González
- timeline, training history ([2c5ce1a](https://github.com/drackp2m/chess-pecker/commit/2c5ce1a42da9e8f9488500e72c3c71743c615648)) by Marc Jovaní González

### ♻️ Code Refactoring

- extract record fold to replay.ts with degradation ([9c6011e](https://github.com/drackp2m/chess-pecker/commit/9c6011ecaed2d326bc8317a3bfe01d5b1391fd56)) by Marc Jovaní González
- replace replay events with playback programs ([6539a4a](https://github.com/drackp2m/chess-pecker/commit/6539a4a1cab08915960ced1c855319a01d20bf37)) by Marc Jovaní González
- share one clock between player and playback ([bca1406](https://github.com/drackp2m/chess-pecker/commit/bca140667aae3899a3f6e35784180eb8f33ce50d)) by Marc Jovaní González
- signal derivation for puzzle line state ([822f445](https://github.com/drackp2m/chess-pecker/commit/822f4458b3668c9753275412d92932d2b7ffbe7f)) by Marc Jovaní González
- wire playback programs for reply and reveal ([7d15629](https://github.com/drackp2m/chess-pecker/commit/7d156291b2bacce44024dbf3b6f554db99d17fb0)) by Marc Jovaní González

### 🐛 Bug Fixes

- anchor revealed answer so it can be stepped ([52f3161](https://github.com/drackp2m/chess-pecker/commit/52f3161a404eb23d33907c497e82afa5ef453868)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.19.3...v1.20.0

# v1.19.3 (2026-08-14)

## What's Changed

### 🐛 Bug Fixes

- prevent missing translation message on settings when change it ([751d031](https://github.com/drackp2m/chess-pecker/commit/751d03168c31ef0d079a4e318088b2880b9e47d1)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.19.2...v1.19.3

# v1.19.2 (2026-08-13)

## What's Changed

### 🐛 Bug Fixes

- improve chart visualization, remove re-render bugs ([35f7557](https://github.com/drackp2m/chess-pecker/commit/35f75572ec5c0b029fb83d3e8e8ceb7e0ed3d9c9)) by Marc Jovaní González
- page load works ([ad121e1](https://github.com/drackp2m/chess-pecker/commit/ad121e1099147d2e1dd8a15537bf25435b93fa16)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.19.1...v1.19.2

# v1.19.1 (2026-08-12)

## What's Changed

### 🐛 Bug Fixes

- connection status chevron centered, show server status with notification ([8b9784e](https://github.com/drackp2m/chess-pecker/commit/8b9784eba37a7472726baf59d580fb7e27a0c219)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.19.0...v1.19.1

# v1.19.0 (2026-08-12)

## What's Changed

### ✨ Features

- cache API puzzles into IndexedDB during training ([99bdc4a](https://github.com/drackp2m/chess-pecker/commit/99bdc4a41a6983eaa3ff673e6904b6ef4d989a48)) by Marc Jovaní González
- icons for network feedback ([cb3d884](https://github.com/drackp2m/chess-pecker/commit/cb3d884005ddb9659454463926725aa000c5bf11)) by Marc Jovaní González
- sync training activity with offline cache ([d0d5b21](https://github.com/drackp2m/chess-pecker/commit/d0d5b21aeb3deeda56c9e056ba8f823f1931e628)) by Marc Jovaní González

### 🐛 Bug Fixes

- charts now scroll with two fingers ([2d583de](https://github.com/drackp2m/chess-pecker/commit/2d583de2fe68598bb8dad715fa3d8841ca19df21)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.18.0...v1.19.0

# v1.18.0 (2026-08-11)

## What's Changed

### ✨ Features

- optimize svg and add new icons ([c1dd343](https://github.com/drackp2m/chess-pecker/commit/c1dd3430cdd80ad8f0be25489c767b9b56815438)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.17.0...v1.18.0

# v1.17.0 (2026-08-11)

## What's Changed

### ✨ Features

- add catalan to available languages ([d6a9b79](https://github.com/drackp2m/chess-pecker/commit/d6a9b796f951669bb11cc0cff0bf986d9e5229b8)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.16.0...v1.17.0

# v1.16.0 (2026-08-11)

## What's Changed

### ✨ Features

- improve charts and training section ([e99751c](https://github.com/drackp2m/chess-pecker/commit/e99751c297475a7aa42f29fe417dbf91705d063a)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.15.1...v1.16.0

# v1.15.1 (2026-08-10)

## What's Changed

### 🐛 Bug Fixes

- chart legend with correct colors ([94d56b4](https://github.com/drackp2m/chess-pecker/commit/94d56b4560a9b371d9f39ad0d21718dc1f070524)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.15.0...v1.15.1

# v1.15.0 (2026-08-10)

## What's Changed

### ✨ Features

- create activity component ([e5d2d46](https://github.com/drackp2m/chess-pecker/commit/e5d2d460edf3626705bcfd11c0e7ead6cafde424)) by Marc Jovaní González
- first iteration of activity chart component ([215c96e](https://github.com/drackp2m/chess-pecker/commit/215c96ebffa07f03af60aa6f97f261b8f1477d37)) by Marc Jovaní González
- gt data from backend for training chart ([206de64](https://github.com/drackp2m/chess-pecker/commit/206de64a1bc3c76692651fe434ece20d55d3c44b)) by Marc Jovaní González
- sample chart on training page ([5894f94](https://github.com/drackp2m/chess-pecker/commit/5894f941dc65b7e050ff59b99194c31e6eb68a7b)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.14.0...v1.15.0

# v1.14.0 (2026-08-09)

## What's Changed

### ✨ Features

- all app translated, new language setting ([b935443](https://github.com/drackp2m/chess-pecker/commit/b9354435af6f32126858c2a5d627696ed6e96f8d)) by Marc Jovaní González

### 🧪 Tests

- create exploration spec, and fixe some bugs on this ([f1f1813](https://github.com/drackp2m/chess-pecker/commit/f1f18139a6187917d56fbc1838d61e44ea9ec166)) by Marc Jovaní González
- remove `element?.scrollTo is not a function` error ([b9ed0a1](https://github.com/drackp2m/chess-pecker/commit/b9ed0a15fb54468cb5bf2db5d7ee27dd93b5cda5)) by Marc Jovaní González

### 🐛 Bug Fixes

- can't move opponent on main line when have mistake ([510dbc8](https://github.com/drackp2m/chess-pecker/commit/510dbc88a27caa85b5601ab928b1bb8e23d58eee)) by Marc Jovaní González
- recover navbar glass effect ([7ffe02e](https://github.com/drackp2m/chess-pecker/commit/7ffe02ecaa1161c09885d094b9874393aa0a74ab)) by Marc Jovaní González
- the time that enables the aid is the time that kept the exercise visible ([a06964a](https://github.com/drackp2m/chess-pecker/commit/a06964ace1d37bcbc8197c6c09694ff62db5d930)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.13.0...v1.14.0

# v1.13.0 (2026-08-08)

## What's Changed

### ✨ Features

- i18n plugin now support typed params ([b0e339a](https://github.com/drackp2m/chess-pecker/commit/b0e339ae72465a10b3dea450451ac317ea227472)) by Marc Jovaní González
- improve i18n checker ([71b7be2](https://github.com/drackp2m/chess-pecker/commit/71b7be2efb9a65826b94c5f9265bd07630a7ea4e)) by Marc Jovaní González

### 🧪 Tests

- strong tests for puzzle navigation constraints ([fa8fe36](https://github.com/drackp2m/chess-pecker/commit/fa8fe36f4b2c1baeedb0ff876429777b1ce658b6)) by Marc Jovaní González

### 🐛 Bug Fixes

- Plays the correct animation when resuming a game with the cursor back ([3b17f14](https://github.com/drackp2m/chess-pecker/commit/3b17f14c3cbc11866edd975ff69d01fc1bed3b7f)) by Marc Jovaní González
- trying to fix the audio loss errors for the third time... ([e5c48be](https://github.com/drackp2m/chess-pecker/commit/e5c48be2a9536a3a2396b020af51a4751478c050)) by Marc Jovaní González

### 🎒 Chores

- auto load i18n plugin ([9814981](https://github.com/drackp2m/chess-pecker/commit/98149811b62d22d79722d9e6e14bb2773e493eb6)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.12.0...v1.13.0

# v1.12.0 (2026-08-07)

## What's Changed

### ✨ Features

- translate dashboard, create script and plugin for i18n with Transloco 🤪 ([8be069d](https://github.com/drackp2m/chess-pecker/commit/8be069d59cdf054de608c6fd81cc574ac81bb7be)) by Marc Jovaní González

### 🎨 Styles

- add two new icons ([cf40ae9](https://github.com/drackp2m/chess-pecker/commit/cf40ae963c0eaaa4a4c05e2bdbc9d457b56657ea)) by Marc Jovaní González

### ♻️ Code Refactoring

- rename plugin to transloco-ulid-i18n ([ff13401](https://github.com/drackp2m/chess-pecker/commit/ff1340141c8256a810bfa3c2e886f469b197570c)) by Marc Jovaní González

### 🐛 Bug Fixes

- castling and eating on the go have multiple animations ([60c5182](https://github.com/drackp2m/chess-pecker/commit/60c5182880b6d455f1f39afdf149af85170a0993)) by Marc Jovaní González

### 🏗️‍ Build System

- prevent loss progress when puzzle when it is half-closed ([f04e2ca](https://github.com/drackp2m/chess-pecker/commit/f04e2ca36dc074bcad71de4369fd380ba9a9930c)) by Marc Jovaní González

### 🎒 Chores

- fix pnpm store path for devcontainer ([327acd0](https://github.com/drackp2m/chess-pecker/commit/327acd00089dee13ec92cc2ad3537f7a9752ea42)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.11.1...v1.12.0

# v1.11.1 (2026-08-06)

## What's Changed

### ♻️ Code Refactoring

- friends are now profile, move user info from dashboard to profile ([6be2b95](https://github.com/drackp2m/chess-pecker/commit/6be2b95db96ac4c436c64e35e2c57d5ca9c68189)) by Marc Jovaní González

### 🐛 Bug Fixes

- prevent moves overflow in /match route ([e4ec180](https://github.com/drackp2m/chess-pecker/commit/e4ec1805263b941c0535eb7c2f430751566630d5)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.11.0...v1.11.1

# v1.11.0 (2026-08-05)

## What's Changed

### ✨ Features

- persist mistake count, hint use and closure with the attempt ([05d4b42](https://github.com/drackp2m/chess-pecker/commit/05d4b42259a815972133010deb0597ddcdc40525)) by Marc Jovaní González

### 🎨 Styles

- redesign board controls ([402285a](https://github.com/drackp2m/chess-pecker/commit/402285aad1880656619cf1faac278296b0d5cafc)) by Marc Jovaní González

### ♻️ Code Refactoring

- add new icons, change others, remove -solid suffix ([c296558](https://github.com/drackp2m/chess-pecker/commit/c29655846f42cf7fca241d74ba704a3911fb3db0)) by Marc Jovaní González
- extract the solving view into a shared component ([8fdcf6a](https://github.com/drackp2m/chess-pecker/commit/8fdcf6aae5661f3ca63009e49f391d7215cba7e9)) by Marc Jovaní González
- retire mistakesBeforeSolution and fix its migration ([b5b9c11](https://github.com/drackp2m/chess-pecker/commit/b5b9c11e7be3af6c28808f874434cf2dc96efea6)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.10.0...v1.11.0

# v1.10.0 (2026-08-05)

## What's Changed

### ✨ Features

- can reset exercise on free play ([328b5f4](https://github.com/drackp2m/chess-pecker/commit/328b5f4d2a5211c579911a1a5b9df9a731c6bbc9)) by Marc Jovaní González
- persist new fields on exercise resolution ([4063c64](https://github.com/drackp2m/chess-pecker/commit/4063c64ef78780d2a4506733af987df91660d5d7)) by Marc Jovaní González
- persist solve time in a local draft attempt row ([3914d25](https://github.com/drackp2m/chess-pecker/commit/3914d25ad02d4ed0947afddba16e359cf988fe86)) by Marc Jovaní González
- persist the imported set and reopen it on reload ([2f867cd](https://github.com/drackp2m/chess-pecker/commit/2f867cd43f8285cbc1028e20904834542ecb2422)) by Marc Jovaní González
- save main exercises moves and free play moves into store ([a43c85d](https://github.com/drackp2m/chess-pecker/commit/a43c85d43a0e994f4df8d7cbb8f12c81c62fb7ce)) by Marc Jovaní González

### 🧪 Tests

- does not solve the exercise with the solution played in free play ([cb6d3df](https://github.com/drackp2m/chess-pecker/commit/cb6d3df409098755c3c8338a06339253dd4bc1e2)) by Marc Jovaní González
- replays the main line back into the board each exploration started from ([8de6b1b](https://github.com/drackp2m/chess-pecker/commit/8de6b1bedf807ca1197e3753252d9745ae5bd92b)) by Marc Jovaní González

### ♻️ Code Refactoring

- excursions is now explorations ([ea5f37c](https://github.com/drackp2m/chess-pecker/commit/ea5f37c5e189bce9158a0d84490dcef908a8bf75)) by Marc Jovaní González

### 🎒 Chores

- add version to api status message ([59014e7](https://github.com/drackp2m/chess-pecker/commit/59014e76f07ea38e5e519425827d5017f1790bca)) by Marc Jovaní González
- AGENTS renamed to CLAUDE.md, summarize file ([58f2c44](https://github.com/drackp2m/chess-pecker/commit/58f2c4487e895443ddcfa57d36df2f145dcf58d1)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.9.0...v1.10.0

# v1.9.0 (2026-08-04)

## What's Changed

### ✨ Features

- add repository for puzzle, puzzle-set, cycle and attempt ([ea607d5](https://github.com/drackp2m/chess-pecker/commit/ea607d58df115f503102158192b33cb393d7b51b)) by Marc Jovaní González
- connection status, angular sdk and shared types between api and web ([631b1a6](https://github.com/drackp2m/chess-pecker/commit/631b1a6ce7e455b8f7c9fe2306e93bf2c19aad56)) by Marc Jovaní González

### 🎨 Styles

- add crop effect to menu items, and blur as backdrop filter ([3478bd9](https://github.com/drackp2m/chess-pecker/commit/3478bd9e967792251658fee6b84a3320f40445ea)) by Marc Jovaní González
- glass effect on navbar icons ([6ef7bec](https://github.com/drackp2m/chess-pecker/commit/6ef7becd96baa8810227c1d064eb7f3373c1a5e0)) by Marc Jovaní González

### ♻️ Code Refactoring

- move icons folder, improve chess piece style ([84c1bc7](https://github.com/drackp2m/chess-pecker/commit/84c1bc7d848b371ca855266953f27a9a821d9960)) by Marc Jovaní González

### 💻 Continuous Integration

- add integration tests on CI ([dbf0bab](https://github.com/drackp2m/chess-pecker/commit/dbf0bab86bd7f8cf868f29aa5171a6f717fffafb)) by Marc Jovaní González
- change jobs order ([187c82b](https://github.com/drackp2m/chess-pecker/commit/187c82b196c294f1c7c0fcaf83d318c1952f6f45)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.8.1...v1.9.0

# v1.8.1 (2026-08-03)

## What's Changed

### 🧪 Tests

- restore current puzzle when switch to another app page ([1fbe19f](https://github.com/drackp2m/chess-pecker/commit/1fbe19f9de79fd1968f7b07824cd10a2d897faed)) by Marc Jovaní González

### ♻️ Code Refactoring

- indexedDB migration, migrate settings to v2 ([4f1f4ce](https://github.com/drackp2m/chess-pecker/commit/4f1f4cecfb8b1d5567e7145acfa93e5402b60524)) by Marc Jovaní González
- remove orphan code from previous project ([5b06b15](https://github.com/drackp2m/chess-pecker/commit/5b06b154dd2af43d9642cb1b0eb9361ca6c7757a)) by Marc Jovaní González

### 🐛 Bug Fixes

- improve fen engine to check draw play ([80dc2b8](https://github.com/drackp2m/chess-pecker/commit/80dc2b84a6b369437fb57fc488003c74ca7a0fd5)) by Marc Jovaní González
- improve load FEN checks, solve error when load invalid CSV file ([dc51886](https://github.com/drackp2m/chess-pecker/commit/dc51886be215c5546c6fdebb09dd8c15ad84eee6)) by Marc Jovaní González
- prevent lost puzzle when navigate through the app ([9ccaa1d](https://github.com/drackp2m/chess-pecker/commit/9ccaa1d1f4b008729611cfd29002d7423fed93f8)) by Marc Jovaní González
- strict API, indexedDB migrations, fix settings db on idb ([61f9bb4](https://github.com/drackp2m/chess-pecker/commit/61f9bb4cb1874b5861bd05c6f1179cf43ead146e)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.8.0...v1.8.1

# v1.8.0 (2026-08-01)

## What's Changed

### ✨ Features

- menu on bottom ([8487942](https://github.com/drackp2m/chess-pecker/commit/8487942cf940b48e2b8e6a430af6796afd244fc4)) by Marc Jovaní González
- reorganize sections, show summary of your program in home page ([d3de680](https://github.com/drackp2m/chess-pecker/commit/d3de680da4dd7f3fe0818af1ec119bf2809f7869)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.7.0...v1.8.0

# v1.7.0 (2026-08-01)

## What's Changed

### ✨ Features

- auth interceptor ([245c4af](https://github.com/drackp2m/chess-pecker/commit/245c4af204b0864aa319fad12bcbef090274b57d)) by Marc Jovaní González

### ♻️ Code Refactoring

- remove unnecessary ([6ddd830](https://github.com/drackp2m/chess-pecker/commit/6ddd83040f6b38cefc796423372835913ea78092)) by Marc Jovaní González

### 🐛 Bug Fixes

- calibration puzzles now return all, including solveds ([79769a1](https://github.com/drackp2m/chess-pecker/commit/79769a146b082c0b6fcdd8373c69121c4abcf1fa)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.6.3...v1.7.0

# v1.6.3 (2026-08-01)

## What's Changed

### 🐛 Bug Fixes

- shrink summary headings and fix the reported Angular version ([0cfab48](https://github.com/drackp2m/chess-pecker/commit/0cfab48b33db2b98d033fe0c668a1bfd869215c9)) by Marc Jovaní González

### 💻 Continuous Integration

- push the release commit as the PAT owner and annotate api type errors ([685b9ca](https://github.com/drackp2m/chess-pecker/commit/685b9ca7a290ac9610e5884719dae61b20c231c4)) by Marc Jovaní González
- report test summaries and typecheck the api project ([87442ae](https://github.com/drackp2m/chess-pecker/commit/87442ae59dab2eb24e0b8f085981fa6eaa3f3546)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.6.2...v1.6.3

# v1.6.2 (2026-08-01)

## What's Changed

### 🐛 Bug Fixes

- push the release commit with a token the ruleset lets through ([ceea04d](https://github.com/drackp2m/chess-pecker/commit/ceea04de660068385750d5c484846b8645190456)) by Marc Jovaní González

### 📚 Documentation

- forbid agent co-author trailers in commits ([5c6cc7c](https://github.com/drackp2m/chess-pecker/commit/5c6cc7c598bb7e2293f037009dc0ca00841674f0)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.6.1...v1.6.2

# v1.6.1 (2026-08-01)

## What's Changed

### 🧪 Tests

- verify consistency in the animation of the pieces ([5bebe07](https://github.com/drackp2m/chess-pecker/commit/5bebe073199173ef47e9060b123765927b4b552a)) by Marc Jovaní González

### 🐛 Bug Fixes

- change movement animation option or flip board not play last move animation ([acd961a](https://github.com/drackp2m/chess-pecker/commit/acd961aac278923d0d09e62b6e653d80c2c80ce1)) by Marc Jovaní González

### 💻 Continuous Integration

- gate main with pull request checks ([b94c983](https://github.com/drackp2m/chess-pecker/commit/b94c98383282927bcc93e83a230ff5ffdea3acde)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.6.0...v1.6.1

# v1.6.0 (2026-07-31)

## What's Changed

### ✨ Features

- add settings for move speed and autoplay answer after fail ([f6e83db](https://github.com/drackp2m/chess-pecker/commit/f6e83db5a9784130da912318d5fb3632ab057e8c)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.5.0...v1.6.0

# v1.5.0 (2026-07-31)

## What's Changed

### ✨ Features

- add sound to exercises moves ([96d369f](https://github.com/drackp2m/chess-pecker/commit/96d369f88dd9ceefca43df20628c1d340669420b)) by Marc Jovaní González

### 🐛 Bug Fixes

- enable sonarjs/pseudo-random ([cd38a29](https://github.com/drackp2m/chess-pecker/commit/cd38a291a7daa4a69ab270a693772dd9c9c264a5)) by Marc Jovaní González

### 🎒 Chores

- create web CNAME ([0498e0d](https://github.com/drackp2m/chess-pecker/commit/0498e0d5ecf6b27daa386eb7fb7d0a349a9750f5)) by Marc Jovaní González
- try to use new domain on backend ([d3f507a](https://github.com/drackp2m/chess-pecker/commit/d3f507a9a1a1c0fb1dee67566dfa52e42854a270)) by Marc Jovaní González
- use api.chess.drackp2m.dev as backend url ([dd1dcba](https://github.com/drackp2m/chess-pecker/commit/dd1dcba727ff76a753d60e559683a6c5ff42d332)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.4.0...v1.5.0

# v1.4.0 (2026-07-30)

## What's Changed

### ✨ Features

- now can get the puzzle solution ([32cc7b3](https://github.com/drackp2m/chess-pecker/commit/32cc7b3a8713bebcc386e1acf1a33b54d99099e1)) by Marc Jovaní González

### ♻️ Code Refactoring

- adapt to new eslint rules ([14ceae1](https://github.com/drackp2m/chess-pecker/commit/14ceae1ef3d2070cabf962395140c022955fb16e)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.3.0...v1.4.0

# v1.3.0 (2026-07-30)

## What's Changed

### ✨ Features

- add import puzzles script, enable updloads up to 2mb ([5d0c3ef](https://github.com/drackp2m/chess-pecker/commit/5d0c3efca9dd4227e0c301d68a08a9ec780dd465)) by Marc Jovaní González

### 💻 Continuous Integration

- copy ./patches folder on Dockerfile for render deploy ([7f6e2ae](https://github.com/drackp2m/chess-pecker/commit/7f6e2aed19d6a41d628c3ada4eb41392bfc3ca5c)) by Marc Jovaní González
- fix ghp build ([76ff358](https://github.com/drackp2m/chess-pecker/commit/76ff3583cfeb45c8b11606a04bb64afa295d1f58)) by Marc Jovaní González
- ghp cron for keep api on render, fix api url on frontend ([4fa80d5](https://github.com/drackp2m/chess-pecker/commit/4fa80d5fd4954a923dfea1f93132640ad399a297)) by Marc Jovaní González
- ignore scripts for skip husky on deploy ([25fe53d](https://github.com/drackp2m/chess-pecker/commit/25fe53da0b659182daf8a59b7086e04d58185be9)) by Marc Jovaní González
- permissions on copy in Dockerfile ([288f86c](https://github.com/drackp2m/chess-pecker/commit/288f86c06f720cb632adf56e6181178a5e6c5be6)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.2.0...v1.3.0

# v1.2.0 (2026-07-30)

## What's Changed

### ✨ Features

- add friendship, user-block, training, puzzle, etc entities to api ([e80e1bb](https://github.com/drackp2m/chess-pecker/commit/e80e1bb44a7181a3c55874b3ff377d9548435c13)) by Marc Jovaní González
- add register and login ([1e15a96](https://github.com/drackp2m/chess-pecker/commit/1e15a965b3fcbec29c6d84b135027733a9932003)) by Marc Jovaní González
- create pages to manage friends and play exercises ([c48e7a2](https://github.com/drackp2m/chess-pecker/commit/c48e7a2cffeecf4dee151da60411afbb6ff6588f)) by Marc Jovaní González
- create pnpm workspace and add nestJS api ([2336854](https://github.com/drackp2m/chess-pecker/commit/23368541ee132594031854c9befbde3605f4b30c)) by Marc Jovaní González
- puzzle and user-setting entities ([bd6d28d](https://github.com/drackp2m/chess-pecker/commit/bd6d28d9393b1f5f8e0edc9fbcd7d57c1d787195)) by Marc Jovaní González

### 🧪 Tests

- using vitest ([bb01707](https://github.com/drackp2m/chess-pecker/commit/bb01707cb340c23c45f97ce676ff3bbfb9356fb6)) by Marc Jovaní González

### 📚 Documentation

- added ToDo's and FixMe's to the entrie project ([c0be2d2](https://github.com/drackp2m/chess-pecker/commit/c0be2d2aa4e7293776c07190523e66734a0a6147)) by Marc Jovaní González

### 💻 Continuous Integration

- prepare Dockerfile and render.yaml for api deploy ([b247a01](https://github.com/drackp2m/chess-pecker/commit/b247a01ecfaf26b1693dfdbf8a641edbed6ba1f0)) by Marc Jovaní González

### 🎒 Chores

- add api typecheck and tests to pre-commit hook ([1a848cd](https://github.com/drackp2m/chess-pecker/commit/1a848cdeba76a82ba01d2398f8569a5b598a9d9b)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.1.0...v1.2.0

# v1.1.0 (2026-07-27)

## What's Changed

### ✨ Features

- allow free play after wrong move in puzzles ([88564b9](https://github.com/drackp2m/chess-pecker/commit/88564b9591588cf007bf91ce28db60e6bd74f4f1)) by Marc Jovaní González

### 🐛 Bug Fixes

- end the exercise on any mate, not only the scripted one ([a0cbbde](https://github.com/drackp2m/chess-pecker/commit/a0cbbde50465c6af91884388c9c0e6b2e1521fb7)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/v1.0.0...v1.1.0

# v1.0.0 (2026-07-27)

## What's Changed

### ✨ Features

- add movement type to settings ([264482f](https://github.com/drackp2m/chess-pecker/commit/264482fbf1260bd5e5f93a72c9c015be70229406)) by Marc Jovaní González
- add settings to manage movement effects ([fc47855](https://github.com/drackp2m/chess-pecker/commit/fc47855ad4f71801d36db0201d607e303d848fe5)) by Marc Jovaní González

**Full Changelog**: https://github.com/drackp2m/chess-pecker/compare/...v1.0.0
