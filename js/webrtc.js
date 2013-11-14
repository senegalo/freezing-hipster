var servers = { 
  iceServers: [{ url: 'stun:stun.l.google.com:19302' }] 
};

var pc = new webkitRTCPeerConnection(servers, {optional: [{RtpDataChannels: true}]});

pc.ondatachannel = function(event) {
  receiveChannel = event.channel;
  receiveChannel.onmessage = function(event){
    document.querySelector("div#receive").innerHTML = event.data;
  };
};

sendChannel = pc.createDataChannel("sendDataChannel", {reliable: false});

document.querySelector("button#send").onclick = function (){
  var data = document.querySelector("textarea#message").value;
  sendChannel.send(data);
};
