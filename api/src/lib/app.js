'use strict'

const fs = require('fs')
const path = require('path')
const co = require('co')
const Koa = require('koa.io')
const body = require('koa-better-body')
const logger = require('koa-mag')
const session = require('koa-session')
const cors = require('kcors')
const errorHandler = require('five-bells-shared/middlewares/error-handler')
const Validator = require('five-bells-shared').Validator
const Config = require('./config')
const Auth = require('./auth')
const Router = require('./router')
const DB = require('./db')
const Log = require('./log')
const Ledger = require('./ledger')
const SPSP = require('./spsp')
const User = require('../models/user')
const Socket = require('./socket')
const Pay = require('./pay')
const Connector = require('./connector')

module.exports = class App {
  constructor (deps) {
    this.auth = deps(Auth)
    this.config = deps(Config)
    this.router = deps(Router)
    this.socket = deps(Socket)
    this.validator = deps(Validator)
    this.ledger = deps(Ledger)
    this.spsp = deps(SPSP)
    this.user = deps(User)
    this.db = deps(DB)
    this.pay = deps(Pay)
    const log = deps(Log)
    this.log = log('app')
    this.connector = deps(Connector)

    this.validator.loadSchemasFromDirectory(path.resolve(__dirname, '../../schemas'))

    const app = this.app = new Koa()

    const uploadDir = path.resolve(__dirname, '../../../uploads')

    // Create uploads folder
    try {
      fs.mkdirSync(uploadDir)
    } catch (err) {
      // ignore if the folder already exists
      if (err.code !== 'EEXIST') { throw err }
    }

    app.use(body({
      multipart: false,
      strict: false
    }))

    app.use(function * (next) {
      if (this.request.method === 'POST' || this.request.method === 'PUT') {
        // the parsed body will store in this.request.body
        // if nothing was parsed, body will be an empty object {}
        this.body = this.request.fields
      }
      yield next
    })

    app.use(logger({mag: log('http')}))
    app.use(errorHandler({log: log('error-handler')}))
    app.use(cors({origin: '*'}))

    app.proxy = true

    app.keys = [this.config.data.get('sessionSecret')]
    app.use(session({
      maxAge: 2592000000
    }, app))

    app.use(require('koa-static')(path.resolve(__dirname, '../../../uploads')))

    this.socket.attach(app)
    this.auth.attach(app)

    this.router.setupDefaultRoutes()
    this.router.attach(app)
  }

  start () {
    co(this._start.bind(this)).catch(err => {
      this.log.critical(err)
    })
  }

  * _start () {
    if (this.db.options.dialect === 'sqlite') {
      yield this.db.sync()
    } else {
      yield this.db.migrate()
    }

    // Ensure admin and connector accounts exists
    const adminAccount = yield this.user.setupAdminAccount()
    const connectorAccount = yield this.user.setupConnectorAccount()

    this.listen()

    yield this.connector.start()

    // Initial connector funding
    if (connectorAccount && connectorAccount.new) {
      yield this.pay.pay({
        user: adminAccount,
        destination: connectorAccount.username,
        quote: {
          sourceAmount: 1000,
          destinationAmount: 1000
        },
        message: 'Initial connector funding'
      })
    }
  }

  listen () {
    this.app.listen(this.config.data.getIn(['server', 'port']))
    this.log.info('wallet listening on ' + this.config.data.getIn(['server', 'bind_ip']) +
      ':' + this.config.data.getIn(['server', 'port']))
    this.log.info('public at ' + this.config.data.getIn(['server', 'base_uri']))
  }
}
