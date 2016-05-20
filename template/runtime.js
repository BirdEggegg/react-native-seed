
export default function(actions) {
  function ajaxJSON(isPost, base, args, ok)
  {
    var fail = msg => alert(msg);

    // prepare callbacks
    var req = new XMLHttpRequest();
    req.onload = () => {
      var json = JSON.parse(req.response);
      ok(json);
    };
    req.onabort = () => fail("connection aborted");
    req.onerror = () => fail("connection failed");

    // fire!
    req.responseType = 'json';
    if (isPost) {
      req.open('POST', base);
      req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      req.send(buildArg(args));
    }
    else {
      req.open('GET', buildURL(base, args));
      req.send();
    }
  }

  function countdown(callback, time)
  {
    var timeout = () => {
      callback(time);
      if (time === 0) return;
      time--;
      setTimeout(timeout, 1000);
    };
    timeout();
  }

  function pushPage(name, onFinished)
  {
    actions['navigator'].push({ name });
    requestAnimationFrame(onFinished);
  }

  function popPage(onFinished)
  {
    actions['navigator'].pop();
    requestAnimationFrame(onFinished);
  }

  return {
    ajaxJSON,
    countdown,
    pushPage,
    popPage,
  };
}

function buildArg(args)
{
    var arg = [];
    for (var name in args)
        arg.push(encodeURIComponent(name) + "="
            + encodeURIComponent(args[name]));
    return arg.join("&");
}

function buildURL(base, args) {
    var arg = buildArg(args);
    if (arg !== '') arg = '?' + arg;
    return base + arg;
}

