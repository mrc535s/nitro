#!/usr/bin/env node
/*/////////////////////////////////////////////////////////////////////////////

  Author  : @qodeninja

/////////////////////////////////////////////////////////////////////////////*/


/*/////////////////////////////////////////////////////////////////////////////
// Includes
/////////////////////////////////////////////////////////////////////////////*/

  const colors     = require('colors');
  const os         = require('os');
  const httpServer = require('../util/www');
  const portfinder = require('portfinder');
  const opener     = require('opener');
  const argv       = require('optimist').boolean('cors').argv;
  const nullHost   = '0.0.0.0';
  const localHost  = '127.0.0.1';
  const basePort   = 8080;
  const logger     = getLogger();
  const baseDir    = "/public";

/*/////////////////////////////////////////////////////////////////////////////
// Exports
/////////////////////////////////////////////////////////////////////////////*/


  function help(){
      console.log([
        'usage: nitro-www [path] [options]',
        '',
        'options:',
        '  -p           Port to use [8080]',
        '  -a           Address to use [0.0.0.0]',
        '  -d           Show directory listings [true]',
        '  -i           Display autoIndex [true]',
        '  -g --gzip    Serve gzip files when possible [false]',
        '  -e --ext     Default file extension if none supplied [none]',
        '  -s --silent  Suppress log messages from output',
        '  --cors[=headers]   Enable CORS via the "Access-Control-Allow-Origin" header',
        '                     Optionally provide CORS headers list separated by commas',
        '  -o [path]    Open browser window after starting the server',
        '  -c           Cache time (max-age) in seconds [3600], e.g. -c10 for 10 seconds.',
        '               To disable caching, use -c-1.',
        '  -U --utc     Use UTC time format in log messages.',
        '',
        '  -P --proxy   Fallback proxy if the request cannot be resolved. e.g.: http://example.com',
        '',
        '  -S --ssl     Enable https.',
        '  -C --cert    Path to ssl cert file (default: cert.pem).',
        '  -K --key     Path to ssl key file (default: key.pem).',
        '',
        '  -r --robots  Respond to /robots.txt [User-agent: *\\nDisallow: /]',
        '  -h --help    Print this list and exit.'
      ].join('\n'));
      process.exit();
  }


  function getLogger(){
    var logger;
    var utc =argv.U || argv.utc;
    if( !argv.s && !argv.silent ){
      logger = {
        info: console.log,
        request: function (req, res, error) {
          var date = utc ? new Date().toUTCString() : new Date();
          if (error) {
            logger.info(
              '[%s] "%s %s" Error (%s): "%s"',
              date, req.method.red, req.url.red,
              error.status.toString().red, error.message.red
            );
          }else {
            logger.info(
              '[%s] "%s %s" "%s"',
              date, req.method.cyan, req.url.cyan,
              req.headers['user-agent']
            );
          }
        }
      };
    }else if(colors) {
      logger = {
        info   : ()=>{},
        request: ()=>{}
      };
    }
    return logger;
  }


  function parseOptions( onSuccess, onError ){
    console.log('parseoptions');
    var options = {
      root      : argv._[0] || null,
      cache     : argv.c    || null,
      showDir   : argv.d    || null,
      autoIndex : argv.i    || null,
      gzip      : argv.g    || argv.gzip,
      robots    : argv.r    || argv.robots,
      ext       : argv.e    || argv.ext,
      proxy     : argv.P    || argv.proxy,
      ssl       : !!argv.S || !!argv.ssl,
      host      : argv.a   || nullHost,
      logFn     : logger.request
    };

    if( argv.cors ){
      options.cors = true;
      if( typeof argv.cors === 'string' ) {
        options.corsHeaders = argv.cors;
      }
    }

    if( options.ssl ){
      options.https = {
        cert: argv.C || argv.cert || 'cert.pem',
        key : argv.K || argv.key  || 'key.pem'
      };
    }

    var port  = argv.p   || parseInt(process.env.PORT, 10);
    console.log(process.env.PORT);

    if( !port ){
      portfinder.basePort = basePort;
      portfinder.getPort(function (err, port) {
        options.port = port;
        if(err)  return onError(err);
        if(!err) return onSuccess(options);
      });
    }else{
      options.port = port;
      console.log(options);
      return onSuccess(options);
    }


  }


  function WWWServer( config ){
    

    config( function( options ){  
      console.log('config-success');
      var ifaces  = os.networkInterfaces();
      var server  = httpServer.createServer( options );
      var port    = options.port;
      var host    = options.host;
      var ssl     = options.ssl;
      var proxy   = options.proxy;

      console.log(options);

      server.listen( port, host, function(){
        var canonicalHost = host === nullHost ? localHost : host,
            protocol      = ssl ? 'https://' : 'http://';

        logger.info( ['Starting up nitro-www, serving '.yellow,
          server.root.cyan,
          ssl ? (' through'.yellow + ' https'.cyan) : '',
          '\nAvailable on:'.yellow
        ].join(''));

        if( argv.a && host !== nullHost ){
          logger.info(('  ' + protocol + canonicalHost + ':' + port.toString()).green);
        }else{
          Object.keys(ifaces).forEach( function (dev){
            ifaces[dev].forEach( function (details){
              if(details.family === 'IPv4') logger.info(('  ' + protocol + details.address + ':' + port ).green);
            });
          });
        }

        if(typeof proxy === 'string') {
          logger.info('Unhandled requests will be served from: ' + proxy);
        }

        logger.info('Hit CTRL-C to stop the server');

        if(argv.o){
          opener(
            protocol + '//' + canonicalHost + ':' + port,
            { command: argv.o !== true ? argv.o : null }
          );
        }
      });

    }, function(err){
      console.log('config-er');
       console.error('Error occured'.red); 
       if(err){ throw err };
       process.exit(1);
    });



    //PROCESS EVENTS
    if (process.platform === 'win32') {
      require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      }).on('SIGINT', function () {
        process.emit('SIGINT');
      });
    }

    process.on('SIGINT', function () {
      logger.info('nitro-www stopped.'.red);
      process.exit();
    });

    process.on('SIGTERM', function () {
      logger.info('nitro-www stopped.'.red);
      process.exit();
    });

    process.once( 'SIGUSR2', function () {
      logger.info('Attempting to graceful kill...'.red);
      process.kill(process.pid, 'SIGUSR2');
    });


    process.once( 'EADDRINUSE', function(){
      logger.info( 'Required port ('+ port +') unavailable'.red);
      process.exit(1);
    });


  }


/*/////////////////////////////////////////////////////////////////////////////
// Exports
/////////////////////////////////////////////////////////////////////////////*/

  //bin files dont usually export
  module.exports = WWWServer;


/*/////////////////////////////////////////////////////////////////////////////
// Standalone
/////////////////////////////////////////////////////////////////////////////*/

  if( require.main === module ){

    // var args = process.argv.slice(2);

    // args.forEach(function (val, index, array) {
    //   console.log(index + ': ' + val);
    // });
    if (argv.h || argv.help) help();
    WWWServer( parseOptions );

  }
