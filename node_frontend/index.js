var com = require("serialport");
require("colors");
var repl = require("repl");
var REPL_STARTED = false;
var yargs = require("yargs");
//repl.start(">>");

var log = require("./log.js");
// global singleton func that sets and determines the current state of the
// arduino board
var state = require("./printer_state.js").state;

// show available ports
var list_ports_and_exit = function() {
  com.list(function (err, ports) {
    log("--------");
    ports.forEach(function(port) {
      log(port.comName);
      log("    ---> " + port.pnpId);
      port.manufacturer && log(port.manufacturer);
      log("");
    });
    log("========");
    process.exit();
  });
  log('Please specify one of these available device ports...');
}

var init_serial = function(sp) {
  /* Initialize the arduino.
  * Define how to handle messages from the serial port */
  sp.on('open', function(err) {
    if (err) {
      state.set("all_off");
      log('failed to open: '+ error);
      throw err;
    }
    log('opened Serial port');

    sp.on('data', function(rawmsg) {handle_incoming_data(rawmsg, sp);});
    sp.on('error', function(err) {
      state.set("all_off");
      if (err) {
        log.serial('something related to arduino failed!');
        throw err;
      }});
    sp.on('close', function(err) {
      state.set("all_off");
      if (err) {
        log.serial('arduino connection closed with failure!');
        throw err;
      }});
  });
}


var handle_incoming_data = function(rawmsg, sp) {
  var msg = rawmsg.toString('utf-8').trim()
  if (msg) {
    log.serial(msg);
  }

  //respond to various messages from the arduino firmware
  if (msg.match(
    "Please pass exactly 1 byte specifying the number"
      + " of microsteps per turn:"))
  {
    state.set("all_off");
    microstep_listener(sp);
    // TODO: the arduino might choose to reset itself for whatever reason.  If
    // it does, I should save what's currently in the pipe and then, after
    // microstep listener, perhaps submit it again?
  } else if (msg.match("Please pass 13 bytes at a time in Big Endian order")) {
    state.set("motors_on");
  }
}

var microstep_listener = function(sp) {
  var message = new Buffer(1);
  message[0] = argv.microstepping;
  // clear the pipe
  sp.drain(function(err) {
    if (err) {
      set.state("all_off");
      throw err;
    }});
  sp.write(message, function(err) {
    if (err) {
      set.state("all_off");
      throw err;
    }
    log('setting microsteps to: ' + argv.microstepping);
  });
}

var send_serial = function(sp) {
  s = function(a, b, c, d) {
  log('sending data to Serial');
  msg = new Buffer(13);
  msg.writeInt32BE(a, 0, false); // num steps on motor 1
  msg.writeInt32BE(b, 4, false); // num steps on motor 2
  msg.writeInt32BE(c, 8, false); // num microsecs to move for
  msg.writeUInt8(d, 12, false); // bitmap of motor directions
  sp.write(msg, function() {
    sp.drain(function() {
      log('sent bytes');
    });
  })
  }

  // TODO: make this queue up on nodejs's end to ensure these all go through!
  ex = function() {
  s(1*argv.microstepping, 1*argv.microstepping, 1000, 0<<7);
  s(1*argv.microstepping, 1*argv.microstepping, 1000, 1<<7);
  }
  if (!REPL_STARTED) {
    log("Attaching repl for interactive use");
    var rs = repl.start("repl> ").on('exit', function() {
      log("EXIT");
      process.exit();
    });
    REPL_STARTED = true;
  }
}

var main = function() {
  if (!argv.fp) {
    list_ports_and_exit();
    return 1
  }
  // Connect to Arduino
  var sp = new com.SerialPort(argv.fp, {
    baudRate: argv.baudrate,
    parser: com.parsers.readline("\n")
  });

  // init serial and then starts reading/writing data
  init_serial(sp);

  state.on('motors_on', function(stream) {
    send_serial(sp);
  });
}

parse_argv = function() {
  return yargs
  .options('f', {
    alias: 'fp',
    required: false,  // handled in main
    describe: "device path to arduino serial port."
    + " ie: --fp /dev/ttyACM0",
  })
  .options('m', {
    alias: 'microstepping',
    default: 32
  })
  .options('b', {
    alias: 'baudrate',
    default: 9600
  })
  .strict()
  .argv;
}

// execute main function
var argv = parse_argv();
main(argv);