//console.log("Background loaded");

var initialTab = 0;
var automatedTabs = { };
var wSocket = null;
var trackNewBrowsers = false;
var commandMessageQueue = new Array();
var messageCommandInterval = null;
var wSocketErrror = false;

function CleanUp ()
{
    wSocket = null;
    if (!wSocketErrror) {
        initialTab = 0;
        automatedTabs = { };
        trackNewBrowsers = false;
    }
}

function CreateUUID()
{
    // From http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8; return v.toString(16); });
}

function FindTabIdByUiid(uuid) {
    for (tabId in automatedTabs) {
        if (automatedTabs[tabId] == uuid) {
            return parseInt(tabId);
        }
    }

    return null;
}

function GetQueryParameterByName(url, paramName) {
    paramName = paramName.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + paramName + "=([^&#]*)"),
        results = regex.exec(url);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}


function SendMessageToTab(tabId, message, data, callback) {

    chrome.tabs.get(tabId, function (tab) { //Get the 'tab'

        if (tab.status === 'complete') { //Make sure the tab has loaded before sending the message
            var tabMsg = JSON.stringify({ message: message, data: data });
            chrome.tabs.sendMessage(tabId, tabMsg, callback);
        }
        else {
            if (data && data.CommandType == 1 && data.InformationType == 5) {

                data.Response = false;

                var response = { message: "execution.setCommandResponse", data: data };
                SendSocketMessage(JSON.stringify(response));
            }
            else {
                setTimeout(function () { //Wait for the tab to become responsive

                    SendMessageToTab(tabId, message, data, callback);
                }, 100);
            }
        }      
    });
}


function NotifyNewBrowserConnected(tabId) {
    setTimeout(function () {
        chrome.tabs.get(tabId, function (tab) {
            if (tab.url.indexOf("chrome://") != -1) {
                return;
            }

            SendMessageToTab(tabId, "teststudio.exec.getPageInfo", null, function (response) {
                var connectParams = { clientId: automatedTabs[tabId], pageTitle: response.title, version: response.version, browserType: "Chrome", tabId: tabId, windowId: tab.windowId };
                var message = { message: "execution.connect", data: connectParams };
                SendSocketMessage(JSON.stringify(message));
            });
        });
    }, 100);
}


function NotifyBrowserClosed(tabId) {
    if (wSocket) {
        var message = { message: "execution.disconnect", data: automatedTabs[tabId] };
        wSocket.send(JSON.stringify(message));
    }
}

function OnWebSocketOpened() {
    if (wSocketErrror) {
        NotifyBrowserClosed(initialTab);
    }
    wSocketErrror = false;

    if (commandMessageQueue) {
        for (var ii = 0; ii < commandMessageQueue.length; ii++) {
            //Socket is opened - just send the message
            wSocket.send(commandMessageQueue[ii]);
        }
        commandMessageQueue = [];
    }

    NotifyNewBrowserConnected(initialTab);
}

function OnWebSocketMessage(message) {
    var messageObj = JSON.parse(message.data);
    if (messageObj.message != "execution.executeCommand") return;

    var cmd = messageObj.data;
    if (!cmd) return;

    switch (cmd.CommandType)//Config command
    {        
        case 4://Config command
            var data = JSON.parse(cmd.Data);
            trackNewBrowsers = data.TrackNewBrowsers;
            break;

        case 1://Information command
            var tabId = FindTabIdByUiid(cmd.ClientId);

            bgrCmdProcessor.ProcessCommand(cmd, function (handled, resultCmd) {
                if (!handled) {
                    //Delegate the message to the corresponding tab
                    var sendMsgInterval = setInterval(function () {
                        SendMessageToTab(tabId, "teststudio.exec.processCommand", cmd, function (response) {

                            if (!response)
                                return;
                            
                            clearInterval(sendMsgInterval);
                        });
                    }, 100);
                }
                else {
                    var response = { message: "execution.setCommandResponse", data: resultCmd };
                    SendSocketMessage(JSON.stringify(response));
                }
            });
            break;

        default://Execution command            
            var tabId = FindTabIdByUiid(cmd.ClientId);

            //First send to the bgrCmdProcessor
            bgrCmdProcessor.ProcessCommand(cmd, function (handled, resultCmd) {
                if (!handled) {
                    //Delegate the message to the corresponding tab   
                    SendMessageToTab(tabId, "teststudio.exec.processCommand", cmd);             
                }
                else {
                    var response = { message: "execution.setCommandResponse", data: resultCmd };
                    SendSocketMessage(JSON.stringify(response));
                }
            });
            break;
    }
}

function Initialize(tabId, port) {

    if (initialTab !== tabId) {
        automatedTabs[tabId] = CreateUUID();
    } 
    initialTab = tabId;

    if (wSocket === null) {
        wSocket = new WebSocket("ws://localhost:" + port);
        wSocket.onopen = OnWebSocketOpened;
        wSocket.onmessage = OnWebSocketMessage;
        wSocket.onerror = function () {
            wSocketErrror = true;
        }
        wSocket.onclose = CleanUp;
    }
    else {
        NotifyNewBrowserConnected(initialTab);
    }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!sender.tab) return;
    if (!request.message) return;

    switch (request.message) {        
        case "teststudio.exec.isAutomated":
            var isAutomated = automatedTabs[sender.tab.id] != undefined;
            sendResponse({ state: isAutomated });
            break;

        case "teststudio.exec.processCommandResponse":
            var response = { message: "execution.setCommandResponse", data: request.data };
            SendSocketMessage(JSON.stringify(response));
            break;

        case "teststudio.exec.dispatchJsEvent":
            var response = { message: "execution.dispatchJsEvent", data: request.data };
            wSocket.send(JSON.stringify(response));
            break;

        case "teststudio.exec.enableExecution":
            if (request.data.port) {
                Initialize(sender.tab.id, request.data.port);
            }
            break;
        case "teststudio.exec.tabLoaded":
            chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
                InitializeChromeStartingTab(tabs[0]);
            });
            break;
    }
});

function SendSocketMessage(msg) {

    switch (wSocket.readyState) {
        case 1: //Socket is opened - just send the message            
            wSocket.send(msg);
            break;

        case 0: //Connecting: wait til socket is opened
            commandMessageQueue.push(msg);
            break;

        default:
            console.log("Cannot send the message. Socket is closed or closing");
            break;
    }
} 

function InitializeChromeStartingTab(tab) {   
    if (tab && tab.url.indexOf("/WebUI/Automation.Start?") != -1) {
        
        initialTab = tab.id;
        automatedTabs[initialTab] = CreateUUID();
        SendMessageToTab(initialTab, "teststudio.exec.started");
        var port = GetQueryParameterByName(tab.url, "port")
        Initialize(initialTab, port);
    }
}

chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    InitializeChromeStartingTab(tabs[0]);
});

chrome.tabs.onCreated.addListener(function (tab) {
    InitializeChromeStartingTab(tab);

    if (trackNewBrowsers) {
        automatedTabs[tab.id] = CreateUUID();

        NotifyNewBrowserConnected(tab.id);
    }
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    if (automatedTabs[tabId]) {
        NotifyBrowserClosed(tabId);
        delete automatedTabs[tabId];
    }
});

chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    if (automatedTabs[removedTabId]) {        
        automatedTabs[addedTabId] = automatedTabs[removedTabId];
        delete automatedTabs[removedTabId];
    }
});