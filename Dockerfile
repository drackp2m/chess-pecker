FROM node:26.5-alpine3.24 AS base

RUN apk add --no-cache build-base python3 openssl pnpm zsh zsh-vcs

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

# pnpm comes from `packageManager` in package.json rather than @latest, so a
# --no-cache rebuild months from now installs the same version this lockfile was
# written with instead of whatever pnpm is current that day.
RUN pnpm install --frozen-lockfile



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

CMD ["sh", "-c", "tail -f /dev/null"]



FROM base AS deps-api-prod

USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/web/package.json ./apps/web/
COPY --chown=node:node apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod --filter @chesspecker/api



FROM deps AS build-api

USER node

COPY . .

RUN pnpm --filter @chesspecker/api run build



FROM base AS serve-api

ARG API_PORT=3000

# Not optional: below 'production' the API loads the local dev certificates
# (BootstrapHelper.nestApplicationOptions reads ../../.cert/*.pem), which are not
# in the image, and it would crash on boot.
ENV NODE_ENV=production

EXPOSE $API_PORT

# mikro-orm.config.ts resolves its entity glob ('dist/module/**/*.entity.js') and
# its migrations path relative to the cwd, so the app has to run from apps/api.
WORKDIR /usr/src/app/apps/api

RUN chown -R node:node /usr/src/app

USER node

COPY --chown=node:node --from=deps-api-prod /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node --from=deps-api-prod /usr/src/app/apps/api/node_modules ./node_modules
COPY --chown=node:node --from=build-api /usr/src/app/apps/api/package.json ./package.json
COPY --chown=node:node --from=build-api /usr/src/app/apps/api/dist ./dist

CMD ["node", "dist/main.js"]
