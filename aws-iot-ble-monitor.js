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
const statusFile = '/htdocs/status.html';
//const alertEmail = 'Ian Tomson-Smith <ian@eagle-view.co.uk>';
const alertEmail = '';
//'pi-2d37bee9': 'Main Entrance 1 (Floor 0 right)',
var sensors = {
'pi-1a06ad89': 'Digital exhibition 1 (Floor -01 left side)',
'pi-1f62a0ce': 'Digital exhibition 2 (Floor -01 right side)',
'pi-25374705': 'Exhibition 2 (Floor -01 café)',
'pi-36e0170f': 'Main Entrance 2 (Floor 0 left)',
'pi-38b30168': 'Clubhouse (Floor 1 )',
'pi-3b482e37': 'Debussy 1 (Floor 1 - Debussy chair)',
'pi-b2ed712': 'Debussy 2 (Floor 1 - Debussy cloakroon)',
'pi-460d53d3': 'Debussy 3 (Floor 3 - Debussy Plinth)',
'pi-3fdff704': 'Audi 1 (Floor 1 - IBM Pillar 3)',
'pi-41406a4e': 'Audi 2 (Floor 1 - IBM Pillar 5)',
'pi-4ebc0601': 'Forum (Floor 3 )',
'pi-5dc8928f': 'Palais 1 Corridor to Terrace (Floor 3 )',
'pi-625b57b5': 'Screen two (Floor 4)',
'pi-724ca6af': 'Screen one (Floor 5)',
'pi-193bae62': 'Terrace 1 (Stage)',
'pi-745d6d64': 'Terrace 2 (Terrace near the DJ Booth)',
'pi-e59fad92': 'Palais 2 Ground Floor Entrance (Reception Desk)',
'pi-aaeefc3a': 'Entertainment 1   (entrance)',
'pi-abcd58a1': 'Entertainment 2   (networking bar)',
'pi-ad5769ae': 'Beach (Cannes Beach)',
'pi-8e00834b': 'Innovation 1 (Palais 2 Stage)',
'pi-95300b7a': 'Innovation 2 (Palais 2Small stage)',
'pi-b1893e28': 'Entertainment 3 (inspiration stage (back camera))',
'pi-99876e0d': 'Innovation 3 (Palais 2 open)',
'pi-2302a806': 'Innovation 4 (front entrance top floor)',
'pi-6b5fe503': 'Innovation 5 ( back entrance top floor )',
'pi-e47abd86': 'reserve4 ()',
'pi-3d9754cd': 'Removed1 ()',
'pi-8620117e': 'Removed2 ()',
'pi-2d37bee9': 'Removed3 ()',
'pi-7444a7ad': 'Maidenhead-UK ()'

}

//
// AWS IoT connection
//

// use the hostname to identify this instance of the monitor
var os = require('os');
const monitor = os.hostname().split('.').shift() + '-monitor';
//const mailFrom = 'monitor@' + os.hostname();
const mailFrom = 'autumnfair-pistatus@eagle-view.co.uk';

// use this topic for heartbeats
const topicHeartbeat = 'heartbeat';

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
			//console.log(now, last, timestamp, age);
			hbtimestamp = toLocalTime(timestamp, 2);
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
      stream.write('<html><head><title>Sensors online as of</title><meta http-equiv=\"refresh\" content=\"10\"><link href="aws-style.css" rel="stylesheet"></head><body><div class="left"><h1 class="green">Sensors online as of ' + toLocalTime(now, 1).toLocaleString() + '</h1><table class="table"><tr><th style="">Sensor</th><th>Name</th><th>Last heartbeat</th></tr>\n');

      map.forEach(function(timestamp, sensor) {
        last = new Date(timestamp);
        // calculate how many seconds since the last timestamp
        age = parseInt((now - last)/1000);
				sensorName = getDeviceName(sensor);
				hbtimestamp = toLocalTime(timestamp, 2)
        stream.write('<tr><td>' + sensor + '</td><td>' + sensorName + '</td><td>' + hbtimestamp.toJSON() + '</td></tr>');
        counter++;
      });
      stream.write('</table><p class="green">' + counter + ' sensors active during last ' + offlineThreshold + ' sec</p></div>\n');

      stream.write('<div class="right"><h1 class="orange">Sensors offline as of ' + toLocalTime(now, 1).toLocaleString() + '</h1><table class="table"><tr><th style="">Sensor</th><th>Name</th></tr>\n');

			for (var tsensor in sensors) {
				if(!map.has(tsensor)) {
					stream.write('<tr><td>' + tsensor + '</td><td>' + sensors[tsensor] + '</td></tr>');
					counter1++;
				}

			}
      stream.write('</table><p class="orange">' + counter1 + ' sensors offline</p></div>\n');
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
			 hbtimestamp = toLocalTime(heartbeat.timestamp, 2)
			 console.log(hbtimestamp, heartbeat.timestamp);
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
             body: 'Sensor ' + sensorName +' ('+ heartbeat.sensor   + ') online at ' + hbtimestamp + ' (uptime ' + parseInt(heartbeat.uptime/60) + ' minutes)',
           })
           myMsg.send();
         }
       }


       // update the last heard from timestamp
       map.set(heartbeat.sensor, heartbeat.timestamp);
    });
