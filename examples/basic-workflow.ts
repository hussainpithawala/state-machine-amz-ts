import { StateMachine, Executor } from '../src'

const definition = {
  StartAt: 'ProcessOrder',
  States: {
    ProcessOrder: {
      Type: 'Task' as const,
      Resource: 'process-order',
      Next: 'NotifyCustomer',
    },
    NotifyCustomer: {
      Type: 'Task' as const,
      Resource: 'send-notification',
      End: true,
    },
  },
}

const executor = new Executor()
  .registerHandler('process-order', async (_resource, input) => {
    console.log('Processing order:', input)
    return { status: 'processed' }
  })
  .registerHandler('send-notification', async (_resource, input) => {
    console.log('Notifying customer:', input)
    return { notified: true }
  })

const sm = StateMachine.fromDict(definition, executor)

sm.execute({ orderId: '12345' }, 'Order-12345').then(execution => {
  console.log('Execution status:', execution.status)
})
