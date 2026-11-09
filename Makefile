NAME=ringlight-ng
DOMAIN=adilhanney.com
SCHEMA=org.gnome.shell.extensions.ringlight-ng

.PHONY: compile bundle install debug lint clean

compile: dist/extension.js dist/metadata.json dist/schemas/$(SCHEMA).gschema.xml dist/LICENSE dist/README.md

bundle: $(NAME)@$(DOMAIN).zip
$(NAME)@$(DOMAIN).zip: compile
	@(cd dist && zip ../$(NAME)@$(DOMAIN).zip -9r . -x *.d.ts)

install: bundle
	gnome-extensions install --force $(NAME)@$(DOMAIN).zip

debug: compile install
	dbus-run-session gnome-shell --devkit --wayland

lint: node_modules/.package-lock.json
	npx oxlint

clean:
	@rm -rf dist/ node_modules/.package-lock.json $(NAME)@$(DOMAIN)*.zip *.tsbuildinfo

###

node_modules/.package-lock.json: package.json package-lock.json
	npm ci

dist/extension.js: node_modules/.package-lock.json src/*.ts
	npx tsc

dist/metadata.json: metadata.json
	@mkdir -p dist/
	@cp metadata.json dist/
dist/schemas/$(SCHEMA).gschema.xml: src/schemas/$(SCHEMA).gschema.xml
	@mkdir -p dist/schemas/
	@cp src/schemas/$(SCHEMA).gschema.xml dist/schemas/$(SCHEMA).gschema.xml
dist/LICENSE: LICENSE
	@mkdir -p dist/
	@cp LICENSE dist/
dist/README.md: README.md
	@mkdir -p dist/
	@cp README.md dist/
