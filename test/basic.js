const assert = require('assert')
const co = require('co')
const r = require('rethinkdbdash')({silent: true})
const clone = require('../lib/commands/clone')
const sync = require('../lib/commands/sync')
const inquirer = require('inquirer')

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

    before(function * () {
      yield r.connect()
      yield r.dbCreate(testSrcDB).run()
      yield r.dbCreate(testDstDB).run()
    })

    beforeEach(function () {
      this.sinon.stub(require('rethinkdbdash/lib/helper'), 'createLogger')
        .returns(() => undefined)
      this.sinon.stub(inquirer, 'prompt').resolves({confirmed: true})
    })

    it(`should correctly sync test table`, function * () {
      const testTable = 'test1'

      yield r.db(testSrcDB).tableCreate(testTable).run()
      yield r.db(testSrcDB).table(testTable).insert(testDataset).run()

      let logStub = this.sinon.stub(console, 'log')
      yield * sync({sourceDB: testSrcDB, targetDB: testDstDB, pickTables: [testTable], noProgress: true})
      logStub.restore()

      const srcData = yield r.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield r.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})

      assert.deepEqual(srcData, dstData)
      assert.strictEqual(srcData.length, testDataset.length)
    })

    it(`should delete any extra records`, function * () {
      const testTable = 'test2'

      yield r.db(testSrcDB).tableCreate(testTable).run()
      yield r.db(testSrcDB).table(testTable).delete().run()
      yield r.db(testDstDB).tableCreate(testTable).run()
      yield r.db(testDstDB).table(testTable).insert(testDataset).run()

      const srcDataPre = yield r.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstDataPre = yield r.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.strictEqual(srcDataPre.length, 0)
      assert.notEqual(dstDataPre.length, 0)

      let logStub = this.sinon.stub(console, 'log')
      yield * sync({sourceDB: testSrcDB, targetDB: testDstDB, pickTables: [testTable], noProgress: true})
      logStub.restore()

      const srcData = yield r.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield r.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.strictEqual(srcData.length, 0)
      assert.strictEqual(dstData.length, 0)
    })

    after(function * () {
      yield r.dbDrop(testDstDB).run()
      yield r.dbDrop(testSrcDB).run()
    })
  })
})
