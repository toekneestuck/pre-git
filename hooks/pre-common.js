'use strict';

var child = require('child_process');
var label = 'pre-commit:';

function getGitRoot(cb) {
  child.exec('git rev-parse --show-toplevel', function onRoot(err, output) {
    if (err) {
      console.error('');
      console.error(label, 'Failed to find git root. Cannot run the tests.');
      console.error('');
      return process.exit(1);
    }
    var root = output.trim();
    cb(root);
  });
}

/**
 * You've failed on some of the scripts, output how much you've sucked today.
 *
 * @param {Error} err The actual error.
 * @api private
 */
function failure(err) {
  console.error('');
  console.error(label, 'You\'ve failed to pass all the hooks.');
  console.error(label);

  if (err.ran) {
    console.error(label, 'The "'+ err.ran +'" script failed.');
  } else {
    var stack = err.stack.split('\n')
    console.error(label, 'An Error was thrown: '+ stack.shift());
    console.error(label);
    stack.forEach(function trace(line) {
      console.error(label, '   '+ line.trim());
    });
  }
  console.error(label);
  console.error(label, 'You can skip the git pre-commit hook by running:');
  console.error(label);
  console.error(label, '   git commit -n (--no-verify)');
  console.error(label);
  console.error(label, 'But this is not adviced as your tests are obviously failing.');
  console.error('');
  process.exit(1);
}

function getTasks(root, label) {
  var pkg, run = [];

   //
  // Bail-out when we failed to parse the package.json, there is probably a some
  // funcky chars in there.
  //
  try {
    pkg = require(root +'/package.json'); }
  catch (e) {
    return failure(e);
  }

  if (!pkg.scripts) {
    console.log('');
    console.log(label + ': No scripts detected in the package.json, bailing out.');
    console.log('');
    return;
  }

  //
  // If there's a `pre-commit` property in the package.json we should use that
  // array.
  //
  if (pkg[label] && Array.isArray(pkg[label])) {
    run = pkg[label];
  }

  //
  // If we don't have any run processes to run try to see if there's a `test`
  // property which we should run instead. But we should check if it's not the
  // default value that `npm` adds when your run the `npm init` command.
  //
  if (!run.length) {
    run.push('echo Please specify tests for "' + label + '"');
  }

  return run;
}

//
// Behold, a lazy man's async flow control library;
//
function runner(run) {
  (function taskRunner(done) {
    (function next(err, task) {
      //
      // Bailout when we received an error. This will make sure that we don't
      // run the rest of the tasks.
      //
      if (err) {
        err = new Error(err.message);
        err.ran = task;
        return done(err);
      }

      // Check if we have tasks to be executed or if we are complete.
      task = run.shift();
      if (!task) return done();

      console.log('executing task "' + task + '"');

      var options = {
        cwd: root,
        env: process.env,
        stdio: [0, 1, 2]
      };
      child.exec(task, options, function onTaskFinished(err, stdio) {
        console.log(stdio);

        if (err) {
          return next(new Error(task + ' closed with error ' + err), task);
        }
        next(undefined, task);
      });
    })();
  })(function ready(err) {
    if (err) return failure(err);

    //
    // Congratulation young padawan, all hooks passed.
    //
    process.exit(0);
  });
}

module.exports = {
  getGitRoot: getGitRoot,
  failure: failure,
  runner: runner,
  getTasks: getTasks
};