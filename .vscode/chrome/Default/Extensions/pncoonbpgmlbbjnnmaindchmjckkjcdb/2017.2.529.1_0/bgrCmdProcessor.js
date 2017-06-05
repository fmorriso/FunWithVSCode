//console.log("Background Command Processor loaded");

var bgrCmdProcessor;
if (!bgrCmdProcessor) {
    bgrCmdProcessor = {

        GetErrorText: function (err) {
            if (err.message)
                return err.message;
            else
                return err;
        },

        ProcessClearCookie: function (command, callback) {
            try {
                var details;
                if (command.Data) {
                    // Transform a cookie wrapper into the getAll filter details
                    var details = JSON.parse(command.Data);
                    delete details.expirationDate;
                    delete details.httpOnly;
                    delete details.value;

                    if (!details.name && details.name != undefined)
                        delete details.name;
                    if (!details.path && details.path != undefined)
                        delete details.path;
                    if (!details.secure && details.secure != undefined)
                        delete details.secure;
                } else {
                    // Clear all cookies
                    details = {};

                    // Clear local storage
                    chrome.browsingData.removeLocalStorage({ "since": 0 }, function () {
                    });
                }

                chrome.cookies.getAll(details, function (cookies) {
                    try {
                        if (cookies) {
                            for (var i = 0; i < cookies.length; i++) {
                                var toDelete = { name: cookies[i].name, storeId: cookies[i].storeId };
                                var domain = cookies[i].domain;
                                if (domain[0] == '.')
                                    domain = domain.slice(1);
                                var prefix = cookies[i].secure ? "https://" : "http://";
                                toDelete.url = prefix + domain + cookies[i].path;
                                chrome.cookies.remove(toDelete);
                            }
                        }
                    } catch (err) {
                        command.InError = true;
                        command.Response = bgrCmdProcessor.GetErrorText(err);
                    }

                    callback(true, command);
                });
            } catch (err) {

                command.InError = true;
                command.Response = bgrCmdProcessor.GetErrorText(err);

                callback(true, command);
            }
        },

        ProcessGetCookies: function (command, callback) {
            // Get cookies for url and return them as a ';'-separated list of name-value pairs

            try {
                var details = { url: command.Data };
                chrome.cookies.getAll(details, function (cookies) {
                    try {
                        var response = "";
                        for (var i = 0; i < cookies.length; i++) {
                            response += cookies[i].name + "=" + cookies[i].value + ";";
                        }

                        command.Response = response;

                    } catch (err) {
                        command.InError = true;
                        command.Response = bgrCmdProcessor.GetErrorText(err);
                    }

                    callback(true, command);
                });
            } catch (err) {
                command.InError = true;
                command.Response = bgrCmdProcessor.GetErrorText(err);

                callback(true, command);
            }
        },

        ProcessSetCookie: function (command, callback) {
            // Get cookies for url and return them as a ';'-separated list of name-value pairs

            try {
                if (command.Data) {
                    var details = JSON.parse(command.Data);

                    chrome.cookies.set(details, function (cookies) {

                        command.Response = true;
                        callback(true, command);
                    });
                }
            } catch (err) {
                command.InError = true;
                command.Response = bgrCmdProcessor.GetErrorText(err);

                callback(true, command);
            }
        },

        ProcessClearHistory: function (command, callback) {
            try {
                chrome.history.deleteAll(function () { }); // No need to do anything in the callback				

            } catch (err) {
                command.InError = true;
                command.Response = bgrCmdProcessor.GetErrorText(err);
            }

            callback(true, command);
        },

        ProcessClearFilesCache: function (command, callback) {
            try {
                chrome.browsingData.removeCache({ "since": 0 });

            } catch (err) {
                command.InError = true;
                command.Response = bgrCmdProcessor.GetErrorText(err);
            }

            callback(true, command);
        },

        ProcessCommand: function (command, callback) {
            if (command == undefined) {
                //Nothing to process
                callback(false, command);

            } else if (command.InformationType == 6) {
                //Get Cookies
                bgrCmdProcessor.ProcessGetCookies(command, callback);

            } else if (command.ActionType == 16) {
                //Set Cookie
                bgrCmdProcessor.ProcessSetCookie(command, callback);

            } else if (command.ActionType == 20) {
                // ClearHistory
                bgrCmdProcessor.ProcessClearHistory(command, callback);

            } else if (command.ActionType == 21) {
                // Clear files cache
                bgrCmdProcessor.ProcessClearFilesCache(command, callback);

            } else if (command.ActionType == 23) {
                // ClearCookies
                bgrCmdProcessor.ProcessClearCookie(command, callback);

            } else {
                //Not a background specific command
                callback(false, command);
            }
        },
    }
}