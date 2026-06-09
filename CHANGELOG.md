# Changelog

All notable changes to this project will be documented in this file.

## [0.0.2] - 2026-06-10

### Changed
* **Domain Model Renaming & Realignment:** * Renamed the concrete domain runtime entity from `Execution` to `ExecutionImpl` (`src/execution/ExecutionImpl.ts`).
    * Reallocated the `Execution` identifier exclusively as the structural public interface type exported from `src/types` to decouple core data contracts from explicit runtime implementations.
    * Realigned static factory construction patterns (`newContext`, `create`) to return concrete `ExecutionImpl` instances.
* **Execution State Architecture:**
    * Transitioned state tracking from string-based tracking (`currentState: string`) to structural object references (`currentState?: BaseState`), using `currentStateName` for explicit textual references.
    * Enhanced `addStateHistory` signatures to accept typed `BaseState` instances natively rather than generic string constants.
* **State Execution History Redesign:**
    * Updated `StateHistory` to implement `StateHistoryInterface`.
    * Introduced mandatory structural identifiers (`id`, `executionId`) and explicitly typed `stateType` (`StateType`) and `status` (`ExecutionStatus`).
    * Standardized instance creation around a dedicated, explicit configuration structure.
* **Engine Core & Component Interop:** * Updated the engine internals across `StateMachine`, `Executor`, `BaseExecutor`, and `MapState` to consistently ingest and evaluate `ExecutionImpl` contexts.
    * Migrated external verification tooling and unit tests (`Execution.test.ts`, `Executor.test.ts`) to conform to the `ExecutionImpl` runtime.

### Fixed
* **Data & Storage Contract Alignment:** Patched signature definitions across `Repository` and `PostgresRepository` boundaries to cleanly bind to structural interface contracts (`Execution`, `StateHistoryInterface`) instead of concrete runtime types.
* **State Factory Validation:** * Added fallback validation handling for `RetryRule` fields including `maxAttempts`, `maxDelaySeconds`, and `jitterStrategy`.
    * Safe-casted key configuration rules into strict string notations inside `ChoiceRule` instantiation mappings.
    * Restructured optional configuration layouts across `ChoiceState` and `FailState` schemas to support explicit `undefined` types safely.
* **Interface Properties:** Restored a missing `timestamp: any` type assignment definition inside `StateHistoryInterface`.

## [0.0.1] - Initial Release

### Added
- Core StateMachine engine (Amazon States Language compatible)
- PersistentStateMachine with pluggable repository
- InMemoryRepository for testing
- Executor with task handler registry
- TypeScript-first API (CJS + ESM)
