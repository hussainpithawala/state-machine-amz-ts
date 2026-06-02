.PHONY: install build test lint clean

install:
	npm install

build:
	npm run build

test:
	npm test

test-coverage:
	npm run test:coverage

lint:
	npm run lint

lint-fix:
	npm run lint:fix

typecheck:
	npm run typecheck

clean:
	npm run clean

all: install lint typecheck test build
