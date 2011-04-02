var Diesel = (function () {

function createElemCreator(tag) {
    return function () {
        return Diesel.create.apply(Diesel, [tag].concat([].slice.call(arguments)));
    };
}

return {
    extend: function (obj1, obj2, func) {
        var newObj = {};
        Diesel.merge(newObj, obj1);
        Diesel.merge(newObj, obj2, func);
        return newObj;
    },
    
    merge: function (obj1, obj2, func) {
        for (var i in obj2) {
            if (obj2.hasOwnProperty(i))
                obj1[i] = func ? func(obj2[i], i) : obj2[i];
        }
    },
    
    objectToQueryString: function (obj) {
        var str = [], i;
        for (i in obj) {
            if (obj.hasOwnProperty(i))
                str.push([i, obj[i]].join('='));
        }
        return encodeURI(str.join('&'));
    },
    
    get: function (selector, node) {
        if (typeof selector != 'string')
            return new Diesel.NodeList(typeof selector[0] != 'undefined' ? Diesel.List.from(selector) : Diesel.List(selector));
        var engine, engines = [], i;
        for (i in Diesel.Engines) {
            if (Diesel.Engines.hasOwnProperty(i))
                engines.push(Diesel.Engines[i]);
        }
        engines.sort(function (a, b) {
            return a.priority <= b.priority;
        });
        for (i = engines.length; --i >= 0;) {
            if (engines[i].test()) {
                engine = engines[i];
                break;
            }
        }
        if (engine)
            return new Diesel.NodeList(Diesel.List.from(engine.search(selector, node || document)));
        return new Diesel.NodeList(Diesel.List(document.getElementById(selector.substring(1))));
    },
    
    create: function (tag) {
        for (var elem = document.createElement(tag), arg, j, i = 1; i < arguments.length, arg = arguments[i]; ++i) {
            if (typeof arg == 'string')
                elem.innerHTML += arg;
            else if (arg.tagName)
                elem.appendChild(arg);
            else if (arg instanceof Diesel.NodeList)
                arg.forEach(function (e) { elem.appendChild(e); });
            else {
                for (j in arg) {
                    if (arg.hasOwnProperty(j)) {
                        if (j == 'style')
                            Diesel.DSL.style(Diesel.List(elem), arg[j]);
                        else if (j == 'on')
                            Diesel.DSL.on(Diesel.List(elem), arg[j]);
                        else if (j == 'class')
                            elem.className = arg[j];
                        else
                            elem.setAttribute(j, arg[j]);
                    }
                }
            }
        }
        return new Diesel.NodeList(Diesel.List(elem));
    },
    
    a: createElemCreator('a'),
    div: createElemCreator('div'),
    span: createElemCreator('span'),
    p: createElemCreator('p'),
    ul: createElemCreator('ul'),
    ol: createElemCreator('ol'),
    li: createElemCreator('li'),
    table: createElemCreator('table'),
    tbody: createElemCreator('tbody'),
    thead: createElemCreator('thead'),
    tfoot: createElemCreator('tfoot'),
    tr: createElemCreator('tr'),
    td: createElemCreator('td'),
    th: createElemCreator('th'),
    
    addEvent: function (elem, event, func) {
        event = 'on' + event;
        var evt = elem[event], old = evt;
        if (!evt || !evt.handlers) {
            evt = elem[event] = function (e) {
                for (var i = 0, handlers = evt.handlers, l = handlers.length; i < l; ++i)
                    handlers[i](e);
            }
            evt.handlers = old ? [old] : [];
        }
        evt.handlers.push(func);
        return func;
    },
    
    removeEvent: function(elem, event, func) {
        event = 'on' + event;
        var handlers;
        if (elem[event] && (handlers = elem[event].handlers)) {
            for (var i = 0, l = handlers.length; i < l; ++i) {
                if (handlers[i] === func)
                    handlers.splice(i, 1);
            }
        }
        return func;
    },
    
    ajax: function (options) {
        options = options || {};
        var url = options.url || '', method = options.method || 'POST', data = options.data || {}, rawData, headers,
        successHandlers = options.success ? [options.success] : [], errorHandlers = options.error ? [options.error] : [],
        states = {1: [], 2: [], 3: [], 4: []}, statuses = {},
        dsl = {
            url: function (newUrl) {
                url = newUrl;
                return dsl;
            },
            
            method: function (newMethod) {
                method = newMethod.toUpperCase();
                return dsl;
            },
            
            raw: function (newData) {
                rawData = newData;
                return dsl;
            },
            
            data: function (newData) {
                Diesel.merge(data, newData);
                return dsl;
            },
            
            headers: function (newHeaders) {
                Diesel.merge(headers, newHeaders);
                return dsl;
            },
            
            success: function (handler) {
                successHandlers.push(handler);
                return dsl;
            },
            
            error: function (handler) {
                errorHandlers.push(handler);
                return dsl;
            },
            
            state: function (state, handler) {
                if (handler) {
                    states[state] = states[state] || [];
                    states[state].push(handler);
                }
                else {
                    states[1].push(state); // "state" is actually the handler
                    states[2].push(state);
                    states[3].push(state);
                    states[4].push(state);
                }
                return dsl;
            },
            
            status: function (code, handler) {
                statuses[code] = statuses[code] || [];
                statuses[code].push(handler);
                return dsl;
            },
            
            send: function () {
                var request = new XMLHttpRequest(), // I don't support IE6 :-)
                query = Diesel.objectToQueryString(data),
                get = method == 'GET', i;
                request.open(get ? 'GET' : 'POST', get ? [url, query].join('?') : url, true);
                if (!get)
                    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                for (i in headers) {
                    if (headers.hasOwnProperty(i))
                        request.setRequestHeader(i, headers[i]);
                }
                request.onreadystatechange = function () {
                    var stateHandlers = states[request.readyState], statusHandlers, i = 0, l;
                    if (stateHandlers) {
                        for (l = stateHandlers.length; i < l; ++i)
                            stateHandlers[i](request);
                    }
                    if (request.readyState != 4)
                        return;
                    statusHandlers = statuses[request.status];
                    if (statusHandlers) {
                        for (i = 0, l = statusHandlers.length; i < l; ++i)
                            statusHandlers[i](request);
                    }
                    if (request.status == 200) {
                        for (i = 0, l = successHandlers.length; i < l; ++i)
                            successHandlers[i](request);
                    }
                    else {
                        for (i = 0, l = errorHandlers.length; i < l; ++i)
                            errorHandlers[i](request);
                    }
                };
                request.send(get ? null : rawData || query);
            }
        };
        return dsl;
    },
    
    conflict: function () {
        window.$ = Diesel.get;
    }
};

})();

Diesel.Engines = {
    Peppy: {
        priority: 2,
        
        test: function () {
            return !!window.peppy;
        },
        
        search: function (query, node) {
            return peppy.query(query, node);
        }
    },
    
    Slick: {
        priority: 1,
        
        test: function () {
            return !!window.Slick;
        },
        
        search: function (query, node) {
            return Slick.search(node, query);
        }
    },
    
    Sly: {
        priority: 0,
        
        test: function () {
            return !!window.Sly;
        },
        
        search: function (query, node) {
            return Sly(query, node);
        }
    }
};

Diesel.DSL = (function () {


function makeEventDsl(evtFunc) {
    return function (list, events) {
        if (events) {
            list.forEach(function (elem) {
                for (var j in events) {
                    if (events.hasOwnProperty(j))
                        evtFunc(elem, j, events[j]);
                }
            });
            return list;
        }
        function makeEventFunc(event) {
            return function (func) {
                list.forEach(function (elem) { evtFunc(elem, event, func); });
                return dsl;
            };
        }
        var dsl = Diesel.extend(list, {
            click: makeEventFunc('click'),
            focus: makeEventFunc('focus'),
            blur: makeEventFunc('blur'),
            mouse: function (mevents) {
                if (mevents) {
                    list.forEach(function (elem) {
                        for (var j in mevents) {
                            if (mevents.hasOwnProperty(j))
                                evtFunc(elem, 'mouse' + j, mevents[j]);
                        }
                    });
                    return dsl;
                }
                return mouseDsl;
            }
        }),
        mouseDsl = Diesel.extend(dsl, {
            move: makeEventFunc('mousemove'),
            over: makeEventFunc('mouseover'),
            out: makeEventFunc('mouseout')
        });
        return dsl;
    };
}

var stylestr = 'backgroundColor|color|display|height|width|left|right';

return {
    style: function (list, styles) {
        if (styles) {
            list.forEach(function (elem) {
                for (j in styles) {
                    if (styles.hasOwnProperty(j))
                        elem.style[j.replace(/\-(\w)/g, function (_, $1) { return $1.toUpperCase(); })] = styles[j];
                }
            });
            return list;
        }
        Diesel.DSL.style.properties = Diesel.DSL.style.properties || stylestr;
        function makeStyleFunc(prop) {
            return function (value) {
                list.forEach(function (elem) { elem.style[prop] = value; });
                return dsl;
            };
        }
        var sty = document.body.style, dsl = list, i, props = Diesel.DSL.style.properties.split('|');
        for (i in sty) {
            if (typeof sty[i] != 'function' && !Diesel.List.Nil[i])
                dsl[i] = makeStyleFunc(i);
        }
        // Strange WebKit hack. Apparently style properties don't get iterated over
        // in a for-in loop, even though "'styleProp' in element.style" is true...
        if (!dsl.backgroundColor) {
            for (i = props.length; --i >= 0;)
                dsl[props[i]] = makeStyleFunc(props[i]);
        }
        return dsl;
    },
    
    animate: function (list) {
        var sty = list.head().style, styprops = Diesel.DSL.style.properties.split('|'),
        pl = styprops.length, dsl = list, props = {}, i;
        function makeAnimFunc(prop) {
            return function () {
                var propobj = {duration: 300, updateHandlers: [], finishHandlers: []}, adsl;
                props[prop] = propobj;
                adsl = Diesel.extend(dsl, {
                    from: function (value) {
                        propobj.from = '' + value;
                        return adsl;
                    },
                    
                    to: function (value) {
                        propobj.to = '' + value;
                        return adsl;
                    },
                    
                    over: function (value) {
                        var odsl = Diesel.extend(adsl, {
                            ms: function () {
                                propobj.duration = value;
                                return odsl;
                            },
                            
                            s: function (secs) {
                                propobj.duration = value * 1000;
                                return odsl;
                            }
                        });
                        return odsl;
                    },
                    
                    on: function (events) {
                        var edsl, i;
                        if (events) {
                            for (i in events) {
                                if (events.hasOwnProperty(i)) {
                                    if (i == 'finish')
                                        propobj.finishHandlers.push(events[i]);
                                    else
                                        propobj.updateHandlers.push(events[i]);
                                }
                            }
                            return adsl;
                        }
                        edsl = Diesel.extend(adsl, {
                            finish: function (func) {
                                propobj.finishHandlers.push(func);
                                return edsl;
                            },
                            
                            update: function (func) {
                                propobj.updateHandlers.push(func);
                                return edsl;
                            }
                        });
                        return edsl;
                    }
                });
                return adsl;
            };
        }
        for (i in sty) {
            if (typeof sty[i] != 'function' && !Diesel.List.Nil[i])
                dsl[i] = makeAnimFunc(i);
        }
        if (!dsl.backgroundColor) {
            for (; --pl >= 0;)
                dsl[styprops[pl]] = makeAnimFunc(styprops[pl])();
        }
        dsl.run = function () {
            list.forEach(function (elem) {
                var prop, i;
                for (i in props) {
                    if (props.hasOwnProperty(i)) {
                        prop = props[i];
                        if (prop.from)
                            elem.style[prop] = prop.from;
                        else
                            prop.from = elem.style[prop];
                        if (!prop.to)
                            prop.to = elem.style[prop];
                        (function (prop, vars) {
                            for (var regex = /\d/, prefix = '', timer, currValue, substr,
                            divBy = 1, i = 0, j = 0, l = vars.from.length; i < l; ++i) {
                                if (regex.test(vars.from.charAt(i)))
                                    break;
                                prefix += vars.from.charAt(i);
                            }
                            currValue = parseFloat(vars.from.substring(i));
                            substr = vars.to.substring(i);
                            if (parseInt(substr) < 1) {
                                for (l = substr.substring(substr.indexOf('.') + 1).length; j < l; ++j)
                                  divBy *= 10;
                            }
                            currValue *= divBy;
                            timer = setInterval(function () {
                                var intify = parseInt, k = 0, l;
                                if (~~(currValue / divBy) >= intify(vars.to.substring(i))) {
                                    clearInterval(timer);
                                    for (l = vars.finishHandlers.length; k < l; ++k)
                                        vars.finishHandlers[i](elem);
                                }
                                else {
                                    currValue = ~~(currValue + (intify(vars.to) - currValue) * (1 / vars.duration * 10) + .5) +
                                    (intify(vars.to) > intify(vars.from) ? 1 : -1);
                                    elem.style[prop] = prefix + currValue / divBy + vars.to.substring(('' + intify(vars.to)).length);
                                    for (l = vars.updateHandlers.length; k < l; ++k)
                                        vars.updateHandlers[i](elem);
                                }
                            }, 20);
                        })(i, prop);
                    }
                }
            });
        };
        return dsl;
    },
    
    on: makeEventDsl(Diesel.addEvent),
    
    off: makeEventDsl(Diesel.removeEvent),
    
    first: function (list) {
        return Diesel.extend(list, {       
            child: function () {
                return list.child();
            }
        });
    },
    
    last: function (list) {
        return Diesel.extend(list, {
            child: function () {
                return new Diesel.NodeList(list.map(function (elem) {
                    var c = elem.children;
                    return c[c.length - 1];
                }));
            }
        });
    },
    
    next: function (list) {
        return Diesel.extend(list, {
            sibling: function () {
                return list.sibling();
            }
        });
    },
    
    previous: function (list) {
        return Diesel.extend(list, {
            sibling: function () {
                return list.sibling(-1);
            }
        });
    },
    
    parent: function (list, depth) {
        return new Diesel.NodeList(list.map(function (elem) {
            var parent = elem, d = depth || 1;
            while (d--)
                parent = parent.parentNode;
            return parent;
        }));
    },
    
    children: function (list) {
        return new Diesel.NodeList(list.flatMap(function (elem) { return Diesel.List.from(elem.children); }));
    },
    
    child: function (list, num) {
        return new Diesel.NodeList(list.map(function (elem) { return elem.children[num || 0]; }));
    },
    
    sibling: function (list, num) {
        return new Diesel.NodeList(list.map(function (elem) {
            if (num == 0)
                return elem;
            var sibling = elem, n = num || 1;
            if (n <= 0) {
                while (n++)
                    sibling = sibling.previousSibling;
                n = 0;
            }
            while (n--)
                sibling = sibling.nextSibling;
            return sibling;
        }));
    },
    
    find: function (list, selector) {
        return new Diesel.NodeList(list.flatMap(function (elem) { return Diesel.get(selector, elem); }));
    },
    
    clone: function (list, deep) {
        if (typeof deep == 'undefined')
            deep = true;
        return list.map(function (elem) { return elem.cloneNode(deep); });
    }
};

})();

Diesel.plugins = {
    html: function (elem, html) {
        elem.innerHTML = html;
    },
    
    attr: function (elem, attrs, value) {
        if (typeof attrs == 'string')
            elem[attrs] = value;
        else {
            for (var i in attrs) {
                if (attrs.hasOwnProperty(i))
                    elem[i] = attrs[i];
            }
        }
    },
    
    addClass: function (elem, className) {
        var classes = elem.className.split(' ');
        classes.push(className);
        elem.className = classes.join(' ');
    },
    
    removeClass: function (elem, className) {
        elem.className = elem.className.replace(new RegExp('(^|\\s)' + className + '(?:\\s|$)', 'g'), '$1');
    },
    
    append: function (elem, child, clone) {
        if (typeof clone == 'undefined')
            clone = true;
        if (child instanceof Diesel.NodeList)
            child.forEach(function (e) { elem.appendChild(clone ? e.cloneNode(true) : e); });
        else
            elem.appendChild(clone ? child.cloneNode(true) : child);
    },
    
    insert: function (elem, child, location) {
        switch (location) {
            case 'before':
                if (child instanceof Diesel.NodeList)
                    child.forEach(function (e) { elem.parentNode.insertBefore(e.cloneNode(true), elem); });
                else
                    elem.parentNode.insertBefore(child.cloneNode(true), elem);
                break;
            default:
                if (child instanceof Diesel.NodeList)
                    child.forEach(function (e) { elem.parentNode.insertBefore(e.cloneNode(true), elem.nextSibling); });
                else
                    elem.parentNode.insertBefore(child.cloneNode(true), elem.nextSibling);
        }
    },
    
    destroy: function (elem) {
        elem.parentNode.removeChild(elem);
    }
};

Diesel.List = (function () {
  
var KEY = Math.random(),

cons = function (obj, list) {
    return new L(obj, list);
},

L = function (head, tail) {
    var t = this, reverse, length = 0, ODP = Object.defineProperties;
    t.head = function () {
        return head;
    };
    t.tail = function () {
        return tail;
    };
    t.len = function () {
        if (!length) {
            // While this will run for the empty list, iterating over
            // that doesn't take very long...
            for (var s = t; s.tail(); s = s.tail())
                ++length;
        }
        return length;
    };
    t.reverse = function () {
        if (!reverse) {
            reverse = Nil;
            for (var s = t; s.tail(); s = s.tail())
                reverse = cons(s.head(), reverse);
        }
        return reverse;
    };
    t.get = function (index) {
        for (var s = t, i = index; i > 0 && s.tail(); s = s.tail(), --i);
        return s.head();
    };
    t.append = function () {
        for (var list = t.reverse(), args = arguments, i = 0; i < args.length; ++i)
            list = cons(args[i], list);
        return list.reverse();
    };
    t.concat = function () {
        for (var list = t, args = arguments, arg, i = 0; i < args.length, arg = args[i]; ++i) {
            for (; arg.tail(); arg = arg.tail())
                list = list.append(arg.head());
        }
        return list;
    };
    t.contains = function (object) {
        for (var s = t; s.tail(); s = s.tail()) {
            if (s.head() === object)
                return true;
        }
        return false;
    };
    t.indexOf = function (object) {
        for (var s = t, i = 0; s.tail(); s = s.tail(), ++i) {
            if (s.head() === object)
                return i;
        }
        return -1;
    };
    t.take = function (num) {
        for (var s = t, i = num, buff = ListBuffer(); i && s.tail(); s = s.tail(), --i)
            buff.append(s.head());
        return buff.toList();
    };
    t.drop = function (num) {
        for (var s = t, i = num; --i && s.tail(); s = s.tail());
        return s.tail() || Nil;
    };
    t.splitAt = function (num) {
        for (var s = t, i = num, buff = ListBuffer(); i && s.tail(); s = s.tail(), --i)
            buff.append(s.head());
        return [buff.toList(), s];
    };
    t.zip = function (list) {
        for (var s = t, u = list, buff = ListBuffer(); s.tail() && u.tail(); s = s.tail(), u = u.tail())
            buff.append([s.head(), u.head()]);
        return buff.toList();
    };
    t.takeWhile = function (func) {
        for (var s = t, buff = ListBuffer(); s.tail() && func(s.head()); s = s.tail())
            buff.append(s.head());
        return buff.toList();
    };
    t.dropWhile = function (func) {
        for (var s = t, buff = ListBuffer(); s.tail() && func(s.head()); s = s.tail());
        return s || Nil;
    };
    t.span = function (func) {
        for (var s = t, buff = ListBuffer(); s.tail() && func(s.head()); s = s.tail())
            buff.append(s.head());
        return [buff.toList(), s];
    };
    t.forEach = function (func) {
        for (var s = t, i = 0; s.tail(); s = s.tail(), ++i)
            func(s.head(), i);
        return t;
    };
    t.map = function (func) {
        for (var s = t, buff = ListBuffer(); s.tail(); s = s.tail())
            buff.append(func(s.head()));
        return buff.toList();
    };
    t.flatMap = function (func) {
        for (var s = t, buff = ListBuffer(), result; s.tail(); s = s.tail()) {
            result = func(s.head());
            for (; result.tail(); result = result.tail())
                buff.append(result.head());
        }
        return buff.toList();
    };
    t.filter = function (func) {
        for (var s = t, buff = ListBuffer(), i = 0; s.tail(); s = s.tail(), ++i) {
            if (func(s.head(), i))
                buff.append(s.head());
        }
        return buff.toList();
    };
    t.partition = function (func) {
        for (var s = t, buff1 = ListBuffer(), buff2 = ListBuffer(); s.tail(); s = s.tail()) {
            if (func(s.head()))
                buff1.append(s.head());
            else
                buff2.append(s.head());
        }
        return [buff1.toList(), buff2.toList()];
    };
    t.exists = function (func) {
        for (var s = t; s.tail(); s = s.tail()) {
            if (func(s.head()))
                return true;
        }
        return false;
    };
    t.forall = function (func) {
        for (var s = t; s.tail(); s = s.tail()) {
            if (!func(s.head()))
                return false;
        }
        return true;
    };
    t.foldLeft = function (start, func) {
        for (var s = t, accumulator = start; s.tail(); s = s.tail())
            accumulator = func(accumulator, s.head());
        return accumulator;
    };
    t.foldRight = function (start, func) {
        return t.reverse().foldLeft(start, func);
    };
    t.sort = function (func) {
        var sort = t.toArray();
        return List.from(func ? sort.sort(func) : sort.sort());
    };
    t.toArray = function () {
        for (var s = t, result = []; s.tail(); s = s.tail())
            result.push(s.head());
        return result;
    };
    t.___setmutable = function(K) {
        if (K === KEY)
            t.___settail = function (newTail) { tail = newTail; };
    };
    t.toString = function () {
        return 'List(' + t.toArray().join(', ') + ')';
    };
    if (ODP)
        ODP(t, {length: {get: t.len}});
},

Nil = new L(null, null),

List = function () {
    return List.from(arguments);
},

ListBuffer = function () {
    var t = this, start = Nil, last, exported, l1;
    if (!(t instanceof ListBuffer))
       return new ListBuffer();
    t.append = function(object) {
        if (exported)
            start = List.from(start.toArray());
        if (start.tail()) {
            l1 = last;
            last = new L(object, Nil);
            l1.___setmutable(KEY);
            l1.___settail(last);
            delete l1.___settail;
        }
        else
            start = last = new L(object, Nil);
        return t;
    }
    t.toList = function() {
        exported = 1;
        return start;
    }
    return t;
};

List.range = function (start, end, skip) {
    if (!end) {
        end = start;
        start = 0;
    }
    for (var range = [], i = Math.min(start, end), j = Math.max(start, end); i < j; i += skip || 1)
        range.push(i);
    return List.from(range);
};

List.make = function (object, num) {
    for (var list = Nil; --num >= 0;)
        list = cons(object, list);
    return list;
};

List.from = function (object) {
    for (var list = Nil, i = object.length; --i >= 0;)
        list = cons(object[i], list);
    //for (i = list.len(); --i >= 0;)
    //    list[i] = list.get(i);
    return list;
};

List.cons = cons;

List.Nil = Nil;

List.ListBuffer = ListBuffer;

return List;

})();

Diesel.NodeList = (function () {

var wrapPlugin = function (func, list) {
    return function () {
        var args = [].slice.call(arguments);
        list.forEach(function (elem) { func.apply(Diesel, [elem].concat(args)); });
        return list;
    };
},

wrapDsl = function (func, list) {
    return function () {
        return func.apply(Diesel, [list].concat([].slice.call(arguments)));
    };
},

NodeList = function (list) {
    var t = this;
    Diesel.merge(t, list, function (f) {
        if (typeof f == 'function') {
            return function () {
                var result = f.apply(t, [].slice.call(arguments));
                if (result && result.head)
                    return new Diesel.NodeList(result);
                if (('' + f).lastIndexOf('return [') != -1)
                    return [new Diesel.NodeList(result[0]), new Diesel.NodeList(result[1])];
                return result;
            };
        }
        return f;
    });
    Diesel.merge(t, Diesel.plugins, function (f) { return wrapPlugin(f, t); });
    Diesel.merge(t, Diesel.DSL, function (f) { return wrapDsl(f, t); });
};

return NodeList;

})();

