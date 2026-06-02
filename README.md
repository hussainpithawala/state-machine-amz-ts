# State Machine AMZ TypeScript ⚡

[![CI](https://github.com/hussainpithawala/state-machine-amz-ts/workflows/CI/badge.svg)](https://github.com/hussainpithawala/state-machine-amz-ts/actions)
[![npm version](https://img.shields.io/npm/v/@hussainpithawala/state-machine-amz)](https://www.npmjs.com/package/@hussainpithawala/state-machine-amz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready TypeScript implementation of AWS Step Functions (Amazon States Language).
Embedded, zero-cost, zero-latency workflow orchestration for Node.js services.

> Part of the **state-machine-amz-\*** multi-language SDK family.
> Reference implementation: [state-machine-amz-go](https://github.com/hussainpithawala/state-machine-amz-go)

## Installation

```bash
npm install @hussainpithawala/state-machine-amz
```

Requires Node.js 18+.

## Quick Start

```typescript
import { StateMachine, Executor } from '@hussainpithawala/state-machine-amz'

const executor = new Executor()
  .registerHandler('process-order', async (_resource, input) => {
    return { status: 'processed', ...input as object }
  })

const sm = StateMachine.fromDict({
  StartAt: 'ProcessOrder',
  States: {
    ProcessOrder: {
      Type: 'Task',
      Resource: 'process-order',
      End: true,
    },
  },
}, executor)

const execution = await sm.execute({ orderId: '12345' })
console.log(execution.status) // SUCCEEDED
```

## Related Projects

| Repo | Language | Role |
|------|----------|------|
| [state-machine-amz-go](https://github.com/hussainpithawala/state-machine-amz-go) | Go | Core engine |
| [state-machine-amz-gin](https://github.com/hussainpithawala/state-machine-amz-gin) | Go | REST API |
| [state-machine-amz-py](https://github.com/hussainpithawala/state-machine-amz-py) | Python | Port |
| [state-machine-amz-ruby](https://github.com/hussainpithawala/state-machine-amz-ruby) | Ruby | Port |
| [state-machine-amz-portal](https://github.com/hussainpithawala/state-machine-amz-portal) | TypeScript | Portal |

## License

MIT © [Hussain Pithawala](https://github.com/hussainpithawala)
