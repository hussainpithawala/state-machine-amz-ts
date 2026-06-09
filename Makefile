# ==============================================================================
# state-machine-amz-ts Makefile
# ==============================================================================

PACKAGE    := @hussainpithawala/state-machine-amz-ts
PKG_JSON   := package.json
VERSION    := $(shell node -p "require('./$(PKG_JSON)').version" 2>/dev/null || echo "unknown")
NODE_VER   := $(shell node --version 2>/dev/null || echo "not installed")
NPM_VER    := $(shell npm --version 2>/dev/null || echo "not installed")

# Colours
RESET  := $(shell tput sgr0    2>/dev/null || echo "")
BOLD   := $(shell tput bold    2>/dev/null || echo "")
GREEN  := $(shell tput setaf 2 2>/dev/null || echo "")
YELLOW := $(shell tput setaf 3 2>/dev/null || echo "")
CYAN   := $(shell tput setaf 6 2>/dev/null || echo "")
RED    := $(shell tput setaf 1 2>/dev/null || echo "")

define section
	@echo "$(BOLD)$(CYAN)▶ $(1)$(RESET)"
endef

define ok
	@echo "$(GREEN)✔ $(1)$(RESET)"
endef

.DEFAULT_GOAL := help
.PHONY: install-tools lint lint-fix fmt fmt-check typecheck build \
        test test-unit test-coverage clean validate ci \
        pre-release release release-ci publish docs version info help

# ==============================================================================
# DEPENDENCY MANAGEMENT
# ==============================================================================

## deps: Install all npm dependencies
deps:
	$(call section,Installing dependencies)
	@npm install
	$(call ok,Dependencies installed)

## install-tools: Install global dev tools (ts-node, typescript, etc.)
install-tools:
	$(call section,Installing global tools)
	@npm install -g ts-node typescript
	$(call ok,Global tools installed)

# ==============================================================================
# CODE QUALITY
# ==============================================================================

## fmt: Format all TypeScript source and test files with Prettier
fmt:
	$(call section,Formatting source files)
	@npx prettier --write "src/**/*.ts" "test/**/*.ts"
	$(call ok,Formatting complete)

## fmt-check: Check formatting without writing (used in CI)
fmt-check:
	$(call section,Checking formatting)
	@npx prettier --check "src/**/*.ts" "test/**/*.ts"
	$(call ok,All files are correctly formatted)

## lint: Run ESLint across src and test
lint:
	$(call section,Running ESLint)
	@npx eslint src test --ext .ts --max-warnings 0
	$(call ok,ESLint passed)

## lint-fix: Run ESLint and auto-fix issues
lint-fix:
	$(call section,Running ESLint with --fix)
	@npx eslint src test --ext .ts --fix
	$(call ok,ESLint fixes applied)

## vet: Alias for typecheck (mirrors Go's go vet)
vet: typecheck

## static-check: Alias for typecheck + lint
static-check: typecheck lint

## typecheck: Run tsc type-checking without emitting files
typecheck:
	$(call section,Type-checking with tsc)
	@npx tsc --noEmit
	$(call ok,TypeScript type-check passed)

# ==============================================================================
# TESTING
# ==============================================================================

## test: Run the full test suite with Jest
test:
	$(call section,Running full test suite)
	@npx jest
	$(call ok,All tests passed)

## test-unit: Run only state machine unit tests (fast inner loop)
test-unit:
	$(call section,Running unit tests)
	@npx jest --testPathPattern='states'
	$(call ok,Unit tests passed)

## test-coverage: Run tests with coverage report
test-coverage:
	$(call section,Running tests with coverage)
	@npx jest --coverage
	$(call ok,Coverage report generated in ./coverage)

# ==============================================================================
# BUILD
# ==============================================================================

## build: Compile TypeScript to CJS + ESM via tsup
build:
	$(call section,Building $(PACKAGE) v$(VERSION))
	@npx tsup
	$(call ok,Build complete '-' dist/)

# ==============================================================================
# DOCUMENTATION
# ==============================================================================

## docs: Generate TypeDoc API documentation
docs:
	$(call section,Generating TypeDoc documentation)
	@if ! npx typedoc --version >/dev/null 2>&1; then \
		echo "  Installing TypeDoc..."; \
		npm install -g typedoc; \
	fi

	@echo "Generating documentation..."
	@npx typedoc src/index.ts --out docs --name "$(PACKAGE)" --logLevel Verbose
	@echo "  Documentation: $(BOLD)./docs/index.html$(RESET)"
	$(call ok,Documentation generated)
# ==============================================================================
# VERSION & INFO
# ==============================================================================

## version: Print the current package version
version:
	@echo "$(BOLD)Package:$(RESET)  $(PACKAGE)"
	@echo "$(BOLD)Version:$(RESET)  $(VERSION)"

## info: Print full environment information
info:
	$(call section,Environment)
	@echo "  Package:  $(PACKAGE)"
	@echo "  Version:  $(VERSION)"
	@echo "  Node:     $(NODE_VER)"
	@echo "  npm:      $(NPM_VER)"
	@echo "  OS:       $$(uname -s) $$(uname -m)"

# ==============================================================================
# COMPOSITE PIPELINES
# ==============================================================================

## validate: typecheck + lint + fmt-check + test
validate: lint fmt-check test
	$(call ok,All validation checks passed)

## ci: Full CI pipeline — deps + validate + build
ci: deps validate build
	$(call ok,CI pipeline completed successfully)

## pre-release: Validate and confirm no dirty git state
pre-release: validate
	$(call section,Pre-release checks)
	@if [ -n "$$(git status --porcelain 2>/dev/null | grep -E -v 'package(-lock)?\.json')" ]; then \
	   echo "$(RED)Working tree is dirty — commit or stash changes before releasing$(RESET)"; \
	   exit 1; \
	fi
	@echo "  Version $(BOLD)$(VERSION)$(RESET) is clean and ready."
	$(call ok,Pre-release checks passed)

## release: Bump version, tag, and push (usage: make release VERSION=1.2.3)
release:
	$(call section,Releasing $(VERSION))
	@if [ -z "$(VERSION)" ]; then \
		echo "$(RED)Provide a version: make release VERSION=1.2.3$(RESET)"; \
		exit 1; \
	fi
	@if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then \
		echo "$(RED)Version must follow semver: MAJOR.MINOR.PATCH$(RESET)"; \
		exit 1; \
	fi
	$(MAKE) pre-release
	@npm version $(VERSION) --no-git-tag-version
	@git add package.json package-lock.json
	@git commit -m "chore: release v$(VERSION)"
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@git push origin main --follow-tags
	$(call ok,Tagged and pushed v$(VERSION) '-' GitHub Actions will publish to NPM)

## release-ci: CI-side release step (run by GitHub Actions on tag push)
release-ci: deps validate build
	$(call section,Release CI verification)
	@echo "  Package: $(PACKAGE)"
	@echo "  Version: $(VERSION)"
	$(call ok,Release CI pipeline passed)

## publish: Publish the package to NPM (requires npm login / NPM_TOKEN)
publish: build
	$(call section,Publishing $(PACKAGE) v$(VERSION) to NPM)
	@npm publish --access public
	$(call ok,Published $(PACKAGE)@$(VERSION))

# ==============================================================================
# CLEANUP
# ==============================================================================

## clean: Remove dist, coverage, and tsbuildinfo artefacts
clean:
	$(call section,Cleaning build artefacts)
	@rm -rf dist coverage *.tsbuildinfo
	$(call ok,Clean complete)

# ==============================================================================
# HELP
# ==============================================================================

## help: Show this help message (default target)
help:
	@echo ""
	@echo "$(BOLD)$(PACKAGE)$(RESET) — Amazon States Language engine (TypeScript)"
	@echo "$(BOLD)Version:$(RESET) $(VERSION)"
	@echo ""
	@echo "$(BOLD)$(CYAN)Usage:$(RESET)"
	@echo "  make $(BOLD)<target>$(RESET) [VARIABLE=value ...]"
	@echo ""
	@echo "$(BOLD)$(CYAN)Targets:$(RESET)"
	@grep -E '^## ' $(MAKEFILE_LIST) \
		| sed 's/^## //' \
		| awk -F': ' '{ printf "  $(BOLD)%-18s$(RESET) %s\n", $$1, $$2 }'
	@echo ""
	@echo "$(BOLD)$(CYAN)Variables:$(RESET)"
	@echo "  $(BOLD)VERSION$(RESET)   Semver version for release, e.g. 1.2.3"
	@echo ""
	@echo "$(BOLD)$(CYAN)Examples:$(RESET)"
	@echo "  make ci"
	@echo "  make test"
	@echo "  make test-unit           # State machine unit tests only"
	@echo "  make release VERSION=1.0.0"
	@echo ""
