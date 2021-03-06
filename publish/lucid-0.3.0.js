export const Lucid = {
  createComponent: createComponent,
  createPage: createPage,
  createApp: createApp,
  renderComponent: renderComponent,
  removeComponent: disconnectComponent,
  /** @type {App} */
  app: {}
};

/**
 * @typedef {object} App
 * 
 * @property {Page} page
 * @property {Object.<string, Component>} components
 * @property {(containerId: string) => void} run
 */

/** 
 * @typedef {object} Page
 * 
 * @property {string} path
 * @property {string} name
 * @property {Array.<{state: object, dom: HTMLElement}>} elements
 * @property {Hooks} hooks
 * @property {any} payload
 * @property {any} contents
 * @property {Skeleton} skeleton
 */

/**
 * @typedef {object} Component
 * 
 * @property {string} name
 * @property {object} state 
 * @property {Function} render 
 * @property {Object.<string, Function>} methods 
 * @property {Hooks} hooks
 * @property {any} attributes 
 * @property {string} key
 * @property {any} watch 
 * @property {Skeleton} skeleton
 */

/**
 * @typedef {object} Hooks
 * 
 * @property {Function} [created]
 * @property {Function} [connected]
 * @property {Function} [disconnected] 
 * @property {Function} [updated]
 */

/**
 * @typedef {object} Skeleton
 * 
 * @property {string} tag
 * @property {Object.<string, string>} attrs
 * @property {Skeleton[]} children
 */

/**
 * Returns the component that's created from given name and properties.
 * @param {string} name HTML tag name 
 * @param {object} properties
 * @param {object} [properties.state] 
 * @param {Object.<string, Function>} [properties.methods] 
 * @param {() => string} properties.render
 * @param {Hooks} [properties.hooks]
 * @param {any} [properties.attributes]
 * @param {any} [properties.watch]
 * 
 * @returns {Component} Component
 */
function createComponent(name, properties) {
  return {
    name: name,
    state: properties.state,
    methods: properties.methods,
    render: properties.render,
    hooks: properties.hooks,
    attributes: properties.attributes,
    watch: properties.watch
  };
}

/**
 * Returns the page that's created from given properties.
 * @param {object} properties
 * @param {string} properties.path
 * @param {string} properties.name
 * @param {any} [properties.payload]
 * @param {Function} properties.contents
 * @param {Hooks} [properties.hooks]
 * 
 * @returns {Page} Page
 */
function createPage(properties) {
  return {
    path: properties.path,
    name: properties.name,
    elements: {},
    payload: properties.payload,
    contents: properties.contents,
    hooks: properties.hooks
  };
}

/**
 * Returns the app that's created from given properties.
 * @param {object} properties 
 * @param {Page} properties.page 
 * @param {Object.<string, Component>} [properties.components]
 * 
 * @returns {App} App
 */
function createApp(properties) {
  Lucid.app = {
    page: properties.page,
    components: properties.components,
    run: function (containerId) {
      // Get the container
      this.container = document.getElementById(containerId);

      const elem = document.createElement("div");
      elem.innerHTML = this.page.contents();

      // Create the skeleton out of the first element node
      for (let i = 0; i < elem.childNodes.length; ++i)
        if (elem.childNodes[i].nodeType === Node.ELEMENT_NODE) {
          this.page.skeleton = createSkeleton(elem.childNodes[i]);

          // Check if hooks exist, if exist, then call "created" function if exists
          Lucid.app.page.hooks && Lucid.app.page.hooks.created && Lucid.app.page.hooks.created();

          connectPage(this.container, this.page.skeleton);

          // Check if hooks exist, if exist, then call "connected" function if exists
          Lucid.app.page.hooks && Lucid.app.page.hooks.connected && Lucid.app.page.hooks.connected();
          break;
        }
    }
  };

  return Lucid.app;
}

/**
 * 
 * @param {HTMLElement} dom 
 * @param {string} componentName 
 * @param {string | number} componentKey 
 */
function renderComponent(dom, componentName, componentKey) {
  // If the component that is going to be rendered does not have a skeleton yet, create a skeleton for it
  if (!Lucid.app.components[componentName].skeleton) {
    const elem = document.createElement("div");
    elem.innerHTML = Lucid.app.components[componentName].render();

    // Create the skeleton out of the first element node
    for (let i = 0; i < elem.childNodes.length; ++i)
      if (elem.childNodes[i].nodeType === Node.ELEMENT_NODE) {
        Lucid.app.components[componentName].skeleton = createSkeleton(elem.childNodes[i], componentName);
        break;
      }
  }

  const elem = document.createElement("div");
  elem.setAttribute("lucid-component", componentName);
  elem.setAttribute("lucid-key", componentKey);

  // Save component's state and DOM into lucid for later use
  Lucid.app.page.elements[componentName + componentKey] = {
    state: Lucid.app.components[componentName].state,
    dom: elem
  };

  // Check if hooks exist, if exist, then call "created" function if exists
  Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.created && Lucid.app.components[componentName].hooks.created.call(getThisParameter(componentName, componentKey));

  connectComponent(elem, Lucid.app.components[componentName].skeleton, componentName, componentKey);
  dom.appendChild(elem);

  // Check if hooks exist, if exist, then call "connected" function if exists
  Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.connected && Lucid.app.components[componentName].hooks.connected.call(getThisParameter(componentName, componentKey));
}

/**
 * 
 * @param {HTMLElement} dom 
 * @param {Skeleton} skeleton 
 * @param {string} componentName 
 * @param {string | number} componentKey 
 */
function connectComponent(dom, skeleton, componentName, componentKey) {
  // If skeleton is a string, it's a text node that is the only child
  if (typeof skeleton === "string") {
    const textNode = document.createTextNode(convertTextVariables(skeleton, componentName, componentKey));
    dom.appendChild(textNode);
    return;
  }

  const elem = document.createElement(skeleton.tag);

  for (const key in skeleton.attrs) {
    if (key.startsWith("on")) {
      elem.addEventListener(key.substr(2), function () {
        skeleton.attrs[key].call(getThisParameter(componentName, componentKey));
      });
    }
    else {
      const result = convertTextVariables(skeleton.attrs[key], componentName, componentKey)
      elem.setAttribute(key, result);
    }
  }

  for (let i = 0; i < skeleton.children.length; ++i)
    connectComponent(elem, skeleton.children[i], componentName, componentKey);

  dom.appendChild(elem);
}

/**
 * 
 * @param {string} componentName Name of the component. 
 * @param {string | number} componentKey Key of the component.
 */
function disconnectComponent(componentName, componentKey) {
  const elementKey = componentName + componentKey;
  const dom = Lucid.app.page.elements[elementKey].dom;

  // Remove the component from the dom, then call "disconnected" hook
  dom.parentNode.removeChild(dom);

  // Check if hooks exist, if exist, then call "disconnected" function if exists
  Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.disconnected && Lucid.app.components[componentName].hooks.disconnected.call(getThisParameter(componentName, componentKey));

  Lucid.app.page.elements[elementKey] = undefined;
}

/**
 * 
 * @param {HTMLElement} dom 
 * @param {Skeleton} skeleton 
 * @param {number} elementKey 
 */
function updateComponent(dom, skeleton, componentName, componentKey) {
  if (typeof skeleton === "string") {
    dom.nodeValue = convertTextVariables(skeleton, componentName, componentKey);
    return;
  }

  for (const key in skeleton.attrs) {
    // Only change the attributes that are not functions,
    // because only {{state.name}} attributes can change
    if (typeof skeleton.attrs[key] !== "function") {
      const result = convertTextVariables(skeleton.attrs[key], componentName, componentKey);
      dom.setAttribute(key, result);
    }
  }

  for (let i = 0; i < dom.childNodes.length; ++i) {
    updateComponent(dom.childNodes[i], skeleton.children[i], componentName, componentKey);
  }
}

/**
 * 
 * @param {HTMLElement} dom 
 * @param {Skeleton} skeleton 
 */
function connectPage(dom, skeleton) {
  // If skeleton is a string, it's a text node that is the only child
  if (typeof skeleton === "string") {
    const textNode = document.createTextNode(skeleton);
    dom.appendChild(textNode);
    return;
  }

  const elem = document.createElement(skeleton.tag);

  for (const key in skeleton.attrs)
    elem.setAttribute(key, skeleton.attrs[key]);

  // Get 2 lucid attributes, "lucid-component" and "lucid-key"
  const componentName = elem.getAttribute("lucid-component");
  const componentKey = elem.getAttribute("lucid-key");

  // If component name and key are present in the node, it's a lucid component
  if (componentName || componentKey) {
    // If lucid component's skeleton is not initialized, initialize it
    if (!Lucid.app.components[componentName].skeleton) {
      const elem = document.createElement("div");
      elem.innerHTML = Lucid.app.components[componentName].render();

      // Create the skeleton out of the first element node
      for (let i = 0; i < elem.childNodes.length; ++i)
        if (elem.childNodes[i].nodeType === Node.ELEMENT_NODE) {
          Lucid.app.components[componentName].skeleton = createSkeleton(elem.childNodes[i], componentName);
          break;
        }
    }

    const elementKey = componentName + componentKey;

    // Save component's state and DOM into lucid for later use
    Lucid.app.page.elements[elementKey] = {
      state: Lucid.app.components[componentName].state,
      dom: elem
    };

    // Check if hooks exist, if exist, then call "created" function if exists
    Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.created && Lucid.app.components[componentName].hooks.created.call(getThisParameter(componentName, componentKey));

    connectComponent(Lucid.app.page.elements[elementKey].dom,
      Lucid.app.components[componentName].skeleton,
      componentName, componentKey);

    // Check if hooks exist, if exist, then call "connected" function if exists
    Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.connected && Lucid.app.components[componentName].hooks.connected.call(getThisParameter(componentName, componentKey));
  }

  for (let i = 0; i < skeleton.children.length; ++i)
    connectPage(elem, skeleton.children[i]);

  dom.appendChild(elem);
}

/**
 * 
 * @param {HTMLElement} child 
 * @param {string} [componentName]  If componentName is not provided, it creates a skeleton out of a page, otherwise out of a component.
 * 
 * @returns {Skeleton} Skeleton
 */
function createSkeleton(child, componentName) {
  if (child.nodeType !== Node.ELEMENT_NODE) {
    const nodeValue = child.nodeValue.trim();
    if (nodeValue !== "") {
      return nodeValue;
    }

    return null;
  }

  const skeleton = {
    tag: child.tagName,
    attrs: {},
    children: []
  };

  for (let i = 0; i < child.attributes.length; ++i) {
    if (child.attributes[i].specified) {
      if (child.attributes[i].name.startsWith("on")) {
        const func = convertTextVariables(child.attributes[i].value, componentName);
        skeleton.attrs[child.attributes[i].name] = func;
      } else {
        skeleton.attrs[child.attributes[i].name] = child.attributes[i].value;
      }
    }
  }

  for (let i = 0; i < child.childNodes.length; ++i) {
    const childSkeleton = createSkeleton(child.childNodes[i], componentName);

    if (childSkeleton)
      skeleton.children.push(childSkeleton);
  }

  return skeleton;
}

/**
 * 
 * @param {string} componentName Name of the component.
 * @param {string | number} componentKey Key of the component.
 * 
 * @returns {{name: string, key: string, dom: HTMLElement, state: object, setState: (newState: object) => void}
 */
function getThisParameter(componentName, componentKey) {
  const elementKey = componentName + componentKey;
  return {
    name: componentName,
    key: componentKey,
    dom: Lucid.app.page.elements[elementKey].dom.firstChild,
    state: Lucid.app.page.elements[elementKey].state,
    setState: function (newState) {
      // Save the new state
      Lucid.app.page.elements[elementKey].state = newState;

      // Re-render the element
      updateComponent(Lucid.app.page.elements[elementKey].dom.firstChild,
        Lucid.app.components[componentName].skeleton,
        componentName, componentKey);

      // Check if hooks exist, if exist, then call "updated" function if exists
      Lucid.app.components[componentName].hooks && Lucid.app.components[componentName].hooks.updated && Lucid.app.components[componentName].hooks.updated.call(this);
    }
  };
}

/**
 * Replaces text variables(e.g. {{state.count}}) with their correct value that's saved in either state or methods.
 * @param {string} text 
 * @param {string} componentName Name of the component that the text variable belongs to.
 * @param {number} [componentKey] If key is provided, state will be used to convert the text, methods otherwise.
 * 
 * @returns {string | Function} Text with the variables replaced or function converted from string variable
 */
function convertTextVariables(text, componentName, componentKey) {
  // Convert key to string because if the key is 0, wrong things may happen
  componentKey = componentKey.toString();

  let startIndex = 0;
  let endIndex = 0;

  if (!componentKey) {
    startIndex = text.indexOf("{{", startIndex);
    endIndex = text.indexOf("}}", startIndex + 2);

    const variable = text.substring(startIndex + 2, endIndex);
    const properties = variable.split(".");

    let tempObj = Lucid.app.components[componentName];
    for (let i = 0; i < properties.length; ++i)
      tempObj = tempObj[properties[i]];

    return tempObj;
  } else {
    const elementKey = componentName + componentKey;

    while (
      (startIndex = text.indexOf("{{", startIndex)) > -1 &&
      (endIndex = text.indexOf("}}", startIndex + 2))
    ) {
      const variable = text.substring(startIndex + 2, endIndex);
      const properties = variable.split(".");

      let tempObj = Lucid.app.page.elements[elementKey];
      for (let i = 0; i < properties.length; ++i)
        tempObj = tempObj[properties[i]];

      text = text.replace("{{" + variable + "}}", tempObj);

      startIndex = 0;
      endIndex = 0;
    }

    return text;
  }
}