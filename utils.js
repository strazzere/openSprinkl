const fs = require('fs');
const yaml = require('js-yaml');
const emoji = require('node-emoji');

function timestampString(epoch) {
    var d = new Date(0);
    d.setUTCSeconds(epoch);
    return " " + emoji.get('calendar') + " " + d.toLocaleString();
}

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

module.exports = {
    loadYaml,
    convertToCron,
    timestampString
};
