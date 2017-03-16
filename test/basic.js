const assert = require('assert')
const co = require('co')
const clone = require('../lib/commands/clone')
const sync = require('../lib/commands/sync')
const inquirer = require('inquirer')

require('mocha-generators').install()
require('mocha-sinon')

function random () {
  return Math.random().toString(32).substr(2, 5)
}

describe('commands', function () {
  const srcHost = 'localhost:28015'
  const dstHost = 'localhost:28016'
  const sr = require('rethinkdbdash')({port: 28015, silent: true})
  const tr = require('rethinkdbdash')({port: 28016, silent: true})
  this.timeout(60000)

  const testDataset = [
    {id: 1, test: sr.ISO8601('2017-01-01T00:00:00+00:00')},
    {id: 2, test: sr.ISO8601('2017-01-01T00:00:00+03:00')},
    {id: 3, test: sr.ISO8601('2017-01-01T00:00:00-07:00')},
    {id: sr.ISO8601('2017-01-01T00:00:00+00:00'), test: 'UTC'},
    {id: sr.ISO8601('2017-01-01T00:00:00-07:00'), test: 'UTC-7'},
    {id: sr.ISO8601('2017-01-01T00:00:00+03:00'), test: 'UTC+3'}
  ]

  describe('clone', function () {
    const testSrcDB = 'test_thinker_' + random()
    const testDstDB = 'test_thinker_' + random()
    const options = {
      sh: srcHost,
      th: dstHost,
      sourceDB: testSrcDB,
      targetDB: testDstDB,
      noProgress: true
    }

    before(function * () {
      yield sr.dbCreate(testSrcDB).run()
      yield tr.dbCreate(testDstDB).run()
    })

    beforeEach(function () {
      this.sinon.stub(require('rethinkdbdash/lib/helper'), 'createLogger')
        .returns(() => undefined)
      this.sinon.stub(inquirer, 'prompt').resolves({confirmed: true})
    })

    it(`should correctly clone test table on the same server`, function * () {
      const testTable = 'test_' + random()

      yield sr.db(testSrcDB).tableCreate(testTable).run()
      yield sr.db(testSrcDB).table(testTable).insert(testDataset).run()

      let logStub = this.sinon.stub(console, 'log')
      yield * clone(Object.assign({}, options, {th: srcHost}))
      logStub.restore()

      const srcData = yield sr.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield sr.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.deepEqual(srcData, dstData)
      assert.strictEqual(srcData.length, testDataset.length)
    })

    it(`should correctly clone test table over the network`, function * () {
      const testTable = 'test_' + random()

      yield sr.db(testSrcDB).tableCreate(testTable).run()
      yield sr.db(testSrcDB).table(testTable).insert(testDataset).run()

      let logStub = this.sinon.stub(console, 'log')
      yield * clone(options)
      logStub.restore()

      const srcData = yield sr.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield tr.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.deepEqual(srcData, dstData)
      assert.strictEqual(srcData.length, testDataset.length)
    })

    after(function * () {
      yield tr.dbDrop(testDstDB).run()
      yield sr.dbDrop(testSrcDB).run()
    })
  })

  describe('sync', function () {
    const testSrcDB = 'test_thinker_' + random()
    const testDstDB = 'test_thinker_' + random()
    const options = {
      sh: srcHost,
      th: dstHost,
      sourceDB: testSrcDB,
      targetDB: testDstDB,
      noProgress: true
    }

    before(function * () {
      yield sr.dbCreate(testSrcDB).run()
      yield tr.dbCreate(testDstDB).run()
    })

    beforeEach(function () {
      this.sinon.stub(require('rethinkdbdash/lib/helper'), 'createLogger')
        .returns(() => undefined)
      this.sinon.stub(inquirer, 'prompt').resolves({confirmed: true})
    })

    it(`should correctly sync test table`, function * () {
      const testTable = 'test_' + random()

      yield sr.db(testSrcDB).tableCreate(testTable).run()
      yield sr.db(testSrcDB).table(testTable).insert(testDataset).run()

      let logStub = this.sinon.stub(console, 'log')
      yield * sync(Object.assign({}, options, {pickTables: [testTable]}))
      logStub.restore()

      const srcData = yield sr.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield tr.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.deepEqual(srcData, dstData)
      assert.strictEqual(srcData.length, testDataset.length)
    })

    it(`should delete any extra records`, function * () {
      const testTable = 'test_' + random()

      yield sr.db(testSrcDB).tableCreate(testTable).run()
      yield sr.db(testSrcDB).table(testTable).delete().run()
      yield tr.db(testDstDB).tableCreate(testTable).run()
      yield tr.db(testDstDB).table(testTable).insert(testDataset).run()

      const srcDataPre = yield sr.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstDataPre = yield tr.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.strictEqual(srcDataPre.length, 0)
      assert.notEqual(dstDataPre.length, 0)

      let logStub = this.sinon.stub(console, 'log')
      yield * sync(Object.assign({}, options, {pickTables: [testTable]}))
      logStub.restore()

      const srcData = yield sr.db(testSrcDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      const dstData = yield tr.db(testDstDB).table(testTable)
        .orderBy({index: 'id'}).run({timeFormat: 'raw'})
      assert.strictEqual(srcData.length, 0)
      assert.strictEqual(dstData.length, 0)
    })

    after(function * () {
      yield tr.dbDrop(testDstDB).run()
      yield sr.dbDrop(testSrcDB).run()
    })
  })
})
