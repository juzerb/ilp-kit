"use strict"

module.exports = PaymentsControllerFactory

const co = require('co')
const request = require('five-bells-shared/utils/request')
const passport = require('koa-passport')
const requestUtil = require('five-bells-shared/utils/request')
const UnprocessableEntityError = require('five-bells-shared').UnprocessableEntityError
const UnmetConditionError = require('five-bells-shared').UnmetConditionError
const Model = require('five-bells-shared').Model
const PaymentFactory = require('../models/payment')
const Log = require('../lib/log')
const DB = require('../lib/db')
const Config = require('../lib/config')

PaymentsControllerFactory.constitute = [PaymentFactory, Log, DB, Config]
function PaymentsControllerFactory (Payment, log, db, config) {
  log = log('payments')

  return class PaymentsController {
    static init (router) {
      let self = this;
      router.get('/payments/:id', passport.authenticate(['basic'], { session: false }), this.getResource)
      //router.get('/payments/history/:userId', this.getHistory)
      router.put('/payments/:id', Payment.createBodyParser(), self.putResource)
      //router.put('/payments/:id/fulfillment', Model.createBodyParser(), this.putFulfillmentResource)
    }

    static * getResource () {
      let id = this.params.id
      request.validateUriParameter('id', id, 'Uuid')
      id = id.toLowerCase()

      const item = yield Payment.findById(this.params.id)

      if (!item) {
        this.status = 404
        return
      }

      this.body = item.getDataExternal()
    }

    /*static async getHistory () {
      let userId = this.params.userId
      // TODO
      // request.validateUriParameter('id', id, 'Uuid')
      userId = userId.toLowerCase()

      // TODO only external data
      this.body = yield Payment.findAll({where: {source_user: userId}})
    }*/

    static * putResource () {
      const _this = this

      let id = _this.params.id
      requestUtil.validateUriParameter('id', id, 'Uuid')
      id = id.toLowerCase()
      let payment = this.body

      payment.id = id

      // TODO do a ledger transaction
      // TODO store source and destinations users
      delete payment.destination_user

      let created
      yield db.transaction(function * (transaction) {
        created = yield payment.create({ transaction })
      })

      log.debug((created ? 'created' : 'updated') + ' payment ID ' + id)

      this.body = payment.getDataExternal()
    }
  }
}