const cron = require('node-cron');
const emoji = require('node-emoji');
const Sentry = require("@sentry/node");
const { convertToCron, loadYaml, timestampString } = require('./utils');
const { openSprinkl } = require('./opensprinkl');

const debug = false;

const main = async function() {
    var config = loadYaml("./config.yaml");
    if (!config || !config.schedules) {
        console.error('Unable to load any configurations!');
    }

    const sprinkl = new openSprinkl(env,
        function () {
            console.log("Connected to Sprinkl...");
        },
        function (topic, message, packet) {
            var logline ="<<< ";
            try {
                var data = JSON.parse(message);
                switch(data.type) {
                    case 'response':
                        switch(data.event) {
                            case 'manual_run':
                                if (data.success === true) {
                                    logline += " run command successful";
                                } else {
                                    logline += emoji.get('rotating_light') + " run command unsuccessful ";
                                }
                                break;
                            case 'halt':
                                logline += emoji.get('hand')
                                if (data.success === true) {
                                    logline += " halt command successful";
                                } else {
                                    logline += emoji.get('rotating_light') + " halt command unsuccessful ";
                                }
                                break;
                            case 'watering_alert':
                                logline += emoji.get('rotating_light') + "watering alert command "
                                if (data.success === true) {
                                    logline += "successful";
                                } else {
                                    logline += "unsuccessful ";
                                }
                                break;
                            case 'error':
                                logline += emoji.get('rotating_light') + " error " + data.body
                                break;
                            default:
                                console.log("RESPONSE: data.type : ", data.type, " data :", data);
                        }
                        break;
                    case 'hb':
                        // {"type":"hb","timestamp":1603159518,"firmware":"2.3.6","running":true,"running_status":{"schedule_id":null,"time_ran_sec":298.3,"time_left_sec":1.7,"zone":3,"zone_time_ran_sec":298.3,"zone_time_left_sec":1.7,"queue_time":1.7,"queue":[{"schedule_id":null,"zone":3,"time":300}],"queue_completed":[]},"last_ran_time":null,"last_ran_schedule_id":null,"alert":null,"next_scheduled_time":null}
                        logline += emoji.get('heart');
                        if (data.running === true) {
                            logline += " " + data.running_status.time_ran_sec + "/" + (data.running_status.time_ran_sec + data.running_status.time_left_sec) + emoji.get('watch');
                        }
                        break;
                    case 'watering_status':
                        //  {"type":"running_status","timestamp":1603159518,"running":true,"running_status":{"schedule_id":null,"time_ran_sec":298.3,"time_left_sec":1.7,"zone":3,"zone_time_ran_sec":298.3,"zone_time_left_sec":1.7,"queue_time":1.7,"queue":[{"schedule_id":null,"zone":3,"time":300}],"queue_completed":[]},"last_ran_time":null,"last_ran_schedule_id":null,"alert":null,"next_scheduled_time":null}
                        if (data.watering === true ) {
                            logline += emoji.get('potable_water');
                        } else {
                            logline += emoji.get('non-potable_water');
                        }
                        if (data.watering === true) {
                            logline += " " +  data.zone_time_ran + "/" + (data.zone_time_ran + data.zone_time_left) + emoji.get('watch');
                        }
                        break;
                    case 'notify_watering_stop':
                    case 'notify_schedule_complete':
                        // {"type":"watering_stop","timestamp":1603159520.604876}
                        logline += emoji.get('non-potable_water');
                        break;
                    case 'zone_started':
                    case 'notify_schedule_start':
                    case 'notify_watering_zone':
                        logline += emoji.get('sweat_drops') + " zone started";
                        break;
                    case 'notify_watering_zone_complete':
                        // {"type":"zone_completed","zone":3,"run_time_sec":300,"timestamp":1603159520.4310756}
                        logline += emoji.get('sweat_drops') + " zone completed";
                        break;
                    case 'online_status':
                        if (data.status === 'online') {
                            logline += emoji.get('ok_hand');
                        } else if (data.status === 'offline') {
                            logline += emoji.get('rotating_light') + " device offline!";
                        } else {
                            logline += emoji.get('rotating_light') + " online status not as expected: " + data.status;
                        }
                        break;
                    case 'ping':
                        logline += emoji.get('wave')
                        break;
                    default:
                        console.log("data.type : ", data.type, " data :", data);
                }
                if (data.timestamp) {
                    logline += timestampString(data.timestamp);
                }
                console.log(logline);
            } catch (e) {
                console.log(emoji.get('rotating_light') + " Cannot parse data : " + e);

            }
        },
        function (reason) {
            console.log(`*** Disconnected - ${reason} - restarting`);
        },
        function (error) {
            console.log('*** Disconnected -- error', error);
        },
    );

    console.log("About to start...");
    await sprinkl.start();
    console.log("Done...");

    config.schedules.forEach( schedule => {
        console.log("Parsing schedule for " + schedule.name);
        schedule.days.forEach(day => {
            schedule.timing.forEach(time => {
                if (debug) {
                    console.log("Day : " + day + " Time : " + time + " cron : " + convertToCron(day, time));
                }
                cron.schedule(convertToCron(day, time), function() {
                    console.log("Starting schedule [ " + schedule.name + " ] @ [ zone " + schedule.zone + "] for [ " + schedule.length + " minutes ]");
                    sprinkl.manualRun(schedule.zone, schedule.length);
                });
            });
        });
    });
};

const env = loadYaml("./env.yaml");
if (!env || !env.credentials) {
    console.error("Error loading credentials!");
    return;
}

env.debug ? debug = env.debug : false;

if (env.sentry) {
    console.log("** Sentry enabled");
    Sentry.init({
        dsn: env.sentry,
    });
}

main().catch(err => {
    console.log("err: ", err);
    Sentry.captureException(err);
});
