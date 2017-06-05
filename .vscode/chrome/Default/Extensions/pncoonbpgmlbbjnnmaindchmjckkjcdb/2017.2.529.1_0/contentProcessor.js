(function () {
    var BrowserCommandType = {
        Information: 1,
        Action: 2,
        Silverlight: 3
    };

    var BrowserActionType = {
        Click: 1,
        SetText: 2,
        SelectDropDown: 3,
        Check: 4,
        ScrollToVisible: 5,
        NavigateTo: 6,
        InvokeEvent: 7,
        InvokeJsFunction: 8,
        Refresh: 9,
        GoBack: 10,
        GoForward: 11,
        LoadString: 12,
        GetProperty: 13,
        SetProperty: 14,
        InvokeMethod: 15,
        SetCookie: 16,
        // IEConnectDialog : 17,
        ScrollBy: 18,
        Stop: 19,
        ClearHistory: 20,
        ClearFilesCache: 21,
        // FFSetProxy : 22,
        ClearCookies: 23,
        InvokeJsFunctionReturnJSON: 24,
        AttachEventHandler: 25,
        RemoveEventHandler: 26,
        // EnableMimeFilter : 27,
        // DisableMimeFilter : 28,
        AddCustomSilverlightAssembly: 29,
        CloseWindow: 30,
        GetFramePadding: 31
    };

    var BrowserInformationType = {
        ElementRectangle: 1,
        FrameRectangle: 2,
        DocumentMarkup: 4,
        IsReady: 5,
        Cookies: 6,
        ComputedStyle: 7,
        // FFCachePath : 8,
        // FFProfilePath : 9,
        InformationBar: 10 // I think this is FF-specific also
    };

    //--------------------- Content Processor ---------------------//
    var ContentProcessor = {
        // Map uuid -> { target: <event target>, name: <event name>, handler: <event handler> }
        EventHandlers: {},
        //The window that a command will be executed against.
        Window: window,
        //The document, that a command will be executed against.
        Document: document,
        //Holds all frames of current page.
        Frames: new Array(),

        BuildFrames: function (parentWindow) {
            try {

                if (parentWindow && parentWindow.frames && parentWindow.frames.length > 0) {
                    var count = parentWindow.frames.length;

                    for (var i = 0; i < count; ++i) {
                        var frame = parentWindow.frames[i];

                        if (frame == null || frame.frameElement == null)
                            continue;

                        var rect = frame.frameElement.getBoundingClientRect();

                        if (rect != null && rect.width > 0 && rect.height > 0) {
                            frame.frameIndexRaw = i;
                            ContentProcessor.Frames[ContentProcessor.Frames.length] = frame;
                        }

                        if (frame.frameElement) {

                            frame.frameElement.__webaii_parentWindow = parentWindow;

                            if (frame.frames.length > 0) {
                                ContentProcessor.BuildFrames(frame);
                            }
                        }
                    }
                }
            }
            catch (err) {
                if (err.name != "SecurityError") {
                    throw "BuildFrames().Error:" + err;
                }
            }
        },

        BuildFramesInfo: function () {
            var framesInfo = "";

            for (var i = 0; i < ContentProcessor.Frames.length; ++i) {

                var frameElement = ContentProcessor.Frames[i].frameElement;

                if (frameElement) {
                    //Index
                    framesInfo += i;
                    framesInfo += '-@-';

                    //Name
                    framesInfo += frameElement.name;
                    framesInfo += '-@-';

                    //Id
                    framesInfo += frameElement.id;
                    framesInfo += '-@-';

                    //Src
                    framesInfo += frameElement.src;
                    framesInfo += '-@-';

                    //XY
                    var frameRect = ContentProcessor.GetFrameRectangle(frameElement);
                    framesInfo += frameRect.left + ',' + frameRect.top + ',' + frameRect.width + ',' + frameRect.height;
                    framesInfo += '-@-';

                    //Frame unique id - we do not needed it actually.
                    framesInfo += '-@-';

                    //Tag Name
                    framesInfo += frameElement.tagName;
                    framesInfo += '-@-';

                    //Tag Index
                    framesInfo += ContentProcessor.Frames[i].frameIndexRaw;
                    framesInfo += '-@-';

                    //Test Studio Tag 
                    if (frameElement.hasAttribute("testStudioTag")) {
                        framesInfo += frameElement.getAttribute("testStudioTag");
                    }

                    framesInfo += '**;**';
                }
                else {
                    framesInfo += "**;**";
                }
            }

            return framesInfo;
        },

        ConfigureContext: function (cmd) {

            //Build frames
            ContentProcessor.Frames = new Array();
            ContentProcessor.BuildFrames(window);

            //Set up ContentProcessor window and document        
            ContentProcessor.Window = null;
            ContentProcessor.Document = null;

            if (cmd.TargetFrameIndex == -1) {

                ContentProcessor.Window = window;
                ContentProcessor.Document = document;
            }
            else if (cmd.TargetFrameIndex <= this.Frames.length - 1) {

                ContentProcessor.Window = ContentProcessor.Frames[cmd.TargetFrameIndex];
                ContentProcessor.Document = ContentProcessor.Window.document;
            }
        },

        ProcessCommand: function (cmd) {
            try {
                ContentProcessor.ConfigureContext(cmd);

                switch (cmd.CommandType) {
                    case BrowserCommandType.Information:
                        ContentProcessor.ProcessInformationCommand(cmd);
                        break;

                    case BrowserCommandType.Action:
                        ContentProcessor.ProcessActionCommand(cmd);
                        break;

                    case BrowserCommandType.Silverlight:
                        ContentProcessor.ProcessSilverlightCommand(cmd);
                        break;

                    default:
                        cmd.InError = true;
                        cmd.Response = "BrowserCommandType " + cmd.CommandType + " not implemented";
                }
            } catch (err) {
                cmd.InError = true;
                if (err.message)
                    cmd.Response = err.message;
                else
                    cmd.Response = err;
            }

            return cmd;
        },

        ProcessInformationCommand: function (cmd) {
            switch (cmd.InformationType) {
                case BrowserInformationType.ElementRectangle:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    var rect = target.getBoundingClientRect();
                    cmd.Response = rect.left + "," + rect.top + "," + rect.width + "," + rect.height;
                    break;

                case BrowserInformationType.FrameRectangle:
                    var frameRect = ContentProcessor.GetFrameRectangle(ContentProcessor.Window.frameElement);
                    cmd.Response = frameRect.left + "," + frameRect.top + "," + frameRect.width + "," + frameRect.height;
                    break;

                case BrowserInformationType.DocumentMarkup:
                    cmd.Response = ContentProcessor.GetDocumentMarkup();

                    if (ContentProcessor.Frames.length > 0 && cmd.TargetFrameIndex == -1) {

                        cmd.HasFrames = true;
                        cmd.FramesInfo = ContentProcessor.BuildFramesInfo();
                    }

                    break;

                case BrowserInformationType.IsReady:
                    cmd.Response = ContentProcessor.Document != null &&
                        (ContentProcessor.Document.readyState === "complete" || ContentProcessor.Document.readyState === "interactive");
                    break;

                case BrowserInformationType.Cookies:
                    // TODO Check the domain requested	        
                    cmd.Response = ContentProcessor.Document.cookie;
                    break;

                case BrowserInformationType.ComputedStyle:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    var styles = ContentProcessor.Window.getComputedStyle(target);
                    cmd.Response = styles[cmd.Data];
                    break;

                case BrowserInformationType.InformationBar:
                    // TODO Implement (or remove) this
                    cmd.InError = true;
                    cmd.Response = "InformationBar not yet implemented";
                    break;

                default:
                    cmd.InError = true;
                    cmd.Response = "InformationType " + cmd.InformationType + " not implemented";
                    break;
            }
        },

        GetElement: function (doc, tagName, index) {
            return doc.getElementsByTagName(tagName)[index];
        },

        ProcessSilverlightCommand: function (cmd) {
            var element = ContentProcessor.Document.getElementsByTagName(cmd.Target.TagName)[cmd.Target.OccurrenceIndex];
            cmd.Response = element.content._webaiiSlCient.ProcessCommand(cmd.Data);
        },

        ProcessActionCommand: function (cmd) {
            switch (cmd.ActionType) {
                case BrowserActionType.Click:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    var clickEvent = ContentProcessor.Document.createEvent("MouseEvents");

                    clickEvent.initMouseEvent("click", true, true, clickEvent.abstractView,
                                  1, 0, 0, 0, 0, false, false, false, false, 0, null); // ???
                    //Prevent current thread from blocking.
                    window.setTimeout(function () { target.dispatchEvent(clickEvent); }, 0);
                    break;

                case BrowserActionType.SetText:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    target.value = cmd.Data;
                    break;

                case BrowserActionType.SelectDropDown:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    ContentProcessor.SelectDropDown(target, cmd.Data);
                    break;

                case BrowserActionType.Check:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    target.checked = ContentProcessor.ToBoolean(cmd.Data);
                    break;

                case BrowserActionType.ScrollToVisible:
                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    target.scrollIntoView(cmd.Data == "1");
                    break;

                case BrowserActionType.NavigateTo:
                    window.location.href = cmd.Data;
                    break;

                case BrowserActionType.InvokeEvent:
                    // Split the data string into the event name and its parameters
                    var endEventName = cmd.Data.indexOf("--@@--");
                    var eventName = cmd.Data.substring(0, endEventName);
                    //Chop on prefix
                    if (eventName.substring(0, 2) == "on") eventName = eventName.substring(2);
                    var eventObjJSON = cmd.Data.substring(endEventName + "--@@--".length);
                    var eventObj = JSON.parse(eventObjJSON);

                    var eventType = "HTMLEvents";
                    if (eventName.substring(0, 3) == "key") {
                        eventType = "KeyboardEvent";
                    }
                    else if (eventName.substring(0, 5) == "mouse" || eventName == "click" || eventName == "dblclick") {
                        eventType = "MouseEvents";
                    }

                    var evt = ContentProcessor.Document.createEvent(eventType);
                    if (!evt) throw "Error creating event";

                    var altKey = false;
                    var ctrlKey = false;
                    var shiftKey = false;
                    var metaKey = false;

                    if (eventType == "HTMLEvents" || !eventObj) { // No event parameters specified
                        evt.initEvent(eventName, true, true);
                    }
                    else {
                        if (eventObj.modifiers & 0x01) // Alt modifier
                            altKey = true;
                        if (eventObj.modifiers & 0x02) // Control modifier
                            ctrlKey = true;
                        if (eventObj.modifiers & 0x04) // Shift modifier
                            shiftKey = true;
                        if (eventObj.modifiers & 0x08) // Meta modifier
                            metaKey = true;

                        if (eventType == "MouseEvents") {
                            // Handle mouse events
                            var button = 0;
                            if (eventObj.button & 1) // Left button
                                button = 0;
                            else if (eventObj.button & 2) // Right button
                                button = 2;
                            else if (eventObj.button & 4) // Middle button
                                button = 1;

                            var relatedTarget;
                            if (eventObj.relatedTarget)
                                relatedTarget = eval(eventObj.relatedTarget);

                            evt.initMouseEvent(eventName, true, true, window, 0, eventObj.screenX, eventObj.screenY,
                                               0, 0, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget);
                        }
                        else if (eventType == "KeyboardEvent") {
                            // BUG WebKit still doesn't have a working implementation for generated keyboard events.
                            //     So none of this stuff works.

                            // Handle keyboard events
                            var keyCode;
                            var charCode;

                            keyCode = eventObj.keyCode;
                            if (eventName == "keypress") {
                                charCode = eventObj.keyCode;
                            }
                            else {
                                charCode = 0;
                            }

                            var keyNum = String.fromCharCode(parseInt(keyCode)).toUpperCase().charCodeAt(0);
                            var keyIdentifier = "U+00" + keyNum.toString(16);

                            evt.initKeyboardEvent(true, true, window,
                                                  keyIdentifier, // keyIdentifier
                                                  0, ctrlKey, altKey, shiftKey, metaKey);
                        }
                    }

                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    target.dispatchEvent(evt);
                    break;

                case BrowserActionType.InvokeJsFunction:
                    var result = ContentProcessor.Window.eval(cmd.Data);

                    if (result == undefined || result == null) {
                        cmd.Response = null;
                    }
                    else {
                        cmd.Response = result.toString();
                    }
                    break;

                case BrowserActionType.Refresh:
                    window.location.reload();
                    break;

                case BrowserActionType.GoBack:
                    history.go(-1);
                    break;

                case BrowserActionType.GoForward:
                    history.go(1);
                    break;

                case BrowserActionType.LoadString:
                    cmd.InError = true;
                    cmd.Response = "LoadString command not supported for WebKit browsers";
                    break;

                case BrowserActionType.GetProperty:
                    cmd.InError = true;
                    cmd.Response = "GetProperty should not be used";
                    break;

                case BrowserActionType.SetProperty:
                    cmd.InError = true;
                    cmd.Response = "SetProperty should not be used";
                    break;

                case BrowserActionType.InvokeMethod:
                    cmd.InError = true;
                    cmd.Response = "InvokeMethod should not be used";
                    break;

                case BrowserActionType.SetCookie:
                    cmd.InError = true;
                    cmd.Response = "SetCookie should not be handled here";
                    break;

                case BrowserActionType.ScrollBy:
                    var coords = cmd.Data.split(';');
                    ContentProcessor.Window.scrollBy(parseInt(coords[0]), parseInt(coords[1]));
                    break;

                case BrowserActionType.Stop:
                    // TODO Implement this
                    cmd.InError = true;
                    cmd.Response = "Stop not implemented";
                    break;

                case BrowserActionType.ClearHistory:
                    cmd.InError = true;
                    cmd.Response = "ClearHistory not supported";
                    break;

                case BrowserActionType.ClearFilesCache:
                    cmd.InError = true;
                    cmd.Response = "ClearFilesCache not supported";
                    break;

                case BrowserActionType.ClearCookies:
                    cmd.InError = true;
                    cmd.Response = "ClearCookies not supported";
                    break;

                case BrowserActionType.InvokeJsFunctionReturnJSON:
                    var result = ContentProcessor.Window.eval(cmd.Data);
                    cmd.Response = JSON.stringify(result);
                    break;

                case BrowserActionType.AttachEventHandler:
                    // Split data string
                    var splitIndex = cmd.Data.indexOf("--@@--");
                    var eventName = cmd.Data.substring(0, splitIndex);
                    var eventUuid = cmd.Data.substring(splitIndex + 6);

                    var target = ContentProcessor.GetElement(ContentProcessor.Document, cmd.Target.TagName, cmd.Target.OccurrenceIndex);
                    if (!target)
                        throw "Unable to find target element";

                    var handler = function (e) {
                        var jem = ({
                            type: e.type,
                            charCode: 0,
                            clientX: 0,
                            clientY: 0,
                            guid: eventUuid,
                            keyCode: 0,
                            modifierKeys: 0,
                            screenX: 0,
                            screenY: 0
                        });
                        if (e.charCode) {
                            jem.charCode = e.charCode;
                        }
                        if (e.clientX) {
                            jem.clientX = e.clientX;
                        }
                        if (e.clientY) {
                            jem.clientY = e.clientY;
                        }
                        if (e.keyCode) {
                            jem.keyCode = e.keyCode;
                        }
                        if (e.altKey) {
                            jem.modifierKeys = jem.modifierKeys | 0x01;
                        }
                        if (e.ctrlKey) {
                            jem.modifierKeys = jem.modifierKeys | 0x02;
                        }
                        if (e.shiftKey) {
                            jem.modifierKeys = jem.modifierKeys | 0x04;
                        }
                        if (e.metaKey) {
                            jem.modifierKeys = jem.modifierKeys | 0x08;
                        }
                        if (e.screenX) {
                            jem.screenX = e.screenX;
                        }
                        if (e.screenY) {
                            jem.screenY = e.screenY;
                        }

                        // Dispatch event
                        ContentProcessor.DispatchJavascriptEvent(jem);
                    };

                    var token = target.addEventListener(eventName, handler, false);
                    ContentProcessor.EventHandlers[eventUuid] = { target: target, name: eventName, handler: handler }; // [eventName, handler];
                    cmd.Response = true;
                    break;

                case BrowserActionType.RemoveEventHandler:
                    // Get event name and id from cmd.Data
                    var splitIndex = cmd.Data.indexOf("--@@--");
                    var eventName = cmd.Data.substring(0, splitIndex);
                    var eventId = cmd.Data.substring(splitIndex + 6);
                    var token = ContentProcessor.EventHandlers[eventId];
                    if (token) {
                        token.target.removeEventListener(token.name, token.handler, false);
                        delete ContentProcessor.EventHandlers[eventId];
                    }
                    break;

                case BrowserActionType.CloseWindow:
                    setTimeout(function () {
                        // This is hacky. Timing might not work out correctly.
                        window.open("", "_self", "");
                        window.close();
                    }, 50);

                    // I need to make sure that we return from this call...
                    break;

                case BrowserActionType.GetFramePadding:
                    var frameIndex = parseInt(cmd.Data);
                    var frame = ContentProcessor.Frames[frameIndex];
                    var result = ContentProcessor.GetFramePaddingOffset(frame.frameElement);
                    cmd.Response = result.lp + "--@@--" + result.tp;
                    break;

                default:
                    cmd.InError = true;
                    cmd.Response = "Unknown action " + cmd.ActionType;
                    break;
            }
        },

        GetDocumentMarkup: function () {
            var output;
            output = ContentProcessor.Document.URL;
            output += "@@URL@@";
            output += ContentProcessor.Document.documentElement.outerHTML;

            return output;
        },

        GetFrameRectangle: function (frameElement) {

            var frameRect = frameElement.getBoundingClientRect();
            var parentElement = frameElement.__webaii_parentWindow.frameElement;

            var left = frameRect.left;
            var top = frameRect.top;

            while (parentElement) {
                var parentRect = parentElement.getBoundingClientRect();
                left += parentRect.left;
                top += parentRect.top;
                parentElement = parentElement.__webaii_parentWindow.frameElement;
            }

            var calculatedRect = {
                left: left,
                top: top,
                width: frameRect.width,
                height: frameRect.height
            };

            return calculatedRect;
        },

        GetFramePaddingOffset: function (targetFrameElement) {
            function getFramePaddingWithoutJQuery() {
                lp = targetFrameElement.style.paddingLeft ? parseInt(targetFrameElement.style.paddingLeft) : 0;
                tp = targetFrameElement.style.paddingTop ? parseInt(targetFrameElement.style.paddingTop) : 0;
            }

            var tp;
            var lp;
            try {
                if (window.jQuery != null) {
                    lp = jQuery(targetFrameElement).css('padding-left') ? parseInt(jQuery(targetFrameElement).css('padding-left')) : 0;
                    tp = jQuery(targetFrameElement).css('padding-top') ? parseInt(jQuery(targetFrameElement).css('padding-top')) : 0;
                }
                else {
                    getFramePaddingWithoutJQuery();
                }
            }
            catch (ex) {
                getFramePaddingWithoutJQuery();
            }

            return { lp: lp, tp: tp }
        },

        SelectDropDown: function (target, optionString) {
            var selectionType = optionString[0];
            var selectionValue = optionString.slice(2);

            if (selectionType == "V") {
                for (var i = 0; i < target.length; i++) {
                    if (target.options[i].value == selectionValue) {
                        target.selectedIndex = i;
                        break;
                    }
                }
            } else if (selectionType == "T") {
                for (var i = 0; i < target.length; i++) {
                    if (target.options[i].text == selectionValue) {
                        target.selectedIndex = i;
                        break;
                    }
                }
            } else if (selectionType == "I") {
                target.selectedIndex = selectionValue;
            }
        },

        DispatchJavascriptEvent: function (jem) {
            window.postMessage({ message: "teststudio.exec.dispatchJsEvent", data: jem }, "*");
        },

        ToBoolean: function (boolString) {
            return boolString.toLowerCase() == "true";
        },

        AddCommandListener: function (event) {
            if (event.data && event.data.message && event.data.message === "teststudio.exec.processCommand") {
                var command = event.data.data;
                //Process command.
                ContentProcessor.ProcessCommand(command);
                //Post response.
                window.postMessage({ message: "teststudio.exec.processCommandResponse", data: command }, "*");
            }
        }
    }

    //--------------------- Content Processor ---------------------//

    //Listen for commands, comming form content script.
    if (window.constructor.prototype && window.constructor.prototype.addEventListener) {
        window.constructor.prototype.addEventListener.call(window, "message", function (event) {
            ContentProcessor.AddCommandListener(event);
        }, false);
    }
    else {
        window.addEventListener("message", function (event) {
            ContentProcessor.AddCommandListener(event);
        });
    };

    //If this element exists when starting execution, 
    //we'll assume that the extension is installed
    var isInstalledNode = document.createElement('div');
    isInstalledNode.id = 'extension-is-installed';
    document.body.appendChild(isInstalledNode);

    //Notify content script that ContentProcessor is injected.
    window.postMessage({ message: "teststudio.exec.contentProcessorInjected" }, "*");
})();