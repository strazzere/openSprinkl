const fs = require('fs');
const yaml = require('js-yaml');
const cron = require('node-cron');
const emoji = require('node-emoji');
const https = require('https')
const WebSocket = require('ws');

const debug = true;

function loadYaml(yamlFile) {
    try {
        var fileContents = fs.readFileSync(yamlFile, 'utf8');
        return yaml.safeLoad(fileContents);
    } catch (e) {
        console.log(e);
    }
}

function dateToCron(day) {
    switch(day) {
        case 'Sunday' || 'sunday':
            return 0;
        case 'Monday' || 'Monday':
            return 1;
        case 'Tuesday' || 'tuesday':
            return 2;
        case 'Wednesday' || 'wednesday':
            return 3;
        case 'Thursday' || 'thursday':
            return 4;
        case 'Friday' || 'friday':
            return 5;
        case 'Saturday' || 'saturday':
            return 6;
        default:
            return undefined
    }
}

function convertToCron(day, time) {
    var numDay = dateToCron(day);
    if (numDay === undefined) {
        return undefined;
    }

    if (time && time.split(':').length === 2) {
        return time.split(':')[1] + " " + time.split(':')[0] + " * * " + numDay;
    }

    return undefined;
}

function createSchedule(zone, zoneId, runTime) {
    var request = {
        "type": "request",
        "action": "schedule_create",
        "schedule": {
          "name": "Schedule 1",
          "type": "standard",
          "frequency": "weekly",
          "start_time": "2020-10-20T01:24:40.403Z",
          "days": [
            "M",
            "W",
            "F"
          ],
          "zones": [
            {
              "id": "5f8c9540dd1885662b33b651",
              "number": 1,
              "run_time": 57
            }
          ],
          "ignore": {
            "rain_chance": true,
            "temp": true,
            "rain": true,
            "rain_inches": true,
            "wind": true
          },
          "enabled": true,
          "cycle_soak": true,
          "seasonally_adjust": false
        }
      };
}

function haltAction(ws) {
    sendSocket(ws, { 
        "type": "request",
        "action": "halt"
    });
}

function manualRun(ws, zone, time) {
    var request = {
        "type": "request",
        "action": "run",
        "zones": [
          {
            "zone": zone,
            "time": time
          }
        ]
      };
      sendSocket(ws, request);
}

function sendSocket(ws, data) {
    if (debug) {
        console.log(">>>", JSON.stringify(data));
    }
    ws.send(JSON.stringify(data));
}

function login(user, pass) {
    return new Promise((resolve, reject) => {
        if (user === undefined || pass === undefined) {
            reject("No username or password provided");
        }
        // Unsure if this is needed, as it actually appears to read them
        // from the path/variables pass in the uri
        const data = JSON.stringify({
            email: user,
            password: pass,
        });
        
        const options = {
            hostname: 'app.sprinkl.com',
            port: 443,
            path: '/api/user/authenticate?email=' + user + '&password=' + pass,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, res => {        
            res.on('data', d => {
                var data = JSON.parse(d);

                if (data.success !== true) {
                    reject('Error logging in: ', data);
                }
                resolve(data);
            });
        });
        
        req.on('error', error => {
            reject(error);
        })
        
        req.write(data);
        req.end();
    });
}

const main = async function(a, b) {
    // TODO : extract out device id request and get it dynamically
    var env = loadYaml("./env.yaml");
    if (!env || !env.credentials) {
        console.error("Error loading credentials!");
        return;
    }

    var config = loadYaml("./config.yaml");
    if (!config || !config.schedules) {
        console.error('Unable to load any configurations!');
    }
    config.schedules.forEach( schedule => {
        console.log("Parsing schedule for " + schedule.name);
        schedule.days.forEach(day => {
            schedule.timing.forEach(time => {
                console.log("Day : " + day + " Time : " + time + " cron : " + convertToCron(day, time));
                cron.schedule(convertToCron(day, time), function() {
                    console.log("Starting schedule [ " + schedule.name + " ] @ [ zone " + schedule.zone + "] for [ " + schedule.length + " minutes ]");
                    manualRun(socket, schedule.zone, schedule.length);
                });
            });
        });
    });

    var socketUrl;

    await login(env.credentials.username, env.credentials.password)
    .then(data => {
        socketUrl = 'wss://stream-api.sprinkl.com/v1/' + env.deviceId + '?cloud_session_id=' + data.session_id
    })
    .catch(error => {
        console.error("Unable to login and create session:", error);
    });

    console.log(socketUrl);

    // Create WebSocket connection.
    const socket = new WebSocket(socketUrl);

    // Connection opened
    socket.addEventListener('open', function (event) {
        socket.send('*** Hello Server!');
    });

    function timestampString(epoch) {
        var d = new Date(0);
        d.setUTCSeconds(epoch);
        return " " + emoji.get('calendar') + " " + d.toLocaleString();
    }

    // Listen for messages
    socket.addEventListener('message', function (event) {
        var logline ="<<< ";
        try {
            var data = JSON.parse(event.data);
            switch(data.type) {
                case 'hb':
                    // {"type":"hb","timestamp":1603159518,"firmware":"2.3.6","running":true,"running_status":{"schedule_id":null,"time_ran_sec":298.3,"time_left_sec":1.7,"zone":3,"zone_time_ran_sec":298.3,"zone_time_left_sec":1.7,"queue_time":1.7,"queue":[{"schedule_id":null,"zone":3,"time":300}],"queue_completed":[]},"last_ran_time":null,"last_ran_schedule_id":null,"alert":null,"next_scheduled_time":null}
                    logline += emoji.get('heart');
                    if (data.running === true) {
                        logline += " " + data.running_status.time_ran_sec + "/" + (data.running_status.time_ran_sec + data.running_status.time_left_sec) + emoji.get('watch');
                    }
                    break;
                case 'running_status':
                    //  {"type":"running_status","timestamp":1603159518,"running":true,"running_status":{"schedule_id":null,"time_ran_sec":298.3,"time_left_sec":1.7,"zone":3,"zone_time_ran_sec":298.3,"zone_time_left_sec":1.7,"queue_time":1.7,"queue":[{"schedule_id":null,"zone":3,"time":300}],"queue_completed":[]},"last_ran_time":null,"last_ran_schedule_id":null,"alert":null,"next_scheduled_time":null}
                    if (data.running === true ) {
                        logline += emoji.get('potable_water');
                    } else {
                        logline += emoji.get('non-potable_water');
                    }
                    if (data.running === true) {
                        logline += " " +  data.running_status.time_ran_sec + "/" + (data.running_status.time_ran_sec + data.running_status.time_left_sec) + emoji.get('watch');
                    }
                    break;
                case 'watering_stop':
                    // {"type":"watering_stop","timestamp":1603159520.604876}
                    logline += emoji.get('non-potable_water');
                    break;
                case 'zone_started':
                    logline += emoji.get('sweat_drops') + " zone started";
                    break;
                case 'zone_completed':
                    // {"type":"zone_completed","zone":3,"run_time_sec":300,"timestamp":1603159520.4310756}
                    logline += emoji.get('sweat_drops') + " zone completed";
                    break;
                case 'online_status':
                    if (data.status === 'online') {
                        logline += emoji.get('ok_hand');
                    } if (data.status === 'offline') {
                        logline += emoji.get('rotating_light') + " device offline!";
                    }else {
                        logline += emoji.get('rotating_light') + " online status not as expected: " + data.status;
                    }
                    break;
                case 'run':
                    if (data.success === true) {
                        logline += " run command successful";
                    } else {
                        logline += emoji.get('rotating_light') + " run command unsuccessful ";
                    }
                    break
                case 'halt':
                    logline += emoji.get('hand')
                    if (data.success === true) {
                        logline += " halt command successful";
                    } else {
                        logline += emoji.get('rotating_light') + " halt command unsuccessful ";
                    }
                    break;
                default:
                    console.log("data.type : ", data.type, " data :", data);
            }
            logline += timestampString(data.timestamp);
            console.log(logline);
        } catch (e) {
            console.log(emoji.get('rotating_light') + " Cannot parse data : " + e);
        }
        
    });

    socket.addEventListener('onclose', function (event) {
        console.log('*** Disconnected');
    });

};


main();

setTimeout(function(){

    // var sprinklerData = {
    //     "type": "request",
    //     "action": "run",
    //     "zones": [
    //       {
    //         "zone": 3,
    //         "time": 120
    //       }
    //     ]
    //   };
      
    //   socket.send(JSON.stringify(sprinklerData));
    // haltAction(socket);
}, 3000);