import { SkipSubscriptionCheck } from '../skip-subscription.decorator.js'

describe('SkipSubscriptionCheck decorator', () => {
  it('sets skipSubscriptionCheck metadata to true when applied to a method', () => {
    class TestController {
      @SkipSubscriptionCheck()
      handler() {
        return true
      }
    }

    // The decorator stores metadata on descriptor.value (the function itself)
    const metadata = Reflect.getOwnMetadata(
      'skipSubscriptionCheck',
      TestController.prototype.handler,
    )
    expect(metadata).toBe(true)
  })

  it('sets skipSubscriptionCheck metadata to true when applied to multiple handlers', () => {
    class TestController {
      @SkipSubscriptionCheck()
      handler1() {
        return true
      }

      @SkipSubscriptionCheck()
      handler2() {
        return false
      }
    }

    const metadata1 = Reflect.getOwnMetadata(
      'skipSubscriptionCheck',
      TestController.prototype.handler1,
    )
    const metadata2 = Reflect.getOwnMetadata(
      'skipSubscriptionCheck',
      TestController.prototype.handler2,
    )

    expect(metadata1).toBe(true)
    expect(metadata2).toBe(true)
  })

  it('sets the KEY property to the metadata key', () => {
    const decorator = SkipSubscriptionCheck()
    expect(decorator.KEY).toBe('skipSubscriptionCheck')
  })
})
