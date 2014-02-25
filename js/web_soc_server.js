#!/usr/bin/env node
Server = {
    init: function() {
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
            if (!Server.originIsAllowed(request.origin)) {
                // Make sure we only accept requests from an allowed origin
                request.reject();
                Server.logEvent('Connection from origin ' + request.origin + ' rejected.');
                return;
            }

            var connection = request.accept('test-protocol', request.origin);
            connection.on('message', function(message) {
                if (message.type === 'utf8') {
                    Server.logEvent("Recived Message..." + message.utf8Data);
                    var parsedMsg = JSON.parse(message.utf8Data);
                    if (Commands[parsedMsg.type + "Command"]) {
                        Server.logEvent("Recived Command...");
                        parsedMsg.connection = connection;
                        Commands[parsedMsg.type + "Command"](parsedMsg);
                    }
                }
            });
            connection.on('close', function(reasonCode, description) {
                Server.logEvent('Peer ' + connection.remoteAddress + ' disconnected.');
                Commands.closeConnection(connection.remoteAddress);
            });
        });
    },
    originIsAllowed: function(origin) {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    },
    sendObject: function(connection, obj) {
        var str = JSON.stringify(obj);
        Server.logEvent("sending data...");
        connection.send(str);
    },
    logEvent: function(msg){
        console.log((new Date()) + msg);
    }
};

Commands = {
    extend: require('util')._extend,
    players: {},
    initCommand: function(cmd) {
        var state = { 
          score: 0
        };
        this.players[this.getPlayerKey(cmd.connection)] = {
            connection: cmd.connection,
            engaged: false,
            initialState: state,
            state: this.extend({},state)
        };
        var player = this.players[this.getPlayerKey(cmd.connection)];
        for (var p in this.players) {
            var op = this.players[p];
            if (p === this.getPlayerKey(cmd.connection)) {
                continue;
            }
            if (!op.engaged) {
                op.engaged = true;
                op.playingWith = this.getPlayerKey(cmd.connection);
                op.state.isMyTurn = false;
                player.engaged = true;
                player.state.isMyTurn = true;
                player.playingWith = p;
                Server.logEvent("Connecting "+player.connection.remoteAddress+" With "+op.connection.remoteAddress);
                this.syncActions(player,op,"newSession");
                break;
            }
        }
    },
    actionCommand: function(cmd) {
        var player = this.players[this.getPlayerKey(cmd.connection)];
        var op = this.players[player.playingWith];
        

        player.state = cmd.state
        player.state.isMyTurn = false;
        op.state.isMyTurn = true;
        this.syncActions(player,op,"sync");
    },
    syncActions: function(player, op, type) {
        Server.logEvent("Syncying Sessions: "+type);
        Server.logEvent(JSON.stringify(player.state));
        Server.logEvent(JSON.stringify(op.state));
        Server.sendObject(player.connection, {
            type: type,
            yourState: player.state,
            opState: op.state
        });
        Server.sendObject(op.connection, {
            type: type,
            yourState: op.state,
            opState: player.state
        });
    },
    convertStateToArray: function(state){
        var out = [];
        for(var s in state){
            out.push(state[s]);
        }
        return out;
    },
    convertStateToObject: function(state){
        var out = {};
        for(var s in state){
            out[state[s].id] = state[s];
        }
        return out;
    },
    closeConnection: function(id){
        var player = this.players[id];
        if(player && player.engaged){
            var op = this.players[player.playingWith];
            Server.sendObject(op.connection,{
                type: "connectionClosed"
            });
            op.engaged = false;
            op.state = this.extend({},op.initialState);
        }
        delete this.players[id];
    },
    getPlayerKey: function(connection){
      return connection.remoteAddress+":"+connection.socket.remotePort
    }
};

Server.init();
