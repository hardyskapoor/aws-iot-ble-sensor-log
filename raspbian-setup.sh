#!/bin/bash
#
# Script to install aws-iot-ble-sensor onto a Raspbian Jessie system.
#
# curl -sL https://raw.githubusercontent.com/hardyskapoor/aws-iot-ble-sensor-log/master/raspbian-setup.sh | sudo -E bash -
#

export DEBIAN_FRONTEND=noninteractive

print_status() {
    echo
    echo "## $1"
    echo
}

bail() {
    echo 'Error executing command, exiting'
    exit 1
}

exec_cmd_nobail() {
    echo "+ $1"
    bash -c "$1"
}

exec_cmd() {
    exec_cmd_nobail "$1" || bail
}

# Install the NodeSource Node.js 6.x repo
curl -sL https://deb.nodesource.com/setup_6.x | bash -

print_status "Running apt-get upgrade..."
exec_cmd 'apt-get upgrade -y'

print_status "Installing Node.js, Supervisor, Git and other dependencies..."
exec_cmd 'apt-get install -y nodejs supervisor git libudev-dev'

print_status "Installing unzip package"
exec_cmd 'apt-get install unzip'

print_status "Checking out aws-iot-ble-sensor-log..."
cd /opt
rm -rf aws-iot-ble-sensor-log

exec_cmd 'git clone https://github.com/hardyskapoor/aws-iot-ble-sensor-log.git'

print_status "Installing aws-iot-ble-sensor dependencies..."
cd /opt/aws-iot-ble-sensor-log

print_status "Create log directory"
mkdir logs
chomod -R 777 logs/

exec_cmd 'npm install'

print_status "unzip the certificates"
rm -rf /boot/setup/aws-iot-cert
exec_cmd 'unzip /boot/setup/aws-iot-cert.zip -d /boot/setup/aws-iot-cert'


print_status "Preparing /boot/setup/aws-iot-cert/ for the AWS IoT cert..."
mkdir -p /boot/setup/aws-iot-cert
exec_cmd 'ln -s /boot/setup/aws-iot-cert /opt/aws-iot-ble-sensor-log/certs'

print_status "Preparing /boot/setup/wifi/ for the WiFi config..."
mkdir -p /boot/setup/wifi
touch /boot/setup/wifi/wpa_supplicant.conf
rm -rf /etc/wpa_supplicant/wpa_supplicant.conf
exec_cmd 'ln -s /boot/setup/wifi/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf'

cd /opt
print_status "Removing old aws-iot-ble-evms folder"
rm -rf aws-iot-ble-evms

print_status "Running clone for aws-iot-ble-evms"

exec_cmd 'git clone https://github.com/hardyskapoor/aws-iot-ble-evms.git'

print_status "Make the wifi test executeable"
#chmod +x /opt/aws-iot-ble-evms/internet-test.sh
chmod +x /opt/aws-iot-ble-evms/wifi-rebooter.sh

print_status "Removing old check-wifi cronbjob"
rm -rf /etc/cron.d/check-wifi

print_status "Setting up new cronjob for wifi rebooter"
exec_cmd 'ln -s /opt/aws-iot-ble-evms/check-wifi /etc/cron.d/check-wifi'

print_status "Setting up cron for rsync started"
print_status "create ssh folder"
rm -rf /root/.ssh
mkdir .ssh
#chmod 777 .ssh
cp /opt/aws-iot-ble-evms/ssh/id_rsa /root/.ssh/id_rsa
cp /opt/aws-iot-ble-evms/ssh/id_rsa.pub /root/.ssh/id_rsa.pub
print_status "change permission id_rsa"
chmod 600 /root/.ssh/id_rsa

chmod +x /opt/aws-iot-ble-evms/log-sync.sh
print_status "Removing old log-sync cronbjob"
rm -rf /etc/cron.d/log-sync

print_status "setting up sync cron"
exec_cmd 'ln -s /opt/aws-iot-ble-evms/log-sync /etc/cron.d/log-sync'

print_status "Setting up cron for rsync finished"


print_status "Setting up hostname to be derived from serial number..."
rm -rf /etc/hostname
rm -rf /etc/rcS.d/S00sethostname.sh
cat >/etc/init.d/sethostname.sh <<EOF
#!/bin/bash
hostname `cat /proc/cpuinfo | grep Serial | awk -F ': ' '{ print $2 }' | sed -e "s/^0*/pi-/"`
sed -i -e "s/^127\.0\.1\.1.*/127.0.1.1\t`hostname`/" /etc/hosts
EOF
chmod +x /etc/init.d/sethostname.sh
exec_cmd 'ln -s ../init.d/sethostname.sh /etc/rcS.d/S00sethostname.sh'

print_status "Setting up Supervisor to startup and monitor aws-iot-ble-sensor..."
cat >/etc/supervisor/conf.d/aws-iot-ble-sensor-log.conf <<EOF
[program:aws-iot-ble-sensor-log]
directory=/opt/aws-iot-ble-sensor-log/
command=/usr/bin/nodejs /opt/aws-iot-ble-sensor-log/aws-iot-ble-sensor.js -l -t
EOF
print_status "Done ready to go"
