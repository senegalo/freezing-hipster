#!/usr/bin/env node
Server = {
    connections: {},
    connectionsID: 0,
    init: function() {
        var self = this;
        
        var WebSocketServer = require('websocket').server;
        var http = require('http');
        var server = http.createServer(function(request, response) {
            Server.logEvent('Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });

        server.listen(8080, function() {
            Server.logEvent('Server is listening on port 8080');
        });

        var wsServer = new WebSocketServer({
            httpServer: server,
            autoAcceptConnections: false
        });

        wsServer.on('request', function(request) {
            //if (!Server.originIsAllowed(request.origin)) {
                // Make sure we only accept requests from an allowed origin
             //   request.reject();
              //  Server.logEvent('Connection from origin ' + request.origin + ' rejected.');
              //  return;
            //}
         // Server.logEvent(self)  
            self.acceptConnection(request);
        });
    },
    
    acceptConnection: function (request) {
        var self = this;
        var guid = this.getGUID();
        var connection = request.accept('test-protocol', request.origin);
        
        this.connections[guid] = {
            connection: connection,
            pairedWith: false
        };
        Server.logEvent("sending:"+ guid);
        connection.send(guid);

        connection.on('message', function (message) {
            Server.logEvent("message received:" + JSON.stringify(message));
            var conObj = self.connections[guid];
            if(conObj.pairedWith === false){
              Server.logEvent("pairing " + guid + " with " + message.utf8Data);
                self.connections[guid].pairedWith = message.utf8Data;
                self.connections[message.utf8Data].pairedWith = guid;
            } else {
               Server.logEvent(conObj.pariedWith + " " + self.connections[conObj.pariedWith])
                self.connections[conObj.pariedWith].connection.send(message.utf8Data);
            }
        });

        connection.on('close', function (reasonCode, description) {
            var pairID = self.connections[guid].pairedWith;
            self.connections[pairID] && self.connections[pairID].connection.close();
            Server.logEvent('Peer ' + connection.remoteAddress + ' disconnected.');
            delete self.connections[guid];
            delete self.connections[pairID];
        });
    },
    
    getGUID: function(){
        return this.connectionsID++;
    },

    logEvent: function(message){
        console.log(message);
    }
};

Server.init();
