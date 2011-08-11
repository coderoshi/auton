
var plugins   = {},
    stylus  = require( 'stylus' ),
    nib     = require( 'nib'    ),
    uglify  = require( 'uglify-js'  ),
    coffee  = require( 'coffee-script' ),
    cssmin  = require( 'cssmin' ),
    gzip    = require( 'gzip'   ),
    jshint  = require( 'jshint' ).JSHINT;
    fs      = require( 'fs' );

  plugins.uglify = function(next) {
    var ast, code;
    try {
      ast = uglify.parser.parse(this.data);
      ast = uglify.uglify.ast_mangle(ast);
      ast = uglify.uglify.ast_squeeze(ast);
      code = uglify.uglify.gen_code(ast);
      this.save.minified = code;
      this.data = code;
      return next();
    } catch (e) {
      return next(e);
    }
  }
  
  plugins.minifyJs = plugins.uglify;

  plugins._jshint = function(options) {
    if (typeof options === 'undefined') {
      options = {};
    }
    return function (next) {
      var result = jshint(this.data, options);
      if (result) {
        next();
      } else {
        var errorString = "Error in " + this.path + ": \n";
        for (var i = 0; i < jshint.errors.length; i++) {
          var e = jshint.errors[i];
          errorString += e.id + " [Line " + e.line + ", Char " + e.character + "] " + e.reason + "\n"
                         " >>> " + e.evidence + "\n";
        }
        next( "JSHint: " + errorString );
      }
    }
  }

  plugins.jshint = plugins._jshint();

  plugins.gzip = function(next) {
    var that = this;
    return gzip(this.data, 9, function(err, cmp) {
      if (err) {
        next(err);
      } else {
        that.data = cmp;
        that.save.compressed = cmp;
        next();
      }
    });
  }

  plugins.read = function(next) {
    var that = this;
    return fs.readFile(this.compiler.rootDir + "/" + this.path, function(err, data) {
      if (err) {
        return next(err);
      }
      var d = data.toString();
      that.save.original = d;
      that.data = d;
      next();
    });
  }

  plugins.cssmin = function(next) {
    try {
      var d = cssmin.cssmin(this.data);
      this.data = d;
      this.save.minified = d;
      next();
    } catch (e) {
      next(e);
    }
  }
  
  plugins.minifyCss = plugins.cssmin;
  
  plugins._stylus = function(opts) {
    if (!opts) { opts = {}; }
    return function(next) {
      var that = this;
      var realOpts = {filename: this.path};
      for (var i in opts) {  
        if (opts.hasOwnProperty( i )) {
          realOpts[i] = opts[i];
        }
      }
      stylus(this.data, realOpts).use( nib() ).render(function(err, css){
        if (err) {
          
          next(err.message);
        } else {
          that.data = css;
          that.save.original = css;
          next();
        }
      });
    };
  }
  
  plugins.stylus = plugins._stylus();
  
  plugins.save = function(next) {
    var savedFiles = [],
        that = this;
    for (var i in this.save) {
      savedFiles.push([ i, this.save[i] ]);
    }

    var doSave = function(i){
      if (i < savedFiles.length) {
        var entry = savedFiles[i],
            filename = that.rule.outputFilenameFunction( entry[0], that.path ),
            data     = entry[1],
            fullPath = path.join( that.compiler.outputDir, filename ),
            dirname  = path.dirname( fullPath );
        
        if (filename) {
          console.log("" + (new Date()) + "> Saving: " + fullPath);
          mkdir_p( dirname, function(e){
            if (e) { return next(e); }
    
            fs.writeFile( fullPath, data, function(err) {
              if (err) { return next(err);     }
              else     { return doSave(i + 1); }
            });
          });
        } else {
          doSave(i + 1);
        }
      }
    }
    doSave(0);
  }

  plugins.debug = function(next) {
    console.log("DEBUG :---------------------------------------------");
    console.log("file  : ", this.path )
    console.log("data  : ", inspect(this.data) );
    for (var i in this.save) {
      console.log("      :---------------------------------------------");
      console.log("save  : " + i);
      console.log("data  : ", inspect(this.save[i]));
    }
    console.log("------:---------------------------------------------");

    next();
  }

function mkdir_p( dir, cb, mode ) {
  mode = mode || 0755;
  path.exists(dir, function(exists){
    if (exists) {
      cb();
    } else {
      var dirs = dir.split("/");
      if ( dir.indexOf('/') === 0) {
        dirs[0] = '/';
      }
      var seed = dirs.shift();
      mkdir_p$( seed, dirs );
    }
  });
  
  var mkdir_p$ = function( str, segments ) {
    var str = path.join(str, segments[0]);
    segments = segments.slice(1);
    var ret = function(){
      if (segments.length) {
        mkdir_p$( str, segments );
      } else {
        cb();
      }
    }
    
    path.exists( str, function(exists){
      if (exists) {
        ret();
      } else {

        fs.mkdir( str, mode, function(err) {
          if (err) { return cb(err); }
          ret();
        });
      }
    });
    
  }
}

module.exports   = plugins;