
const https = require('https');
const mqtt = require('mqtt')
const uuidv4 = require('uuid').v4;

class openSprinkl {
    constructor(options, openListener, incomingListener, closeListener, errorListener) {

        this.credentials = options.credentials;
        this.cloudSessionID = undefined;
        this.deviceID = undefined;
        this.openListener = openListener;
        this.incomingListener = incomingListener;
        this.closeListener = closeListener;
        this.errorListener = errorListener;
    }

    async createSchedule(days, zone, zoneId, runTime) {
        this.sendMqtt({
            "type": "schedule_create",
            "schedule": {
                "name": "Schedule 1",
                "type": "standard",
                "frequency": "weekly",
                "start_time": "2020-10-20T01:24:40.403Z",
                "days": days, // Array
                "zones": [
                    {
                    "id": zone,
                    "number": zoneId,
                    "run_time": runTime
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
                "cycle_soak": false,
                "seasonally_adjust": false
            }
        });
    }

    async haltAction() {
        this.sendMqtt({
            "type": "halt"
        });
    }

    // {"message_id":"40fdf729-0009-49cd-872f-84162277773d","type":"manual_run","zone_times":[{"zone":2,"time":25}]}
    async manualRun(zone, time) {
        this.sendMqtt({
            "type": "manual_run",
            "zone_times": [
                {
                    "zone": zone,
                    "time": time
                }
            ]
        });
    }

    async sendMqtt(data) {
        data.message_id = uuidv4();
        console.log(">>>", JSON.stringify(data));
        this.client.publish(`/SR400/${this.deviceID}/actions`, JSON.stringify(data))
    }

    async start() {
        
        await this.login(this.credentials.username, this.credentials.password)
        .then(data => {
            this.cloudSessionID = data.session_id;
        })
        .catch(error => {
            console.error("Unable to login:", error);
        });

        console.log('Getting devices...')
        await this.devices(this.cloudSessionID)
        .then(data => {
            if (data.devices[0] !== undefined && data.devices[0].enabled === true) {
                this.deviceID = data.devices[0].uuid;
            }
        })
        .catch(error => {
            console.error("Unable to create session:", error);
        });

        console.log(`Using ${this.deviceID}`)

        var client = mqtt.connect('ssl://mqtt-control.sprinkl.io', {
            port: 8884,
            username: 'sr400',
            password: 'w4terthel4wn', // It's from the app, so *shrug*
            protocol: 'ssl',
            clientId: 'sprinkl' + uuidv4()
        })

        var topic = `/SR400/${this.deviceID}/events/#`

        client.on('connect', function() {
            console.log(`Subscribed to ${topic}`);
            client.subscribe(topic)
        });

        client.on('message', function(topic, message, packet) {
            // console.log('Received Message:= ' + message.toString() + '\nOn topic:= ' + topic)
        });

        client.addListener('connect', this.openListener);
        client.addListener('message', this.incomingListener);
        client.addListener('close', this.closeListener);
        client.addListener('error', this.errorListener);

        this.client = client
        this.topic = topic
    }

    async getHttps(uri, data) {
        return this.sendHttps(uri, 'GET', data);
    }
    
    async postHttps(uri, data) {
        return this.sendHttps(uri, 'POST', data);
    }
    
    async sendHttps(uri, method, data) {
        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(data);
            
            const options = {
                hostname: 'cloud.sprinkl.io',
                port: 443,
                path: uri,
                method: method,
            };

            if (method === 'POST') {
                options.headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            }

            const req = https.request(options, res => {
                var data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    var parsed = JSON.parse(data);

                    if (parsed.success !== true) {
                        reject('Error ', parsed);
                    }
                    resolve(parsed);
                });
            });
            
            req.on('error', error => {
                reject(error);
            })
            
            req.write(data);
            req.end();
        });
    }

    async login(user, pass) {
        if (user === undefined || pass === undefined) {
            new Error("No username or password provided");
        }

        const data = JSON.stringify({
            email: user,
            password: pass,
        });
        const uri = '/user/authenticate.json';

        return this.postHttps(uri, data);
    }

    async devices(sessionID) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = '/user/control/devices.json?session_id=' + sessionID;
        
        return this.getHttps(uri, uri);
    }

    async history(sessionID, deviceID) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = '/user/control/devices/' + deviceID +'/history.json?session_id=' + sessionID;

        return this.getHttps(uri, uri);
    }

    async schedules(sessionID, deviceID, year, month) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = 'api/devices/' + deviceID + '/schedules/' + year + '/' + month + '?session_id=' + sessionID;

        return this.getHttps(uri, uri);
    }
}

module.exports = { openSprinkl }