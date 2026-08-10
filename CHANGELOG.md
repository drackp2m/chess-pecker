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
