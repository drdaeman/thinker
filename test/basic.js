const assert = require('assert')
const co = require('co')
const r = require('rethinkdbdash')({silent: true})
const clone = require('../lib/commands/clone')
const sync = require('../lib/commands/sync')
const inquirer = require('inquirer')
const process = require('process')

require('mocha-generators').install()
require('mocha-sinon')

function random () {
  return Math.random().toString(32).substr(2, 5)
}

const testDataset = [
  {id: 1, test: r.ISO8601("2017-01-01T00:00:00+00:00")},
  {id: 2, test: r.ISO8601("2017-01-01T00:00:00+03:00")},
  {id: 3, test: r.ISO8601("2017-01-01T00:00:00-07:00")},
  {id: r.ISO8601("2017-01-01T00:00:00+00:00"), test: "UTC"},
  {id: r.ISO8601("2017-01-01T00:00:00-07:00"), test: "UTC-7"},
  {id: r.ISO8601("2017-01-01T00:00:00+03:00"), test: "UTC+3"}
]

describe('commands', function () {
  this.timeout(60000)

  describe('clone', function () {
    const testSrcDB = 'test_thinker_' + random()
    const testDstDB = 'test_thinker_' + random()
    const testTable = 'test1'

    before(function * () {
      yield r.connect()
      yield r.dbCreate(testSrcDB).run()
      yield r.db(testSrcDB).tableCreate(testTable).run()
      yield r.db(testSrcDB).table(testTable).insert(testDataset)
      yield r.dbCreate(testDstDB).run()
    })

    beforeEach(function () {
      this.sinon.stub(require('rethinkdbdash/lib/helper'), 'createLogger')
        .returns(() => undefined)
      this.sinon.stub(inquirer, 'prompt').resolves({confirmed: true})
    })

    it(`should correctly clone test table`, function * () {
      let logStub = this.sinon.stub(console, 'log')
      yield * clone({sourceDB: testSrcDB, targetDB: testDstDB})
      logStub.restore()

      const srcData = yield r.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield r.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})

      assert.deepEqual(srcData, dstData)
    })

    after(function * () {
      yield r.dbDrop(testDstDB).run()
      yield r.dbDrop(testSrcDB).run()
    })
  })

  describe('sync', function () {
    const testSrcDB = 'test_thinker_' + random()
    const testDstDB = 'test_thinker_' + random()
    const testTable = 'test1'

    before(function * () {
      yield r.connect()
      yield r.dbCreate(testSrcDB).run()
      yield r.db(testSrcDB).tableCreate(testTable).run()
      yield r.db(testSrcDB).table(testTable).insert(testDataset)
      yield r.dbCreate(testDstDB).run()
    })

    beforeEach(function () {
      this.sinon.stub(require('rethinkdbdash/lib/helper'), 'createLogger')
        .returns(() => undefined)
      this.sinon.stub(inquirer, 'prompt').resolves({confirmed: true})
    })

    it(`should correctly sync test table`, function * () {
      let logStub = this.sinon.stub(console, 'log')
      let outStub = this.sinon.stub(process.stdout, 'write')
      yield * sync({sourceDB: testSrcDB, targetDB: testDstDB})
      outStub.restore()
      logStub.restore()

      const srcData = yield r.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield r.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})

      assert.deepEqual(srcData, dstData)
      console.log(srcData)
    })

    after(function * () {
      yield r.dbDrop(testDstDB).run()
      yield r.dbDrop(testSrcDB).run()
    })
  })
})
