// AWS IoT Device app that continuously scans for heartbeat



//
// Parse command line arguments
//

var commandLineArgs = require('command-line-args');

var args = commandLineArgs([
  { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
  { name: 'email', alias: 'e', type: Boolean, defaultValue: false },
])

var options = args.parse()

// keep a hash map of sensors with the last timestamp
var HashMap = require('hashmap');
var map = new HashMap();

const offlineThreshold = 180;
const statusFile = '/var/www/vhosts/pi.stillindev.com/htdocs/status.html';
const alertEmail = 'Ian Tomson-Smith <ian@eagle-view.co.uk>';
//const alertEmail = 'abdul@webequator.com';

var sensors = {
	'pi-625b57b5': 'Screen two - Floor 4 - Screen two',
	'pi-95300b7a': 'Innovation 2 - Palais 2 - Floor 0 - Small stage',
	'pi-41406a4e': 'Audi 2 - Floor 1 - Grand Audi 2',
	'pi-2d37bee9': 'Entrance 1 - Floor 0 - entrance 1',
	'pi-5dc8928f': 'P1 to terrace - Floor 3 - Passage to terrace',
	'pi-8e00834b': 'Innovation 1 - Palais 2 - Floor 0 - Stage',
	'pi-e59fad92': 'PI-7',
	'pi-25374705': 'Exhibition 2 - Floor 01 - exhibition 2',
	'pi-99876e0d': 'Innovation 3 - Palais 2 - Floor 0 - open',
	'pi-aaeefc3a': 'Health 1 - Palais 2 - Floor 1 - Stage',
	'pi-e47abd86': 'Terrace 1 - Terrace',
	'pi-745d6d64': 'Terrace 2 - Terrace',
	'pi-3b482e37': 'Debussy 1 - Floor 1 - Debussy booth 1',
	'pi-3d9754cd': 'Debussy 2 - Floor 1 - Debussy booth 2',
	'pi-8620117e': 'P2 Entrance - Palais 2 - Floor 0 - Entrance',
	'pi-b2ed712': 'PI-16',
	'pi-36e0170f': 'Entrance 2 - Floor 0 - entrance 2',
	'pi-b1893e28': 'PI-18',
	'pi-2302a806': 'Exhibition 1 - Floor 01 - exhibition 1',
	'pi-1a06ad89': 'Digital exhibition 1 - Floor 01 - left side',
	'pi-193bae62': 'Entrance Floor 01 - hostess desk',
	'pi-1f62a0ce': 'Digital exhibition 2 - Floor 01 - right side',
	'pi-724ca6af': 'Screen one - Floor 5 - Screen one',
	'pi-abcd58a1': 'P2 to terrace - Palais 2 - Floor 1 - Entrance from terrace',
	'pi-ad5769ae': 'Beach - Cannes Beach',
	'pi-7444a7ad': 'Maidenhead-UK',
	'pi-3fdff704': 'Audi 1 - Floor 1 - Grand Audi 1',
	'pi-460d53d3': 'Debussy 3 - Floor 3 - Debussy',
	'pi-38b30168': 'Clubhouse - Floor 1 - Clubhouse',
	'pi-4ebc0601': 'Forum - Floor 3 - Forum',
	'pi-6b5fe503': 'PI-TEST - TEST'
}

//
// AWS IoT connection
//

// use the hostname to identify this instance of the monitor
var os = require('os');
const monitor = os.hostname().split('.').shift() + '-monitor';
const mailFrom = 'monitor@' + os.hostname();

// use this topic for heartbeats
//const topicHeartbeat = 'heartbeat';
const topicHeartbeat = 'detection';

// connect to AWS IoT
var awsIot = require('aws-iot-device-sdk');

var toLocalTime = function(dtime, offset) {
	var d = new Date(dtime);
	var offset = offset*3600000;//(new Date().getTimezoneOffset() / 60) * 1200;
	var n = new Date(d.getTime() + offset);
	return n;
};

var getDeviceName = function(sensor) {
	if(typeof sensors[sensor] !== 'undefined') {
		sensor = sensors[sensor];
	}
	else {
		sensor = sensor;
	}
	
	return sensor;
}

const aws = awsIot.device({
    keyPath: './certs/private.pem.key',
    certPath: './certs/certificate.pem.crt',
    caPath: './certs/root-CA.crt',
    region: 'eu-west-1',
    clientId: monitor
});

// check for offline sensors every 10 seconds
offline = setInterval(function() {
    now = new Date();

    if (options.verbose) {
      // also log to console
      console.log('Sensor check at', now.toJSON());
    }
    map.forEach(function(timestamp, sensor) {
      last = new Date(timestamp);
      // calculate how many seconds since the last timestamp
      age = parseInt((now - last)/1000);
			
      if (age > offlineThreshold) {
         // if sensor hasn'd reported recently announce it as newly offline
         console.log('Sensor', sensor, 'offline at', now.toJSON(), '(last heartbeat', age, 'sec ago, threshold is', offlineThreshold + 'sec)');
         // and remove it form the list
         map.remove(sensor);
				 sensor = getDeviceName(sensor) + " ("+sensor+")";
         if (options.email) {
           // also sent email
           var Email = require('email').Email
           var myMsg = new Email(
           { from: mailFrom,
             to:   alertEmail,
             subject: 'Sensor ' + sensor + ' offline',
             body: 'Sensor ' + sensor + ' offline at ' + now.toJSON() + ' (last heartbeat ' + age + ' sec ago, threshold is ' + offlineThreshold + ' sec)',
           })
           myMsg.send();
         }
      }
      if (options.verbose) {
        // log to console each sensor and timestamp/seconds since last heard
        console.log(sensor, last.toJSON(), age, 'sec ago');
      }
    });
}, 10000);

// report active sensors every 10 seconds to a file
report = setInterval(function() {
    now = new Date();

    if (options.verbose) {
      // also log to console
      console.log('Reporting to file at', now.toString());
    }

    var counter = 0;
    var counter1 = 0;

    var fs = require('fs');
    var stream = fs.createWriteStream(statusFile);
    stream.once('open', function(fd) {
      stream.write('<html><head><title>Sensors online as of</title><meta http-equiv=\"refresh\" content=\"10\"><link href="style.css" rel="stylesheet"></head><body><h1 class="green">Status of sensors as of ' + toLocalTime(now, 2).toLocaleString() + '</h1><table class="table"><tr><th style="">Sensor</th><th>Name</th><th>Last heartbeat</th></tr>\n');

      map.forEach(function(timestamp, sensor) {
        last = new Date(timestamp);
        // calculate how many seconds since the last timestamp
        age = parseInt((now - last)/1000);
				sensorName = getDeviceName(sensor);
        stream.write('<tr><td>' + sensor + '</td><td>' + sensorName + '</td><td>' + last.toJSON() + '</td></tr>');
        counter++;
      });
      stream.write('</table><p class="green">' + counter + ' sensors active during last ' + offlineThreshold + ' sec</p>\n');
			
      stream.write('<h1 class="orange">Sensors offline as of ' + toLocalTime(now, 2).toLocaleString() + '</h1><table class="table"><tr><th style="">Sensor</th><th>Name</th></tr>\n');
			
			for (var tsensor in sensors) {
				if(!map.has(tsensor)) {
					stream.write('<tr><td>' + tsensor + '</td><td>' + sensors[tsensor] + '</td></tr>');
					counter1++;
				}
				
			}
      stream.write('</table><p class="orange">' + counter1 + ' sensors offline</p>\n');
      stream.write('</body></html>\n');
			
			
      stream.end();
    });
}, 10000);

// subscribe to the topic
aws.subscribe(topicHeartbeat);



//
// AWS IoT event handlers
//

aws
    .on('connect', function() {
        console.log('AWS IoT Device Gateway: Connected');
    });
aws
    .on('close', function() {
        console.log('AWS IoT Device Gateway: Closed');
    });
aws
    .on('reconnect', function() {
        console.log('AWS IoT Device Gateway: Reconnected');
    });
aws
    .on('offline', function() {
        console.log('AWS IoT Device Gateway: Offline');
    });
aws
    .on('error', function(error) {
        console.log('AWS IoT Device Gateway: Error -', error);
    });
aws
    .on('message', function(topic, payload) {
       if (options.verbose) {
         // also log to consolepp
         console.log(payload.toString());
       }

       // parse payload
       heartbeat = JSON.parse(payload);
			 //change hearbeat sensor name and time to cannes time.
			 //heartbeat.sensor = getDeviceName(heartbeat.sensor);
			 heartbeat.timestamp = toLocalTime(heartbeat.timestamp, 2)
				 
       if (! map.has(heartbeat.sensor)) {
         // if sensor is not on our list announce it as newly online
				 
         console.log('Sensor', heartbeat.sensor, ' online at', heartbeat.timestamp, '(uptime', parseInt(heartbeat.uptime/60), 'minutes)');
				sensorName = getDeviceName(heartbeat.sensor);
         if (options.email) {
           // also sent email
					 var Email = require('email').Email
           var myMsg = new Email(
           { from: mailFrom,
             to:   alertEmail,
             subject: 'Sensor ' + sensorName + ' ('+ heartbeat.sensor + ') online',
             body: 'Sensor ' + sensorName +' ('+ heartbeat.sensor   + ') online at ' + heartbeat.timestamp + ' (uptime ' + parseInt(heartbeat.uptime/60) + ' minutes)',
           })
           myMsg.send();
         }
       }
			
			
       // update the last heard from timestamp
       map.set(heartbeat.sensor, heartbeat.timestamp);
    });
