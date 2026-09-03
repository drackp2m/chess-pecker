FROM node:26.5-alpine3.24 AS base

RUN apk add --no-cache build-base python3 openssl zsh zsh-vcs

RUN npm install -g pnpm@11

ARG USER_GID
ARG USER_UID

RUN if [ -n "$USER_GID" ] && [ "$USER_GID" != "1000" ]; then \
			sed -i "s/node:x:1000:1000:/node:x:1000:$USER_GID:/" /etc/passwd; \
		fi && \
		if [ -n "$USER_UID" ] && [ "$USER_UID" != "1000" ]; then \
			sed -i "s/node:x:1000:/node:x:$USER_UID:/" /etc/passwd; \
		fi

WORKDIR /usr/src/app

RUN chown -R node:node /usr/src/app /home/node /usr/local/lib/node_modules /usr/local/bin



FROM base AS deps

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/web/package.json ./apps/web/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node libs/api-definitions/package.json ./libs/api-definitions/
COPY --chown=node:node patches ./patches

RUN pnpm install --frozen-lockfile --ignore-scripts



FROM deps AS dev-attached

USER root

RUN apk add --no-cache sudo

RUN addgroup node root \
			&& echo "%root ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers

USER node

RUN sudo apk add --no-cache git openssh-client gnupg vim ripgrep \
			zsh zsh-theme-powerlevel10k

RUN mkdir -p ~/.local/share/zsh/plugins \
			&& ln -s /usr/share/zsh/plugins/powerlevel10k ~/.local/share/zsh/plugins/

RUN git config --global --add safe.directory /usr/src/app

RUN mkdir /home/node/.gnupg \
			&& chmod 700 /home/node/.gnupg

CMD mkdir -p ~/.vscode-server/extensions \
			&& rm -f ~/.vscode-server/extensions/drackp2m.transloco-ulid-i18n-* \
			&& ver=$(node -p "require('./tools/vscode-plugins/transloco-ulid-i18n/package.json').version") \
			&& ln -sfn "$PWD/tools/vscode-plugins/transloco-ulid-i18n" ~/.vscode-server/extensions/drackp2m.transloco-ulid-i18n-$ver \
			&& tail -f /dev/null



FROM deps AS build-api

USER node

COPY --chown=node:node . .

RUN pnpm --filter @chesspecker/api run build

RUN pnpm --filter @chesspecker/api --prod deploy /tmp/api-deploy --legacy



FROM base AS serve-api

ARG API_PORT=3000

ENV NODE_ENV=production

ENV MIKRO_ORM_CLI_CONFIG=dist/shared/module/config/mikro-orm.config.js

EXPOSE $API_PORT

WORKDIR /usr/src/app/apps/api

RUN chown -R node:node /usr/src/app

USER node

COPY --chown=node:node --from=build-api /tmp/api-deploy ./

CMD ["sh", "-c", "node_modules/.bin/mikro-orm migration:up && node dist/main.js"]
