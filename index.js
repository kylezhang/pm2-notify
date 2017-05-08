const pm2         = require('pm2')
const moment      = require('moment')
const hostname    = require('os').hostname()
const path        = require('path')
const nodemailer  = require('nodemailer')
const markdown    = require('nodemailer-markdown').markdown
const config       = require('yamljs').load(__dirname + '/config.yml')
const _           = require('lodash')
const template    = require('fs').readFileSync(config.template)
const async       = require('async')
const util        = require('util')
const sendMailAD  = require('./mail')

const transporter = nodemailer.createTransport(require('nodemailer-smtp-transport')(config.mail.smtp))
transporter.use('compile', markdown({
    useEmbeddedImages: true
}))

let queue = []
let busy = false

/**
 * Compile template
 * @param string template
 * @param object data
 */
function compile(template, data) {
    let s = _.template(template)
    data.date = moment(new Date(data.date)).format('YYYY-MM-DD HH:mm:ss')
    data.process.pm_uptime = moment(data.process.pm_uptime).format('YYYY-MM-DD HH:mm:ss')
    return s(data)
}

/**
 * Send an email through smtp transport
 * @param object opts
 */
function sendMail(opts, cb) {
    if (!opts.subject || !opts.text) {
        throw new ReferenceError("No text or subject to be mailed")
    }

    opts = {
        from: opts.from || config.mail.from,
        to: opts.to ? opts.to : config.mail.to,
        subject: opts.subject,
        markdown: opts.text,
        attachments: opts.attachments || []
    }

    transporter.sendMail(opts, function(err, info) {
        if (err) console.error(err)
        console.log('mail sent', info)
        if(typeof cb === 'function') cb()
    })
}

/**
 * Process the events queue
 * if there is only one event, send an email with it
 * if there are more than one, join texts and attachments
 */
function processQueue(cb) {
    if (queue.length === 0 || busy) return
    busy = true

    //Concat texts, get the multiple subject
    const subject = compile(config.subject, queue[0])
    const text = queue.map(mail => mail.text).join('\n')
    let attachments = []
    if (config.attach_logs) {
        attachments = _
            .chain(queue)
            .flatMap(mail => mail.attachments)
            .uniqBy('path').value()
    }

    sendMail({
        subject: subject,
        text: text,
        attachments: attachments
    }, x => busy = false)

    //reset queue
    queue.length = 0
}

pm2.launchBus(function(err, bus) {
    if (err) throw err

    console.log('listening on pm2 events')
    bus.on('process:event', function(e) {
        if (e.manually === true) return

        //it's an event we should watch 
        if (~config.events.indexOf(e.event)) {

            e.date = new Date(e.at).toString()

            e = util._extend(e, {
                hostname: hostname,
                text: compile(template, e)
            })

            //should we attach logs?
            if (config.attach_logs) {
                e.attachments = []
                ['pm_out_log_path', 'pm_err_log_path'].forEach(function(log) {
                    e.attachments.push({
                        filename: path.basename(e.process[log]),
                        path: e.process[log]
                    })
                })
            }

            queue.push(e)
        }
    })

    bus.on('pm2:kill', function() {
        console.error('PM2 is beeing killed')
    })
})

setInterval(processQueue, config.polling)