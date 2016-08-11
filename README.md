# aws-iot-ble-sensor

This is a simple AWS IoT Device app that continuously scans for and reports detected iBeacons.
Rules can then be setup to send the data to Amazon DynamoDB, Elasticsearch Service, Kinesis or Machine Learning.

## Installation

This app is intended to be run on Raspberry Pi 3 running Raspbian Jessie.

- Download the Raspbian Jessie Lite image from the [official downloads page](https://www.raspberrypi.org/downloads/raspbian/)
- Install Raspbian image to an SD card following the [installation guide](https://www.raspberrypi.org/documentation/installation/installing-images/README.md)
- Boot the device, login and run the automated setup script: ```curl -sL https://raw.githubusercontent.com/kkonstan/aws-iot-ble-sensor/master/raspbian-setup.sh | sudo -E bash -```
- Copy AWS IoT certificates to ```/boot/setup/aws-iot-cert/```
- Optionally setup WiFi in ```/boot/setup/wifi/wpa_supplicant.conf```

Example ```wpa_supplicant.conf```:
```
country=GB
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
network={
	ssid=“My Network”
	psk=“My Pre-Shared Key”
}
```

The above setup script will also install a script that will automatically set the hostname (which is also used as a clientId when connecting to AWS IoT) based on the serial number of the CPU. This means that the SD card can be copied and used by any number of Raspberry Pis and each will connect and report a unique hostname as clientID.

## Usage

For testing purposes the scripts can also be run on OS X and Linux.

### aws-iot-ble-sensor.js

This script listens for ibeacons and reports them to the topic ‘detection’ and also sends a heartbeat every 60 seconds to topic ‘heartbeat’. This also create the log for detection topic to avoid data loss in case of network not available.

Options:

  * -v or --verbose to emmit debug messages to the console
  * -t or --throttle to supress reporting beacons more than once per 10 seconds
  * -l or --led to display status via controlling LEDs connected to GPIO pins

### aws-iot-ble-receiver.js

This script subscribes to both topics and just prints out the messages it receives.

### aws-iot-ble-monitor.js

This script subscribes for 'heartbeat' topic and create report in HTML format to view status of online/offline PIs with their location.
This is what a detection message and log looks like:
```json
{
  "timestamp": "2016-04-26T17:46:34.527Z",
  "type": "detection",
  "uuidmm": "699ebc80e1f311e39a0f0cf3ee3bc012:0/65535",
  "proximity": "near",
  "sensor": "hostname"
}
```

This is what a heartbeat message looks like:
```json
{
  "timestamp": "2016-04-26T17:47:28.361Z",
  "type": "heartbeat",
  "version":"0.2.1",
  "uptime": 78440,
  "loadavg": [
    0.794921875,
    0.83349609375,
    0.875
  ],
  "sensor": "hostname"
}
```
