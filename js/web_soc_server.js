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
                    Server.logEvent("Recived Message...");
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
        var state = this.convertStateToObject(cmd.state);
        this.players[cmd.connection.remoteAddress] = {
            connection: cmd.connection,
            engaged: false,
            initialState: state,
            state: this.extend({},state)
        };
        var player = this.players[cmd.connection.remoteAddress];
        for (var p in this.players) {
            var op = this.players[p];
            if (p === cmd.connection.remoteAddress) {
                op.connection.send("Waiting for opponent !");
                continue;
            }
            if (!op.engaged) {
                op.engaged = true;
                op.playingWith = cmd.connection.remoteAddress;
                op.turn = 1; 
                player.engaged = true;
                player.playingWith = p;
                player.turn = 2;
                Server.logEvent("Connecting "+player.connection.remoteAddress+" With "+op.connection.remoteAddress);
                this.syncActions(player,op,"newSession");
                op.connection.send("You are Player 1");
                player.connection.send ("You are Player 2");
                break;
            }
        }
    },
    /*actionCommand: function(cmd) {
        var player = this.players[cmd.connection.remoteAddress];
        var op = this.players[player.playingWith];
        if(op.state[cmd.target]){
            op.state[cmd.target].hp += cmd.impact;
            Server.logEvent("Unit ID: "+cmd.target+" For User: " + op.connection.remoteAddress + " Current Health: "+op.state[cmd.target].hp);
            this.syncActions(player,op,"sync");
        } else {
            player.connection.send("NO TROUPS FOUND WITH ID "+cmd.target);
        }
    },*/

    beingHitCommand: function(cmd){
        var player = this.players[cmd.connection.remoteAddress];
        var op = this.players[player.playingWith];
        Server.sendObject(op.connection, {
            damage: cmd.damage;
        });
    },

    hitCommand: function(cmd){
        var player = this.players[cmd.connection.remoteAddress];
        var op = this.players[player.playingWith];
        Server.sendObject(op.connection, {
            damage: cmd.target;
        });
    },

    endTurnCommand: function(cmd){
        var player = this.players[cmd.connection.remoteAddress];
        var op = this.players[player.playingWith];
        player.playing = false;
        op.playing = true;
        this.syncActions(player,op,"sync");
    },

    syncActions: function(player, op, type) {
        Server.logEvent("Syncying Sessions...");
        Server.sendObject(player.connection, {
            playing: player.playing,
            type: type
        });
        Server.sendObject(op.connection, {
            playing: op.playing,
            type: type
        });
    },
    /*convertStateToArray: function(state){
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
        if(player.engaged){
            var op = this.players[player.playingWith];
            Server.sendObject(op.connection,{
                type: "connectionClosed"
            });
            op.engaged = false;
            op.state = this.extend({},op.initialState);
        }
        delete this.players[id];
    } */
};

Server.init();