var checkInterval;
var processorInjected = false;
var alreadyInjected = false;

function HandleWindowMessage(event) {
    if (!event) return;
    if (!event.data) return;
    if (!event.data.message) return;

    if (window.closed) {
        console.log('Window already closed. Ignoring message.');
        return;
    }

    switch (event.data.message) {

        case "teststudio.exec.contentProcessorInjected":
            processorInjected = true;
            break;

        case "teststudio.exec.processCommandResponse":
        case "teststudio.exec.dispatchJsEvent":
            //Just redirect to background
            chrome.runtime.sendMessage(event.data);
            break;

        case "teststudio.exec.enableExecution":
            chrome.runtime.sendMessage(event.data);
            CheckIsAutomated();
            break;

    }
}

function CheckIsAutomated() {
    chrome.runtime.sendMessage({ message: "teststudio.exec.isAutomated" }, function (response) {
        if (!response) return;

        clearInterval(checkInterval);        

        if (response.state && !alreadyInjected) {
            //Inject content processor            
            var processorScript = document.createElement('script');
            processorScript.type = 'text/javascript';
            processorScript.src = chrome.extension.getURL('contentProcessor.js');
            document.body.appendChild(processorScript);

            alreadyInjected = true;
        }
    });
}

function PostToWindow(command) {
    if (processorInjected) {
        window.postMessage(command, "*");
    }
    else {
        window.setTimeout(function () {
            PostToWindow(command);
        }, 50);
    }
}

//Start - work with top window only
if (window === window.top) {

    //Start listening extension background messages
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        var response = {};
        var msgObj = JSON.parse(message);
        if (!msgObj.message) return;

        switch (msgObj.message) {
            case "teststudio.exec.getPageInfo":
                response.title = document.title;
                if (!response.title) {
                    response.title = window.location.host;
                    if (window.location.pathname.length !== 1) {
                        response.title = response.title + window.location.pathname;
                    }
                }
                response.title = unescape(response.title);
                response.version = window.navigator.appVersion.match(/Chrome\/([^ ]*)/)[1];
                break;

            case "teststudio.exec.processCommand":
                //Redirect to window
                PostToWindow(msgObj);
                break;

            case "teststudio.exec.started":
                CheckIsAutomated();
                break;
        }

        sendResponse(response);
    });

    //Start listening windows messages
    window.addEventListener("message", HandleWindowMessage);

    chrome.runtime.sendMessage({ message: "teststudio.exec.tabLoaded" });

    checkInterval = window.setInterval(function () {
        CheckIsAutomated();
    }, 100);

    CheckIsAutomated();
}