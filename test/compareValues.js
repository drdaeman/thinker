const assert = require('assert')
const compareValues = require('../lib/compareValues')
const _ = require('lodash')
const r = require('rethinkdbdash')({silent: true})

require('mocha-generators').install()

describe('compareValues', function () {
  it(`recognizes all common JS types`, function * () {
    // ARRAY < BOOL < NULL < NUMBER < OBJECT < PTYPE<BINARY> < PTYPE<TIME> < STRING
    const orderedData = [
      [],
      [1, 2, 3],
      [3, 2, 1],
      ['foo', 'bar'],
      false,
      true,
      null,
      1,
      1.25,
      1.5,
      2,
      10,
      20,
      1000.0,
      {foo: 1, bar: 2},
      Buffer.from('test'),
      new Date(1000000000000),
      new Date(1400000000000),
      'bar',
      'bar1',
      'baz',
      'foo',
      'z',
      Infinity
    ]

    for (let i = 0; i < orderedData.length; i++) {
      for (let j = 0; j < orderedData.length; j++) {
        const a = orderedData[i]
        const b = orderedData[j]

        if (a === Infinity && b === Infinity) {
          // Infinity isn't meant to be comparable with itself
          continue
        }

        const expected = i === j ? 0 : (i < j ? -1 : 1)
        const actual = compareValues(a, b)

        if (actual === null && (_.isTypedArray(a) || _.isTypedArray(b))) {
          // Let comparison of typed arrays fail silently
          continue
        }

        assert.equal(actual, expected)

        if (typeof a !== 'undefined' && typeof b !== 'undefined' &&
            a !== Infinity && b !== Infinity) {
          const correct = yield (r.branch(r.expr(a).eq(r.expr(b)), 0,
                                 r.branch(r.expr(a).lt(r.expr(b)), -1,
                                 r.branch(r.expr(a).gt(r.expr(b)), 1, null))).run())
          assert.equal(correct, actual)
        }
      }
    }
  })
})
