"use strict";function _defineProperty(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}class RtcPacs{static handleError(e){console.log(e),window.alert(e)}constructor(){this.peer=new Peer(RtcPacs.salt+RtcPacs.adjectives[Math.floor(Math.random()*RtcPacs.adjectives.length)]+RtcPacs.animals[Math.floor(Math.random()*RtcPacs.animals.length)]),this.peer.on("open",this.peerOpen),this.peer.on("disconnected",this.peerDisconnected.bind(this)),this.peer.on("close",this.peerClose),this.peer.on("error",RtcPacs.handleError),this.peer.on("connection",this.peerConnection.bind(this)),this.peer.on("call",this.peerCall.bind(this)),this.codename="",this.controlToggle=!1,this.caseSelect="",this.message="",this.chatroom=[],this.controlCodename="",this.rosterList=[],this.dataConnections=[],this.audioStreams=[],this.activeRoster=[this.peer.id],this.viewerLinked=!1,this.viewerDirty=!1,this.viewerState=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,!1],this.lastViewerUpdate=0,this.audioStream=null,this.microphoneState=RtcPacs.microphoneStates.none,navigator.mediaDevices.getUserMedia({audio:!0,video:!1}).then(function(e){this.audioStream=e,this.microphoneState=RtcPacs.microphoneStates.unmuted}.bind(this)).catch(function(e){RtcPacs.handleError(e),RtcPacs.handleError("Microphone permission denied.  This is not going to work.  Look for an icon in the URL bar, grant mic access and reload the page.")}),this.t1=0,this.t2=0}peerOpen(e){}peerDisconnected(){window.confirm("Disconnected from signaling server!  Try to reconnect?")&&this.peer.reconnect()}peerClose(){}peerConnection(e){e.on("open",this.connectionOpenIncoming.bind(this)),e.on("close",this.connectionClose.bind(this)),e.on("data",this.connectionData.bind(this)),e.on("error",RtcPacs.handleError)}peerCall(e){e.answer(this.audioStream,{sdpTransform:this.transformSdp}),e.on("stream",this.callStream.bind(this)),e.on("close",this.callClose.bind(this)),e.on("error",RtcPacs.handleError)}connectionOpenIncoming(){this.refreshRosters(),this.broadcastRoster()}connectionOpenOutgoing(){this.refreshRosters()}connectionData(e){if(e[0]===RtcPacs.messageTypes.viewer)this.viewerState.some((t,a)=>t!==e[1][a])&&(this.viewerState=e[1],this.viewerDirty=!0);else if(e[0]===RtcPacs.messageTypes.roster){let t=e[1];this.activeRoster.some(e=>{let a=t.every(t=>t!==e);if(a){let e=5e3*Math.random();setTimeout(this.broadcastRoster.bind(this),e)}return a}),t.forEach(e=>{if(this.activeRoster.every(t=>t!==e)){let t=5e3*Math.random();setTimeout(this.connectTo.bind(this),t,e)}})}else e[0]==RtcPacs.messageTypes.chat?this.saveChatMessage(e[1],e[2]):e[0]==RtcPacs.messageTypes.control?e[2]?(this.controlToggle=!1,this.controlCodename=e[1].slice(RtcPacs.salt.length)):this.controlCodename="":e[0]==RtcPacs.messageTypes.image&&(this.caseSelect=e[1])}connectionClose(){this.refreshRosters()}callClose(){this.refreshRosters()}callStream(e){let t=new Audio;t.srcObject=e,t.play(),this.audioStreams.push(t),this.refreshRosters()}connectTo(e){if(!this.activeRoster.includes(e)){let t=this.peer.connect(e,{reliable:!0});t&&(t.on("data",this.connectionData.bind(this)),t.on("open",this.connectionOpenOutgoing.bind(this)),t.on("close",this.connectionClose.bind(this)),t.on("error",RtcPacs.handleError));let a=this.peer.call(e,this.audioStream,{sdpTransform:this.transformSdp});a&&(a.on("stream",this.callStream.bind(this)),a.on("close",this.callClose.bind(this)),a.on("error",RtcPacs.handleError))}this.codename=""}refreshRosters(){this.rosterList=[],this.dataConnections=[],Object.keys(this.peer.connections).forEach(e=>{let t=!1,a=!1;this.peer.connections[e].forEach(e=>{e.open&&("data"===e.type?(t=!0,this.dataConnections.push(e)):"media"===e.type&&(a=!0))}),this.rosterList.push({codename:e.startsWith(RtcPacs.salt)?e.slice(RtcPacs.salt.length):e,data:t,audio:a})}),this.activeRoster=this.rosterList.filter(e=>e.data||e.audio).map(e=>RtcPacs.salt+e.codename),this.activeRoster.push(this.peer.id)}broadcastRoster(){this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.roster,this.activeRoster])),this.controlToggle&&this.takeControl()}takeControl(){this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.control,this.peer.id,!0])),this.broadcastImage(),setTimeout(()=>{this.broadcastViewer()},RtcPacs.broadcastImageDelay)}yieldControl(){this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.control,this.peer.id,!1]))}loadImage(){this.viewerLinked||(papayaContainers[0].viewer.registerDrawViewerCallback(this.broadcastViewer.bind(this)),window.requestAnimationFrame(this.updateViewer.bind(this)),this.viewerLinked=!0);let e=this.caseSelect;papayaContainers[0].viewer.resetViewer(),e&&(papayaContainers[0].viewer.loadBaseImage([e],!0,!1,!1),papayaContainers[0].viewer.zoomFactor=1,this.updateZoomTransforms())}broadcastImage(){this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.image,this.caseSelect]))}updateViewer(e){!this.controlToggle&&this.viewerDirty&&e-this.lastViewerUpdate>RtcPacs.msPerFrame&&(papayaContainers[0].viewer.currentCoord.x=this.viewerState[0],papayaContainers[0].viewer.currentCoord.y=this.viewerState[1],papayaContainers[0].viewer.currentCoord.z=this.viewerState[2],papayaContainers[0].viewer.zoomFactor=this.viewerState[3],papayaContainers[0].viewer.zoomLocX=this.viewerState[4],papayaContainers[0].viewer.zoomLocY=this.viewerState[5],papayaContainers[0].viewer.zoomLocZ=this.viewerState[6],papayaContainers[0].viewer.panLocX=this.viewerState[7],papayaContainers[0].viewer.panLocY=this.viewerState[8],papayaContainers[0].viewer.panLocZ=this.viewerState[9],papayaContainers[0].viewer.panAmountX=this.viewerState[10],papayaContainers[0].viewer.panAmountY=this.viewerState[11],papayaContainers[0].viewer.panAmountZ=this.viewerState[12],papayaContainers[0].viewer.currentScreenVolume&&(papayaContainers[0].viewer.currentScreenVolume.screenMin=this.viewerState[13],papayaContainers[0].viewer.currentScreenVolume.screenMax=this.viewerState[14],papayaContainers[0].viewer.currentScreenVolume.screenRatio=this.viewerState[15]),papayaContainers[0].viewer.container.preferences.showCrosshairs=this.viewerState[16]?"Yes":"No",this.lastViewerUpdate=e,this.viewerDirty=!1,this.updateZoomTransforms(),papayaContainers[0].viewer.drawViewer(!0)),window.requestAnimationFrame(this.updateViewer.bind(this))}updateZoomTransforms(){[papayaContainers[0].viewer.axialSlice,papayaContainers[0].viewer.coronalSlice,papayaContainers[0].viewer.sagittalSlice].forEach(e=>{e&&e.updateZoomTransform(papayaContainers[0].viewer.zoomFactor,papayaContainers[0].viewer.zoomLocX,papayaContainers[0].viewer.zoomLocY,papayaContainers[0].viewer.panAmountX,papayaContainers[0].viewer.panAmountY,papayaContainers[0].viewer)})}broadcastViewer(){this.controlToggle&&(this.viewerState=[papayaContainers[0].viewer.currentCoord.x,papayaContainers[0].viewer.currentCoord.y,papayaContainers[0].viewer.currentCoord.z,papayaContainers[0].viewer.zoomFactor,papayaContainers[0].viewer.zoomLocX,papayaContainers[0].viewer.zoomLocY,papayaContainers[0].viewer.zoomLocZ,papayaContainers[0].viewer.panLocX,papayaContainers[0].viewer.panLocY,papayaContainers[0].viewer.panLocZ,papayaContainers[0].viewer.panAmountX,papayaContainers[0].viewer.panAmountY,papayaContainers[0].viewer.panAmountZ,papayaContainers[0].viewer.currentScreenVolume?papayaContainers[0].viewer.currentScreenVolume.screenMin:0,papayaContainers[0].viewer.currentScreenVolume?papayaContainers[0].viewer.currentScreenVolume.screenMax:100,papayaContainers[0].viewer.currentScreenVolume?papayaContainers[0].viewer.currentScreenVolume.screenRatio:1,"Yes"===papayaContainers[0].viewer.container.preferences.showCrosshairs],this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.viewer,this.viewerState])))}saveChatMessage(e,t){this.chatroom.push({author:e.startsWith(RtcPacs.salt)?e.slice(RtcPacs.salt.length):e,msg:t})}broadcastChatMessage(){this.saveChatMessage(this.peer.id,this.message),this.dataConnections.forEach(e=>e.send([RtcPacs.messageTypes.chat,this.peer.id,this.message])),this.message=""}transformSdp(e){return e}testScrollF(e){this.t1<350?(papayaContainers[0].viewer.currentCoord.z=this.t1%35,papayaContainers[0].viewer.drawViewer(!0),this.t1++,window.requestAnimationFrame(this.testScrollF.bind(this))):this.t1=0}testJumpF(){this.t2<400?(papayaContainers[0].viewer.currentCoord.z=this.t2%35,papayaContainers[0].viewer.drawViewer(!0),this.t2+=4,window.setTimeout(this.testJumpF.bind(this),2400)):this.t2=0}}_defineProperty(RtcPacs,"DEBUG",!1),_defineProperty(RtcPacs,"adjectives",["Agile","Brilliant","Candid","Daring","Eager","Faithful","Gentle","Hungry","Ignorant","Jealous","Kind","Loyal","Majestic","Noisy","Optimistic","Proud","Quirky","Royal","Somber","Tidy","Ultimate","Vibrant","Worried","Youthful","Zesty"]),_defineProperty(RtcPacs,"animals",["Antelope","Beaver","Cheetah","Donkey","Elephant","Fox","Gorilla","Hawk","Iguana","Jaguar","Kangaroo","Leopard","Mongoose","Newt","Octopus","Penguin","Quail","Rooster","Shark","Tiger","Urchin","Vulture","Walrus","Yak","Zebra"]),_defineProperty(RtcPacs,"salt","qwnlcZsz-"),_defineProperty(RtcPacs,"messageTypes",{viewer:0,roster:1,control:2,image:3,chat:4}),_defineProperty(RtcPacs,"broadcastImageDelay",1e4),_defineProperty(RtcPacs,"msPerFrame",1e3/30),_defineProperty(RtcPacs,"microphoneStates",{none:0,unmuted:1,muted:2});let rtcpacs=new RtcPacs;var vm=new Vue({el:"#app",data:rtcpacs,computed:{peerCodeName:function(){return this.peer.id?this.peer.id.slice(RtcPacs.salt.length):"null"},peerCodeNameStyle:function(){return{"font-weight-bold":this.controlToggle,"text-primary":this.controlToggle}},peerBadgeStyle:function(){return{"badge-success":this.peer.open,"badge-warning":this.peer.disconnected&&!this.peer.destroyed,"badge-danger":this.peer.destroyed||!this.peer.open&&!this.peer.disconnected}},peerBadgeText:function(){return this.peer.open?"open":this.peer.destroyed?"destroyed":this.peer.disconnected?"disconnected":"error"}},methods:{connect:function(e){let t=this.codename.toLowerCase().trim(),a=RtcPacs.adjectives.find(e=>t.startsWith(e.toLowerCase())),s=RtcPacs.animals.find(e=>t.endsWith(e.toLowerCase())),i=a&&s?RtcPacs.salt+a+s:RtcPacs.salt+this.codename;this.$data.connectTo(i)},sendChatMessage:function(e){this.$data.broadcastChatMessage()},changeControl:function(e){this.controlToggle?(this.controlCodename=this.peerCodeName,this.$data.takeControl()):this.$data.yieldControl()},connectionCodeNameStyle:function(e){return{"font-weight-bold":e.codename===this.controlCodename,"text-primary":e.codename===this.controlCodename}},connectionBadgeStyle:function(e,t){return e[t]?"badge-success":"badge-danger"},messageStyle:function(e){return e.author===this.peerCodeName?"bg-light text-dark text-right ml-4":"bg-dark text-light text-left mr-4"},audioStatusToggle:function(){if(this.audioStream){let e=!this.audioStream.getAudioTracks()[0].enabled;this.audioStream.getAudioTracks()[0].enabled=e,this.microphoneState=e?RtcPacs.microphoneStates.unmuted:RtcPacs.microphoneStates.muted}else this.microphoneState=RtcPacs.microphoneStates.none},testScroll:function(){this.$data.testScrollF()},testJump:function(){this.$data.testJumpF()}},watch:{caseSelect:function(){this.$data.loadImage(),this.$data.controlToggle&&(this.$data.broadcastImage(),setTimeout(()=>{this.$data.broadcastViewer()},RtcPacs.broadcastImageDelay))},chatroom:function(){this.$nextTick(()=>{this.$refs.chatroom.scrollTop=this.$refs.chatroom.scrollHeight})}}});
