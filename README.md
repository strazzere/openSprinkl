# openSprinkl

## What and why?

I bought this interesting device which is just a simple IoT sprinkler controller. However the developers don't believe it's necessary to have more than 13 schedules (anything that start/stops once is a schedule) and refuse to update this. They claim it's because people will waste water and they'd get dinged by the EPA or something?

~~Regardless, I bought this device for a reason and nothing listed the above restrictions. So I just grabbed the websocket interactions off the webapp and wrote some code to schedule `manualRun`s instead of using their scheduler. It seems to work fine now, and the product is pretty decent once you're allowed to do whatever you want with it.~~

The service is depricating the web app for some reason - so MQTT is utilized instead of the old websocket. The format is essentially the same. Note that there is a hardcoded password for all clients to interact with MQTT. This might be a bad design as it appears anyone could subscribe to anyone elses topics?

Next steps would be to make some type of UI if anyone cares, or replace the actual firmware on the device/server call out. It wasn't difficult to root either, just haven't bothered doing this yet as I still need to water my lawn. Maybe when the rainy season comes I'll take the next step.

Enjoy!

## Install / Running
Install the node modules, adjust the `config.yaml` to accurately represent the zones and scheduling you want for your sprinklers. Add a `env.yaml` file like the following format:

```
 credentials:
    username: foo@bar.com
    password: foob@rspassw0rd
sentry: https://blahblahblah.ingest.sentry.io/5480627 (optional)
```
Then just run `node` with `index.js`, I did this in a `screen` session for the time being.

## TODO
 - While the controller will accept an arbitrary time, it will only run at a max length of 1 hour and 30 minutes. So we will need to replicate "fake" extensions
 - Detect potential collisions in scheduling
 - Add actual documentation if someone else wants to use this?
 - Add device offline notification, via twilio?