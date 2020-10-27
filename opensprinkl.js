
const https = require('https');
const WebSocket = require('ws');

class openSprinkl {
    constructor(options, openListener, incomingListener, closeListener) {

        this.credentials = options.credentials;
        this.cloudSessionID = undefined;
        this.deviceID = undefined;
        this.openListener = openListener;
        this.incomingListener = incomingListener;
        this.closeListener = closeListener;
    }

    async createSchedule(zone, zoneId, runTime) {
        sendSocket({
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
            "cycle_soak": true,
            "seasonally_adjust": false
            }
        });
    }

    async haltAction() {
        sendSocket({ 
            "type": "request",
            "action": "halt"
        });
    }

    async manualRun(zone, time) {
        sendSocket({
            "type": "request",
            "action": "run",
            "zones": [
            {
                "zone": zone,
                "time": time
            }
            ]
        });
    }

    async sendSocket(data) {
        if (debug) {
            console.log(">>>", JSON.stringify(data));
        }
        this.socket.send(JSON.stringify(data));
    }

    async start() {
        
        await this.login(this.credentials.username, this.credentials.password)
        .then(data => {
            this.cloudSessionID = data.session_id;
        })
        .catch(error => {
            console.error("Unable to login:", error);
        });

        await this.devices(this.cloudSessionID)
        .then(data => {
            if (data.devices[0] !== undefined && data.devices[0].enabled === true) {
                this.deviceID = data.devices[0].id;
            }
        })
        .catch(error => {
            console.error("Unable to create session:", error);
        });

        var socketUrl = 'wss://stream-api.sprinkl.com/v1/' + this.deviceID + '?cloud_session_id=' + this.cloudSessionID;

        this.socket = new WebSocket(socketUrl);
        this.socket.addEventListener('open', this.openListener);
        this.socket.addEventListener('message', this.incomingListener);
        this.socket.addEventListener('onclose', this.closeListener);
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
                hostname: 'app.sprinkl.com',
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
                res.on('data', d => {
                    var data = JSON.parse(d);

                    if (data.success !== true) {
                        reject('Error ', data);
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

    async login(user, pass) {
        if (user === undefined || pass === undefined) {
            new Error("No username or password provided");
        }

        const data = JSON.stringify({
            email: user,
            password: pass,
        });
        const uri = '/api/user/authenticate?email=' + user + '&password=' + pass;

        return this.postHttps(uri, data);
    }

    async devices(sessionID) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = '/api/devices/all?session_id=' + sessionID;
        
        return this.getHttps(uri, uri);
    }

    async history(sessionID, deviceID) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = 'api/devices/' + deviceID +'/history?session_id=' + sessionID;

        return this.getHttps(uri, uri);
    }

    async schedules(sessionID, deviceID, year, month) {
        if (sessionID === undefined ) {
            new Error("No sessionID provided");
        }

        const uri = 'api/devices/' + deviceID + '/schedules/' + year + '/' + month + '?session_id=' + sessionID;

        return this.getHttps(uri, uri);
    }

//     curl 'https://app.sprinkl.com/api/devices/all?session_id=5f97a10e3a40347036f10e92' \
//   -H 'authority: app.sprinkl.com' \
//   -H 'pragma: no-cache' \
//   -H 'cache-control: no-cache' \
//   -H 'accept: application/json, text/plain, */*' \
//   -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36' \
//   -H 'dnt: 1' \
//   -H 'sec-fetch-site: same-origin' \
//   -H 'sec-fetch-mode: cors' \
//   -H 'sec-fetch-dest: empty' \
//   -H 'referer: https://app.sprinkl.com/auth/login' \
//   -H 'accept-language: en-US,en;q=0.9' \
//   --compressed
}

module.exports = { openSprinkl }