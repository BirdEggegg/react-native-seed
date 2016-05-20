
function error(msg)
{
  alert(msg);
  throw msg;
}

var engine = () => {
  var nothing = {};

  var nodes;
  var async_nodes;

  // uninstall will only work for async nodes
  var uninstall = node => {
    if (node.inputs.length > 0) return;   // skip intermediate async node
    node.formula(x => {
      error('you shall not call next for destruction of input node');
    }, false);
  };

  // install will only work for async nodes
  var install = node => {
    node.post = make_post(node);
    node.seq  = 0;
    if (node.inputs.length > 0) return;   // skip intermediate async node
    node.formula(node.post, true);
  };

  var events = [];
  var make_post = node => value => {
    if (value === nothing) return;
    if (updating) error('next shall not be called in the main thread.');
    if (nodes == null || nodes.find(x => x === node) === undefined) return;
    events.push({ node, value });
    request_update();
  };

  var dispatch = (changed, node) => {
    node.narrived++;
    node.changed = node.changed || changed;
    if (node.narrived > node.inputs.length)
      error('how come number of arrived value is more than number of inputs???');
    if (node.narrived !== node.inputs.length) return; // wait for others

    if (node.type === 'async') {
      if (node.changed) {
        node.formula(
            (ack =>
              value => ack === node.seq ? node.post(value) : null
            )(++node.seq),
          node.inputs[0].value);
      }
    }
    else {
      if (node.changed) {
        var result;
        switch (node.type) {
          case 'lift':
            result = node.formula(...node.inputs.map(input => input.value),
                        ...node.inputs.map(input => input.touched));
            break;
          case 'fold':
            result = node.formula(node.value, node.inputs[0].value)
            break;
          default: error(`unknown node type: ${node.type}`);
        }
        if (result === nothing) node.changed = false;
        else node.value = result;
      }
      node.touched = node.changed;
      node.outputs.forEach(output => dispatch(node.changed, output));
    }

    // reset internal state
    node.narrived = 0;
    node.changed = false;
  };

  var update_request = null;
  var updating = false;

  var update = () => {  // dispatch events, ONE AT A TIME
    update_request = null;
    updating = true;
    while (events.length > 0) {
      var ev = events.shift();
      if (ev.value === nothing)
        error('logic error: why "nothing" is in the event queue?');

      async_nodes.forEach(node => {
        var changed = (node === ev.node);
        if (changed) ev.node.value = ev.value;
        node.touched = changed;
        node.outputs.forEach(output => dispatch(changed, output));
      });
    }
    updating = false;
  };

  var request_update = () => {
    if (update_request == null)
      update_request = requestAnimationFrame(update);
  };

  var setup = nodes_ => {
    // destroy remembered nodes
    if (update_request) {
      cancelAnimationFrame(update_request);
      update_request = null;
    }
    if (async_nodes != null) async_nodes.forEach(uninstall);
    async_nodes = null;

    // remember new nodes
    nodes = nodes_;
    if (nodes == null) return;

    // find `outputs` from `inputs`
    var populate_outputs = node => {
      if (node.outputs) return;
      node.outputs = [];
      node.inputs.forEach(populate_outputs);
      node.inputs.forEach(input => input.outputs.push(node));
    };
    nodes.forEach(populate_outputs);

    // sanity check
    if (nodes.find(node => node. inputs.length === 0 &&
                 node.outputs.length === 0) !== undefined)
      error('nodes must be connected to the world');
    if (nodes.find(node => node.type !== 'async' && (
                   node. inputs.length === 0 ||
                   node.outputs.length === 0)) !== undefined)
      error('non-async node must have both inputs and outputs.');
    if (nodes.find(node => node.type !== 'lift' &&
                 node.inputs.length > 1) !== undefined)
      error('non-lift node can have at most 1 input.');

    // initialize async nodes
    async_nodes = nodes.filter(node => node.type === 'async');
    async_nodes.forEach(install);

    // populate internal state for nodes
    nodes.forEach(node => {
      node.narrived = 0;
      node.changed = false;
    });
  };

  // helpers
  var fromDOM = (value, element, event, callback) => {
    var listener = null;
    return {
      type: 'async',
      inputs: [],
      value: value,
      formula: (next, init) => {
        if (init) {
          if (listener) error('logic error: listening to the same event again is not allowed.');
          listener = ev => callback(next, ev);
          element.addEventListener(event, listener);
        }
        else {
          if (listener) error('logic error: there is nothing to be unlistened.');
          element.removeEventListener(event, listener);
          listener = null;
        }
      },
    };
  };
  return { setup, nothing, fromDOM };
};

export default engine;

